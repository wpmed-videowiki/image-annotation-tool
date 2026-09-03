import sharp from "sharp";

import {
  BACKGROUND_REMOVAL_MAX_CONCURRENT,
  BACKGROUND_REMOVAL_MAX_QUEUE,
  MAX_BACKGROUND_REMOVAL_PIXELS,
} from "../../app/config/constants.js";
import { createLimiter } from "./limiter.js";
import {
  applyMaskToAlpha,
  maskToAlpha,
  normalizeMask,
  parseThreshold,
} from "./mask.js";
import { MODEL_NAME, getSession, runSaliency } from "./model.js";
import { MODEL_INPUT_SIZE, rgbToModelInput } from "./preprocess.js";

export { LimiterSaturatedError } from "./limiter.js";
export { ModelLoadError, ModelMissingError, getModelStatus } from "./model.js";
export { parseThreshold };

export class InvalidImageError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "InvalidImageError";
  }
}

export class ImageTooLargeError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageTooLargeError";
  }
}

// what the editor sends; svg, gif etc. are refused rather than rasterised
const DECODABLE_FORMATS = new Set(["png", "jpeg", "webp"]);

// shared across requests: one inference at a time bounds peak memory
export const backgroundRemovalLimiter = createLimiter({
  maxConcurrent: BACKGROUND_REMOVAL_MAX_CONCURRENT,
  maxQueue: BACKGROUND_REMOVAL_MAX_QUEUE,
});

const ms = (from, to) => Math.round(to - from);

// image bytes -> transparent PNG, alpha = min(existing alpha, mask)
export const removeBackground = async (input, { threshold }) => {
  const t0 = performance.now();

  // header only, no pixel allocation
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch (err) {
    throw new InvalidImageError("input is not a decodable image", { cause: err });
  }
  if (!DECODABLE_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new InvalidImageError(`unsupported input format: ${meta.format}`);
  }
  if (meta.width * meta.height > MAX_BACKGROUND_REMOVAL_PIXELS) {
    throw new ImageTooLargeError(
      `${meta.width}x${meta.height} exceeds ${MAX_BACKGROUND_REMOVAL_PIXELS} pixels`
    );
  }

  const { data: rgba, info } = await sharp(input, {
    limitInputPixels: MAX_BACKGROUND_REMOVAL_PIXELS,
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // transparent areas go to the model as white; min() keeps them transparent
  const rgb = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
  const t1 = performance.now();

  const session = await getSession();
  const pred = await runSaliency(session, rgbToModelInput(rgb));
  const t2 = performance.now();

  const alpha = maskToAlpha(normalizeMask(pred), threshold);
  const mask = await sharp(Buffer.from(alpha.buffer, alpha.byteOffset, alpha.byteLength), {
    raw: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE, channels: 1 },
  })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("b-w") // keep a single channel; resize would emit sRGB
    .raw()
    .toBuffer();
  applyMaskToAlpha(rgba, mask);

  // level 3: the browser consumes this immediately, so encode speed beats size
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 3 })
    .toBuffer();
  const t3 = performance.now();

  return {
    png,
    width,
    height,
    model: MODEL_NAME,
    timings: {
      decodeMs: ms(t0, t1),
      inferMs: ms(t1, t2),
      encodeMs: ms(t2, t3),
      totalMs: ms(t0, t3),
    },
  };
};
