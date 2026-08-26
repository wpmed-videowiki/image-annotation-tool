import { createChunkUploadHandler } from "../../lib/chunkUploadHandler";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  SERVER_CHUNK_BYTES,
} from "../../../config/constants";

export const POST = createChunkUploadHandler({
  maxTotalBytes: MAX_IMAGE_UPLOAD_BYTES,
  chunkBytes: SERVER_CHUNK_BYTES,
});
