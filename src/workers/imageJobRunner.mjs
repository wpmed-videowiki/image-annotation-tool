import fs from "fs";
import path from "path";
// note: explicit .js extensions so this module loads under bare Node
import connectDB from "../app/api/lib/connectDB.js";
import VideoJobModel from "../app/models/VideoJob.js";
import { getProviderToken } from "../lib/auth/tokens.js";
import ImageUploadModel from "../app/models/ImageUpload.js";
import { uploadFileToCommonsChunked } from "./chunkedUploadUtils.mjs";
import { writeSdcRecord } from "../app/api/utils/sdcWrite.js";
import {
  JOBS_TMP_DIR,
  UPLOADS_TMP_DIR,
  ensureTmpDirs,
} from "../lib/videoTmp.js";
import {
  finalizeCancelled,
  makeCancelCheck,
  makeHeartbeat,
  makeProgressWriter,
  mapBand,
  mapJobError,
  setJob,
  startNextQueuedJob,
} from "./jobQueue.mjs";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("worker.image-job");

// overridable so the pipeline can run against local-commons
const COMMONS_BASE_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL =
  process.env.NCCOMMONS_API_URL || "https://nccommons.org/w/api.php";

const SDC_SUMMARY =
  "Structured data from the Image Annotation Tool upload wizard";

// progress bands, tail reserved for publish + SDC
const UPLOAD_BAND = [5, 90];
const SDC_PROGRESS = 97;

// Image jobs skip the download/ffmpeg stages entirely: the rendered file is
// already assembled in UPLOADS_TMP_DIR by /api/image/upload-chunk. Lifecycle:
// queued -> uploading -> publishing -> done|error. No dry-run mode (that is
// video-specific).
export async function runImageJob(jobId) {
  await connectDB();
  const job = await VideoJobModel.findById(jobId);
  if (
    !job ||
    job.kind !== "image" ||
    !["queued", "uploading"].includes(job.status)
  ) {
    logger.warn("skipping ineligible job", {
      jobId: String(jobId),
      kind: job?.kind,
      status: job?.status,
    });
    return;
  }

  const log = logger.child({ jobId: String(job._id) });
  if (job.cancelRequested) {
    // cancelled between claim and run
    await finalizeCancelled(job._id, log);
    void startNextQueuedJob("image");
    return;
  }
  const startedAt = Date.now();
  const tempDir = path.join(JOBS_TMP_DIR, String(job._id));
  const writeProgress = makeProgressWriter(job._id);
  const checkCancel = makeCancelCheck(job._id, 0);
  let success = false;

  log.info("image job started", {
    filename: job.target.filename,
    provider: job.target.provider,
    userId: String(job.user),
  });

  try {
    ensureTmpDirs();
    await fs.promises.mkdir(tempDir, { recursive: true });
    await setJob(job._id, {
      status: "uploading",
      stage: "starting",
      tempDir,
      progress: 0,
    });

    // 1. take ownership of the assembled upload (ENOENT here maps to the
    // "uploaded file expired" user error). A retried job already has it.
    const inputPath = path.join(tempDir, "input");
    if (!fs.existsSync(inputPath)) {
      await fs.promises.rename(
        path.join(UPLOADS_TMP_DIR, path.basename(job.deviceUploadId)),
        inputPath
      );
      log.debug("claimed device upload", { deviceUploadId: job.deviceUploadId });
    }
    await checkCancel();

    // 2. upload to Commons / NC Commons with a fresh token
    const provider = job.target.provider;
    const baseUrl =
      provider === "nccommons" ? NCCOMMONS_BASE_URL : COMMONS_BASE_URL;
    const token = await getProviderToken(job.user, provider);

    await setJob(job._id, {
      stage: "uploading",
      progress: UPLOAD_BAND[0],
    });
    const upload = await uploadFileToCommonsChunked(baseUrl, token, {
      filename: job.target.filename,
      text: job.target.text,
      comment: job.target.comment,
      filePath: inputPath,
      onProgress: (percent) => writeProgress(mapBand(UPLOAD_BAND, percent)),
      onStage: (stage) => {
        if (stage === "publishing") {
          void setJob(job._id, { status: "publishing", stage, progress: 95 });
        } else {
          void setJob(job._id, { stage });
        }
      },
      onPoll: makeHeartbeat(job._id),
      onCheckpoint: makeCancelCheck(job._id),
      log,
    });
    log.info("commons upload accepted", {
      filename: job.target.filename,
      provider,
    });
    // the file is public now; a late cancel must not orphan it
    await setJob(job._id, { cancelRequested: false });

    // 3. structured data. Commons-only, and a failure never fails the job -
    // the file is already public; the outcome is recorded for a retry.
    let sdc = null;
    if (upload?.result === "Success" && provider === "commons") {
      await setJob(job._id, {
        status: "publishing",
        stage: "writing structured data",
        progress: SDC_PROGRESS,
      });
      sdc = await writeSdcRecord(COMMONS_BASE_URL, token, {
        filename: job.target.filename,
        metadata: job.metadata,
        summary: SDC_SUMMARY,
        log,
      });
      writeProgress(99);
    }

    // 4. record the upload; failure is bookkeeping-only (the success screen
    // just loses the SDC retry button when uploadId is missing)
    const descriptionurl = upload?.imageinfo?.descriptionurl || "";
    if (!descriptionurl) throw new Error("upload_failed");
    let uploadDoc = null;
    try {
      uploadDoc = await ImageUploadModel.findOneAndUpdate(
        { url: descriptionurl },
        {
          $set: {
            fileName: job.target.filename,
            provider: provider === "nccommons" ? "nccommons" : "commons",
            uploadedBy: job.user,
            metadata: job.metadata,
            sdc,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      log.warn("image upload record failed", { descriptionurl, err });
    }

    await setJob(job._id, {
      status: "done",
      stage: "",
      progress: 100,
      result: {
        descriptionurl,
        imageinfo: upload?.imageinfo || null,
        uploadId: uploadDoc ? String(uploadDoc._id) : null,
      },
      sdc,
    });
    success = true;
    log.info("image job done", {
      durationMs: Date.now() - startedAt,
      descriptionurl,
    });
  } catch (err) {
    if (err?.name === "JobCancelledError") {
      await finalizeCancelled(job._id, log);
      return;
    }
    log.error("image job failed", { durationMs: Date.now() - startedAt, err });
    await setJob(job._id, {
      status: "error",
      error: mapJobError(err, "Image upload failed."),
      errorDetail: String(err?.info || err?.stack || err).slice(0, 4000),
    });
  } finally {
    if (success) {
      await fs.promises
        .rm(tempDir, { recursive: true, force: true })
        .catch(() => {});
    }
    void startNextQueuedJob("image");
  }
}
