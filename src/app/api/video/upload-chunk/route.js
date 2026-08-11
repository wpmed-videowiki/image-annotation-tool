import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOADS_TMP_DIR, ensureTmpDirs } from "../../../../lib/videoTmp.js";
import {
  MAX_DEVICE_VIDEO_BYTES,
  VIDEO_SERVER_CHUNK_BYTES,
} from "../../../config/constants";

export const POST = async (req) => {
  const appUserId = req.cookies.get("app-user-id")?.value;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  ensureTmpDirs();

  const chunkIndex = parseInt(req.headers.get("x-chunk-index") || "0", 10);
  const totalChunks = parseInt(req.headers.get("x-total-chunks") || "1", 10);
  const totalBytes = parseInt(req.headers.get("x-total-bytes") || "0", 10);
  let uploadId = req.headers.get("x-upload-id") || "";

  if (
    !Number.isFinite(totalBytes) ||
    totalBytes <= 0 ||
    totalBytes > MAX_DEVICE_VIDEO_BYTES
  ) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  if (chunkIndex === 0) {
    uploadId = crypto.randomBytes(16).toString("hex");
  } else if (!/^[a-f0-9]{32}$/.test(uploadId)) {
    return NextResponse.json({ error: "invalid upload id" }, { status: 400 });
  }
  const filePath = path.join(UPLOADS_TMP_DIR, uploadId);

  if (chunkIndex > 0) {
    const stat = await fs.promises.stat(filePath).catch(() => null);
    const expectedOffset = chunkIndex * VIDEO_SERVER_CHUNK_BYTES;
    if (!stat || stat.size !== expectedOffset) {
      return NextResponse.json(
        { error: "chunk out of order", expectedOffset: stat?.size ?? 0 },
        { status: 409 }
      );
    }
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  if (!buffer.length) {
    return NextResponse.json({ error: "empty chunk" }, { status: 400 });
  }
  if (
    (chunkIndex * VIDEO_SERVER_CHUNK_BYTES) + buffer.length >
    MAX_DEVICE_VIDEO_BYTES
  ) {
    await fs.promises.unlink(filePath).catch(() => {});
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  await fs.promises.writeFile(filePath, buffer, {
    flag: chunkIndex === 0 ? "w" : "a",
  });

  if (chunkIndex === totalChunks - 1) {
    const finalSize = (await fs.promises.stat(filePath)).size;
    if (finalSize !== totalBytes) {
      await fs.promises.unlink(filePath).catch(() => {});
      return NextResponse.json({ error: "size mismatch" }, { status: 400 });
    }
  }

  return NextResponse.json({ uploadId });
};
