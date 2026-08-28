import { cookies } from "next/headers";
import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";
import { SESSION_TTL_SECONDS, signToken, verifyToken } from "../../lib/auth/jwt.js";

export const SESSION_COOKIE = "iat-session";
export const OAUTH_COOKIE = "iat-oauth";

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge,
});

export const createSession = async (userId) => {
  const token = await signToken({ uid: String(userId) }, { expiresInSeconds: SESSION_TTL_SECONDS });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
};

export const clearSession = async () => {
  (await cookies()).set(SESSION_COOKIE, "", cookieOptions(0));
};

// The only way server code learns who is calling. Null unless the cookie is
// valid AND the user still has a Wikimedia link (that link is the identity).
export const getSessionUser = async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifyToken(token);
  if (!payload?.uid || !/^[a-f0-9]{24}$/.test(String(payload.uid))) return null;
  await connectDB();
  const user = await UserModel.findById(payload.uid);
  if (!user || !user.accounts?.wikimedia?.accessToken) return null;
  return user;
};

export const unauthenticated = () => ({ error: "not_authenticated" });

// Translate token-service failures into action result codes.
export const authErrorResult = (err) => {
  if (err?.name === "NotLinkedError") {
    return { error: "provider_not_linked", provider: err.provider };
  }
  if (err?.name === "ReauthRequiredError") {
    return { error: "reauth_required", provider: err.provider };
  }
  return null;
};

const linkSummary = (account) =>
  account && account.accessToken
    ? { username: account.profile?.username || account.profile?.name || "" }
    : null;

// Plain serializable shape handed to client components. Never tokens.
export const getCurrentUserSummary = async () => {
  const user = await getSessionUser();
  if (!user) return null;
  return {
    id: String(user._id),
    username: user.username || user.accounts.wikimedia.profile?.username || "",
    wikimediaId: user.wikimediaId,
    linked: {
      nccommons: linkSummary(user.accounts.nccommons),
      mdwiki: linkSummary(user.accounts.mdwiki),
    },
    defaultUploadOption: user.defaultUploadOption || "new",
  };
};
