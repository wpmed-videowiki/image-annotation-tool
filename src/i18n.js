import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  let locale = (await cookies()).get("locale")?.value;
  if (!locale) {
    locale = "en";
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
