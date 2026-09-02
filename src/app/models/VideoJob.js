import mongoose from "mongoose";

import UploadMetadataSchema from "./uploadMetadataSchema.js";

const Schema = mongoose.Schema;

// Despite the name, this collection holds every upload job; `kind`
// discriminates. Docs that predate the field are video jobs.
const VideoJobSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["video", "image"],
      default: "video",
      index: true,
    },
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
        "cancelled",
      ],
      default: "queued",
      index: true,
    },
    stage: { type: String, default: "" },
    // set by cancelJob(); runners poll it and finish as "cancelled"
    cancelRequested: { type: Boolean, default: false },
    // hidden from the default /uploads list; query with $ne:true so docs that
    // predate the field stay visible
    archived: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
    // { rotation, trim, crop, mute }; image jobs carry no ops
    ops: {
      type: Object,
      required: function () {
        return this.kind !== "image";
      },
    },
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

// the worker's claim query: queued jobs of one kind, oldest first
VideoJobSchema.index({ status: 1, kind: 1, createdAt: 1 });
// the per-user /uploads list
VideoJobSchema.index({ user: 1, archived: 1, createdAt: -1 });

const VideoJobModel =
  mongoose.models.VideoJob || mongoose.model("VideoJob", VideoJobSchema);

export default VideoJobModel;
