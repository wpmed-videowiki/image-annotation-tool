// MediaWiki calls for Structured Data on Commons.

import { fetchCSRFToken } from "./uploadUtils.js";

const MAX_ATTEMPTS = 3;
// errors that won't get better on retry
const FATAL_CODES = new Set([
  "permissiondenied",
  "mwoauth-invalid-authorization",
  "not-recognized-language",
  "modification-failed",
  "no-such-entity",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const apiPost = async (baseUrl, token, fields) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    formData.append(key, String(value));
  }
  const response = await fetch(`${baseUrl}?format=json&formatversion=2`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const data = await response.json();
  if (data.error) {
    // same error shape as chunkedUploadUtils.postUpload
    const err = new Error(data.error.code || "sdc request failed");
    err.info = data.error.info || "";
    throw err;
  }
  return data;
};

// MediaInfo entity id is "M" + page id
export const fetchMediaInfoEntityId = async (baseUrl, token, title) => {
  const url =
    `${baseUrl}?action=query&format=json&formatversion=2` +
    `&titles=${encodeURIComponent(title)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const data = await response.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing || !page.pageid) return null;
  return `M${page.pageid}`;
};

export const fetchExistingStructuredData = async (baseUrl, token, entityId) => {
  const url =
    `${baseUrl}?action=wbgetentities&format=json&formatversion=2` +
    `&ids=${encodeURIComponent(entityId)}&props=labels%7Cclaims`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.USER_AGENT,
      },
    });
    const data = await response.json();
    return data?.entities?.[entityId] || null;
  } catch {
    // treat as "nothing there yet", callers only use this for dedup
    return null;
  }
};

export const writeStructuredData = async (
  baseUrl,
  token,
  { entityId, data, summary = "" }
) => {
  let csrfToken = await fetchCSRFToken(baseUrl, token);
  let attempt = 0;
  for (;;) {
    try {
      return await apiPost(baseUrl, token, {
        action: "wbeditentity",
        id: entityId,
        data: JSON.stringify(data),
        token: csrfToken,
        summary,
        bot: 0,
      });
    } catch (err) {
      attempt += 1;
      if (FATAL_CODES.has(err.message) || attempt >= MAX_ATTEMPTS) throw err;
      if (err.message === "badtoken") {
        csrfToken = await fetchCSRFToken(baseUrl, token);
      }
      await sleep(1000 * Math.pow(3, attempt - 1));
    }
  }
};
