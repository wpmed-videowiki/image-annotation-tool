import { SignJWT, jwtVerify } from "jose";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const secretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
};

export const signToken = async (payload, { expiresInSeconds }) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey());
};

export const verifyToken = async (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
};
