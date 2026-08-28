"use server";

import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";
import { getSessionUser, unauthenticated } from "../lib/session";

export async function updateUserDefaultUploadOption(defaultUploadOption = "new") {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  await connectDB();
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { defaultUploadOption: defaultUploadOption === "overwrite" ? "overwrite" : "new" } }
  );
  return { ok: true };
}
