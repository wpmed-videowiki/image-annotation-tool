// Builds the wikitext for a Commons file page. Section order matches what
// UploadWizard produces. Pure ESM since it also runs in the client-side preview.

import {
  AI_GENERATED_TEMPLATE,
  AI_PROMPT_TEMPLATE,
  CREATOR_LICENSE_MAP,
  HEIR_LICENSE_MAP,
  OWN_WORK_LICENSE_MAP,
  PERMISSION_LICENSE_MAP,
  PERMISSION_PENDING_TEMPLATE,
  PUBLIC_DOMAIN_MAP,
  UNKNOWN_AUTHOR_TEMPLATE,
} from "../config/commonsLicenses.js";

// "|" would start a new template param, {{!}} is the standard escape. Only used on
// prose fields; source/author may contain wikilinks so those stay raw.
export const escapeForTemplate = (text) => String(text ?? "").replace(/\|/g, "{{!}}");

const template = (name) => `{{${name}}}`;

// one {{lang|1=text}} line per row
export const buildDescription = (metadata) => {
  const { captions, descriptions, sameAsCaption } = metadata.describe;
  const rows = sameAsCaption ? captions : descriptions;
  return rows
    .map((row) => `{{${row.lang}|1=${escapeForTemplate(row.text)}}}`)
    .join("\n");
};

export const buildSource = (metadata) =>
  metadata.rights.ownership === "own" ? "{{own}}" : metadata.rights.thirdParty.source;

export const buildAuthor = (metadata, username) => {
  if (metadata.rights.ownership === "own") {
    const { originality, aiEngine } = metadata.rights.own;
    const self = username ? `[[User:${username}|${username}]]` : "";
    if (originality === "ai-generated" && aiEngine) {
      // Template:Prompt docs put the tool in the author field
      return self ? `${aiEngine}, prompted by ${self}` : aiEngine;
    }
    return self;
  }

  const tp = metadata.rights.thirdParty;
  if (tp.aiGenerated) {
    return tp.aiAuthorUnknown ? template(UNKNOWN_AUTHOR_TEMPLATE) : tp.aiAuthor;
  }
  return tp.authorUnknown ? template(UNKNOWN_AUTHOR_TEMPLATE) : tp.author;
};

// returns bare template names, no braces
const collectLicenseTemplates = (metadata) => {
  const names = [];
  const custom = [];

  if (metadata.rights.ownership === "own") {
    const own = metadata.rights.own;
    const option = OWN_WORK_LICENSE_MAP[own.license];
    if (option?.custom) {
      custom.push(own.customLicense);
    } else if (option?.templates) {
      // own work gets wrapped: {{self|cc-by-sa-4.0}}
      names.push(`self|${option.templates.join("|")}`);
    }
    if (own.originality === "ai-generated") names.push(AI_GENERATED_TEMPLATE);
    return { names, custom };
  }

  const tp = metadata.rights.thirdParty;

  if (tp.reason === "creator-free-license") {
    const option = CREATOR_LICENSE_MAP[tp.creatorLicense];
    if (option?.custom) custom.push(tp.customLicense);
    else if (option?.templates) names.push(...option.templates);
  }

  if (tp.reason === "heir") {
    const option = HEIR_LICENSE_MAP[tp.heirLicense];
    if (option?.templates) names.push(...option.templates);
  }

  if (tp.reason === "not-protected") {
    tp.publicDomain.forEach((value) => {
      const option = PUBLIC_DOMAIN_MAP[value];
      if (option?.templates) names.push(...option.templates);
    });
    if (tp.customPd) custom.push(tp.customPd);
  }

  if (tp.reason === "permission") {
    // VRT pending tag first so reviewers see it
    names.push(PERMISSION_PENDING_TEMPLATE);
    const option = PERMISSION_LICENSE_MAP[tp.permissionLicense];
    if (option?.custom) custom.push(tp.customLicense);
    else if (option?.templates) names.push(...option.templates);
  }

  if (tp.aiGenerated) names.push(AI_GENERATED_TEMPLATE);

  return { names, custom };
};

export const buildLicenseWikitext = (metadata) => {
  const { names, custom } = collectLicenseTemplates(metadata);
  // custom entries are already full wikitext
  return [...names.map(template), ...custom].join("\n");
};

export const buildLocationWikitext = (location) => {
  if (location?.lat === null || location?.lon === null) return "";
  if (location?.lat === undefined || location?.lon === undefined) return "";
  const parts = ["Location", location.lat, location.lon];
  if (location.heading !== null && location.heading !== undefined) {
    parts.push(`heading:${location.heading}`);
  }
  return `{{${parts.join("|")}}}`;
};

export const buildCategories = (categories) =>
  categories.map((name) => `[[Category:${name}]]`).join("\n");

const buildInformation = (metadata, { username, otherVersions }) => {
  const own = metadata.rights.own;
  const isOwnAi =
    metadata.rights.ownership === "own" && own.originality === "ai-generated";

  const lines = [
    "{{Information",
    `|description=${buildDescription(metadata)}`,
    `|date=${metadata.describe.date}`,
    `|source=${buildSource(metadata)}`,
    `|author=${buildAuthor(metadata, username)}`,
    // UploadWizard emits these even when empty
    "|permission=",
    `|other versions=${otherVersions}`,
  ];

  const otherFields = [];
  if (isOwnAi && own.aiPrompt) {
    otherFields.push(`{{${AI_PROMPT_TEMPLATE}|${escapeForTemplate(own.aiPrompt)}}}`);
  }
  if (metadata.describe.otherInformation) {
    otherFields.push(metadata.describe.otherInformation);
  }
  if (otherFields.length) {
    // UploadWizard puts the prompt in "other fields 1"
    lines.push(`|other fields 1=${otherFields.join("\n")}`);
  }

  lines.push("}}");
  return lines.join("\n");
};

// metadata: output of normalizeUploadMetadata
// otherVersions: e.g. "See [[:File:Original.webm|original file]]."
export const buildFilePageWikitext = (metadata, { username = "", otherVersions = "" } = {}) => {
  const blocks = ["== {{int:filedesc}} ==", buildInformation(metadata, { username, otherVersions })];

  const location = buildLocationWikitext(metadata.describe.location);
  if (location) blocks.push(location);

  blocks.push("");
  blocks.push("== {{int:license-header}} ==");
  blocks.push(buildLicenseWikitext(metadata));

  const categories = buildCategories(metadata.describe.categories);
  if (categories) {
    blocks.push("");
    blocks.push(categories);
  }

  return blocks.join("\n").trim();
};
