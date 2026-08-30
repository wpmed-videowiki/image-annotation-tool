"use server";

import fs from "fs";
import path from "path";
import connectDB from "../api/lib/connectDB";
import VideoJobModel from "../models/VideoJob";
import { authErrorResult, getSessionUser, unauthenticated } from "../lib/session";
import { getProviderToken } from "../../lib/auth/tokens.js";
import { JOBS_TMP_DIR, UPLOADS_TMP_DIR } from "../../lib/videoTmp.js";
import {
  RETRY_RESET_FIELDS,
  canArchive,
  canCancel,
  canRetry,
  isActive,
} from "../utils/jobStatus.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("action.jobs");

const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 20;

const isObjectId = (id) => /^[a-f0-9]{24}$/.test(String(id || ""));

const findOwnedJob = async (user, jobId) => {
  if (!isObjectId(jobId)) return null;
  const job = await VideoJobModel.findById(jobId);
  if (!job || String(job.user) !== String(user._id)) return null;
  return job;
};

// what the /uploads page sees; never the wikitext or temp paths
const toJobSummary = (job) => ({
  id: String(job._id),
  kind: job.kind === "image" ? "image" : "video",
  status: job.status,
  stage: job.stage || "",
  progress: job.progress || 0,
  archived: !!job.archived,
  cancelRequested: !!job.cancelRequested,
  filename: job.target?.filename || "",
  provider: job.target?.provider === "nccommons" ? "nccommons" : "commons",
  sourceType: job.sourceType,
  error: job.error || "",
  errorDetail: job.errorDetail || "",
  result: job.result?.descriptionurl
    ? {
        descriptionurl: job.result.descriptionurl,
        uploadId: job.result.uploadId || null,
      }
    : null,
  sdc: job.sdc ? { ok: !!job.sdc.ok, error: job.sdc.error || "" } : null,
  createdAt: job.createdAt ? job.createdAt.toISOString() : null,
  updatedAt: job.updatedAt ? job.updatedAt.toISOString() : null,
});

const EMPTY_LIST = { jobs: [], total: 0, page: 1, perPage: DEFAULT_PER_PAGE, hasActive: false };

export const listMyJobs = async ({
  archived = false,
  status = "",
  page = 1,
  perPage = DEFAULT_PER_PAGE,
} = {}) => {
  await connectDB();
  const user = await getSessionUser();
  if (!user) return EMPTY_LIST;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePerPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(perPage, 10) || DEFAULT_PER_PAGE)
  );
  const filter = {
    user: user._id,
    archived: archived ? true : { $ne: true },
    ...(status ? { status: String(status) } : {}),
  };
  const [docs, total] = await Promise.all([
    VideoJobModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safePerPage)
      .limit(safePerPage),
    VideoJobModel.countDocuments(filter),
  ]);
  const jobs = docs.map(toJobSummary);
  return {
    jobs,
    total,
    page: safePage,
    perPage: safePerPage,
    hasActive: jobs.some((job) => isActive(job.status)),
  };
};

// Cooperative: a queued job is cancelled outright; a running one gets
// cancelRequested and the worker finishes it at its next checkpoint.
export const cancelJob = async (jobId) => {
  await connectDB();
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const job = await findOwnedJob(user, jobId);
  if (!job) return { error: "not_found" };
  if (!canCancel(job)) return { error: "not_cancellable" };

  if (job.status === "queued") {
    const result = await VideoJobModel.updateOne(
      { _id: job._id, status: "queued" },
      { $set: { status: "cancelled", stage: "", cancelRequested: false } }
    );
    if (result.modifiedCount > 0) {
      log.info("queued job cancelled", { jobId: String(job._id) });
      return { ok: true, pending: false };
    }
    // the worker claimed it in between: fall through to the running path
  }
  await VideoJobModel.updateOne(
    { _id: job._id },
    { $set: { cancelRequested: true } }
  );
  log.info("job cancel requested", { jobId: String(job._id) });
  return { ok: true, pending: true };
};

// Device-source jobs can only be retried while their file is still on disk
// (the runner's temp dir, or the never-claimed chunk upload).
const hasRetrySource = (job) => {
  if (job.sourceType !== "device") return true;
  const candidates = [path.join(JOBS_TMP_DIR, String(job._id), "input")];
  if (/^[a-f0-9]{32}$/.test(job.deviceUploadId || "")) {
    candidates.push(path.join(UPLOADS_TMP_DIR, path.basename(job.deviceUploadId)));
  }
  return candidates.some((candidate) => fs.existsSync(candidate));
};

const retryOwnedJob = async (user, job) => {
  if (!canRetry(job)) return { error: "not_retryable" };
  if (!hasRetrySource(job)) return { error: "source_expired" };
  try {
    // validates the link now; the worker fetches a fresh token when it runs
    await getProviderToken(user._id, job.target?.provider || "commons");
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }
  const result = await VideoJobModel.updateOne(
    { _id: job._id, status: { $in: ["error", "cancelled"] } },
    { $set: RETRY_RESET_FIELDS }
  );
  if (result.modifiedCount === 0) return { error: "not_retryable" };
  log.info("job re-queued", { jobId: String(job._id), from: job.status });
  return { ok: true };
};

export const retryJob = async (jobId) => {
  await connectDB();
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const job = await findOwnedJob(user, jobId);
  if (!job) return { error: "not_found" };
  return retryOwnedJob(user, job);
};

export const retryAllFailed = async () => {
  await connectDB();
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const failed = await VideoJobModel.find({
    user: user._id,
    status: "error",
    archived: { $ne: true },
  }).sort({ createdAt: 1 });
  let retried = 0;
  const skipped = [];
  for (const job of failed) {
    const result = await retryOwnedJob(user, job);
    if (result.ok) retried += 1;
    else skipped.push({ id: String(job._id), error: result.error });
  }
  return { ok: true, retried, skipped };
};

export const setJobArchived = async (jobId, archived) => {
  await connectDB();
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const job = await findOwnedJob(user, jobId);
  if (!job) return { error: "not_found" };
  if (!canArchive(job)) return { error: "not_archivable" };
  await VideoJobModel.updateOne(
    { _id: job._id },
    { $set: { archived: !!archived } }
  );
  return { ok: true, archived: !!archived };
};
