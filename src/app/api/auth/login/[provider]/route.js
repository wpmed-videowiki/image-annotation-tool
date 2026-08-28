import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  PROVIDERS,
  buildAuthorizeUrl,
  generatePkce,
  redirectUriFor,
} from "../../../../../lib/auth/oauth.js";
import { signToken } from "../../../../../lib/auth/jwt.js";
import { OAUTH_COOKIE, getSessionUser } from "../../../../lib/session";

const OAUTH_TTL_SECONDS = 10 * 60;

// only same-origin paths; never an absolute or protocol-relative url
const safeReturnTo = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";

export const GET = async (req, { params }) => {
  const { provider } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!PROVIDERS[provider]) {
    return NextResponse.redirect(`${appUrl}/?authError=unknown_provider`);
  }
  // linking a secondary wiki requires being logged in with Wikimedia
  if (provider !== "wikimedia" && !(await getSessionUser())) {
    return NextResponse.redirect(`${appUrl}/?authError=not_authenticated`);
  }

  const returnTo = safeReturnTo(new URL(req.url).searchParams.get("returnTo"));
  const state = crypto.randomBytes(24).toString("base64url");
  const { verifier, challenge } = generatePkce();

  const transient = await signToken(
    { provider, state, verifier, returnTo },
    { expiresInSeconds: OAUTH_TTL_SECONDS }
  );
  (await cookies()).set(OAUTH_COOKIE, transient, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  });

  return NextResponse.redirect(
    buildAuthorizeUrl(provider, {
      state,
      codeChallenge: challenge,
      redirectUri: redirectUriFor(provider),
    })
  );
};
