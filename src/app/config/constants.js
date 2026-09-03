export const SUPPORTED_LOCALE_LANGUAGES = [
  {
    name: "English",
    code: "en",
  },
];

export const SUPPORTED_OVERWRITE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "svg",
  "webm",
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  "webm",
  "mp4",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "mpg",
  "mpeg",
  "ogv",
];

// chunk size for device uploads to /api/{video,image}/upload-chunk
export const SERVER_CHUNK_BYTES = 20 * 1024 * 1024;
export const MAX_DEVICE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB v1 cap

// formats the image wizard can publish. SVG sources are locked to svg
export const SUPPORTED_IMAGE_UPLOAD_EXTENSIONS = ["svg", "png", "jpg", "jpeg"];
export const IMAGE_RASTER_EXTENSION_CHOICES = ["png", "jpg", "jpeg"];
// device picker formats; HEIC/HEIF get converted to jpg server-side
export const SUPPORTED_DEVICE_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "svg",
];
export const MAX_DEVICE_IMAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
// canvas export cap; renders travel chunked to the server, then to Commons
// via the stash API, so this is a policy cap rather than a transport limit
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
// heic-convert decodes the whole file in memory server-side, so HEIC/HEIF
// conversion keeps a lower cap than plain device images
export const MAX_HEIC_CONVERT_BYTES = 100 * 1024 * 1024;

// --- AI background removal (u2netp via onnxruntime-node) --------------------
// the route buffers the whole PNG and decodes it to RGBA in memory, so a byte
// cap and a pixel cap both apply (40 MP RGBA is 160 MB raw)
export const MAX_BACKGROUND_REMOVAL_BYTES = 100 * 1024 * 1024;
export const MAX_BACKGROUND_REMOVAL_PIXELS = 40 * 1000 * 1000;
export const BACKGROUND_REMOVAL_MODEL_INPUT_SIZE = 320;
// slider 0..100: 0 keeps the raw soft mask, higher values remove more
export const DEFAULT_BACKGROUND_REMOVAL_THRESHOLD = 10;
// one inference at a time bounds peak memory; a few extra requests wait
export const BACKGROUND_REMOVAL_MAX_CONCURRENT = 2;
export const BACKGROUND_REMOVAL_MAX_QUEUE = 10;
// fixed rather than derived from os.cpus(), which ignores container quotas
export const DEFAULT_BACKGROUND_REMOVAL_THREADS = 4;

// --- Commons upload wizard ---------------------------------------------------

// Structured Data on Commons
// overridable for the local test wiki (fresh Wikibase starts at P1/Q1,
// see local-commons/README.md)
export const SDC_PROPERTY_DEPICTS = process.env.SDC_PROPERTY_DEPICTS || "P180";
export const SDC_PROPERTY_INCEPTION = process.env.SDC_PROPERTY_INCEPTION || "P571";
export const SDC_PROPERTY_SOURCE_OF_FILE =
  process.env.SDC_PROPERTY_SOURCE_OF_FILE || "P7482";
export const SDC_PROPERTY_POV_COORDINATES =
  process.env.SDC_PROPERTY_POV_COORDINATES || "P1259";
export const SDC_PROPERTY_HEADING = process.env.SDC_PROPERTY_HEADING || "P7787";
export const SDC_ITEM_FILE_ON_THE_INTERNET =
  process.env.SDC_ITEM_FILE_ON_THE_INTERNET || "Q74228490";
// "original creation by uploader"
export const SDC_ITEM_ORIGINAL_CREATION =
  process.env.SDC_ITEM_ORIGINAL_CREATION || "Q66458942";
// "described at URL"
export const SDC_PROPERTY_DESCRIBED_AT_URL =
  process.env.SDC_PROPERTY_DESCRIBED_AT_URL || "P973";
// a standalone Wikibase rejects foreign entity URIs, so these need the same
// env override as the property IDs
export const WIKIDATA_GLOBE_EARTH =
  process.env.WIKIDATA_GLOBE_EARTH || "http://www.wikidata.org/entity/Q2";
export const WIKIDATA_UNIT_DEGREE =
  process.env.WIKIDATA_UNIT_DEGREE || "http://www.wikidata.org/entity/Q28390";

// UploadWizard only writes {{Location}} wikitext; P1259 goes beyond it.
// Set false for strict parity.
export const SDC_WRITE_LOCATION = true;

export const MAX_CAPTION_LENGTH = 255; // SDC label limit
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_DEPICTS = 20;
export const MAX_CATEGORIES = 30;
export const MAX_SOURCE_LENGTH = 1000;
export const MAX_AI_PROMPT_LENGTH = 2000;
export const MAX_CUSTOM_TEMPLATE_LENGTH = 500;
export const MAX_WIKITEXT_BYTES = 100000;
// "File:" + title + ".webm" must fit createVideoJob's limit
export const MAX_FILENAME_LENGTH = 240;

// fallback languages in case the siteinfo request fails
export const FALLBACK_CAPTION_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fa", name: "فارسی" },
  { code: "fr", name: "Français" },
  { code: "hi", name: "हिन्दी" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "sv", name: "Svenska" },
  { code: "tr", name: "Türkçe" },
  { code: "uk", name: "Українська" },
  { code: "ur", name: "اردو" },
  { code: "zh", name: "中文" },
];
