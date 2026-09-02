import fs from "fs";
import path from "path";
// note: explicit .js extensions so this module loads under bare Node
import connectDB from "../app/api/lib/connectDB.js";
import VideoJobModel from "../app/models/VideoJob.js";
import {
  JOBS_TMP_DIR,
  UPLOADS_TMP_DIR,
  VIDEO_TMP_DIR,
} from "../lib/videoTmp.js";
import { createLogger } from "../lib/logger.js";
import { RUNNING_STATUSES } from "../app/utils/jobStatus.js";

const log = createLogger("worker.queue");

export const MAX_CONCURRENT_VIDEO_JOBS = 2;
export const MAX_CONCURRENT_IMAGE_JOBS = 4;
export const STALE_JOB_MS = 15 * 60 * 1000;
const SWEEP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const DRY_RUN_DIR = path.join(VIDEO_TMP_DIR, "dry-run");

export { RUNNING_STATUSES };

// thrown by cancel checkpoints inside the runners
export class JobCancelledError extends Error {
  constructor(message = "job cancelled") {
    super(message);
    this.name = "JobCancelledError";
  }
}

export const setJob = async (jobId, fields) => {
  try {
    await VideoJobModel.updateOne({ _id: jobId }, { $set: fields });
  } catch (err) {
    log.error("failed to update job", {
      jobId: String(jobId),
      fields: Object.keys(fields),
      err,
    });
  }
};

export const makeProgressWriter = (jobId) => {
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

// recoverStaleJobs kills jobs whose updatedAt goes quiet, but the Commons
// checkstatus loop can poll for many minutes without a progress change, so
// runners bump updatedAt explicitly through a throttled heartbeat.
export const touchJob = async (jobId) => {
  try {
    await VideoJobModel.updateOne(
      { _id: jobId },
      { $currentDate: { updatedAt: true } }
    );
  } catch (err) {
    log.warn("failed to touch job", { jobId: String(jobId), err });
  }
};

export const makeHeartbeat = (jobId, minIntervalMs = 5000) => {
  let last = 0;
  return () => {
    const now = Date.now();
    if (now - last < minIntervalMs) return;
    last = now;
    void touchJob(jobId);
  };
};

export const throwIfCancelled = async (jobId) => {
  const job = await VideoJobModel.findById(jobId, {
    cancelRequested: 1,
    status: 1,
  }).lean();
  if (!job || job.cancelRequested || job.status === "cancelled") {
    throw new JobCancelledError();
  }
};

// throttled checkpoint for hot loops (per chunk, per checkstatus poll)
export const makeCancelCheck = (jobId, minIntervalMs = 3000) => {
  let last = 0;
  return async () => {
    const now = Date.now();
    if (now - last < minIntervalMs) return;
    last = now;
    await throwIfCancelled(jobId);
  };
};

// The temp dir is deliberately kept so a cancelled device-source job stays
// retryable; sweepTempFiles() collects it after 24h.
export const finalizeCancelled = async (jobId, log) => {
  await setJob(jobId, {
    status: "cancelled",
    stage: "",
    cancelRequested: false,
    error: "",
  });
  log?.info("job cancelled");
};

export const mapBand = ([from, to], percent) =>
  from + (percent / 100) * (to - from);

export const mapJobError = (err, fallback = "Video processing failed.") => {
  if (err?.name === "JobCancelledError") return "Cancelled.";
  if (err?.name === "ReauthRequiredError") {
    return "Your Wikimedia login expired; log in and retry.";
  }
  if (err?.name === "NotLinkedError") {
    return `Link your ${err.provider === "nccommons" ? "NC Commons" : err.provider} account and retry.`;
  }
  if (err?.code === "ENOENT") {
    return "The uploaded file expired. Please retry.";
  }
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
  return code || fallback;
};

// `$ne: "image"` rather than `"video"` so docs that predate the kind field
// keep being claimed as video jobs
const KINDS = {
  video: {
    max: MAX_CONCURRENT_VIDEO_JOBS,
    kindFilter: { kind: { $ne: "image" } },
    firstStatus: "downloading",
    // lazy imports keep the queue <-> runner dependency acyclic
    run: async (jobId) =>
      (await import("./videoJobRunner.mjs")).runVideoJob(jobId),
  },
  image: {
    max: MAX_CONCURRENT_IMAGE_JOBS,
    kindFilter: { kind: "image" },
    firstStatus: "uploading",
    run: async (jobId) =>
      (await import("./imageJobRunner.mjs")).runImageJob(jobId),
  },
};

export async function startNextQueuedJob(kind = "video") {
  const config = KINDS[kind];
  if (!config) return false;
  try {
    await connectDB();
    const activeCount = await VideoJobModel.countDocuments({
      status: { $in: RUNNING_STATUSES },
      ...config.kindFilter,
    });
    if (activeCount >= config.max) return false;
    const next = await VideoJobModel.findOneAndUpdate(
      { status: "queued", cancelRequested: { $ne: true }, ...config.kindFilter },
      { $set: { status: config.firstStatus, stage: "starting" } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (!next) return false;
    log.info("job claimed", { jobId: String(next._id), kind });
    void config.run(next._id);
    return true;
  } catch (err) {
    log.error("failed to schedule next job", { kind, err });
    return false;
  }
}

export const recoverStaleJobs = async (maxAgeMs = STALE_JOB_MS) => {
  try {
    await connectDB();
    const result = await VideoJobModel.updateMany(
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
    if (result.modifiedCount > 0) {
      log.warn("recovered stale jobs", { count: result.modifiedCount, maxAgeMs });
    }
  } catch (err) {
    log.error("failed to recover stale jobs", { err });
  }
};

export const sweepTempFiles = async () => {
  try {
    const now = Date.now();
    let deleted = 0;
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
        log.debug("sweeping temp entry", { path: entryPath });
        await fs.promises
          .rm(entryPath, { recursive: true, force: true })
          .then(() => {
            deleted += 1;
          })
          .catch(() => {});
      }
    }
    if (deleted > 0) {
      log.info("swept temp files", { deleted });
    }
  } catch (err) {
    log.error("failed to sweep temp files", { err });
  }
};
