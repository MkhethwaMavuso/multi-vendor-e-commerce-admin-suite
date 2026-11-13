import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { User } from "../models/User";

async function createSuperAdmin(): Promise<void> {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required.");
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");

  await connectDatabase(MONGO_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.exists({ email })) throw new Error("An account already exists for ADMIN_EMAIL.");
  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    role: "SUPER_ADMIN",
    vendorId: null
  });
  console.info(`Created super-admin account for ${email}.`);
}

void createSuperAdmin()
  .catch((error: unknown) => {
    console.error("Could not create super-admin account.", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
