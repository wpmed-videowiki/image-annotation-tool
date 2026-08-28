import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import { uploadFileToCommons } from "../utils/uploadUtils";
import ImageUploadModel from "../../models/ImageUpload";
import { authErrorResult, getSessionUser } from "../../lib/session";
import { getProviderToken } from "../../../lib/auth/tokens.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("api.upload");

const COMMONS_BASE_URL = process.env.COMMONS_API_URL || "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL = "https://nccommons.org/w/api.php";

const generateRandomId = () => Math.random().toString(36).substring(7);

// overwrite path is still single-shot, so it keeps a 100 MB cap
const MAX_OVERWRITE_BYTES = 100 * 1024 * 1024;

export const POST = async (req) => {
  const user = await getSessionUser();
  if (!user) {
    log.warn("overwrite upload unauthorized");
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const data = await req.formData();
  const filename = data.get("filename");
  const text = data.get("text");
  const file = data.get("file");
  if (
    !file ||
    typeof file.arrayBuffer !== "function" ||
    file.size > MAX_OVERWRITE_BYTES
  ) {
    log.warn("overwrite upload rejected: file too large", {
      size: file?.size,
    });
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  const comment = data.get("comment");
  const provider = data.get("provider");
  const fileId = generateRandomId();
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const fileLocation = `./${fileId}.${filename.split(".").pop()}`;
  log.info("overwrite upload started", {
    filename,
    provider,
    size: file.size,
    userId: String(user._id),
  });
  await fs.promises.writeFile(fileLocation, fileBuffer);
  // wait 500ms
  await new Promise((resolve) => setTimeout(resolve, 200));

  const baseUrl =
    provider === "nccommons" ? NCCOMMONS_BASE_URL : COMMONS_BASE_URL;
  let token;
  try {
    token = await getProviderToken(user._id, provider);
  } catch (err) {
    const mapped = authErrorResult(err);
    if (mapped) {
      await fs.promises.unlink(fileLocation).catch(() => {});
      return NextResponse.json(mapped, { status: 401 });
    }
    throw err;
  }
  const fileStream = fs.createReadStream(fileLocation);

  let response;
  try {
    response = await uploadFileToCommons(baseUrl, token, {
      filename,
      text,
      comment,
      file: fileStream,
    });
  } catch (err) {
    log.error("overwrite upload failed", { filename, provider, err });
    await fs.promises.unlink(fileLocation).catch(() => {});
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  if (response?.imageinfo?.descriptionurl) {
    try {
      const existingUpload = await ImageUploadModel.findOne({
        url: response.imageinfo.descriptionurl,
      });

      if (!existingUpload) {
        await ImageUploadModel.create({
          url: response.imageinfo.descriptionurl,
          fileName: filename,
          provider: provider === "nccommons" ? "nccommons" : "commons",
          uploadedBy: user._id,
        });
      }
    } catch (err) {
      log.warn("failed to save upload record", { filename, err });
    }
  }

  await fs.promises.unlink(fileLocation);
  return NextResponse.json(response);
};
