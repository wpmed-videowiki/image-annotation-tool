import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    username: { type: String, default: "" },
    defaultUploadOption: { type: String, default: "new" },

    wikimediaId: { type: String, default: "" },
    wikimediaToken: { type: String, default: "" },
    wikimediaRefreshToken: { type: String, default: "" },
    wikimediaTokenExpiresAt: { type: Number, default: 0 },
    wikimediaProfile: { type: Object, default: {} },

    mdwikiId: { type: String, default: "" },
    mdwikiToken: { type: String, default: "" },
    mdwikiRefreshToken: { type: String, default: "" },
    mdwikiTokenExpiresAt: { type: Number, default: 0 },
    mdwikiProfile: { type: Object, default: {} },

    nccommonsId: { type: String, default: "" },
    nccommonsToken: { type: String, default: "" },
    nccommonsRefreshToken: { type: String, default: "" },
    nccommonsTokenExpiresAt: { type: Number, default: 0 },
    nccommonsProfile: { type: Object, default: {} },
    authenticated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export default UserModel;
