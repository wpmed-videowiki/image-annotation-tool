import mongoose from "mongoose";

const Schema = mongoose.Schema;

// One slot per wiki. `null` means "not linked". Tokens are only ever read
// through src/lib/auth/tokens.js so refresh happens in one place.
const AccountSchema = new Schema(
  {
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    expiresAt: { type: Number, default: 0 }, // ms since epoch
    profile: { type: Object, default: {} },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    // OAuth `sub` from the Wikimedia profile; this is the identity
    wikimediaId: { type: String, default: "", index: true },
    username: { type: String, default: "" },
    defaultUploadOption: { type: String, default: "new" },
    accounts: {
      wikimedia: { type: AccountSchema, default: null },
      nccommons: { type: AccountSchema, default: null },
      mdwiki: { type: AccountSchema, default: null },
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export default UserModel;
