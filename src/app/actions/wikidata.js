"use server";

// Wikidata entity search for the "main subjects" field.

const WIKIDATA_API_URL =
  process.env.WIKIDATA_API_URL || "https://www.wikidata.org/w/api.php";
// entity links point at the wiki the search ran against
const WIKIDATA_WIKI_URL = WIKIDATA_API_URL.replace(/\/w\/api\.php$/, "/wiki");
const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

// cache repeated keystrokes, an unthrottled autocomplete is a good way to get
// blocked by WMF
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map();

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // FIFO eviction, Map keeps insertion order
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
};

export const searchWikidataEntities = async (search, language = "en") => {
  const query = String(search || "").trim();
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) return [];
  const lang = LANG_RE.test(String(language || "")) ? String(language) : "en";

  const key = `${lang}:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url =
    `${WIKIDATA_API_URL}?action=wbsearchentities&format=json&formatversion=2` +
    `&type=item&limit=10&language=${lang}&uselang=${lang}` +
    `&search=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });
    const data = await response.json();
    const results = (data?.search || []).map((entity) => ({
      id: entity.id,
      label: entity.label || entity.id,
      description: entity.description || "",
      url: `${WIKIDATA_WIKI_URL}/${entity.id}`,
    }));
    cacheSet(key, results);
    return results;
  } catch (err) {
    // don't throw into the autocomplete, empty list is fine
    console.log(err);
    return [];
  }
};
