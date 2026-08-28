// Framework-free MediaWiki OAuth2 client. Loaded by both Next (web) and bare
// Node (worker), so: explicit .js imports, no next/* imports, global fetch.
import crypto from "node:crypto";

export class OAuthError extends Error {
  constructor(code, { status = 0, body = null, message } = {}) {
    super(message || `oauth ${code}`);
    this.name = "OAuthError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

const provider = (id, name, baseUrl, keyVar, secretVar) => ({
  id,
  name,
  baseUrl,
  apiUrl: `${baseUrl}/w/api.php`,
  get clientId() {
    return process.env[keyVar] || "";
  },
  get clientSecret() {
    return process.env[secretVar] || "";
  },
});

export const PROVIDERS = {
  wikimedia: provider(
    "wikimedia",
    "Wikimedia Commons",
    "https://commons.wikimedia.org",
    "MEDIAWIKI_CONSUMER_KEY",
    "MEDIAWIKI_CONSUMER_SECRET"
  ),
  nccommons: provider(
    "nccommons",
    "NC Commons",
    "https://nccommons.org",
    "NCCOMMONS_CONSUMER_KEY",
    "NCCOMMONS_CONSUMER_SECRET"
  ),
  mdwiki: provider(
    "mdwiki",
    "MD Wiki",
    "https://mdwiki.org",
    "MDWIKI_CONSUMER_KEY",
    "MDWIKI_CONSUMER_SECRET"
  ),
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

const getProvider = (id) => {
  const p = PROVIDERS[id];
  if (!p) throw new OAuthError("unknown_provider", { message: `unknown provider ${id}` });
  return p;
};

// jobs and uploads say "commons"; the account slot is "wikimedia"
export const accountKeyForProvider = (name) => {
  if (name === "nccommons" || name === "mdwiki") return name;
  return "wikimedia";
};

// Any Wikimedia-family wiki (en.wikipedia.org, commons...) edits with the
// Wikimedia token; only nccommons.org / mdwiki.org have their own.
export const providerForWikiSource = (wikiSource) => {
  let host;
  try {
    host = new URL(wikiSource).hostname;
  } catch {
    return null;
  }
  if (host === "nccommons.org" || host.endsWith(".nccommons.org")) return "nccommons";
  if (host === "mdwiki.org" || host.endsWith(".mdwiki.org")) return "mdwiki";
  return "wikimedia";
};

export const redirectUriFor = (providerId) =>
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/${providerId}`;

export const generatePkce = () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

export const buildAuthorizeUrl = (providerId, { state, codeChallenge, redirectUri }) => {
  const p = getProvider(providerId);
  const url = new URL(`${p.baseUrl}/w/rest.php/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
};

const postToken = async (p, params) => {
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    ...params,
  }).toString();
  const response = await fetch(`${p.baseUrl}/w/rest.php/oauth2/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.USER_AGENT || "",
    },
    body,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok || !json || json.error) {
    throw new OAuthError(json?.error || "token_request_failed", {
      status: response.status,
      body: json,
      message: json?.hint || json?.message || json?.error || `HTTP ${response.status}`,
    });
  }
  if (!json.access_token) {
    throw new OAuthError("invalid_response", { status: response.status, body: json });
  }
  return json;
};

const toTokenSet = (json, fallbackRefreshToken = "") => ({
  accessToken: json.access_token,
  refreshToken: json.refresh_token || fallbackRefreshToken,
  expiresAt: Date.now() + Number(json.expires_in || 0) * 1000,
});

export const exchangeCode = async (providerId, { code, codeVerifier, redirectUri }) => {
  const p = getProvider(providerId);
  const json = await postToken(p, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  return toTokenSet(json);
};

export const refreshAccessToken = async (providerId, refreshToken) => {
  const p = getProvider(providerId);
  const json = await postToken(p, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return toTokenSet(json, refreshToken);
};

export const fetchProfile = async (providerId, accessToken) => {
  const p = getProvider(providerId);
  const response = await fetch(`${p.baseUrl}/w/rest.php/oauth2/resource/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": process.env.USER_AGENT || "",
    },
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok || !json || !json.sub) {
    throw new OAuthError("profile_failed", { status: response.status, body: json });
  }
  return { sub: String(json.sub), username: json.username || "", raw: json };
};
