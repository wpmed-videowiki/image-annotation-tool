"use server";

import { cookies } from "next/headers";

export const setLocaleToCookies = async (locale) => {
  cookies().set("locale", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
};

export const getLocaleFromCookies = async () => {
  const cookiesLocale = cookies().get("locale")?.value;
  if (!cookiesLocale) {
    return "en";
  }
  return cookiesLocale;
};
