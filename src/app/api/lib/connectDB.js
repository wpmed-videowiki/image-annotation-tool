import mongoose from "mongoose";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("db");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Please define the DATABASE_URL environment variable inside .env.local"
  );
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // guard on the global cache object - a module-level flag would not
    // survive Next dev hot reloads and would stack duplicate listeners
    if (!cached.listenersAttached) {
      cached.listenersAttached = true;
      mongoose.connection.on("connected", () => log.info("mongoose connected"));
      mongoose.connection.on("error", (err) =>
        log.error("mongoose connection error", { err })
      );
      mongoose.connection.on("disconnected", () =>
        log.warn("mongoose disconnected")
      );
    }

    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(DATABASE_URL, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
