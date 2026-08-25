// Metadata shape, normalization and validation for the upload wizard.
// Pure ESM (no next/react/mongoose imports) so the client, the server action and the
// video worker can all use it. Explicit .js extensions because the worker runs on
// bare Node without the "@/*" alias.

import {
  CREATOR_LICENSE_VALUES,
  HEIR_LICENSE_VALUES,
  OTHERS_WORK_VALUES,
  OWNERSHIP_VALUES,
  OWN_ORIGINALITY_VALUES,
  OWN_WORK_LICENSE_VALUES,
  PERMISSION_LICENSE_VALUES,
  PUBLIC_DOMAIN_VALUES,
  THIRD_PARTY_REASON_VALUES,
} from "../config/commonsLicenses.js";
import {
  MAX_AI_PROMPT_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_CATEGORIES,
  MAX_CUSTOM_TEMPLATE_LENGTH,
  MAX_DEPICTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_FILENAME_LENGTH,
  MAX_SOURCE_LENGTH,
} from "../config/constants.js";

export const METADATA_VERSION = 1;

// factory so callers can mutate their copy
export const EMPTY_METADATA = () => ({
  version: METADATA_VERSION,
  rights: {
    ownership: "",
    own: {
      originality: "",
      othersWork: "",
      aiEngine: "",
      aiPrompt: "",
      license: "",
      customLicense: "",
    },
    thirdParty: {
      reason: "",
      creatorLicense: "",
      heirLicense: "",
      publicDomain: [],
      customPd: "",
      permissionLicense: "",
      customLicense: "",
      source: "",
      aiGenerated: false,
      author: "",
      authorUnknown: false,
      aiAuthor: "",
      aiAuthorUnknown: false,
    },
  },
  describe: {
    title: "",
    captions: [{ lang: "en", text: "" }],
    sameAsCaption: true,
    descriptions: [{ lang: "en", text: "" }],
    date: "",
    depicts: [],
    categories: [],
    location: { lat: null, lon: null, heading: null },
    otherInformation: "",
  },
});

// selections that block the upload entirely (different UI than field errors)
export const BLOCKING_CODES = [
  "others_work_copyright_protected",
  "others_work_unknown",
  "third_party_reason_unknown",
  "creator_license_unknown",
];

const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const QID_RE = /^Q[1-9]\d*$/;
const TEMPLATE_RE = /\{\{[^{}]+\}\}/;
// forbidden in MediaWiki titles ("~~~" would get signature-substituted)
const ILLEGAL_TITLE_RE = /[#<>[\]|{}:/]|~~~/;

const str = (value) => (typeof value === "string" ? value.trim() : "");
const bool = (value) => value === true;

const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round6 = (value) => Math.round(value * 1e6) / 1e6;

const err = (errors, field, code) => {
  errors.push({ field, code });
};

// drop blank rows, lowercase langs, first row wins on duplicate language
const normalizeRows = (rows, { field, maxLength, errors }) => {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const result = [];
  rows.forEach((row, index) => {
    const text = str(row?.text);
    if (!text) return;
    const lang = str(row?.lang).toLowerCase();
    if (!LANG_RE.test(lang)) {
      err(errors, `${field}.${index}.lang`, "invalid_lang");
      return;
    }
    if (seen.has(lang)) {
      err(errors, `${field}.${index}.lang`, "duplicate_lang");
      return;
    }
    if (text.length > maxLength) {
      err(errors, `${field}.${index}.text`, "too_long");
      return;
    }
    // raw template syntax would break the {{lang|1=...}} wrapper
    if (text.includes("{{") || text.includes("}}")) {
      err(errors, `${field}.${index}.text`, "no_templates");
      return;
    }
    seen.add(lang);
    result.push({ lang, text });
  });
  return result;
};

const normalizeCustomTemplate = (value, { field, errors, required }) => {
  const text = str(value);
  if (!text) {
    if (required) err(errors, field, "required");
    return "";
  }
  if (text.length > MAX_CUSTOM_TEMPLATE_LENGTH) {
    err(errors, field, "too_long");
    return "";
  }
  if (!TEMPLATE_RE.test(text)) {
    err(errors, field, "not_a_template");
    return "";
  }
  // block subst:, raw HTML and inline category links
  if (/<|\[\[Category:|subst:/i.test(text)) {
    err(errors, field, "not_a_template");
    return "";
  }
  return text;
};

const normalizeTitle = (value, errors, extension) => {
  const title = str(value)
    .replace(/^File:/i, "")
    .replace(/\s+/g, "_");
  if (!title) {
    err(errors, "describe.title", "required");
    return "";
  }
  if (ILLEGAL_TITLE_RE.test(title)) {
    err(errors, "describe.title", "invalid_chars");
    return "";
  }
  if (/^[._]|[._]$/.test(title)) {
    err(errors, "describe.title", "invalid_chars");
    return "";
  }
  // server rejects longer titles, better to catch it here
  if (`File:${title}.${extension}`.length > MAX_FILENAME_LENGTH) {
    err(errors, "describe.title", "too_long");
    return "";
  }
  return title;
};

const normalizeDate = (value, errors) => {
  const date = str(value);
  if (!date) {
    err(errors, "describe.date", "required");
    return "";
  }
  if (!DATE_RE.test(date)) {
    err(errors, "describe.date", "invalid_date");
    return "";
  }
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1000) {
    err(errors, "describe.date", "invalid_date");
    return "";
  }
  if (month !== undefined) {
    const parsed = new Date(Date.UTC(year, month - 1, day || 1));
    const validMonth = parsed.getUTCMonth() === month - 1;
    const validDay = day === undefined || parsed.getUTCDate() === day;
    if (!validMonth || !validDay) {
      err(errors, "describe.date", "invalid_date");
      return "";
    }
  }
  // 36h slack for timezones
  const parts = [year, month || 1, day || 1];
  const asUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  if (asUtc > Date.now() + 36 * 60 * 60 * 1000) {
    err(errors, "describe.date", "future_date");
    return "";
  }
  return date;
};

const normalizeDepicts = (value, errors) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  value.forEach((entry, index) => {
    const id = str(entry?.id);
    if (!QID_RE.test(id)) {
      err(errors, `describe.depicts.${index}`, "invalid_entity");
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    // label/description are just for the review screen, only id reaches Commons
    result.push({ id, label: str(entry?.label), description: str(entry?.description) });
  });
  if (result.length > MAX_DEPICTS) {
    err(errors, "describe.depicts", "too_many");
    return result.slice(0, MAX_DEPICTS);
  }
  return result;
};

const normalizeCategories = (value, errors) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  value.forEach((entry, index) => {
    // prefill gives "[[Category:Foo]]", the chip input gives "Foo"
    const name = str(entry)
      .replace(/^\[\[/, "")
      .replace(/\]\]$/, "")
      .replace(/^Category:/i, "")
      .split("|")[0]
      .replace(/_/g, " ")
      .trim();
    if (!name) return;
    if (/[[\]{}|#<>]/.test(name) || name.includes("\n") || name.length > 255) {
      err(errors, `describe.categories.${index}`, "invalid_category");
      return;
    }
    const canonical = name[0].toUpperCase() + name.slice(1);
    // MediaWiki uppercases the first letter, so these collide
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(canonical);
  });
  if (result.length > MAX_CATEGORIES) {
    err(errors, "describe.categories", "too_many");
    return result.slice(0, MAX_CATEGORIES);
  }
  return result;
};

const normalizeLocation = (value, errors) => {
  const lat = num(value?.lat);
  const lon = num(value?.lon);
  const heading = num(value?.heading);
  const empty = { lat: null, lon: null, heading: null };
  if (lat === null && lon === null) {
    if (heading !== null) err(errors, "describe.location", "incomplete_location");
    return empty;
  }
  if (lat === null || lon === null) {
    err(errors, "describe.location", "incomplete_location");
    return empty;
  }
  if (lat < -90 || lat > 90) {
    err(errors, "describe.location.lat", "out_of_range");
    return empty;
  }
  if (lon < -180 || lon > 180) {
    err(errors, "describe.location.lon", "out_of_range");
    return empty;
  }
  if (heading !== null && (heading < 0 || heading > 360)) {
    err(errors, "describe.location.heading", "out_of_range");
    return { lat: round6(lat), lon: round6(lon), heading: null };
  }
  return {
    lat: round6(lat),
    lon: round6(lon),
    heading: heading === null ? null : round6(heading),
  };
};

const normalizeOwnRights = (raw, errors) => {
  const own = {
    originality: "",
    othersWork: "",
    aiEngine: "",
    aiPrompt: "",
    license: "",
    customLicense: "",
  };

  const originality = str(raw?.originality);
  if (!OWN_ORIGINALITY_VALUES.includes(originality)) {
    err(errors, "rights.own.originality", "required");
  } else {
    own.originality = originality;
  }

  if (own.originality === "contains-others") {
    const othersWork = str(raw?.othersWork);
    if (!OTHERS_WORK_VALUES.includes(othersWork)) {
      err(errors, "rights.own.othersWork", "required");
    } else {
      own.othersWork = othersWork;
      if (othersWork === "copyright-protected") {
        err(errors, "rights.own.othersWork", "others_work_copyright_protected");
      } else if (othersWork === "unknown") {
        err(errors, "rights.own.othersWork", "others_work_unknown");
      }
    }
  }

  if (own.originality === "ai-generated") {
    own.aiEngine = str(raw?.aiEngine).slice(0, 200);
    if (!own.aiEngine) err(errors, "rights.own.aiEngine", "required");
    own.aiPrompt = str(raw?.aiPrompt);
    if (own.aiPrompt.length > MAX_AI_PROMPT_LENGTH) {
      err(errors, "rights.own.aiPrompt", "too_long");
      own.aiPrompt = "";
    }
  }

  const license = str(raw?.license);
  if (!OWN_WORK_LICENSE_VALUES.includes(license)) {
    err(errors, "rights.own.license", "required");
  } else {
    own.license = license;
    if (license === "custom") {
      own.customLicense = normalizeCustomTemplate(raw?.customLicense, {
        field: "rights.own.customLicense",
        errors,
        required: true,
      });
    }
  }

  return own;
};

const normalizeThirdPartyRights = (raw, errors) => {
  const tp = {
    reason: "",
    creatorLicense: "",
    heirLicense: "",
    publicDomain: [],
    customPd: "",
    permissionLicense: "",
    customLicense: "",
    source: "",
    aiGenerated: false,
    author: "",
    authorUnknown: false,
    aiAuthor: "",
    aiAuthorUnknown: false,
  };

  const reason = str(raw?.reason);
  if (!THIRD_PARTY_REASON_VALUES.includes(reason)) {
    err(errors, "rights.thirdParty.reason", "required");
  } else {
    tp.reason = reason;
  }

  if (tp.reason === "unknown") {
    err(errors, "rights.thirdParty.reason", "third_party_reason_unknown");
  }

  if (tp.reason === "creator-free-license") {
    const license = str(raw?.creatorLicense);
    if (!CREATOR_LICENSE_VALUES.includes(license)) {
      err(errors, "rights.thirdParty.creatorLicense", "required");
    } else {
      tp.creatorLicense = license;
      if (license === "i-dont-know") {
        err(errors, "rights.thirdParty.creatorLicense", "creator_license_unknown");
      }
      if (license === "custom") {
        tp.customLicense = normalizeCustomTemplate(raw?.customLicense, {
          field: "rights.thirdParty.customLicense",
          errors,
          required: true,
        });
      }
    }
  }

  if (tp.reason === "heir") {
    const license = str(raw?.heirLicense);
    if (!HEIR_LICENSE_VALUES.includes(license)) {
      err(errors, "rights.thirdParty.heirLicense", "required");
    } else {
      tp.heirLicense = license;
    }
  }

  if (tp.reason === "not-protected") {
    const checked = Array.isArray(raw?.publicDomain) ? raw.publicDomain : [];
    tp.publicDomain = PUBLIC_DOMAIN_VALUES.filter((value) => checked.includes(value));
    tp.customPd = normalizeCustomTemplate(raw?.customPd, {
      field: "rights.thirdParty.customPd",
      errors,
      required: false,
    });
    if (!tp.publicDomain.length && !tp.customPd) {
      err(errors, "rights.thirdParty.publicDomain", "required");
    }
  }

  if (tp.reason === "permission") {
    const license = str(raw?.permissionLicense);
    if (!PERMISSION_LICENSE_VALUES.includes(license)) {
      err(errors, "rights.thirdParty.permissionLicense", "required");
    } else {
      tp.permissionLicense = license;
      if (license === "custom") {
        tp.customLicense = normalizeCustomTemplate(raw?.customLicense, {
          field: "rights.thirdParty.customLicense",
          errors,
          required: true,
        });
      }
    }
  }

  // source + author are always shown for third party
  tp.source = str(raw?.source);
  if (!tp.source) {
    err(errors, "rights.thirdParty.source", "required");
  } else if (tp.source.length > MAX_SOURCE_LENGTH) {
    err(errors, "rights.thirdParty.source", "too_long");
    tp.source = "";
  }

  tp.aiGenerated = bool(raw?.aiGenerated);
  if (tp.aiGenerated) {
    tp.aiAuthorUnknown = bool(raw?.aiAuthorUnknown);
    tp.aiAuthor = tp.aiAuthorUnknown ? "" : str(raw?.aiAuthor).slice(0, 500);
    if (!tp.aiAuthor && !tp.aiAuthorUnknown) {
      err(errors, "rights.thirdParty.aiAuthor", "required");
    }
  } else {
    tp.authorUnknown = bool(raw?.authorUnknown);
    tp.author = tp.authorUnknown ? "" : str(raw?.author).slice(0, 500);
    if (!tp.author && !tp.authorUnknown) {
      err(errors, "rights.thirdParty.author", "required");
    }
  }

  return tp;
};

// rebuilds a clean object with only the fields reachable from the selected branch,
// so leftovers from abandoned branches never reach the wikitext
export const normalizeUploadMetadata = (raw, { extension = "webm" } = {}) => {
  const errors = [];
  const value = EMPTY_METADATA();

  const ownership = str(raw?.rights?.ownership);
  if (!OWNERSHIP_VALUES.includes(ownership)) {
    err(errors, "rights.ownership", "required");
  } else {
    value.rights.ownership = ownership;
  }

  if (value.rights.ownership === "own") {
    value.rights.own = normalizeOwnRights(raw?.rights?.own, errors);
  } else if (value.rights.ownership === "third-party") {
    value.rights.thirdParty = normalizeThirdPartyRights(raw?.rights?.thirdParty, errors);
  }

  const describe = raw?.describe || {};
  value.describe.title = normalizeTitle(describe.title, errors, extension);
  value.describe.captions = normalizeRows(describe.captions, {
    field: "describe.captions",
    maxLength: MAX_CAPTION_LENGTH,
    errors,
  });
  if (!value.describe.captions.length) {
    err(errors, "describe.captions", "required");
  }

  value.describe.sameAsCaption = describe.sameAsCaption !== false;
  if (value.describe.sameAsCaption) {
    value.describe.descriptions = [];
  } else {
    value.describe.descriptions = normalizeRows(describe.descriptions, {
      field: "describe.descriptions",
      maxLength: MAX_DESCRIPTION_LENGTH,
      errors,
    });
    if (!value.describe.descriptions.length) {
      err(errors, "describe.descriptions", "required");
    }
  }

  value.describe.date = normalizeDate(describe.date, errors);
  value.describe.depicts = normalizeDepicts(describe.depicts, errors);
  value.describe.categories = normalizeCategories(describe.categories, errors);
  value.describe.location = normalizeLocation(describe.location, errors);

  value.describe.otherInformation = str(describe.otherInformation);
  if (value.describe.otherInformation.length > MAX_DESCRIPTION_LENGTH) {
    err(errors, "describe.otherInformation", "too_long");
    value.describe.otherInformation = "";
  }

  return { ok: errors.length === 0, value, errors };
};

export const isBlockingError = (error) => BLOCKING_CODES.includes(error.code);

// hard refusal, not a fixable field error
export const hasBlockingError = (errors) => errors.some(isBlockingError);

const errorsForPrefix = (metadata, prefix, options) =>
  normalizeUploadMetadata(metadata, options).errors.filter((error) =>
    error.field.startsWith(prefix)
  );

// step gating; both just filter the normalizer output
export const validateRightsStep = (metadata, options) =>
  errorsForPrefix(metadata, "rights", options);
export const validateDescribeStep = (metadata, options) =>
  errorsForPrefix(metadata, "describe", options);
