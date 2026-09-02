"use server";

import fs from "fs";
import path from "path";
import connectDB from "../api/lib/connectDB";
import VideoJobModel from "../models/VideoJob";
import { authErrorResult, getSessionUser, unauthenticated } from "../lib/session";
import { getProviderToken } from "../../lib/auth/tokens.js";
import { UPLOADS_TMP_DIR } from "../../lib/videoTmp.js";
import {
  hasBlockingError,
  normalizeUploadMetadata,
} from "../utils/uploadMetadata.js";
import { buildFilePageWikitext } from "../utils/commonsWikitext.js";
import { sanitizeEditedText } from "../utils/editedText.js";
import {
  buildStructuredData,
  diffStructuredData,
} from "../utils/structuredData.js";
import {
  fetchExistingStructuredData,
  fetchMediaInfoEntityId,
  writeStructuredData,
} from "../api/utils/sdcUtils.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("action.video");

const COMMONS_API_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";

const ALLOWED_ROTATIONS = [0, 90, 180, 270];
const ALLOWED_SOURCE_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "nccommons.org",
];

const validateOps = (ops) => {
  if (!ops || typeof ops !== "object") return null;
  const rotation = Number(ops.rotation) || 0;
  if (!ALLOWED_ROTATIONS.includes(rotation)) return null;
  let trim = null;
  if (ops.trim) {
    const start = Number(ops.trim.start);
    const end = Number(ops.trim.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start < 0 || end <= start) return null;
    trim = { start, end };
  }
  let crop = null;
  if (ops.crop) {
    const { x, y, w, h } = ops.crop;
    if (![x, y, w, h].every((value) => Number.isFinite(Number(value)))) {
      return null;
    }
    if (x < 0 || y < 0 || w < 0.01 || h < 0.01) return null;
    if (x + w > 1.001 || y + h > 1.001) return null;
    crop = { x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
  }
  return { rotation, trim, crop, mute: !!ops.mute };
};

const validateSource = (sourceType, sourceUrl, deviceUploadId) => {
  if (sourceType === "commons") {
    let url;
    try {
      url = new URL(sourceUrl);
    } catch {
      return false;
    }
    return (
      url.protocol === "https:" &&
      ALLOWED_SOURCE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      )
    );
  }
  if (sourceType === "device") {
    if (!/^[a-f0-9]{32}$/.test(deviceUploadId || "")) return false;
    return fs.existsSync(
      path.join(UPLOADS_TMP_DIR, path.basename(deviceUploadId))
    );
  }
  return false;
};

const buildTargetText = (payload, metadata, username) => {
  if (payload.target?.textEdited) {
    return sanitizeEditedText(payload.target.text);
  }
  // don't trust client-produced wikitext
  return buildFilePageWikitext(metadata, {
    username,
    otherVersions: String(payload.target?.otherVersions || ""),
  });
};

export const createVideoJob = async (payload) => {
  await connectDB();

  const user = await getSessionUser();
  if (!user) return unauthenticated();

  const reject = (result) => {
    log.warn("video job rejected", {
      reason: result?.error || "unknown",
      userId: String(user._id),
    });
    return result;
  };

  const { sourceType, sourceUrl, deviceUploadId, ops, target, metadata } =
    payload || {};
  const cleanOps = validateOps(ops);
  if (!cleanOps) return reject({ error: "invalid_ops" });
  if (!validateSource(sourceType, sourceUrl, deviceUploadId)) {
    return reject({ error: "invalid_source" });
  }

  // resolve first so the author byline uses the target wiki's username
  const provider = target?.provider === "nccommons" ? "nccommons" : "commons";

  // pre-wizard clients send no metadata and must keep working
  let cleanMetadata = null;
  let text = String(target?.text || "");
  let filename = String(target?.filename || "");

  if (metadata) {
    const normalized = normalizeUploadMetadata(metadata);
    if (hasBlockingError(normalized.errors)) {
      return reject({
        error: "blocked_license",
        fields: normalized.errors.filter((e) => e.field),
      });
    }
    if (!normalized.ok) {
      return reject({ error: "invalid_metadata", fields: normalized.errors });
    }
    cleanMetadata = normalized.value;
    filename = `File:${cleanMetadata.describe.title}.webm`;
    const account = user.accounts[provider === "nccommons" ? "nccommons" : "wikimedia"];
    const username = account?.profile?.username || account?.profile?.name || user.username || "";
    text = buildTargetText(payload, cleanMetadata, username);
    if (text === null) return reject({ error: "invalid_metadata", fields: [] });
  }

  if (
    !filename.startsWith("File:") ||
    !filename.toLowerCase().endsWith(".webm") ||
    filename.length > 240
  ) {
    return reject({ error: "invalid_filename" });
  }
  try {
    // validates the link now; the worker fetches a fresh token at upload time
    await getProviderToken(user._id, provider);
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) return reject(mapped);
    throw err;
  }

  // no per-user limit: jobs queue FIFO behind the worker's per-kind cap and
  // the user tracks them on /uploads

  let job;
  try {
    job = await VideoJobModel.create({
      status: "queued",
      ops: cleanOps,
      sourceType,
      sourceUrl: sourceType === "commons" ? sourceUrl : "",
      deviceUploadId: sourceType === "device" ? deviceUploadId : "",
      target: {
        filename,
        text,
        comment: String(target?.comment || ""),
        provider,
        wikiSource: String(target?.wikiSource || ""),
      },
      ...(cleanMetadata ? { metadata: cleanMetadata } : {}),
      user: user._id,
    });
  } catch (err) {
    // surface enum violations as field errors, not a 500
    if (err?.name === "ValidationError") {
      return reject({ error: "invalid_metadata", fields: [] });
    }
    throw err;
  }

  log.info("video job created", {
    jobId: String(job._id),
    userId: String(user._id),
    provider,
    sourceType,
    filename,
  });
  // execution happens in the video worker (src/workers/videoWorker.mjs),
  // which polls for queued jobs every few seconds
  return { jobId: String(job._id) };
};

export const getVideoJobStatus = async (jobId) => {
  await connectDB();

  const user = await getSessionUser();
  if (!user) return null;
  const appUserId = String(user._id);
  if (!/^[a-f0-9]{24}$/.test(String(jobId || ""))) return null;

  const job = await VideoJobModel.findById(jobId);
  if (!job || String(job.user) !== String(appUserId)) return null;

  return {
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error,
    cancelRequested: !!job.cancelRequested,
    result: job.result?.descriptionurl
      ? { descriptionurl: job.result.descriptionurl }
      : null,
    // lets the UI offer an SDC retry
    sdc: job.sdc ? { ok: !!job.sdc.ok, error: job.sdc.error || "" } : null,
  };
};

// Re-run a failed SDC write with the user's current token (the usual failure
// cause is an expired one).
export const retryStructuredData = async (jobId) => {
  await connectDB();

  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthenticated();
  const appUserId = String(sessionUser._id);
  if (!/^[a-f0-9]{24}$/.test(String(jobId || ""))) return { error: "not_found" };

  const job = await VideoJobModel.findById(jobId);
  if (!job || String(job.user) !== String(appUserId)) return { error: "not_found" };
  if (job.status !== "done") return { error: "not_finished" };
  if (job.target?.provider === "nccommons") return { error: "unsupported_provider" };

  const data = buildStructuredData(job.metadata);
  if (!data) return { error: "nothing_to_write" };

  let token;
  try {
    token = await getProviderToken(appUserId, "wikimedia");
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }

  try {
    const mid =
      job.sdc?.mid ||
      (await fetchMediaInfoEntityId(COMMONS_API_URL, token, job.target.filename));
    if (!mid) return { error: "not_found" };

    // wbeditentity merges, so retrying blindly would duplicate statements
    const existing = await fetchExistingStructuredData(COMMONS_API_URL, token, mid);
    const pending = diffStructuredData(data, existing);
    if (!pending) {
      await VideoJobModel.updateOne(
        { _id: job._id },
        { $set: { sdc: { ok: true, mid, at: new Date() } } }
      );
      return { ok: true };
    }

    await writeStructuredData(COMMONS_API_URL, token, {
      entityId: mid,
      data: pending,
      summary: "Structured data from the Image Annotation Tool upload wizard",
    });
    await VideoJobModel.updateOne(
      { _id: job._id },
      { $set: { sdc: { ok: true, mid, at: new Date() } } }
    );
    return { ok: true };
  } catch (err) {
    log.warn("sdc retry failed", { jobId: String(jobId), err });
    await VideoJobModel.updateOne(
      { _id: job._id },
      {
        $set: {
          sdc: {
            ok: false,
            mid: job.sdc?.mid || null,
            error: err?.message || "sdc write failed",
            info: err?.info || "",
            at: new Date(),
          },
        },
      }
    );
    return { error: err?.message || "sdc_failed" };
  }
};
