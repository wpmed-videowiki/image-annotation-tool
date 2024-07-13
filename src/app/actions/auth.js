"use server";

import { cookies } from "next/headers";
import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";

export const getAppUser = async () => {
  await connectDB();
  const userId = cookies().get("app-user-id");
  if (userId) {
    const user = await UserModel.findById(userId.value);
    if (user) {
      return user._id.toString();
    }
  }
  const user = await UserModel.create({});
  cookies().set("app-user-id", user._id, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return user._id.toString();
};

export const logoutPlatform = async (platform) => {
  await connectDB();
  const userId = cookies().get("app-user-id");
  if (userId) {
    const user = await UserModel.findById(userId.value);
    if (user) {
      const update = {
        [`${platform}Id`]: null,
        [`${platform}Token`]: null,
        [`${platform}RefreshToken`]: null,
        [`${platform}Profile`]: {},
      };
      await UserModel.findByIdAndUpdate(user._id, {
        $set: update,
      });
    }
  }
};
