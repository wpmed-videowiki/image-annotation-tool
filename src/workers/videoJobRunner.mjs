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
import { writeSdcRecord } from "../app/api/utils/sdcWrite.js";
import { buildStructuredData } from "../app/utils/structuredData.js";
import {
  JOBS_TMP_DIR,
  UPLOADS_TMP_DIR,
  ensureTmpDirs,
} from "../lib/videoTmp.js";
import {
  DRY_RUN_DIR,
  makeHeartbeat,
  makeProgressWriter,
  mapBand,
  mapJobError,
  setJob,
  startNextQueuedJob,
} from "./jobQueue.mjs";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("worker.video-job");

// overridable so the pipeline can run against local-commons
const COMMONS_BASE_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL =
  process.env.NCCOMMONS_API_URL || "https://nccommons.org/w/api.php";

const DRY_RUN = process.env.VIDEO_UPLOAD_DRY_RUN === "true";

// progress bands per stage, tail reserved for the SDC write
const DOWNLOAD_BAND = [0, 15];
const PROCESS_BAND = [15, 72];
const UPLOAD_BAND = [72, 92];
const SDC_PROGRESS = 96;

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
  if (!job || !["queued", "downloading"].includes(job.status)) {
    logger.warn("skipping ineligible job", {
      jobId: String(jobId),
      status: job?.status,
    });
    return;
  }

  const log = logger.child({ jobId: String(job._id) });
  const startedAt = Date.now();
  const tempDir = path.join(JOBS_TMP_DIR, String(job._id));
  const writeProgress = makeProgressWriter(job._id);
  let success = false;

  log.info("video job started", {
    filename: job.target.filename,
    provider: job.target.provider,
    sourceType: job.sourceType,
    userId: String(job.user),
  });

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
    log.debug("probe complete", {
      durationSec: probe?.durationSec,
      width: probe?.width,
      height: probe?.height,
    });

    // 2. process with a single ffmpeg invocation
    const outputPath = path.join(tempDir, "output.webm");
    const { args, strategy, outputDurationSec } = buildFfmpegArgs({
      inputPath,
      outputPath,
      ops: job.ops,
      probe,
    });
    log.info("ffmpeg strategy chosen", { strategy, outputDurationSec });
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
      log.info("dry run complete, skipping upload", { dryRunPath });
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
        onPoll: makeHeartbeat(job._id),
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
      await setJob(job._id, {
        status: "publishing",
        stage: "writing structured data",
        progress: SDC_PROGRESS,
      });
      sdc = await writeSdcRecord(COMMONS_BASE_URL, user?.wikimediaToken, {
        filename: job.target.filename,
        metadata: job.metadata,
        summary: "Structured data from the Image Annotation Tool upload wizard",
        log,
      });
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
        log.warn("video upload record failed", { descriptionurl, err });
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
    log.info("video job done", {
      durationMs: Date.now() - startedAt,
      descriptionurl,
    });
  } catch (err) {
    log.error("video job failed", { durationMs: Date.now() - startedAt, err });
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
    void startNextQueuedJob("video");
  }
}
