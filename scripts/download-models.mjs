// Downloads the AI background-removal model weights and verifies their MD5.
//
//   node scripts/download-models.mjs          download anything missing/corrupt
//   node scripts/download-models.mjs --check  verify only, exit 1 when missing
//   node scripts/download-models.mjs --force  re-download even when present
//
// The weights are not committed: run this after cloning. The Docker build runs it too.
// Destination: models/<file>, or BACKGROUND_REMOVAL_MODEL_PATH for u2netp.onnx.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MODELS = [
  {
    file: "u2netp.onnx",
    url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
    md5: "8e83ca70e441ab06c318d82300c84806",
    envPath: "BACKGROUND_REMOVAL_MODEL_PATH",
  },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const force = args.has("--force");

const md5Of = async (file) => {
  const hash = createHash("md5");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};

// stream to <dest>.part while hashing; the caller renames on a match
const download = async (url, dest) => {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  const hash = createHash("md5");
  let bytes = 0;
  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body), tap, fs.createWriteStream(part));
  } catch (err) {
    await fs.promises.rm(part, { force: true });
    throw err;
  }
  return { part, md5: hash.digest("hex"), bytes };
};

let failed = false;
for (const model of MODELS) {
  const dest =
    process.env[model.envPath] || path.join(ROOT, "models", model.file);

  if (fs.existsSync(dest) && !force) {
    const actual = await md5Of(dest);
    if (actual === model.md5) {
      console.log(`${model.file}: ok (${dest})`);
      continue;
    }
    console.error(
      `${model.file}: checksum mismatch at ${dest}: expected ${model.md5}, got ${actual}`
    );
    if (checkOnly) {
      failed = true;
      continue;
    }
  } else if (checkOnly) {
    console.error(
      `${model.file}: missing at ${dest}; run \`npm run models:download\``
    );
    failed = true;
    continue;
  }

  console.log(`${model.file}: downloading ${model.url}`);
  const { part, md5, bytes } = await download(model.url, dest);
  if (md5 !== model.md5) {
    await fs.promises.rm(part, { force: true });
    console.error(
      `${model.file}: checksum mismatch after download: expected ${model.md5}, got ${md5}`
    );
    failed = true;
    continue;
  }
  await fs.promises.rename(part, dest);
  console.log(`${model.file}: saved ${bytes} bytes to ${dest} (md5 ${md5})`);
}

process.exit(failed ? 1 : 0);
