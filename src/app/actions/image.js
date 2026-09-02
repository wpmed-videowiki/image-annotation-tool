"use server";

import fs from "fs";
import path from "path";
import connectDB from "../api/lib/connectDB";
import ImageUploadModel from "../models/ImageUpload";
import { authErrorResult, getSessionUser, unauthenticated } from "../lib/session";
import { getProviderToken } from "../../lib/auth/tokens.js";
import VideoJobModel from "../models/VideoJob";
import { validateImagePublishRequest } from "../utils/imagePublishRequest.js";
import {
  buildStructuredData,
  diffStructuredData,
} from "../utils/structuredData.js";
import {
  fetchExistingStructuredData,
  fetchMediaInfoEntityId,
  writeStructuredData,
} from "../api/utils/sdcUtils.js";
import { UPLOADS_TMP_DIR } from "../../lib/videoTmp.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("action.image");

const COMMONS_API_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";

const SDC_SUMMARY = "Structured data from the Image Annotation Tool upload wizard";

const requireUser = () => getSessionUser();

// Queues an image publish for the upload worker (src/workers/imageJobRunner.mjs)
// instead of uploading inline: a >95MB Commons publish can hold a request open
// for many minutes, which proxies time out. The rendered file arrives via
// /api/image/upload-chunk; the action only gets the id of the assembled temp
// file, validates everything, and creates the job. No per-user job limit.
export const createImageJob = async (formData) => {
  await connectDB();

  const user = await requireUser();
  if (!user) return unauthenticated();

  const chunkUploadId = String(formData.get("uploadId") || "");
  if (!/^[a-f0-9]{32}$/.test(chunkUploadId)) {
    return { error: "invalid_file" };
  }
  const filePath = path.join(UPLOADS_TMP_DIR, path.basename(chunkUploadId));
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || !stat.size) {
    return { error: "invalid_file" };
  }

  // a rejected render is useless; don't leave it for the sweeper. On success
  // the job owns the file (the runner moves it into its temp dir).
  const fail = async (result) => {
    log.warn("image job rejected", {
      reason: result?.error || "unknown",
      userId: String(user._id),
    });
    await fs.promises.unlink(filePath).catch(() => {});
    return result;
  };

  let metadata;
  try {
    metadata = JSON.parse(String(formData.get("metadata") || ""));
  } catch {
    return fail({ error: "invalid_metadata", fields: [] });
  }

  const provider =
    formData.get("provider") === "nccommons" ? "nccommons" : "commons";
  const account = user.accounts[provider === "nccommons" ? "nccommons" : "wikimedia"];
  const profile = account?.profile;

  const validated = validateImagePublishRequest({
    metadata,
    extension: formData.get("extension"),
    fileSize: stat.size,
    provider,
    textEdited: formData.get("textEdited") === "true",
    text: formData.get("text"),
    comment: formData.get("comment"),
    wikiSource: formData.get("wikiSource"),
    otherVersions: formData.get("otherVersions"),
    username: profile?.username || profile?.name || user.username || "",
  });
  if (!validated.ok) return fail(validated);
  const { value } = validated;

  try {
    await getProviderToken(user._id, provider);
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) return fail(mapped);
    throw err;
  }

  let job;
  try {
    job = await VideoJobModel.create({
      kind: "image",
      status: "queued",
      sourceType: "device",
      deviceUploadId: chunkUploadId,
      target: {
        filename: value.filename,
        text: value.text,
        comment: value.comment,
        provider,
        wikiSource: value.wikiSource,
      },
      metadata: value.metadata,
      user: user._id,
    });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return fail({ error: "invalid_metadata", fields: [] });
    }
    throw err;
  }

  log.info("image job created", {
    jobId: String(job._id),
    userId: String(user._id),
    provider,
    filename: value.filename,
    fileSize: stat.size,
  });
  return { jobId: String(job._id) };
};

export const getImageJobStatus = async (jobId) => {
  await connectDB();

  const user = await requireUser();
  if (!user) return null;
  const appUserId = String(user._id);
  if (!/^[a-f0-9]{24}$/.test(String(jobId || ""))) return null;

  const job = await VideoJobModel.findById(jobId);
  if (!job || job.kind !== "image" || String(job.user) !== String(appUserId)) {
    return null;
  }

  return {
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error,
    cancelRequested: !!job.cancelRequested,
    // uploadId is the ImageUpload doc id, which the SDC retry needs
    result: job.result?.descriptionurl
      ? {
          descriptionurl: job.result.descriptionurl,
          uploadId: job.result.uploadId || null,
        }
      : null,
    sdc: job.sdc ? { ok: !!job.sdc.ok, error: job.sdc.error || "" } : null,
  };
};

// re-run a failed SDC write with the user's current token
export const retryImageStructuredData = async (uploadId) => {
  await connectDB();

  const user = await requireUser();
  if (!user) return unauthenticated();
  if (!/^[a-f0-9]{24}$/.test(String(uploadId || ""))) return { error: "not_found" };

  const doc = await ImageUploadModel.findById(uploadId);
  if (!doc || String(doc.uploadedBy) !== String(user._id)) {
    return { error: "not_found" };
  }
  if (doc.provider === "nccommons") return { error: "unsupported_provider" };

  const data = buildStructuredData(doc.metadata);
  if (!data) return { error: "nothing_to_write" };

  let token;
  try {
    token = await getProviderToken(user._id, "wikimedia");
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) return mapped;
    throw err;
  }

  try {
    const mid =
      doc.sdc?.mid ||
      (await fetchMediaInfoEntityId(COMMONS_API_URL, token, doc.fileName));
    if (!mid) return { error: "not_found" };

    // wbeditentity merges, retrying blindly would duplicate statements
    const existing = await fetchExistingStructuredData(COMMONS_API_URL, token, mid);
    const pending = diffStructuredData(data, existing);
    if (pending) {
      await writeStructuredData(COMMONS_API_URL, token, {
        entityId: mid,
        data: pending,
        summary: SDC_SUMMARY,
      });
    }
    await ImageUploadModel.updateOne(
      { _id: doc._id },
      { $set: { sdc: { ok: true, mid, at: new Date() } } }
    );
    return { ok: true };
  } catch (err) {
    log.warn("image sdc retry failed", { uploadId: String(uploadId), err });
    await ImageUploadModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          sdc: {
            ok: false,
            mid: doc.sdc?.mid || null,
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
