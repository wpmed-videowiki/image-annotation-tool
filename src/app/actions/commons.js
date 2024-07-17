"use server";

import { cookies } from "next/headers";
import UserModel from "../models/User";
import connectDB from "../api/lib/connectDB";
import { updateArticleText } from "../api/utils/uploadUtils";

const PLAYER_IMAGE_WIDTH = 1280;
const COMMONS_BASE_URL = "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL = "https://nccommons.org/w/api.php";

const getFetchImageUrl = (baseUrl, fileName) =>
  `${baseUrl}/w/api.php?action=query&titles=${fileName}&prop=imageinfo&iiprop=url|mediatype|size|extmetadata&iiurlwidth=${PLAYER_IMAGE_WIDTH}&format=json&formatversion=2`;

export const fetchCommonsImage = async (fileName) => {
  let infoUrl = getFetchImageUrl(COMMONS_BASE_URL, fileName);

  let response = await fetch(infoUrl, {
    headers: {
      "User-Agent": process.env.USER_AGENT,
    },
  });
  let data = await response.json();
  let pages = data.query.pages;
  let page = pages[0];
  page.wikiSource = COMMONS_BASE_URL.split("/w/api.php")[0];
  if (page.missing) {
    infoUrl = getFetchImageUrl(NCCOMMONS_BASE_URL, fileName);
    response = await fetch(infoUrl, {
      headers: {
        "User-Agent": process.env.USER_AGENT,
      },
    });
    data = await response.json();
    pages = data.query.pages;
    page = pages[0];
    page.wikiSource = NCCOMMONS_BASE_URL.split("/w/api.php")[0];
    if (page.missing) {
      return null;
    }
  }

  return page;
};

export const searchCommonsImages = async (search) => {
  if (!search) return [];
  if (search.includes("https://") && search.includes("/wiki/")) {
    const title = search.split("/wiki/")[1];
    search = title;
  }
  if (!search.startsWith("File:")) {
    search = `File:${search}`;
  }

  const page = await fetchCommonsImage(search);
  if (!page) return [];

  return [
    {
      title: page.title,
      pageid: page.pageid,
      wikiSource: page.wikiSource,
    },
  ];
};

export const fetchPageSource = async (wikiSource) => {
  const baseUrl = wikiSource.split("/wiki/")[0];
  const title = wikiSource.split("/wiki/")[1];

  const sourceUrl = `${baseUrl}/w/api.php?action=query&titles=${title}&prop=revisions&rvprop=content&format=json&formatversion=2`;

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": process.env.USER_AGENT,
    },
  });

  const data = await response.json();
  const pages = data.query.pages;
  const page = pages[0];
  return page;
};

export const updatePageSource = async (wikiSource, text) => {
  await connectDB();

  const appUserId = cookies().get("app-user-id")?.value;
  const user = await UserModel.findById(appUserId);

  const baseUrl = `${wikiSource.split("/wiki/")[0]}/w/api.php`;
  const title = wikiSource.split("/wiki/")[1];
  const token = baseUrl.includes("mdwiki.org")
    ? user.mdwikiToken
    : user.wikimediaToken;

  const result = await updateArticleText(baseUrl, token, { title, text });
  return result;
};

export const uploadFile = async (formData) => {
  const req = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/upload`, {
    method: "POST",
    body: formData,
    headers: {
      Cookie: (await cookies()).toString(),
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const response = await req.json();
  return response;
};
