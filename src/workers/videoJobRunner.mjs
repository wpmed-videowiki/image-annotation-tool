import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
// note: explicit .js extensions so this module loads under bare Node
import connectDB from "../app/api/lib/connectDB.js";
import VideoJobModel from "../app/models/VideoJob.js";
import UserModel from "../app/models/User.js";
import ImageUploadModel from "../app/models/ImageUpload.js";
import {
  buildFfmpegArgs,
  ffprobeFile,
  runFfmpeg,
} from "./ffmpegUtils.mjs";
import { uploadFileToCommonsChunked } from "./chunkedUploadUtils.mjs";
import {
  fetchMediaInfoEntityId,
  writeStructuredData,
} from "../app/api/utils/sdcUtils.js";
import { buildStructuredData } from "../app/utils/structuredData.js";
import {
  JOBS_TMP_DIR,
  UPLOADS_TMP_DIR,
  VIDEO_TMP_DIR,
  ensureTmpDirs,
} from "../lib/videoTmp.js";

// overridable so the pipeline can run against local-commons
const COMMONS_BASE_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL =
  process.env.NCCOMMONS_API_URL || "https://nccommons.org/w/api.php";

export const MAX_CONCURRENT_VIDEO_JOBS = 2;
const STALE_JOB_MS = 15 * 60 * 1000;
const SWEEP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DRY_RUN = process.env.VIDEO_UPLOAD_DRY_RUN === "true";
const DRY_RUN_DIR = path.join(VIDEO_TMP_DIR, "dry-run");

const RUNNING_STATUSES = ["downloading", "processing", "uploading", "publishing"];

// progress bands per stage, tail reserved for the SDC write
const DOWNLOAD_BAND = [0, 15];
const PROCESS_BAND = [15, 72];
const UPLOAD_BAND = [72, 92];
const SDC_PROGRESS = 96;

const setJob = async (jobId, fields) => {
  try {
    await VideoJobModel.updateOne({ _id: jobId }, { $set: fields });
  } catch (err) {
    console.log("failed to update video job", err);
  }
};

const makeProgressWriter = (jobId) => {
  let lastPercent = -1;
  let lastWrite = 0;
  return (percent) => {
    const rounded = Math.max(0, Math.min(100, Math.round(percent)));
    const now = Date.now();
    if (rounded === lastPercent || now - lastWrite < 2000) return;
    lastPercent = rounded;
    lastWrite = now;
    void setJob(jobId, { progress: rounded });
  };
};

const mapBand = ([from, to], percent) => from + (percent / 100) * (to - from);

const mapJobError = (err) => {
  const code = err?.message || "";
  if (
    code.includes("mwoauth-invalid-authorization") ||
    code.includes("badtoken") ||
    code.includes("assertuserfailed")
  ) {
    return "Your Commons session has expired. Please log in again and retry.";
  }
  if (code.includes("fileexists") || code.includes("duplicate")) {
    return "A file with this name or content already exists on Commons.";
  }
  if (
    code.includes("no video stream") ||
    code.includes("invalid video duration") ||
    code.includes("ffprobe exited")
  ) {
    return "This file does not appear to be a valid video.";
  }
  if (code.includes("ffmpeg exited")) {
    return "Video processing failed.";
  }
  return code || "Video processing failed.";
};

const downloadSource = async (url, destination, onProgress) => {
  const response = await fetch(url, {
    headers: { "User-Agent": process.env.USER_AGENT },
  });
  if (!response.ok || !response.body) {
    throw new Error(`failed to download source video: HTTP ${response.status}`);
  }
  const total = parseInt(response.headers.get("content-length") || "0", 10);
  let received = 0;
  const counter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (total) onProgress((received / total) * 100);
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body),
    counter,
    fs.createWriteStream(destination)
  );
};

export async function runVideoJob(jobId) {
  await connectDB();
  const job = await VideoJobModel.findById(jobId);
  if (!job || !["queued", "downloading"].includes(job.status)) return;

  const tempDir = path.join(JOBS_TMP_DIR, String(job._id));
  const writeProgress = makeProgressWriter(job._id);
  let success = false;

  try {
    ensureTmpDirs();
    await fs.promises.mkdir(tempDir, { recursive: true });
    await setJob(job._id, {
      status: "downloading",
      stage:
        job.sourceType === "device" ? "assembling" : "downloading source",
      tempDir,
      progress: 0,
    });

    // 1. acquire the source file
    const inputPath = path.join(tempDir, "input");
    if (job.sourceType === "device") {
      const uploadPath = path.join(
        UPLOADS_TMP_DIR,
        path.basename(job.deviceUploadId)
      );
      await fs.promises.rename(uploadPath, inputPath);
      writeProgress(DOWNLOAD_BAND[1]);
    } else {
      await downloadSource(job.sourceUrl, inputPath, (percent) =>
        writeProgress(mapBand(DOWNLOAD_BAND, percent))
      );
    }
    const probe = await ffprobeFile(inputPath);

    // 2. process with a single ffmpeg invocation
    const outputPath = path.join(tempDir, "output.webm");
    const { args, strategy, outputDurationSec } = buildFfmpegArgs({
      inputPath,
      outputPath,
      ops: job.ops,
      probe,
    });
    await setJob(job._id, {
      status: "processing",
      stage: strategy === "copy" ? "remuxing" : "encoding",
      progress: PROCESS_BAND[0],
      probe,
    });
    await runFfmpeg(args, {
      durationSec: outputDurationSec,
      onProgress: (percent) => writeProgress(mapBand(PROCESS_BAND, percent)),
    });

    // 3. upload to Commons / NC Commons (or keep the file in dry-run mode)
    const provider = job.target.provider;
    let upload = null;
    if (DRY_RUN) {
      await setJob(job._id, {
        status: "uploading",
        stage: "dry run - skipping Commons upload",
        progress: UPLOAD_BAND[0],
      });
      await fs.promises.mkdir(DRY_RUN_DIR, { recursive: true });
      const dryRunPath = path.join(DRY_RUN_DIR, `${job._id}.webm`);
      await fs.promises.rename(outputPath, dryRunPath);
      console.log(
        `DRY RUN: job ${job._id} finished, output kept at ${dryRunPath} (nothing uploaded)`
      );
    } else {
      const user = await UserModel.findById(job.user);
      const baseUrl =
        provider === "nccommons" ? NCCOMMONS_BASE_URL : COMMONS_BASE_URL;
      const token =
        provider === "nccommons" ? user?.nccommonsToken : user?.wikimediaToken;
      if (!token) throw new Error("mwoauth-invalid-authorization");
      await setJob(job._id, {
        status: "uploading",
        stage: "uploading",
        progress: UPLOAD_BAND[0],
      });
      upload = await uploadFileToCommonsChunked(baseUrl, token, {
        filename: job.target.filename,
        text: job.target.text,
        comment: job.target.comment,
        filePath: outputPath,
        onProgress: (percent) => writeProgress(mapBand(UPLOAD_BAND, percent)),
        onStage: (stage) => {
          if (stage === "publishing") {
            void setJob(job._id, { status: "publishing", stage, progress: 95 });
          } else {
            void setJob(job._id, { stage });
          }
        },
      });
    }

    // 3b. structured data. Skipped for NC Commons (no WikibaseMediaInfo) and
    // pre-wizard jobs. A failure here never fails the job - the file is already
    // public and erroring would push the user into a fileexists re-upload. We
    // record the outcome on job.sdc and let retryStructuredData() re-run it.
    let sdc = null;
    const structured =
      !DRY_RUN && upload?.result === "Success" && provider === "commons"
        ? buildStructuredData(job.metadata)
        : null;

    if (structured) {
      const user = await UserModel.findById(job.user);
      const token = user?.wikimediaToken;
      let mid = null;
      try {
        if (!token) throw new Error("mwoauth-invalid-authorization");
        await setJob(job._id, {
          status: "publishing",
          stage: "writing structured data",
          progress: SDC_PROGRESS,
        });
        mid = await fetchMediaInfoEntityId(
          COMMONS_BASE_URL,
          token,
          job.target.filename
        );
        if (!mid) throw new Error("no-such-entity");
        await writeStructuredData(COMMONS_BASE_URL, token, {
          entityId: mid,
          data: structured,
          summary: "Structured data from the Image Annotation Tool upload wizard",
        });
        sdc = { ok: true, mid, at: new Date() };
      } catch (err) {
        console.log("sdc write failed", err);
        sdc = {
          ok: false,
          mid,
          error: err?.message || "sdc write failed",
          info: err?.info || "",
          at: new Date(),
        };
      }
      writeProgress(99);
    }

    // 4. record the result
    const descriptionurl = upload?.imageinfo?.descriptionurl || "";
    if (descriptionurl) {
      try {
        const existingUpload = await ImageUploadModel.findOne({
          url: descriptionurl,
        });
        if (!existingUpload) {
          await ImageUploadModel.create({
            url: descriptionurl,
            fileName: job.target.filename,
            provider: provider === "nccommons" ? "nccommons" : "commons",
            uploadedBy: job.user,
          });
        }
      } catch (err) {
        console.log("Error saving upload to db", err);
      }
    }
    await setJob(job._id, {
      status: "done",
      stage: "",
      progress: 100,
      result: { descriptionurl, imageinfo: upload?.imageinfo || null },
      sdc,
    });
    success = true;
  } catch (err) {
    console.log("video job failed", err);
    await setJob(job._id, {
      status: "error",
      error: mapJobError(err),
      errorDetail: String(err?.stderrTail || err?.info || err?.stack || err).slice(
        0,
        4000
      ),
    });
  } finally {
    if (success) {
      await fs.promises
        .rm(tempDir, { recursive: true, force: true })
        .catch(() => {});
    }
    void startNextQueuedJob();
  }
}

export async function startNextQueuedJob() {
  try {
    await connectDB();
    const activeCount = await VideoJobModel.countDocuments({
      status: { $in: RUNNING_STATUSES },
    });
    if (activeCount >= MAX_CONCURRENT_VIDEO_JOBS) return false;
    const next = await VideoJobModel.findOneAndUpdate(
      { status: "queued" },
      { $set: { status: "downloading", stage: "starting" } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (!next) return false;
    void runVideoJob(next._id);
    return true;
  } catch (err) {
    console.log("failed to schedule next video job", err);
    return false;
  }
}

export const recoverStaleJobs = async (maxAgeMs = STALE_JOB_MS) => {
  try {
    await connectDB();
    await VideoJobModel.updateMany(
      {
        status: { $in: RUNNING_STATUSES },
        updatedAt: { $lt: new Date(Date.now() - maxAgeMs) },
      },
      {
        $set: {
          status: "error",
          error: "The job was interrupted by a server restart. Please retry.",
        },
      }
    );
  } catch (err) {
    console.log("failed to recover stale video jobs", err);
  }
};

export const sweepTempFiles = async () => {
  try {
    const now = Date.now();
    for (const dir of [UPLOADS_TMP_DIR, JOBS_TMP_DIR, DRY_RUN_DIR]) {
      const entries = await fs.promises.readdir(dir).catch(() => []);
      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.promises.stat(entryPath).catch(() => null);
        if (!stat || now - stat.mtimeMs < SWEEP_MAX_AGE_MS) continue;
        if (dir === JOBS_TMP_DIR) {
          const job = await VideoJobModel.findById(entry).catch(() => null);
          if (job && RUNNING_STATUSES.concat("queued").includes(job.status)) {
            continue;
          }
        }
        await fs.promises
          .rm(entryPath, { recursive: true, force: true })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.log("failed to sweep video temp files", err);
  }
};
