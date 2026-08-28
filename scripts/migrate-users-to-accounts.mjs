// One-off: reshape User docs for the auth redesign. Dry-run by default;
// pass --apply to write. Safe to re-run.
//   node scripts/migrate-users-to-accounts.mjs [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { planUserMigration } from "../src/lib/auth/migrationPlan.js";

const APPLY = process.argv.includes("--apply");

const main = async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const users = db.collection("users");
  const jobs = db.collection("videojobs");
  const uploads = db.collection("imageuploads");

  const all = await users.find({}).toArray();
  const plan = planUserMigration(all);

  console.log(`users total:         ${all.length}`);
  console.log(`to delete:           ${plan.deleteIds.length}`);
  console.log(`to reshape:          ${plan.updates.length}`);
  console.log(`duplicate re-points: ${plan.repoints.length}`);

  if (!APPLY) {
    console.log("dry run - re-run with --apply to write");
    await mongoose.disconnect();
    return;
  }

  const oid = (id) => new mongoose.Types.ObjectId(id);

  for (const { from, to } of plan.repoints) {
    const j = await jobs.updateMany({ user: oid(from) }, { $set: { user: oid(to) } });
    const u = await uploads.updateMany({ uploadedBy: oid(from) }, { $set: { uploadedBy: oid(to) } });
    console.log(`re-pointed ${from} -> ${to}: jobs=${j.modifiedCount} uploads=${u.modifiedCount}`);
  }

  for (const { _id, set, unset } of plan.updates) {
    await users.updateOne({ _id: oid(_id) }, { $set: set, $unset: unset });
  }
  console.log(`reshaped ${plan.updates.length} users`);

  if (plan.deleteIds.length) {
    const result = await users.deleteMany({ _id: { $in: plan.deleteIds.map(oid) } });
    console.log(`deleted ${result.deletedCount} users`);
  }

  await mongoose.disconnect();
  console.log("done");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
