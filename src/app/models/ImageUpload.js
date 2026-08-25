const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ImageUploadSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    provider: { type: String, required: true }, // commons, nccommons
    statsLastUpdatedAt: { type: Date, default: Date.now },
    linkedPagesViews: { type: Number, default: 0 },
    linkedPages: { type: Array, default: [] },
    numberOfLinkedPages: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    statsStatus: { type: String, default: "done" },
    possibleWikis: { type: Array, default: [] },
    statsFinishedWikis: { type: Array, default: [] },
    // wizard answers, absent on legacy/overwrite uploads. Plain Object because
    // this file must stay CommonJS; values are normalized before they get here.
    metadata: { type: Object, default: undefined },
    // SDC write outcome: { ok, mid, error, info, at }
    sdc: { type: Object, default: null },
  },
  { timestamps: true }
);

ImageUploadSchema.index({ url: 1 }, { unique: true });

const ImageUploadModel =
  mongoose.models.ImageUpload ||
  mongoose.model("ImageUpload", ImageUploadSchema);

module.exports = ImageUploadModel;
