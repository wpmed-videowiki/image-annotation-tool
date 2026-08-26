import { NextResponse } from "next/server";
import convert from "heic-convert";

import connectDB from "../lib/connectDB";
import UserModel from "../../models/User";
import { MAX_HEIC_CONVERT_BYTES } from "../../config/constants";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("api.convert-heic");

// Browsers can't decode HEIC/HEIF, so convert to JPEG here before the editor
// sees the file. heic-convert is WASM, no native deps.
export const POST = async (req) => {
  const appUserId = req.cookies.get("app-user-id")?.value;
  if (!appUserId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  await connectDB();
  const user = await UserModel.findById(appUserId);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const data = await req.formData();
  const file = data.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_HEIC_CONVERT_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const output = await convert({ buffer, format: "JPEG", quality: 0.92 });
    return new NextResponse(Buffer.from(output), {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch (err) {
    log.error("heic conversion failed", { size: file.size, err });
    return NextResponse.json({ error: "conversion_failed" }, { status: 422 });
  }
};
