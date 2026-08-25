import { MAX_FILENAME_LENGTH } from "../config/constants";

// characters MediaWiki rejects in titles
const ILLEGAL_TITLE_RE = /[#<>[\]|{}:/]|~~~/;

export const buildFileName = (title, extension) =>
  `File:${String(title || "").trim()}.${extension}`;

// Measures the full "File:<stem>.<ext>" like the server does (the old inline
// check only measured the stem, so names could pass client-side and still be
// rejected). Returns {code} or null.
export const validateFileTitle = (title, extension) => {
  const value = String(title || "").trim();
  if (!value) return { code: "required" };
  if (ILLEGAL_TITLE_RE.test(value)) return { code: "invalid_chars" };
  if (/^[._]|[._]$/.test(value)) return { code: "invalid_chars" };
  if (buildFileName(value, extension).length > MAX_FILENAME_LENGTH) {
    return { code: "too_long" };
  }
  return null;
};
