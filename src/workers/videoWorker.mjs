import "dotenv/config";
const { default: connectDB } = await import("../app/api/lib/connectDB.js");
const { ensureTmpDirs } = await import("../lib/videoTmp.js");
const {
  MAX_CONCURRENT_IMAGE_JOBS,
  MAX_CONCURRENT_VIDEO_JOBS,
  recoverStaleJobs,
  startNextQueuedJob,
  sweepTempFiles,
} = await import("./jobQueue.mjs");
const { createLogger } = await import("../lib/logger.js");

const log = createLogger("worker.loop");

const POLL_INTERVAL_MS = 10 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await connectDB();
log.info("connected to database");
ensureTmpDirs();

await recoverStaleJobs(0);

let lastSweep = 0;
// each kind has its own concurrency budget so image jobs never queue
// behind long video encodes
const KIND_CAPS = {
  video: MAX_CONCURRENT_VIDEO_JOBS,
  image: MAX_CONCURRENT_IMAGE_JOBS,
};

log.info("worker started", {
  pollIntervalMs: POLL_INTERVAL_MS,
  maxVideoJobs: MAX_CONCURRENT_VIDEO_JOBS,
  maxImageJobs: MAX_CONCURRENT_IMAGE_JOBS,
});
for (;;) {
  try {
    await recoverStaleJobs();
    for (const [kind, cap] of Object.entries(KIND_CAPS)) {
      for (let i = 0; i < cap; i++) {
        const started = await startNextQueuedJob(kind);
        if (!started) break;
      }
    }
    if (Date.now() - lastSweep > SWEEP_INTERVAL_MS) {
      lastSweep = Date.now();
      await sweepTempFiles();
    }
  } catch (err) {
    log.error("worker loop error", { err });
  }
  await sleep(POLL_INTERVAL_MS);
}
