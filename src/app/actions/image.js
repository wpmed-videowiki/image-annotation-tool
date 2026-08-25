"use server";

import { cookies } from "next/headers";
import connectDB from "../api/lib/connectDB";
import UserModel from "../models/User";
import ImageUploadModel from "../models/ImageUpload";
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
import { uploadFileToCommons } from "../api/utils/uploadUtils.js";

const COMMONS_API_URL =
  process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_API_URL =
  process.env.NCCOMMONS_API_URL || "https://nccommons.org/w/api.php";

const SDC_SUMMARY = "Structured data from the Image Annotation Tool upload wizard";

const requireUser = async () => {
  const appUserId = (await cookies()).get("app-user-id")?.value;
  if (!appUserId) return null;
  return UserModel.findById(appUserId);
};

// non-fatal: the file is already public, record the failure and offer a retry
const writeSdc = async (token, { filename, metadata }) => {
  const data = buildStructuredData(metadata);
  if (!data) return null;
  try {
    const mid = await fetchMediaInfoEntityId(COMMONS_API_URL, token, filename);
    if (!mid) throw new Error("MediaInfo id not found after upload");
    await writeStructuredData(COMMONS_API_URL, token, {
      entityId: mid,
      data,
      summary: SDC_SUMMARY,
    });
    return { ok: true, mid, at: new Date() };
  } catch (err) {
    console.log("image sdc write failed", err);
    return {
      ok: false,
      mid: null,
      error: err?.message || "sdc write failed",
      info: err?.info || "",
      at: new Date(),
    };
  }
};

// Synchronous publish for the image wizard. No job/worker like video, one call
// uploads the file, writes the page text and the structured data.
export const publishImage = async (formData) => {
  await connectDB();

  const user = await requireUser();
  if (!user) return { error: "not_authenticated" };

  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return { error: "invalid_file" };
  }

  let metadata;
  try {
    metadata = JSON.parse(String(formData.get("metadata") || ""));
  } catch {
    return { error: "invalid_metadata", fields: [] };
  }

  const provider =
    formData.get("provider") === "nccommons" ? "nccommons" : "commons";
  const profile =
    provider === "nccommons" ? user.nccommonsProfile : user.wikimediaProfile;

  const validated = validateImagePublishRequest({
    metadata,
    extension: formData.get("extension"),
    fileSize: file.size,
    provider,
    textEdited: formData.get("textEdited") === "true",
    text: formData.get("text"),
    comment: formData.get("comment"),
    wikiSource: formData.get("wikiSource"),
    otherVersions: formData.get("otherVersions"),
    username: profile?.username || profile?.name || user.username || "",
  });
  if (!validated.ok) return validated;
  const { value } = validated;

  const token =
    provider === "nccommons" ? user.nccommonsToken : user.wikimediaToken;
  if (!token) return { error: "not_authenticated" };

  const baseUrl = provider === "nccommons" ? NCCOMMONS_API_URL : COMMONS_API_URL;

  let upload;
  try {
    upload = await uploadFileToCommons(baseUrl, token, {
      filename: value.filename,
      text: value.text,
      comment: value.comment,
      file,
    });
  } catch (err) {
    return { error: err?.message || "upload_failed" };
  }
  const descriptionurl = upload?.imageinfo?.descriptionurl;
  if (!descriptionurl) return { error: "upload_failed" };

  // SDC is Commons-only, NC Commons has no WikibaseMediaInfo
  const sdc =
    provider === "commons"
      ? await writeSdc(token, { filename: value.filename, metadata: value.metadata })
      : null;

  let uploadId = null;
  try {
    const doc = await ImageUploadModel.findOneAndUpdate(
      { url: descriptionurl },
      {
        $set: {
          fileName: value.filename,
          provider,
          uploadedBy: user._id,
          metadata: value.metadata,
          sdc,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    uploadId = String(doc._id);
  } catch (err) {
    // bookkeeping only, the upload itself succeeded
    console.log("image upload record failed", err);
  }

  return {
    ok: true,
    descriptionurl,
    sdc: sdc ? { ok: !!sdc.ok, error: sdc.error || "" } : null,
    uploadId,
  };
};

// re-run a failed SDC write with the user's current token
export const retryImageStructuredData = async (uploadId) => {
  await connectDB();

  const user = await requireUser();
  if (!user) return { error: "not_authenticated" };
  if (!/^[a-f0-9]{24}$/.test(String(uploadId || ""))) return { error: "not_found" };

  const doc = await ImageUploadModel.findById(uploadId);
  if (!doc || String(doc.uploadedBy) !== String(user._id)) {
    return { error: "not_found" };
  }
  if (doc.provider === "nccommons") return { error: "unsupported_provider" };

  const data = buildStructuredData(doc.metadata);
  if (!data) return { error: "nothing_to_write" };

  const token = user.wikimediaToken;
  if (!token) return { error: "not_authenticated" };

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
    console.log("image sdc retry failed", err);
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
