import fs from "node:fs";
import path from "node:path";
import * as ortModule from "onnxruntime-node";

import {
  BACKGROUND_REMOVAL_MODEL_INPUT_SIZE,
  DEFAULT_BACKGROUND_REMOVAL_THREADS,
} from "../../app/config/constants.js";
import { createLogger } from "../logger.js";

// onnxruntime-node is CommonJS with __esModule set: bare Node exposes it as
// the namespace's default, webpack (Next) exposes the named exports directly
const ort = ortModule.default ?? ortModule;
const { InferenceSession, Tensor } = ort;
const log = createLogger("background-removal.model");

export const MODEL_NAME = "u2netp";
export const MODEL_FILE = "u2netp.onnx";

export class ModelMissingError extends Error {
  constructor(modelPath) {
    super(`model file not found: ${modelPath}`);
    this.name = "ModelMissingError";
    this.path = modelPath;
  }
}

export class ModelLoadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ModelLoadError";
    this.cause = cause;
  }
}

export const resolveModelPath = (env = process.env) =>
  env.BACKGROUND_REMOVAL_MODEL_PATH ||
  path.join(process.cwd(), "models", MODEL_FILE);

export const resolveThreadCount = (env = process.env) => {
  const n = parseInt(env.BACKGROUND_REMOVAL_THREADS, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BACKGROUND_REMOVAL_THREADS;
};

// on globalThis so an HMR re-evaluation reuses the loaded session
const cache =
  globalThis.__backgroundRemoval ||
  (globalThis.__backgroundRemoval = { promise: null, lastError: null });

const modelReadable = async (modelPath) => {
  try {
    await fs.promises.access(modelPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

// availability probe; never creates a session
export const getModelStatus = async () => {
  const modelPath = resolveModelPath();
  if (!(await modelReadable(modelPath))) {
    return { available: false, model: MODEL_NAME, reason: "model_missing" };
  }
  if (cache.lastError) {
    return { available: false, model: MODEL_NAME, reason: "model_load_failed" };
  }
  return { available: true, model: MODEL_NAME };
};

const sessionOptions = () => ({
  executionProviders: ["cpu"],
  intraOpNumThreads: resolveThreadCount(),
  interOpNumThreads: 1,
  executionMode: "sequential",
  graphOptimizationLevel: "all",
  enableCpuMemArena: true,
  logSeverityLevel: 3,
});

const loadSession = async () => {
  const modelPath = resolveModelPath();
  if (!(await modelReadable(modelPath))) {
    log.error("model file missing; run `npm run models:download`", { modelPath });
    throw new ModelMissingError(modelPath);
  }
  let session;
  try {
    session = await InferenceSession.create(modelPath, sessionOptions());
  } catch (err) {
    log.error("model failed to load", { modelPath, err });
    throw new ModelLoadError(`model failed to load: ${modelPath}`, err);
  }
  if (session.inputNames.length !== 1 || session.outputNames.length < 1) {
    throw new ModelLoadError(
      `unexpected model signature: ${session.inputNames.length} inputs, ${session.outputNames.length} outputs`
    );
  }
  log.info("model loaded", {
    modelPath,
    threads: resolveThreadCount(),
    inputs: session.inputNames,
    outputs: session.outputNames,
  });
  return session;
};

export const getSession = () => {
  if (!cache.promise) {
    cache.promise = loadSession().then(
      (session) => {
        cache.lastError = null;
        return session;
      },
      (err) => {
        // remember only a broken load; a missing file is reported by getModelStatus
        cache.promise = null;
        cache.lastError = err instanceof ModelMissingError ? null : err;
        throw err;
      }
    );
  }
  return cache.promise;
};

// CHW float32 input -> the fused saliency map (row-major size*size floats)
export const runSaliency = async (session, input) => {
  const size = BACKGROUND_REMOVAL_MODEL_INPUT_SIZE;
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const feeds = { [inputName]: new Tensor("float32", input, [1, 3, size, size]) };
  const results = await session.run(feeds, [outputName]);
  const out = results[outputName];
  const count = out.dims.reduce((a, b) => a * b, 1);
  if (out.type !== "float32" || count !== size * size) {
    throw new ModelLoadError(
      `unexpected model output: ${out.type} ${JSON.stringify(out.dims)}`
    );
  }
  return out.data;
};
