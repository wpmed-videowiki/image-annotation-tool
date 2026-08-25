// wbeditentity payload for Structured Data on Commons. Captions -> labels,
// main subjects -> P180. Location statements are gated behind SDC_WRITE_LOCATION
// (UploadWizard itself only writes {{Location}} wikitext).

import {
  MAX_CAPTION_LENGTH,
  SDC_ITEM_FILE_ON_THE_INTERNET,
  SDC_ITEM_ORIGINAL_CREATION,
  SDC_PROPERTY_DEPICTS,
  SDC_PROPERTY_DESCRIBED_AT_URL,
  SDC_PROPERTY_HEADING,
  SDC_PROPERTY_INCEPTION,
  SDC_PROPERTY_POV_COORDINATES,
  SDC_PROPERTY_SOURCE_OF_FILE,
  SDC_WRITE_LOCATION,
  WIKIDATA_GLOBE_EARTH,
  WIKIDATA_UNIT_DEGREE,
} from "../config/constants.js";

const entityStatement = (property, qid) => ({
  mainsnak: {
    snaktype: "value",
    property,
    datavalue: {
      type: "wikibase-entityid",
      value: {
        "entity-type": "item",
        "numeric-id": Number(qid.slice(1)),
        id: qid,
      },
    },
  },
  type: "statement",
  rank: "normal",
});

// P571 with day precision, same shape UploadWizard writes
const inceptionStatement = (date) => ({
  mainsnak: {
    snaktype: "value",
    property: SDC_PROPERTY_INCEPTION,
    datavalue: {
      type: "time",
      value: {
        time: `+${date}T00:00:00Z`,
        timezone: 0,
        before: 0,
        after: 0,
        precision: 11,
        calendarmodel: "http://www.wikidata.org/entity/Q1985727",
      },
    },
  },
  type: "statement",
  rank: "normal",
});

const FIRST_URL_RE = /https?:\/\/[^\s\]|<>"]+/;

// P7482 source of file, like UploadWizard: own work or "available on the
// internet" + P973 URL qualifier. Non-URL third-party sources are skipped.
const sourceStatement = (metadata) => {
  if (metadata.rights.ownership === "own") {
    return entityStatement(SDC_PROPERTY_SOURCE_OF_FILE, SDC_ITEM_ORIGINAL_CREATION);
  }
  if (metadata.rights.ownership !== "third-party") return null;
  const url = (metadata.rights.thirdParty.source || "").match(FIRST_URL_RE)?.[0];
  if (!url) return null;
  const statement = entityStatement(
    SDC_PROPERTY_SOURCE_OF_FILE,
    SDC_ITEM_FILE_ON_THE_INTERNET
  );
  statement.qualifiers = {
    [SDC_PROPERTY_DESCRIBED_AT_URL]: [
      {
        snaktype: "value",
        property: SDC_PROPERTY_DESCRIBED_AT_URL,
        datavalue: { type: "string", value: url },
      },
    ],
  };
  statement["qualifiers-order"] = [SDC_PROPERTY_DESCRIBED_AT_URL];
  return statement;
};

const coordinateStatement = ({ lat, lon, heading }) => {
  const statement = {
    mainsnak: {
      snaktype: "value",
      property: SDC_PROPERTY_POV_COORDINATES,
      datavalue: {
        type: "globecoordinate",
        value: {
          latitude: lat,
          longitude: lon,
          // matches the normalizer's 6 decimal rounding
          precision: 0.000001,
          globe: WIKIDATA_GLOBE_EARTH,
        },
      },
    },
    type: "statement",
    rank: "normal",
  };

  if (heading !== null && heading !== undefined) {
    statement.qualifiers = {
      [SDC_PROPERTY_HEADING]: [
        {
          snaktype: "value",
          property: SDC_PROPERTY_HEADING,
          datavalue: {
            type: "quantity",
            value: {
              // Wikibase wants an explicit sign, as a string
              amount: `${heading >= 0 ? "+" : ""}${heading}`,
              unit: WIKIDATA_UNIT_DEGREE,
            },
          },
        },
      ],
    };
    statement["qualifiers-order"] = [SDC_PROPERTY_HEADING];
  }

  return statement;
};

/**
 * @returns {{labels: object, claims: object[]}|null} null when there is nothing to
 *   write, so callers can skip the API round-trip entirely.
 */
export const buildStructuredData = (metadata) => {
  if (!metadata || metadata.version !== 1) return null;

  const labels = {};
  for (const caption of metadata.describe.captions || []) {
    if (!caption.text) continue;
    labels[caption.lang] = {
      language: caption.lang,
      value: caption.text.slice(0, MAX_CAPTION_LENGTH),
    };
  }

  const claims = [];
  for (const entry of metadata.describe.depicts || []) {
    if (entry?.id) claims.push(entityStatement(SDC_PROPERTY_DEPICTS, entry.id));
  }

  if (metadata.describe.date) {
    claims.push(inceptionStatement(metadata.describe.date));
  }

  const source = sourceStatement(metadata);
  if (source) claims.push(source);

  const location = metadata.describe.location;
  if (
    SDC_WRITE_LOCATION &&
    location &&
    location.lat !== null &&
    location.lat !== undefined &&
    location.lon !== null &&
    location.lon !== undefined
  ) {
    claims.push(coordinateStatement(location));
  }

  if (!Object.keys(labels).length && !claims.length) return null;
  return { labels, claims };
};

// drop values the entity already has so retries don't duplicate statements
export const diffStructuredData = (data, existing) => {
  if (!existing) return data;

  const labels = {};
  for (const [lang, label] of Object.entries(data.labels)) {
    if (existing.labels?.[lang]?.value !== label.value) labels[lang] = label;
  }

  const existingClaims = existing.statements || existing.claims || {};
  const claims = data.claims.filter((claim) => {
    const property = claim.mainsnak.property;
    const current = existingClaims[property] || [];
    return !current.some(
      (other) =>
        JSON.stringify(other?.mainsnak?.datavalue?.value) ===
        JSON.stringify(claim.mainsnak.datavalue.value)
    );
  });

  if (!Object.keys(labels).length && !claims.length) return null;
  return { labels, claims };
};
