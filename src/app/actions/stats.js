"use server";
// import async from "async";
const async = require("async");
import connectDB from "../api/lib/connectDB";
import ImageUploadModel from "../models/ImageUpload";
import UserModel from "../models/User";
import { ALL_WIKIS } from "../config/allWikis";
import { revalidatePath } from "next/cache";
const { connectRabbitMQ, publishers } = require("../../workers/rabbitmq");

const PER_PAGE = 100;
const FILE_USAGE_CONCURRENCY = 10;

export async function getStats(page = 1) {
  await connectDB();
  const [uploads, totalUploads] = await Promise.all([
    ImageUploadModel.find()
      .skip((page - 1) * PER_PAGE)
      .limit(PER_PAGE)
      .select(
        "_id fileName numberOfLinkedPages linkedPagesViews statsLastUpdatedAt createdAt url statsStatus"
      ),
    ImageUploadModel.countDocuments(),
  ]);

  return {
    uploads,
    totalUploads,
    totalPages: Math.ceil(totalUploads / PER_PAGE),
  };
}

export async function getTotalUsers() {
  await connectDB();
  const usersCount = await UserModel.countDocuments({ authenticated: true });

  return usersCount;
}

export async function getFileUsageOnWiki(
  fileName,
  wiki,
  { cnt, level = 0 } = {}
) {
  let url = `${wiki}/w/api.php?action=query&generator=fileusage&titles=${encodeURIComponent(
    fileName
  )}&prop=info&format=json`;

  if (cnt) {
    const key = cnt[cnt["continue"].replace(/[\{\}]/g, "").split("|")[0]];
    url += `&${key}=${cnt[key]}`;
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.USER_AGENT,
    },
  });

  const data = await response.json();

  if (data.query && data.query.pages) {
    let result = Object.values(data.query.pages).map((page) => ({
      title: page.title,
      pageid: page.pageid,
    }));
    // get page views
    const funcArray = result.map((item) => {
      return (callback) => {
        getPageViews(wiki, item.title)
          .then((views) => {
            callback(null, { ...item, views });
          })
          .catch((err) => {
            console.log({ err });
            callback(null, { ...item, views: 0 });
          });
      };
    });

    result = await async.parallelLimit(funcArray, 10);

    console.log({ wiki, fileName, cnt, level, continue: data.continue });
    if (data.continue && data.continue.continue) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return result.concat(
        await getFileUsageOnWiki(fileName, wiki, {
          cnt: data.continue,
          level: level + 1,
        })
      );
    }

    return result;
  }

  return [];
}

export async function getFileUsageOnAllWikis(id) {
  await connectDB();
  const image = await ImageUploadModel.findById(id);
  if (!image) {
    throw new Error("Image not found");
  }
  if (image.statsStatus === "processing") {
    throw new Error("Stats are already being processed for this image");
  }
  // const wikis = [ALL_WIKIS[0], ALL_WIKIS[1]];
  const wikis = ALL_WIKIS;
  await ImageUploadModel.findByIdAndUpdate(id, {
    $set: {
      statsStatus: "processing",
      linkedPages: [],
      numberOfLinkedPages: 0,
      linkedPagesViews: 0,
      possibleWikis: wikis,
      statsFinishedWikis: [],
    },
  });

  const fileName = decodeURIComponent(image.url.split("/").pop());

  const rabbitmq = await connectRabbitMQ();
  wikis.forEach((wiki) => {
    publishers.publishCollectFileStats(rabbitmq, { fileName, wiki, id });
  });
}

export async function getFileUploadById(id) {
  await connectDB();

  return await ImageUploadModel.findById(id);
}

export async function getFileUploadByIdLight(id) {
  await connectDB();

  return JSON.parse(
    JSON.stringify(
      (
        await ImageUploadModel.findById(id).select(
          "_id fileName numberOfLinkedPages linkedPagesViews statsLastUpdatedAt createdAt url statsStatus"
        )
      ).toJSON()
    )
  );
}

// export async function getPageViews(wiki, title) {
//   const url = `${wiki}/w/api.php?action=query&prop=pageviews&titles=${encodeURIComponent(
//     title
//   )}&format=json`;
//   const response = await fetch(url, {
//     headers: {
//       "User-Agent": process.env.USER_AGENT,
//     },
//   });

//   const data = await response.json();

//   if (data.query && data.query.pages) {
//     return Object.values(data.query.pages)[0].pageviews;
//   }

//   return 0;
// }

export async function getPageViews(wiki, title) {
  const wikiSource = wiki.replace("https://", "").replace(".org", "");
  // mdwiki is not supported by the API
  if (wikiSource === "mdwiki") {
    return 0;
  }

  const date = new Date();
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${wikiSource}/all-access/user/${encodeURIComponent(
    title
  )}/monthly/19700101/${date.getFullYear()}${date
    .getMonth()
    .toString()
    .padStart(2, "0")}${date.getDay().toString().padStart(2, "0")}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.USER_AGENT,
    },
  });

  const data = await response.json();

  return data.items.reduce((acc, item) => acc + item.views, 0);
}
