import mongoose from "mongoose";

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
    target: { type: Object, required: true }, // { filename, text, comment, provider, wikiSource }
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
