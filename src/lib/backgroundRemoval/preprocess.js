import { BACKGROUND_REMOVAL_MODEL_INPUT_SIZE } from "../../app/config/constants.js";

export const MODEL_INPUT_SIZE = BACKGROUND_REMOVAL_MODEL_INPUT_SIZE;
export const IMAGENET_MEAN = [0.485, 0.456, 0.406];
export const IMAGENET_STD = [0.229, 0.224, 0.225];

// RGB bytes -> planar CHW float32 the U²-Net way: scale by the max byte,
// then ImageNet mean/std per channel
export const rgbToModelInput = (rgb, size = MODEL_INPUT_SIZE) => {
  const pixels = size * size;
  if (rgb.length !== pixels * 3) {
    throw new RangeError(`expected ${pixels * 3} RGB bytes, got ${rgb.length}`);
  }
  let maxByte = 0;
  for (let i = 0; i < rgb.length; i++) {
    if (rgb[i] > maxByte) maxByte = rgb[i];
  }
  const scale = 1 / Math.max(maxByte, 1e-6);
  const out = new Float32Array(pixels * 3);
  for (let c = 0; c < 3; c++) {
    const mean = IMAGENET_MEAN[c];
    const std = IMAGENET_STD[c];
    const plane = c * pixels;
    for (let p = 0; p < pixels; p++) {
      out[plane + p] = (rgb[p * 3 + c] * scale - mean) / std;
    }
  }
  return out;
};
