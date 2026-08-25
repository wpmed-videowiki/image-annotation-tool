import { CREATOR_LICENSE_VALUES } from "../config/commonsLicenses.js";

// Maps a license tag scraped off an existing Commons page onto a wizard option
// so the rights step comes prefilled. Unrecognized tags become `custom` verbatim.
const ALIASES = {
  "cc0": "cc-zero",
  "cc-zero": "cc-zero",
  "cc zero": "cc-zero",
  "cc-by-4.0": "cc-by-4.0",
  "cc by 4.0": "cc-by-4.0",
  "cc-by-3.0": "cc-by-3.0",
  "cc by 3.0": "cc-by-3.0",
  "cc-by-2.5": "cc-by-2.5",
  "cc by 2.5": "cc-by-2.5",
  "cc-by-sa-4.0": "cc-by-sa-4.0",
  "cc by-sa 4.0": "cc-by-sa-4.0",
  "cc-by-sa-3.0": "cc-by-sa-3.0",
  "cc by-sa 3.0": "cc-by-sa-3.0",
  "cc-by-sa-2.5": "cc-by-sa-2.5",
  "cc by-sa 2.5": "cc-by-sa-2.5",
};

// tag can be "self|cc-by-sa-4.0", "Cc-by-sa-4.0", "CC BY-SA 4.0", ...
export const parseLicenseTag = (tag) => {
  const raw = String(tag || "").trim();
  if (!raw) return { value: "", custom: "" };

  // license is the last pipe-separated part
  const withoutBraces = raw.replace(/^\{\{/, "").replace(/\}\}$/, "").trim();
  const candidate = withoutBraces.split("|").pop().trim().toLowerCase();

  const mapped = ALIASES[candidate];
  if (mapped && CREATOR_LICENSE_VALUES.includes(mapped)) {
    return { value: mapped, custom: "" };
  }

  return {
    value: "custom",
    custom: /^\{\{.*\}\}$/.test(raw) ? raw : `{{${withoutBraces}}}`,
  };
};

// turn raw "[[Category:Foo|sort]]" wikitext into bare names for the chip input
export const normalizeCategoryName = (entry) =>
  String(entry || "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/^Category:/i, "")
    .split("|")[0]
    .replace(/_/g, " ")
    .trim();
