import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDB from "../../../lib/connectDB";
import UserModel from "../../../../models/User";
import {
  PROVIDERS,
  exchangeCode,
  fetchProfile,
  redirectUriFor,
} from "../../../../../lib/auth/oauth.js";
import { verifyToken } from "../../../../../lib/auth/jwt.js";
import { OAUTH_COOKIE, createSession, getSessionUser } from "../../../../lib/session";
import { createLogger } from "../../../../../lib/logger.js";

const log = createLogger("api.auth.callback");

const fail = (code) =>
  NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?authError=${code}`);

export const GET = async (req, { params }) => {
  const { provider } = await params;
  if (!PROVIDERS[provider]) return fail("unknown_provider");

  const jar = await cookies();
  const transient = await verifyToken(jar.get(OAUTH_COOKIE)?.value);
  jar.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });

  const url = new URL(req.url);
  if (url.searchParams.get("error") === "access_denied") return fail("access_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!transient || transient.provider !== provider || !state || state !== transient.state) {
    log.warn("oauth state mismatch", { provider });
    return fail("state_mismatch");
  }
  if (!code) return fail("exchange_failed");

  let tokens;
  try {
    tokens = await exchangeCode(provider, {
      code,
      codeVerifier: transient.verifier,
      redirectUri: redirectUriFor(provider),
    });
  } catch (err) {
    log.error("code exchange failed", { provider, code: err?.code, status: err?.status });
    return fail("exchange_failed");
  }

  let profile;
  try {
    profile = await fetchProfile(provider, tokens.accessToken);
  } catch (err) {
    log.error("profile fetch failed", { provider, code: err?.code, status: err?.status });
    return fail("profile_failed");
  }

  const account = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    profile: profile.raw,
  };

  await connectDB();
  if (provider === "wikimedia") {
    // no unique index yet: findOne then create, dedupe is best-effort
    let user = await UserModel.findOne({ wikimediaId: profile.sub });
    if (user) {
      user = await UserModel.findByIdAndUpdate(
        user._id,
        { $set: { username: profile.username, "accounts.wikimedia": account } },
        { new: true }
      );
    } else {
      user = await UserModel.create({
        wikimediaId: profile.sub,
        username: profile.username,
        accounts: { wikimedia: account, nccommons: null, mdwiki: null },
      });
    }
    await createSession(user._id);
    log.info("wikimedia login", { userId: String(user._id) });
  } else {
    const user = await getSessionUser();
    if (!user) return fail("not_authenticated");
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { [`accounts.${provider}`]: account } }
    );
    log.info("provider linked", { userId: String(user._id), provider });
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${transient.returnTo || "/"}`);
};
