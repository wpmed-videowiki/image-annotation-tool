import mongoose from "mongoose";

import UploadMetadataSchema from "./uploadMetadataSchema.js";

const Schema = mongoose.Schema;

const VideoJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "queued",
        "downloading",
        "processing",
        "uploading",
        "publishing",
        "done",
        "error",
      ],
      default: "queued",
      index: true,
    },
    stage: { type: String, default: "" },
    progress: { type: Number, default: 0 },
    ops: { type: Object, required: true }, // { rotation, trim, crop, mute }
    sourceType: { type: String, enum: ["commons", "device"], required: true },
    sourceUrl: { type: String, default: "" },
    deviceUploadId: { type: String, default: "" },
    probe: { type: Object, default: {} },
    // { filename, text, comment, provider, wikiSource }
    target: { type: Object, required: true },
    // wizard answers; absent on pre-wizard jobs, guard on metadata?.version
    metadata: { type: UploadMetadataSchema, default: undefined },
    // SDC write outcome: { ok, mid, error, info, attempts, at }
    sdc: { type: Object, default: null },
    result: { type: Object, default: null },
    error: { type: String, default: "" },
    errorDetail: { type: String, default: "" },
    tempDir: { type: String, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

const VideoJobModel =
  mongoose.models.VideoJob || mongoose.model("VideoJob", VideoJobSchema);

export default VideoJobModel;
