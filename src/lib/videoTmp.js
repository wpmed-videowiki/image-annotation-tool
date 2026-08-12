import fs from "fs";
import os from "os";
import path from "path";

// Temp storage shared by the web app (device-upload chunks land here via
// /api/video/upload-chunk) and the video worker (which reads them and works
// in per-job dirs). In Docker both containers must mount the same volume at
// VIDEO_TMP_DIR.
export const VIDEO_TMP_DIR =
  process.env.VIDEO_TMP_DIR || path.join(os.tmpdir(), "image-annotation-video");
export const UPLOADS_TMP_DIR = path.join(VIDEO_TMP_DIR, "uploads");
export const JOBS_TMP_DIR = path.join(VIDEO_TMP_DIR, "jobs");

export const ensureTmpDirs = () => {
  fs.mkdirSync(UPLOADS_TMP_DIR, { recursive: true });
  fs.mkdirSync(JOBS_TMP_DIR, { recursive: true });
};
