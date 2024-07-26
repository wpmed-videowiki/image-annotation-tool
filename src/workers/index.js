require("dotenv").config();
const async = require("async");
const mongoose = require("mongoose");
const ImageUploadModel = require("../app/models/ImageUpload");
const fetch = require("node-fetch");
const { QUEUES, connectRabbitMQ, publishers } = require("./rabbitmq");

let channel;
async function init() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log("Connected to database");
  channel = await connectRabbitMQ();
  channel.prefetch(4);
  console.log("Connected to rabbitmq");
  channel.consume(QUEUES.COLLECT_FILE_STATS, async (msg) => {
    const data = JSON.parse(msg.content.toString());
    console.log(
      `Received message to collect stats for ${data.id}: ${data.fileName} on ${
        data.wiki
      }, level: ${data.level} - ${data.cnt ? data.cnt.gfucontinue : ""}`
    );
    try {
      await collectFileUsageOnWiki(data);
    } catch (err) {
      console.log(err);
    }
    console.log(
      `Finished stats for ${data.id}: ${data.fileName} on ${data.wiki}`
    );
    // Collect stats
    channel.ack(msg);
  });
}

async function collectFileUsageOnWiki({ fileName, wiki, cnt, id, level = 0 }) {
  let url = `${wiki}/w/api.php?action=query&generator=fileusage&titles=${encodeURIComponent(
    fileName
  )}&prop=info&format=json`;

  if (cnt && cnt.continue) {
    const field = cnt["continue"].replace(/[\{\}]/g, "").split("|")[0];
    const value = cnt[field];
    url += `&${field}=${value}`;
  }
  console.log(url);
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

    await ImageUploadModel.updateOne(
      { _id: id },
      {
        $push: {
          linkedPages: {
            wiki,
            result,
          },
        },
        $inc: {
          numberOfLinkedPages: result.length,
          linkedPagesViews: result.reduce((acc, item) => acc + item.views, 0),
        },
      }
    );
  }

  if (data.continue && data.continue.continue) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // request next page
    console.log("need next page");
    publishers.publishCollectFileStats(channel, {
      fileName,
      wiki,
      cnt: data.continue,
      level: level + 1,
      id,
    });
  } else {
    const updated = await ImageUploadModel.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          statsFinishedWikis: wiki,
        },
      },
      {
        new: true,
      }
    );
    if (updated.statsFinishedWikis.length === updated.possibleWikis.length) {
      await ImageUploadModel.updateOne(
        { _id: id },
        {
          $set: {
            statsStatus: "done",
            statsLastUpdatedAt: new Date(),
          },
        }
      );
      console.log("Stats finished");
    }
  }

  return [];
}

async function getPageViews(wiki, title) {
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

  if (data.items) {
    return data.items.reduce((acc, item) => acc + item.views, 0);
  }
  return 0;
}

init();
