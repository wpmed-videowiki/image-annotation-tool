import { spawn } from "child_process";

const WEBM_VIDEO_CODECS = ["vp8", "vp9", "av1"];
const WEBM_AUDIO_CODECS = ["vorbis", "opus"];
const STDERR_TAIL_LINES = 50;

export const ffprobeFile = (filePath) =>
  new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration,format_name",
      "-show_entries",
      "stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      filePath,
    ];
    const proc = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => (stdout += data));
    proc.stderr.on("data", (data) => (stderr += data));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe exited with code ${code}: ${stderr.slice(-500)}`)
        );
      }
      try {
        const data = JSON.parse(stdout);
        const videoStream = (data.streams || []).find(
          (stream) => stream.codec_type === "video"
        );
        const audioStream = (data.streams || []).find(
          (stream) => stream.codec_type === "audio"
        );
        const durationSec = parseFloat(data.format?.duration);
        if (!videoStream || !videoStream.width || !videoStream.height) {
          return reject(new Error("no video stream found"));
        }
        if (!Number.isFinite(durationSec) || durationSec <= 0) {
          return reject(new Error("invalid video duration"));
        }
        resolve({
          durationSec,
          width: videoStream.width,
          height: videoStream.height,
          hasAudio: !!audioStream,
          container: data.format?.format_name || "",
          vcodec: videoStream.codec_name || "",
          acodec: audioStream?.codec_name || "",
        });
      } catch (err) {
        reject(err);
      }
    });
  });

export const buildFfmpegArgs = ({ inputPath, outputPath, ops, probe }) => {
  const rotation = ops.rotation || 0;
  const trim =
    ops.trim &&
    typeof ops.trim.start === "number" &&
    typeof ops.trim.end === "number"
      ? ops.trim
      : null;
  const crop = ops.crop || null;
  const mute = !!ops.mute;

  const outputDurationSec = trim
    ? Math.min(trim.end, probe.durationSec) - trim.start
    : probe.durationSec;

  // Copy path: WebM in, no reframing ops, and audio (if kept) already
  // WebM-compatible. Trim is excluded because -c copy only cuts at
  // keyframes, which would silently shift the in-point.
  const isWebmCompatible =
    WEBM_VIDEO_CODECS.includes(probe.vcodec) &&
    (mute || !probe.hasAudio || WEBM_AUDIO_CODECS.includes(probe.acodec));
  const canCopy = isWebmCompatible && rotation === 0 && !crop && !trim;

  const args = ["-y", "-hide_banner", "-nostdin", "-loglevel", "error"];

  if (canCopy) {
    args.push("-i", inputPath, "-map", "0:v:0");
    if (mute) {
      args.push("-an");
    } else {
      args.push("-map", "0:a:0?");
    }
    args.push("-c", "copy", "-progress", "pipe:1", outputPath);
    return { args, strategy: "copy", outputDurationSec };
  }

  if (trim) args.push("-ss", String(trim.start));
  args.push("-i", inputPath);
  if (trim) args.push("-t", String(outputDurationSec));
  args.push("-map", "0:v:0");
  if (!mute) args.push("-map", "0:a:0?");

  const filters = [];
  if (rotation === 90) filters.push("transpose=1");
  else if (rotation === 180) filters.push("transpose=1,transpose=1");
  else if (rotation === 270) filters.push("transpose=2");
  if (crop) {
    // crop coords are normalized relative to the rotated frame; transpose
    // runs first in the chain, so the rect maps 1:1. Values are floored to
    // even numbers for yuv420p.
    const rotatedW = rotation % 180 === 0 ? probe.width : probe.height;
    const rotatedH = rotation % 180 === 0 ? probe.height : probe.width;
    const x = Math.floor((crop.x * rotatedW) / 2) * 2;
    const y = Math.floor((crop.y * rotatedH) / 2) * 2;
    const w = Math.max(
      2,
      Math.min(Math.floor((crop.w * rotatedW) / 2) * 2, rotatedW - x)
    );
    const h = Math.max(
      2,
      Math.min(Math.floor((crop.h * rotatedH) / 2) * 2, rotatedH - y)
    );
    filters.push(`crop=${w}:${h}:${x}:${y}`);
  }
  if (filters.length) args.push("-vf", filters.join(","));

  args.push(
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "32",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-cpu-used",
    "4",
    "-deadline",
    "good",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "240"
  );
  if (mute) {
    args.push("-an");
  } else {
    args.push("-c:a", "libopus", "-b:a", "128k");
  }
  args.push("-progress", "pipe:1", outputPath);
  return { args, strategy: "encode", outputDurationSec };
};

const SIGKILL_GRACE_MS = 5000;

// `signal` (AbortSignal) kills the encode; the rejection carries
// name "JobCancelledError" so runners treat it like any other cancel
export const runFfmpeg = (args, { durationSec, onProgress, signal } = {}) =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    const stderrLines = [];
    let stdoutBuffer = "";
    let aborted = false;
    let killTimer = null;
    const onAbort = () => {
      aborted = true;
      proc.kill("SIGTERM");
      killTimer = setTimeout(() => proc.kill("SIGKILL"), SIGKILL_GRACE_MS);
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    proc.stdout.on("data", (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop();
      for (const line of lines) {
        const [key, value] = line.trim().split("=");
        if (key === "out_time_us" && durationSec && onProgress) {
          const percent = Math.min(
            99,
            (parseInt(value, 10) / (durationSec * 1e6)) * 100
          );
          if (Number.isFinite(percent)) onProgress(percent);
        }
      }
    });
    proc.stderr.on("data", (data) => {
      stderrLines.push(...data.toString().split("\n").filter(Boolean));
      while (stderrLines.length > STDERR_TAIL_LINES) stderrLines.shift();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      if (aborted) {
        return reject(
          Object.assign(new Error("ffmpeg cancelled"), { name: "JobCancelledError" })
        );
      }
      if (code === 0) return resolve();
      const err = new Error(`ffmpeg exited with code ${code}`);
      err.stderrTail = stderrLines.join("\n");
      reject(err);
    });
  });
