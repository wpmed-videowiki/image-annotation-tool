"use server";

import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";
import VideoJobModel from "../models/VideoJob";
import { UPLOADS_TMP_DIR } from "../../lib/videoTmp.js";

const ACTIVE_STATUSES = [
  "queued",
  "downloading",
  "processing",
  "uploading",
  "publishing",
];

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

export const createVideoJob = async (payload) => {
  await connectDB();

  const appUserId = (await cookies()).get("app-user-id")?.value;
  if (!appUserId) return { error: "not_authenticated" };
  const user = await UserModel.findById(appUserId);
  if (!user) return { error: "not_authenticated" };

  const { sourceType, sourceUrl, deviceUploadId, ops, target } = payload || {};
  const cleanOps = validateOps(ops);
  if (!cleanOps) return { error: "invalid_ops" };
  if (!validateSource(sourceType, sourceUrl, deviceUploadId)) {
    return { error: "invalid_source" };
  }

  const filename = String(target?.filename || "");
  if (
    !filename.startsWith("File:") ||
    !filename.toLowerCase().endsWith(".webm") ||
    filename.length > 240
  ) {
    return { error: "invalid_filename" };
  }
  const provider = target?.provider === "nccommons" ? "nccommons" : "commons";
  const token =
    provider === "nccommons" ? user.nccommonsToken : user.wikimediaToken;
  if (!token) return { error: "not_authenticated" };

  const activeJobs = await VideoJobModel.countDocuments({
    user: user._id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (activeJobs > 0) return { error: "job_already_running" };

  const job = await VideoJobModel.create({
    status: "queued",
    ops: cleanOps,
    sourceType,
    sourceUrl: sourceType === "commons" ? sourceUrl : "",
    deviceUploadId: sourceType === "device" ? deviceUploadId : "",
    target: {
      filename,
      text: String(target?.text || ""),
      comment: String(target?.comment || ""),
      provider,
      wikiSource: String(target?.wikiSource || ""),
    },
    user: user._id,
  });

  // execution happens in the video worker (src/workers/videoWorker.mjs),
  // which polls for queued jobs every few seconds
  return { jobId: String(job._id) };
};

export const getVideoJobStatus = async (jobId) => {
  await connectDB();

  const appUserId = (await cookies()).get("app-user-id")?.value;
  if (!appUserId) return null;
  if (!/^[a-f0-9]{24}$/.test(String(jobId || ""))) return null;

  const job = await VideoJobModel.findById(jobId);
  if (!job || String(job.user) !== String(appUserId)) return null;

  return {
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error,
    result: job.result?.descriptionurl
      ? { descriptionurl: job.result.descriptionurl }
      : null,
  };
};
