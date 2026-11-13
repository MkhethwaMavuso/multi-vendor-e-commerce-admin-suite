import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  storeName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

function issueToken(res: Response, user: { id: string; role: string; vendorId: mongoose.Types.ObjectId | null }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  const token = jwt.sign(
    { role: user.role, vendorId: user.vendorId?.toString() ?? null },
    secret,
    { subject: user.id, expiresIn: "12h", issuer: "vendorhub-api", audience: "vendorhub-client" }
  );
  res.cookie("vendorhub_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/"
  });
  return token;
}

function toUserResponse(user: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: string;
  vendorId?: mongoose.Types.ObjectId | null;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    vendorId: user.vendorId?.toString() ?? null
  };
}

export async function registerVendor(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const session = await mongoose.startSession();
  const ownerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  let created = false;
  try {
    await session.withTransaction(async () => {
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [vendor] = await Vendor.create(
        [{
          _id: vendorId,
          storeName: input.storeName,
          slug: input.slug,
          ownerId,
          commissionRate: PLATFORM_COMMISSION_RATE
        }],
        { session }
      );
      await User.create(
        [{
          _id: ownerId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: "VENDOR_ADMIN",
          vendorId: vendor._id
        }],
        { session }
      );
      created = Boolean(vendor);
    });
  } finally {
    await session.endSession();
  }
  if (!created) throw new Error("Vendor registration did not complete.");
  const responseUser = {
    _id: ownerId,
    name: input.name,
    email: input.email,
    role: "VENDOR_ADMIN",
    vendorId
  };
  issueToken(res, { id: ownerId.toString(), role: "VENDOR_ADMIN", vendorId });
  res.status(201).json({ user: toUserResponse(responseUser), message: "Registration submitted for vendor approval." });
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    res.status(401).json({ message: "Email or password is incorrect." });
    return;
  }
  issueToken(res, { id: user._id.toString(), role: user.role, vendorId: user.vendorId ?? null });
  res.json({ user: toUserResponse(user) });
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user?.id);
  if (!user || !user.isActive) {
    res.clearCookie("vendorhub_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    });
    res.status(401).json({ message: "The authenticated account is no longer available." });
    return;
  }
  res.json({ user: toUserResponse(user) });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie("vendorhub_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/"
  });
  res.status(204).end();
}
