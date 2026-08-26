import { buildStructuredData } from "../../utils/structuredData.js";
import { fetchMediaInfoEntityId, writeStructuredData } from "./sdcUtils.js";
import { createLogger } from "../../../lib/logger.js";

// Shared by the image/video job runners. A failure never throws - the file is
// already public by the time SDC is written, so callers record the outcome and
// offer a retry instead of failing the upload. Since errors are swallowed
// here, this is the single place they get logged (callers may inject their
// per-job child logger).
export const writeSdcRecord = async (
  baseUrl,
  token,
  { filename, metadata, summary, log = createLogger("commons.sdc") }
) => {
  const data = buildStructuredData(metadata);
  if (!data) return null;
  let mid = null;
  try {
    if (!token) throw new Error("mwoauth-invalid-authorization");
    mid = await fetchMediaInfoEntityId(baseUrl, token, filename);
    if (!mid) throw new Error("MediaInfo id not found after upload");
    await writeStructuredData(baseUrl, token, { entityId: mid, data, summary });
    return { ok: true, mid, at: new Date() };
  } catch (err) {
    log.warn("sdc write failed", { filename, mid, err });
    return {
      ok: false,
      mid,
      error: err?.message || "sdc write failed",
      info: err?.info || "",
      at: new Date(),
    };
  }
};
