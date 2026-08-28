import UserModelDefault from "../../app/models/User.js";
import {
  OAuthError,
  accountKeyForProvider,
  refreshAccessToken as refreshDefault,
} from "./oauth.js";
import { NotLinkedError, ReauthRequiredError } from "./errors.js";
import { createLogger } from "../logger.js";

const log = createLogger("auth.tokens");

export const DEFAULT_MIN_TTL_MS = 10 * 60 * 1000;

export const createTokenService = ({
  UserModel = UserModelDefault,
  refreshAccessToken = refreshDefault,
  now = () => Date.now(),
} = {}) => {
  const getProviderToken = async (userId, provider, { minTtlMs = DEFAULT_MIN_TTL_MS } = {}) => {
    const key = accountKeyForProvider(provider);
    const user = await UserModel.findById(userId);
    const account = user?.accounts?.[key];
    if (!user || !account || !account.accessToken) throw new NotLinkedError(key);

    if (account.expiresAt - now() > minTtlMs) return account.accessToken;

    const usedRefreshToken = account.refreshToken;
    if (!usedRefreshToken) {
      await UserModel.findOneAndUpdate(
        { _id: user._id },
        { $set: { [`accounts.${key}`]: null } }
      );
      throw new ReauthRequiredError(key);
    }

    let fresh;
    try {
      fresh = await refreshAccessToken(key, usedRefreshToken);
    } catch (err) {
      if (err instanceof OAuthError && err.code === "invalid_grant") {
        log.warn("refresh token rejected, clearing link", { userId: String(userId), provider: key });
        await UserModel.findOneAndUpdate(
          { _id: user._id },
          { $set: { [`accounts.${key}`]: null } }
        );
        throw new ReauthRequiredError(key);
      }
      throw err;
    }

    // conditional on the refresh token we consumed: MediaWiki rotates refresh
    // tokens, so a concurrent refresher must not be clobbered
    const updated = await UserModel.findOneAndUpdate(
      { _id: user._id, [`accounts.${key}.refreshToken`]: usedRefreshToken },
      {
        $set: {
          [`accounts.${key}.accessToken`]: fresh.accessToken,
          [`accounts.${key}.refreshToken`]: fresh.refreshToken,
          [`accounts.${key}.expiresAt`]: fresh.expiresAt,
        },
      },
      { new: true }
    );
    if (updated) {
      log.info("access token refreshed", { userId: String(userId), provider: key });
      return fresh.accessToken;
    }

    const current = await UserModel.findById(userId);
    const token = current?.accounts?.[key]?.accessToken;
    if (!token) throw new ReauthRequiredError(key);
    log.info("concurrent refresh detected, using stored token", {
      userId: String(userId),
      provider: key,
    });
    return token;
  };

  return { getProviderToken };
};

export const { getProviderToken } = createTokenService();
