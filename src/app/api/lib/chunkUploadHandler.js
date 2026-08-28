import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOADS_TMP_DIR, ensureTmpDirs } from "../../../lib/videoTmp.js";
import { createLogger } from "../../../lib/logger.js";
import { getSessionUser } from "../../lib/session";

const log = createLogger("api.chunk-upload");

// Shared POST handler for chunked device uploads (video and image routes).
// Chunks are appended to a single file in UPLOADS_TMP_DIR keyed by a random
// upload id; abandoned files are reaped by the video worker's temp sweeper.
export const createChunkUploadHandler = ({ maxTotalBytes, chunkBytes }) =>
  async (req) => {
    const user = await getSessionUser();
    if (!user) {
      log.warn("chunk upload unauthorized");
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
      totalBytes > maxTotalBytes
    ) {
      log.warn("chunk upload rejected: file too large", {
        totalBytes,
        maxTotalBytes,
      });
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }

    if (chunkIndex === 0) {
      uploadId = crypto.randomBytes(16).toString("hex");
    } else if (!/^[a-f0-9]{32}$/.test(uploadId)) {
      log.warn("chunk upload rejected: invalid upload id", { chunkIndex });
      return NextResponse.json({ error: "invalid upload id" }, { status: 400 });
    }
    const filePath = path.join(UPLOADS_TMP_DIR, uploadId);

    if (chunkIndex > 0) {
      const stat = await fs.promises.stat(filePath).catch(() => null);
      const expectedOffset = chunkIndex * chunkBytes;
      if (!stat || stat.size !== expectedOffset) {
        log.warn("chunk out of order", {
          uploadId,
          chunkIndex,
          expectedOffset,
          actualSize: stat?.size ?? 0,
        });
        return NextResponse.json(
          { error: "chunk out of order", expectedOffset: stat?.size ?? 0 },
          { status: 409 }
        );
      }
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    if (!buffer.length) {
      log.warn("chunk upload rejected: empty chunk", { uploadId, chunkIndex });
      return NextResponse.json({ error: "empty chunk" }, { status: 400 });
    }
    if ((chunkIndex * chunkBytes) + buffer.length > maxTotalBytes) {
      log.warn("chunk upload rejected: file too large", {
        uploadId,
        chunkIndex,
        maxTotalBytes,
      });
      await fs.promises.unlink(filePath).catch(() => {});
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }
    await fs.promises.writeFile(filePath, buffer, {
      flag: chunkIndex === 0 ? "w" : "a",
    });

    if (chunkIndex === totalChunks - 1) {
      const finalSize = (await fs.promises.stat(filePath)).size;
      if (finalSize !== totalBytes) {
        log.warn("chunk upload rejected: size mismatch", {
          uploadId,
          finalSize,
          totalBytes,
        });
        await fs.promises.unlink(filePath).catch(() => {});
        return NextResponse.json({ error: "size mismatch" }, { status: 400 });
      }
      log.info("chunk upload assembled", { uploadId, totalBytes, totalChunks });
    }

    return NextResponse.json({ uploadId });
  };
