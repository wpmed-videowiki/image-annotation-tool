"use server";

import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";
import { clearSession, getSessionUser, unauthenticated } from "../lib/session";

export const logout = async () => {
  await clearSession();
  return { ok: true };
};

// Wikimedia is the identity and cannot be unlinked; that's logout.
export const unlinkProvider = async (provider) => {
  if (provider !== "nccommons" && provider !== "mdwiki") {
    return { error: "invalid_provider" };
  }
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  await connectDB();
  await UserModel.updateOne({ _id: user._id }, { $set: { [`accounts.${provider}`]: null } });
  return { ok: true };
};
