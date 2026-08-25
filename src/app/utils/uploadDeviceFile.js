import { VIDEO_SERVER_CHUNK_BYTES } from "../config/constants";

const MAX_CHUNK_ATTEMPTS = 3;

// Chunk-uploads a device video to /api/video/upload-chunk.
export const uploadDeviceFileToServer = async (file, onProgress = () => {}) => {
  const totalChunks = Math.ceil(file.size / VIDEO_SERVER_CHUNK_BYTES) || 1;
  let uploadId = "";
  let lastResponse = null;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(
      i * VIDEO_SERVER_CHUNK_BYTES,
      (i + 1) * VIDEO_SERVER_CHUNK_BYTES
    );
    let attempt = 0;
    for (;;) {
      const response = await fetch("/api/video/upload-chunk", {
        method: "POST",
        body: chunk,
        headers: {
          "content-type": "application/octet-stream",
          "x-chunk-index": String(i),
          "x-total-chunks": String(totalChunks),
          "x-total-bytes": String(file.size),
          "x-file-name": encodeURIComponent(file.name),
          ...(uploadId ? { "x-upload-id": uploadId } : {}),
        },
      });
      if (response.ok) {
        lastResponse = await response.json();
        uploadId = lastResponse.uploadId;
        break;
      }
      attempt += 1;
      if (attempt >= MAX_CHUNK_ATTEMPTS) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload video to the server");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    onProgress(((i + 1) / totalChunks) * 100);
  }

  return lastResponse;
};
