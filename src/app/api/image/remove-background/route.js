import { NextResponse } from "next/server";

import { getSessionUser } from "../../../lib/session";
import { MAX_BACKGROUND_REMOVAL_BYTES } from "../../../config/constants";
import { createLogger } from "../../../../lib/logger.js";
import {
  backgroundRemovalLimiter,
  getModelStatus,
  parseThreshold,
  removeBackground,
} from "../../../../lib/backgroundRemoval/index.js";

const log = createLogger("api.image.remove-background");

// GET reads the filesystem and env, so it must never be prerendered
export const dynamic = "force-dynamic";

const json = (body, status, headers) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

// availability probe for the editor button; no auth, it only says whether the model exists
export const GET = async () => json(await getModelStatus(), 200);

// error class -> [status, code]
const ERROR_RESPONSES = {
  InvalidImageError: [400, "invalid_file"],
  ImageTooLargeError: [413, "image_too_large"],
  LimiterSaturatedError: [503, "busy"],
  ModelMissingError: [503, "model_missing"],
  ModelLoadError: [503, "model_load_failed"],
};

// runs U²-Net-p on the editor PNG and returns it with the background transparent
export const POST = async (req) => {
  const user = await getSessionUser();
  if (!user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const data = await req.formData();
  const file = data.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "invalid_file" }, 400);
  }
  if (file.size <= 0 || file.size > MAX_BACKGROUND_REMOVAL_BYTES) {
    return json({ error: "file_too_large" }, 413);
  }
  const threshold = parseThreshold(data.get("threshold"));
  if (threshold === null) {
    return json({ error: "invalid_threshold" }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { png, width, height, timings } = await backgroundRemovalLimiter.run(
      () => removeBackground(buffer, { threshold })
    );
    log.info("background removed", {
      width,
      height,
      threshold,
      bytesIn: buffer.length,
      bytesOut: png.length,
      ...timings,
    });
    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Image-Width": String(width),
        "X-Image-Height": String(height),
      },
    });
  } catch (err) {
    const mapped = ERROR_RESPONSES[err?.name];
    if (mapped) {
      const [status, code] = mapped;
      return json({ error: code }, status, code === "busy" ? { "Retry-After": "2" } : undefined);
    }
    log.error("background removal failed", { size: file.size, threshold, err });
    return json({ error: "removal_failed" }, 422);
  }
};
