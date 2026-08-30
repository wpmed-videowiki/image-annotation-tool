import fs from "fs";
import {
  fetchCSRFToken,
  updateArticleText,
  uploadFileToCommons,
} from "../app/api/utils/uploadUtils.js";
import { createLogger } from "../lib/logger.js";

export const COMMONS_CHUNK_BYTES = 10 * 1024 * 1024;
export const COMMONS_SINGLE_SHOT_MAX_BYTES = 95 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 3;
const CHECKSTATUS_INTERVAL_MS = 3000;
const CHECKSTATUS_TIMEOUT_MS = 15 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const postUpload = async (baseUrl, token, fields) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Blob) {
      formData.append(key, value, "chunk.bin");
    } else {
      formData.append(key, String(value));
    }
  }
  const response = await fetch(`${baseUrl}?format=json`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const data = await response.json();
  if (data.error) {
    const err = new Error(data.error.code || "upload failed");
    err.info = data.error.info || "";
    throw err;
  }
  if (!data.upload) {
    throw new Error("unexpected upload response");
  }
  return data.upload;
};

// Chunked upload per https://www.mediawiki.org/wiki/API:Upload#Chunked_uploading
// Falls back to the existing single-shot upload for small files.
export const uploadFileToCommonsChunked = async (
  baseUrl,
  token,
  {
    filename,
    text,
    comment,
    filePath,
    onProgress = () => {},
    onStage = () => {},
    // fired on every checkstatus poll so callers can keep a liveness
    // heartbeat while Commons assembles the file (can take many minutes
    // with no progress change)
    onPoll = () => {},
    // cancel checkpoint; may throw to abort. Only consulted before the
    // final publish request: past that point the file is public and the
    // job is no longer cancellable.
    onCheckpoint = async () => {},
    // runners inject their per-job child logger
    log = createLogger("commons.chunked-upload"),
  }
) => {
  const size = (await fs.promises.stat(filePath)).size;
  await onCheckpoint();
  if (size <= COMMONS_SINGLE_SHOT_MAX_BYTES) {
    log.debug("file under chunk threshold, single-shot upload", { size });
    return uploadFileToCommons(baseUrl, token, {
      filename,
      text,
      comment,
      file: fs.createReadStream(filePath),
    });
  }

  const totalChunks = Math.ceil(size / COMMONS_CHUNK_BYTES);
  log.info("chunked upload starting", { filename, size, totalChunks });
  let csrfToken = await fetchCSRFToken(baseUrl, token);
  let filekey = null;
  let offset = 0;
  let chunkIndex = 0;
  const fileHandle = await fs.promises.open(filePath, "r");

  try {
    while (offset < size) {
      await onCheckpoint();
      const length = Math.min(COMMONS_CHUNK_BYTES, size - offset);
      const buffer = Buffer.alloc(length);
      await fileHandle.read(buffer, 0, length, offset);
      onStage(`stashing chunk ${chunkIndex + 1}/${totalChunks}`);

      let upload;
      let attempt = 0;
      for (;;) {
        try {
          upload = await postUpload(baseUrl, token, {
            action: "upload",
            stash: 1,
            filename,
            filesize: size,
            offset,
            token: csrfToken,
            ignorewarnings: 1,
            ...(filekey ? { filekey } : {}),
            chunk: new Blob([buffer], { type: "application/octet-stream" }),
          });
          break;
        } catch (err) {
          attempt += 1;
          if (attempt >= MAX_CHUNK_ATTEMPTS) throw err;
          const backoffMs = 1000 * Math.pow(3, attempt - 1);
          log.warn("chunk upload attempt failed, retrying", {
            chunkIndex,
            attempt,
            backoffMs,
            err,
          });
          if (err.message === "badtoken") {
            log.warn("csrf token rejected, refreshing", { chunkIndex });
            csrfToken = await fetchCSRFToken(baseUrl, token);
          }
          await sleep(backoffMs);
        }
      }

      if (upload.filekey) filekey = upload.filekey;
      if (upload.result === "Success") {
        offset = size;
        break;
      }
      if (upload.result !== "Continue") {
        throw new Error(`unexpected stash result: ${upload.result}`);
      }
      // trust the server-reported offset so a partially-received chunk
      // re-syncs instead of corrupting the stash
      if (typeof upload.offset === "number" && upload.offset !== offset + length) {
        log.warn("server offset resync", {
          expected: offset + length,
          serverOffset: upload.offset,
        });
      }
      offset =
        typeof upload.offset === "number" ? upload.offset : offset + length;
      chunkIndex += 1;
      log.debug("chunk stashed", { chunkIndex, offset, totalChunks });
      onProgress((offset / size) * 95);
    }

    if (!filekey) throw new Error("no filekey returned by stash upload");

    onStage("publishing");
    log.info("publishing stashed file", { filename, filekey });
    let upload = await postUpload(baseUrl, token, {
      action: "upload",
      filekey,
      filename,
      comment: comment || "",
      text,
      token: csrfToken,
      ignorewarnings: 1,
      async: 1,
    });

    const deadline = Date.now() + CHECKSTATUS_TIMEOUT_MS;
    while (
      upload.result === "Poll" ||
      upload.result === "Queued" ||
      upload.result === "Continue"
    ) {
      if (Date.now() > deadline) {
        throw new Error(
          "Publishing timed out - the file may still appear on Commons shortly"
        );
      }
      await sleep(CHECKSTATUS_INTERVAL_MS);
      onPoll();
      upload = await postUpload(baseUrl, token, {
        action: "upload",
        checkstatus: 1,
        filekey,
        token: csrfToken,
      });
      log.debug("publish checkstatus", { result: upload.result });
    }

    if (upload.result !== "Success") {
      if (upload.warnings) {
        throw new Error(
          `upload warning: ${Object.keys(upload.warnings).join(", ")}`
        );
      }
      throw new Error(`unexpected publish result: ${upload.result}`);
    }

    log.info("publish accepted", { filename });
    onProgress(100);
    await updateArticleText(baseUrl, token, { title: filename, text });
    return upload;
  } finally {
    await fileHandle.close();
  }
};
