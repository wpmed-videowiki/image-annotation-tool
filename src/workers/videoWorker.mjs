import "dotenv/config";
const { default: connectDB } = await import("../app/api/lib/connectDB.js");
const { ensureTmpDirs } = await import("../lib/videoTmp.js");
const {
  MAX_CONCURRENT_VIDEO_JOBS,
  recoverStaleJobs,
  startNextQueuedJob,
  sweepTempFiles,
} = await import("./videoJobRunner.mjs");

const POLL_INTERVAL_MS = 10 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await connectDB();
console.log("Video worker: connected to database");
ensureTmpDirs();

await recoverStaleJobs(0);

let lastSweep = 0;
console.log(
  `Video worker: polling every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_CONCURRENT_VIDEO_JOBS} concurrent jobs`
);
for (;;) {
  try {
    await recoverStaleJobs();
    for (let i = 0; i < MAX_CONCURRENT_VIDEO_JOBS; i++) {
      const started = await startNextQueuedJob();
      if (!started) break;
      console.log("Video worker: started a queued job");
    }
    if (Date.now() - lastSweep > SWEEP_INTERVAL_MS) {
      lastSweep = Date.now();
      await sweepTempFiles();
    }
  } catch (err) {
    console.log("Video worker: loop error", err);
  }
  await sleep(POLL_INTERVAL_MS);
}
