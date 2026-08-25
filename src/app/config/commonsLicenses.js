// License options, mirroring UploadWizard.config.php on Commons. The wizard UI,
// the validator and the wikitext serializer all read from these maps.
// `templates` = template names without braces ({{self|...}} wrapping happens in
// commonsWikitext.js). `labelKey`/`hintKey` resolve against UploadWizard.licenses
// in messages/en.json.

// own work, serialized as {{self|<key>}}
export const OWN_WORK_LICENSES = [
  { value: "cc-zero", templates: ["cc-zero"], labelKey: "cc0", hintKey: "cc0_hint" },
  { value: "cc-by-4.0", templates: ["cc-by-4.0"], labelKey: "cc_by_40", hintKey: "cc_by_hint" },
  {
    value: "cc-by-sa-4.0",
    templates: ["cc-by-sa-4.0"],
    labelKey: "cc_by_sa_40",
    hintKey: "cc_by_sa_hint",
  },
  { value: "custom", custom: true, labelKey: "custom", hintKey: "custom_hint" },
];

// third party, creator published under a free license
export const CREATOR_LICENSES = [
  { value: "cc-zero", templates: ["Cc-zero"], labelKey: "cc0", hintKey: "cc0_hint" },
  { value: "cc-by-4.0", templates: ["Cc-by-4.0"], labelKey: "cc_by_40", hintKey: "cc_by_hint" },
  { value: "cc-by-3.0", templates: ["Cc-by-3.0"], labelKey: "cc_by_30", hintKey: "cc_by_hint" },
  { value: "cc-by-2.5", templates: ["Cc-by-2.5"], labelKey: "cc_by_25" },
  {
    value: "cc-by-sa-4.0",
    templates: ["Cc-by-sa-4.0"],
    labelKey: "cc_by_sa_40",
    hintKey: "cc_by_sa_hint",
  },
  {
    value: "cc-by-sa-3.0",
    templates: ["Cc-by-sa-3.0"],
    labelKey: "cc_by_sa_30",
    hintKey: "cc_by_sa_hint",
  },
  { value: "cc-by-sa-2.5", templates: ["Cc-by-sa-2.5"], labelKey: "cc_by_sa_25" },
  { value: "custom", custom: true, labelKey: "custom", hintKey: "custom_hint" },
  // no known license means Commons refuses the upload
  { value: "i-dont-know", blocking: true, labelKey: "unknown" },
];

// third party, uploader inherited the rights
export const HEIR_LICENSES = [
  { value: "cc-by-4.0", templates: ["Cc-by-4.0-heirs"], labelKey: "cc_by_40" },
  { value: "cc-by-sa-4.0", templates: ["Cc-by-sa-4.0-heirs"], labelKey: "cc_by_sa_40" },
];

// third party, permission pending via VRT ({{subst:PP}} gets prepended for these)
export const PERMISSION_LICENSES = [
  { value: "cc-zero", templates: ["Cc-zero"], labelKey: "cc0", hintKey: "cc0_hint" },
  { value: "cc-by-4.0", templates: ["Cc-by-4.0"], labelKey: "cc_by_40", hintKey: "cc_by_hint" },
  {
    value: "cc-by-sa-4.0",
    templates: ["Cc-by-sa-4.0"],
    labelKey: "cc_by_sa_40",
    hintKey: "cc_by_sa_hint",
  },
  { value: "custom", custom: true, labelKey: "custom", hintKey: "custom_hint" },
];

// third party, not copyright protected. Multi-select, so several templates can
// come out together. `unsure` emits {{subst:uwl}} to match UploadWizard exactly,
// even though it can end up next to a real PD tag.
export const PUBLIC_DOMAIN_REASONS = [
  { value: "pd-us", templates: ["PD-US-expired"], labelKey: "pd_us_expired" },
  { value: "pd-old-70", templates: ["PD-old-70"], labelKey: "pd_old_70" },
  { value: "pd-usgov", templates: ["PD-USGov"], labelKey: "pd_usgov" },
  { value: "pd-usgov-nasa", templates: ["PD-USGov-NASA"], labelKey: "pd_usgov_nasa" },
  { value: "unsure", templates: ["subst:uwl"], labelKey: "pd_unsure" },
];

// "Is this entirely your own work?"
export const OWN_ORIGINALITY = [
  { value: "entirely-mine", labelKey: "own_origin_own" },
  { value: "contains-others", labelKey: "own_origin_others" },
  { value: "ai-generated", labelKey: "own_origin_ai" },
];

// "Is other people's work in this media free to use and share?"
export const OTHERS_WORK_STATUS = [
  { value: "free-license", labelKey: "own_others_freelicense" },
  { value: "not-protected", labelKey: "own_others_nocopyright" },
  { value: "copyright-protected", blocking: true, labelKey: "own_others_copyrighted" },
  { value: "unknown", blocking: true, labelKey: "own_others_unknown" },
];

// "Please choose why this work is free to share."
export const THIRD_PARTY_REASONS = [
  { value: "creator-free-license", labelKey: "tp_reason_freelicense" },
  { value: "heir", labelKey: "tp_reason_heir" },
  { value: "not-protected", labelKey: "tp_reason_nocopyright" },
  { value: "permission", labelKey: "tp_reason_permission" },
  { value: "unknown", blocking: true, labelKey: "tp_reason_unknown" },
];

export const OWNERSHIP_OPTIONS = [
  { value: "own", labelKey: "ownership_own" },
  { value: "third-party", labelKey: "ownership_thirdparty" },
];

// added to the license block for AI-generated work
export const AI_GENERATED_TEMPLATE = "PD-algorithm";
// wraps the AI prompt inside {{Information}}
export const AI_PROMPT_TEMPLATE = "Prompt";
// prepended for the VRT branch, expands to {{Permission pending}}
export const PERMISSION_PENDING_TEMPLATE = "subst:PP";
// author fallback for "I do not know who the author is"
export const UNKNOWN_AUTHOR_TEMPLATE = "Unknown|author";

const values = (options) => options.map((option) => option.value);

export const OWNERSHIP_VALUES = values(OWNERSHIP_OPTIONS);
export const OWN_ORIGINALITY_VALUES = values(OWN_ORIGINALITY);
export const OTHERS_WORK_VALUES = values(OTHERS_WORK_STATUS);
export const THIRD_PARTY_REASON_VALUES = values(THIRD_PARTY_REASONS);
export const OWN_WORK_LICENSE_VALUES = values(OWN_WORK_LICENSES);
export const CREATOR_LICENSE_VALUES = values(CREATOR_LICENSES);
export const HEIR_LICENSE_VALUES = values(HEIR_LICENSES);
export const PERMISSION_LICENSE_VALUES = values(PERMISSION_LICENSES);
export const PUBLIC_DOMAIN_VALUES = values(PUBLIC_DOMAIN_REASONS);

const byValue = (options) =>
  options.reduce((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {});

export const OWN_WORK_LICENSE_MAP = byValue(OWN_WORK_LICENSES);
export const CREATOR_LICENSE_MAP = byValue(CREATOR_LICENSES);
export const HEIR_LICENSE_MAP = byValue(HEIR_LICENSES);
export const PERMISSION_LICENSE_MAP = byValue(PERMISSION_LICENSES);
export const PUBLIC_DOMAIN_MAP = byValue(PUBLIC_DOMAIN_REASONS);
