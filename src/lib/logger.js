// Structured logger shared by the Next server side (actions,
// API routes) and the bare-node workers, following the videoTmp.js shared-
// module pattern. Server-only - never import from client components.
//
// Output: one line per record. JSON when LOG_FORMAT=json (or NODE_ENV is
// production and LOG_FORMAT is unset), human-readable otherwise. debug/info
// go to stdout, warn/error to stderr. Level filtering via LOG_LEVEL
// (default "info"). Env is read lazily so import order vs dotenv is
// irrelevant. A logger must never throw.

export const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const MAX_STRING = 500;
const MAX_STACK_LINES = 5;
const MAX_PRETTY_OBJECT = 300;

const SENSITIVE_KEY_RE = /token|authorization|cookie|secret|password/i;
// "Bearer <...>" headers and JWT-shaped runs (MediaWiki OAuth2 access tokens
// are JWTs, and a mongoose CastError message can embed one)
const SENSITIVE_VALUE_RE = /Bearer \S+|eyJ[A-Za-z0-9_-]{20,}/g;

const truncate = (value, max = MAX_STRING) => {
  const str = String(value);
  return str.length > max ? `${str.slice(0, max)}...` : str;
};

const scrubString = (value) => value.replace(SENSITIVE_VALUE_RE, "[redacted]");

export const serializeError = (err) => {
  if (!(err instanceof Error)) {
    return { name: "Error", message: scrubString(truncate(err)) };
  }
  const out = {
    name: err.name || "Error",
    message: scrubString(truncate(err.message || "")),
  };
  if (err.code !== undefined) out.code = scrubString(truncate(err.code));
  if (err.info !== undefined) out.info = scrubString(truncate(err.info));
  if (err.status !== undefined) out.status = err.status;
  if (err.stack) {
    out.stack = scrubString(
      err.stack.split("\n").slice(0, MAX_STACK_LINES).join("\n")
    );
  }
  return out;
};

const redactValue = (value, depth) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(truncate(value));
  if (typeof value !== "object") return value;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[Buffer ${value.byteLength} bytes]`;
  }
  if (value instanceof Error) return serializeError(value);
  if (depth > 0) return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, 1));
  return redactObject(value, 1);
};

const redactObject = (obj, depth) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEY_RE.test(key)
      ? "[redacted]"
      : redactValue(value, depth);
  }
  return out;
};

const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === "bigint") return String(value);
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[circular]";
          seen.add(value);
        }
        return value;
      });
    } catch {
      return '"[unserializable]"';
    }
  }
};

const prettyValue = (value) => {
  if (typeof value === "string") {
    return /\s/.test(value) ? JSON.stringify(value) : value;
  }
  if (value === null || typeof value !== "object") return String(value);
  const json = safeStringify(value);
  return json.length > MAX_PRETTY_OBJECT
    ? `${json.slice(0, MAX_PRETTY_OBJECT)}...`
    : json;
};

const resolveLevel = (options) => {
  const name = options.level || process.env.LOG_LEVEL || "info";
  return LEVELS[name] ?? LEVELS.info;
};

const resolveJson = (options) => {
  if (typeof options.json === "boolean") return options.json;
  const format = process.env.LOG_FORMAT;
  if (format) return format === "json";
  return process.env.NODE_ENV === "production";
};

// raw stream writes rather than console.* so Next dev's console decoration
// doesn't mangle the lines
const defaultWrite = (line, levelName) => {
  const stream =
    LEVELS[levelName] >= LEVELS.warn ? process.stderr : process.stdout;
  stream.write(line + "\n");
};

export const createLogger = (component, options = {}) => {
  const baseContext = options.context || {};

  const emit = (levelName, msg, context) => {
    try {
      if (LEVELS[levelName] < resolveLevel(options)) return;
      const clean = redactObject({ ...baseContext, ...(context || {}) }, 0);
      let line;
      if (resolveJson(options)) {
        const record = {
          time: new Date().toISOString(),
          level: levelName,
          component,
          msg,
        };
        for (const [key, value] of Object.entries(clean)) {
          if (!(key in record)) record[key] = value;
        }
        line = safeStringify(record);
      } else {
        const pairs = Object.entries(clean)
          .map(([key, value]) => `${key}=${prettyValue(value)}`)
          .join(" ");
        line = `${new Date().toISOString()} ${levelName
          .toUpperCase()
          .padEnd(5)} [${component}] ${msg}${pairs ? ` ${pairs}` : ""}`;
      }
      (options.write || defaultWrite)(line, levelName);
    } catch {
      // a logger must never throw
    }
  };

  return {
    debug: (msg, context) => emit("debug", msg, context),
    info: (msg, context) => emit("info", msg, context),
    warn: (msg, context) => emit("warn", msg, context),
    error: (msg, context) => emit("error", msg, context),
    child: (extraContext) =>
      createLogger(component, {
        ...options,
        context: { ...baseContext, ...extraContext },
      }),
  };
};
