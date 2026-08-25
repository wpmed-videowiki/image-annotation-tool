// Sanity checks for hand-edited wikitext from the review step. The metadata is
// still validated separately, so editing the source can't bypass a blocking answer.
// Pure ESM (TextEncoder not Buffer) since client, actions and worker all import it.

import { MAX_WIKITEXT_BYTES } from "../config/constants.js";

export const sanitizeEditedText = (text) => {
  const value = String(text || "");
  if (!value.trim()) return null;
  if (new TextEncoder().encode(value).length > MAX_WIKITEXT_BYTES) return null;
  return value;
};
