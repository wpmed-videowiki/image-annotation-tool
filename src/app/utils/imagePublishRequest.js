// Server-side validation for the image publish request. Pure ESM so it's testable
// without mocking Next; actions/image.js just parses FormData and delegates here.
// Filename and wikitext are rebuilt/checked server-side, nothing client-supplied
// is trusted.

import {
  MAX_IMAGE_UPLOAD_BYTES,
  SUPPORTED_IMAGE_UPLOAD_EXTENSIONS,
} from "../config/constants.js";
import { buildFilePageWikitext } from "./commonsWikitext.js";
import { sanitizeEditedText } from "./editedText.js";
import {
  hasBlockingError,
  normalizeUploadMetadata,
} from "./uploadMetadata.js";

export const validateImagePublishRequest = ({
  metadata,
  extension,
  fileSize,
  provider,
  textEdited,
  text,
  comment,
  wikiSource,
  otherVersions,
  username,
}) => {
  const cleanExtension = String(extension || "").toLowerCase();
  if (!SUPPORTED_IMAGE_UPLOAD_EXTENSIONS.includes(cleanExtension)) {
    return { error: "invalid_extension" };
  }

  const size = Number(fileSize || 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_UPLOAD_BYTES) {
    return { error: "invalid_file" };
  }

  const normalized = normalizeUploadMetadata(metadata, {
    extension: cleanExtension,
  });
  if (hasBlockingError(normalized.errors)) {
    return {
      error: "blocked_license",
      fields: normalized.errors.filter((e) => e.field),
    };
  }
  if (!normalized.ok) {
    return { error: "invalid_metadata", fields: normalized.errors };
  }
  const cleanMetadata = normalized.value;

  const finalText = textEdited
    ? sanitizeEditedText(text)
    : buildFilePageWikitext(cleanMetadata, {
        username: String(username || ""),
        otherVersions: String(otherVersions || ""),
      });
  if (finalText === null) return { error: "invalid_metadata", fields: [] };

  return {
    ok: true,
    value: {
      provider: provider === "nccommons" ? "nccommons" : "commons",
      extension: cleanExtension,
      metadata: cleanMetadata,
      filename: `File:${cleanMetadata.describe.title}.${cleanExtension}`,
      text: finalText,
      comment: String(comment || ""),
      wikiSource: String(wikiSource || ""),
    },
  };
};
