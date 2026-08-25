"use server";

import { cookies } from "next/headers";
import UserModel from "../models/User";
import connectDB from "../api/lib/connectDB";
import { updateArticleText } from "../api/utils/uploadUtils";
import { FALLBACK_CAPTION_LANGUAGES } from "../config/constants";

const PLAYER_IMAGE_WIDTH = 1280;
const COMMONS_BASE_URL = "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL = "https://nccommons.org/w/api.php";

const getFetchImageUrl = (baseUrl, fileName) =>
  `${baseUrl}/w/api.php?action=query&titles=${fileName}&prop=imageinfo&iiprop=url|mediatype|size|extmetadata&iiurlwidth=${PLAYER_IMAGE_WIDTH}&format=json&formatversion=2`;

export const fetchCommonsImage = async (fileName) => {
  let infoUrl = getFetchImageUrl(COMMONS_BASE_URL, fileName);

  let response, page, pages, data;
  try {
    response = await fetch(infoUrl, {
      headers: {
        "User-Agent": process.env.USER_AGENT,
      },
    });
    data = await response.json();
    pages = data.query.pages;
    page = pages[0];
    page.wikiSource = COMMONS_BASE_URL.split("/w/api.php")[0];

  } catch (err) {
    console.log(err);
  }

  if (!page || page.missing) {
    infoUrl = getFetchImageUrl(NCCOMMONS_BASE_URL, fileName);
    try {
      response = await fetch(infoUrl, {
        headers: {
          "User-Agent": process.env.USER_AGENT,
        },
      });
      data = await response.json();
      pages = data.query.pages;
      page = pages[0];
      page.wikiSource = NCCOMMONS_BASE_URL.split("/w/api.php")[0];
      if (page.missing) {
        return null;
      }
    } catch (err) {
      console.log(err);
      return null
    }
  }

  return page;
};

// TimedMediaHandler's browser-playable transcodes of a video (Commons
// serves e.g. Theora .ogv originals as VP9 WebM derivatives, which is what
// its own player uses). Returns [] when unavailable (e.g. NC Commons).
export const fetchVideoDerivatives = async (fileName, wikiSource) => {
  const base = wikiSource || "https://commons.wikimedia.org";
  const url = `${base}/w/api.php?action=query&titles=${encodeURIComponent(
    fileName
  )}&prop=videoinfo&viprop=derivatives&format=json&formatversion=2`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.USER_AGENT,
      },
    });
    const data = await response.json();
    return data?.query?.pages?.[0]?.videoinfo?.[0]?.derivatives || [];
  } catch (err) {
    console.log(err);
    return [];
  }
};

export const searchCommonsImages = async (search) => {
  if (!search) return [];
  if (search.includes("https://") && search.includes("/wiki/")) {
    const title = search.split("/wiki/")[1];
    search = title;
  }
  if (!search.startsWith("File:")) {
    search = `File:${search}`;
  }

  const page = await fetchCommonsImage(search);
  if (!page) return [];

  return [
    {
      title: page.title,
      pageid: page.pageid,
      wikiSource: page.wikiSource,
    },
  ];
};

export const fetchPageSource = async (wikiSource) => {
  const baseUrl = wikiSource.split("/wiki/")[0];
  const title = wikiSource.split("/wiki/")[1];

  const sourceUrl = `${baseUrl}/w/api.php?action=query&titles=${title}&prop=revisions&rvprop=content&format=json&formatversion=2`;

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": process.env.USER_AGENT,
    },
  });

  const data = await response.json();
  const pages = data.query.pages;
  const page = pages[0];
  return page;
};

export const updatePageSource = async (wikiSource, text) => {
  await connectDB();

  const appUserId = (await cookies()).get("app-user-id")?.value;
  const user = await UserModel.findById(appUserId);

  const baseUrl = `${wikiSource.split("/wiki/")[0]}/w/api.php`;
  const title = wikiSource.split("/wiki/")[1];
  const token = baseUrl.includes("mdwiki.org")
    ? user.mdwikiToken
    : user.wikimediaToken;

  const result = await updateArticleText(baseUrl, token, { title, text });
  return result;
};

export const uploadFile = async (formData) => {
  const req = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/upload`, {
    method: "POST",
    body: formData,
    headers: {
      Cookie: (await cookies()).toString(),
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const response = await req.json();
  return response;
};

// --- upload wizard lookups ---------------------------------------------------

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;
const LANGUAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOOKUP_CACHE_MAX_ENTRIES = 200;
const lookupCache = new Map();

const lookupGet = (key) => {
  const hit = lookupCache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    lookupCache.delete(key);
    return null;
  }
  return hit.value;
};

const lookupSet = (key, value, ttl) => {
  if (lookupCache.size >= LOOKUP_CACHE_MAX_ENTRIES) {
    lookupCache.delete(lookupCache.keys().next().value);
  }
  lookupCache.set(key, { value, expires: Date.now() + ttl });
};

const apiBaseFor = (provider) =>
  provider === "nccommons" ? NCCOMMONS_BASE_URL : COMMONS_BASE_URL;

// category autocomplete; prefixsearch on namespace 14 like MediaWiki's own widget
export const searchCommonsCategories = async (search, provider = "commons") => {
  const query = String(search || "").trim();
  if (query.length < 2 || query.length > 255) return [];

  const key = `cat:${provider}:${query.toLowerCase()}`;
  const cached = lookupGet(key);
  if (cached) return cached;

  const url =
    `${apiBaseFor(provider)}?action=query&format=json&formatversion=2` +
    `&list=prefixsearch&psnamespace=14&pslimit=10` +
    `&pssearch=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });
    const data = await response.json();
    const results = (data?.query?.prefixsearch || []).map((page) =>
      page.title.replace(/^Category:/i, "")
    );
    lookupSet(key, results, CATEGORY_CACHE_TTL_MS);
    return results;
  } catch (err) {
    console.log(err);
    return [];
  }
};

// language list for caption/description rows, with a hardcoded fallback
export const fetchCommonsLanguages = async () => {
  const key = "languages";
  const cached = lookupGet(key);
  if (cached) return cached;

  const url = `${COMMONS_BASE_URL}?action=query&meta=siteinfo&siprop=languages&format=json&formatversion=2`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });
    const data = await response.json();
    const languages = (data?.query?.languages || [])
      .map((language) => ({ code: language.code, name: language.name || language.code }))
      .filter((language) => language.code);
    if (!languages.length) return FALLBACK_CAPTION_LANGUAGES;
    lookupSet(key, languages, LANGUAGE_CACHE_TTL_MS);
    return languages;
  } catch (err) {
    console.log(err);
    return FALLBACK_CAPTION_LANGUAGES;
  }
};

// languagesearch API (same as UploadWizard): finds languages by any name,
// e.g. "french" matches fr
export const searchCommonsLanguages = async (search) => {
  const query = String(search || "").trim();
  if (!query || query.length > 100) return [];

  const key = `languagesearch:${query.toLowerCase()}`;
  const cached = lookupGet(key);
  if (cached) return cached;

  const url =
    `${COMMONS_BASE_URL}?action=languagesearch&format=json&formatversion=2` +
    `&search=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });
    const data = await response.json();
    // { code: matched name, ... }
    const results = Object.entries(data?.languagesearch || {}).map(
      ([code, name]) => ({ code, name })
    );
    lookupSet(key, results, LANGUAGE_CACHE_TTL_MS);
    return results;
  } catch (err) {
    console.log(err);
    return [];
  }
};

// renders a custom license tag for the wizard's Preview button
export const previewWikitext = async (text, provider = "commons") => {
  const value = String(text || "").trim();
  if (!value || value.length > 500) return "";
  const url =
    `${apiBaseFor(provider)}?action=parse&format=json&formatversion=2` +
    `&contentmodel=wikitext&prop=text&disablelimitreport=1` +
    `&text=${encodeURIComponent(value)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });
    const data = await response.json();
    return data?.parse?.text || "";
  } catch (err) {
    console.log(err);
    return "";
  }
};
