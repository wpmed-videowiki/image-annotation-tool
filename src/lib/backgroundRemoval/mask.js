import { DEFAULT_BACKGROUND_REMOVAL_THRESHOLD } from "../../app/config/constants.js";

// min-max normalise to 0..1; a constant prediction becomes zeros, not NaN
export const normalizeMask = (pred) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pred.length; i++) {
    if (pred[i] < min) min = pred[i];
    if (pred[i] > max) max = pred[i];
  }
  const out = new Float32Array(pred.length);
  const range = max - min;
  if (!(range > 1e-12)) return out;
  for (let i = 0; i < pred.length; i++) {
    out[i] = (pred[i] - min) / range;
  }
  return out;
};

// missing -> default, numeric -> clamped 0..100, anything else -> null (400)
export const parseThreshold = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_BACKGROUND_REMOVAL_THRESHOLD;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
};

// alpha = clamp((v - t) / (1 - t)); 0 keeps the soft mask, 100 is a hard cut
export const maskToAlpha = (norm, threshold) => {
  const t = threshold / 100;
  const denom = Math.max(1 - t, 1e-6);
  const out = new Uint8Array(norm.length);
  for (let i = 0; i < norm.length; i++) {
    const a = (norm[i] - t) / denom;
    out[i] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
  }
  return out;
};

// in place; transparent input pixels stay transparent
export const applyMaskToAlpha = (rgba, mask) => {
  if (rgba.length !== mask.length * 4) {
    throw new RangeError(
      `rgba length ${rgba.length} does not match mask length ${mask.length}`
    );
  }
  for (let i = 0, a = 3; i < mask.length; i++, a += 4) {
    if (mask[i] < rgba[a]) rgba[a] = mask[i];
  }
  return rgba;
};
