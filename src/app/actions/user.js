"use server";

import { cookies } from "next/headers";
import UserModel from "../models/User";

export async function updateUserDefaultUploadOption(
  defaultUploadOption = "new"
) {
  const userId = cookies().get("app-user-id");
  if (userId?.value) {
    await UserModel.findByIdAndUpdate(
      userId.value,
      {
        defaultUploadOption,
      },
    );
  }
}
