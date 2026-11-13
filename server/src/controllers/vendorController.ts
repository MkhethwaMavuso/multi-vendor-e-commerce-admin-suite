import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { HttpError } from "../utils/HttpError";

const vendorStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);
const statusSchema = z.object({ status: vendorStatusSchema });
const vendorFields = {
  storeName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().transform((value) => value.toLowerCase())
};
const createVendorSchema = z.object({
  ...vendorFields,
  ownerPassword: z.string().min(12).max(128),
  status: vendorStatusSchema.default("PENDING")
});
const updateVendorSchema = z.object(vendorFields).partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one vendor field must be provided."
});

function publicVendor(vendor: InstanceType<typeof Vendor>) {
  return {
    ...vendor.toObject(),
    commissionRate: PLATFORM_COMMISSION_RATE
  };
}

export async function listVendors(_req: Request, res: Response): Promise<void> {
  const vendors = await Vendor.find()
    .populate("ownerId", "name email")
    .select("-payoutDetails.accountNumberEncrypted -payoutDetails.routingNumber")
    .sort({ createdAt: -1 });
  res.json({ vendors: vendors.map(publicVendor) });
}

export async function createVendor(req: Request, res: Response): Promise<void> {
  const input = createVendorSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.ownerPassword, 12);
  const session = await mongoose.startSession();
  let createdVendorId: mongoose.Types.ObjectId | undefined;

  try {
    await session.withTransaction(async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const vendorId = new mongoose.Types.ObjectId();
      await User.create([{
        _id: ownerId,
        name: input.ownerName,
        email: input.ownerEmail,
        passwordHash,
        role: "VENDOR_ADMIN",
        vendorId
      }], { session });
      await Vendor.create([{
        _id: vendorId,
        storeName: input.storeName,
        slug: input.slug,
        ownerId,
        status: input.status,
        commissionRate: PLATFORM_COMMISSION_RATE
      }], { session });
      createdVendorId = vendorId;
    });
  } finally {
    await session.endSession();
  }

  if (!createdVendorId) throw new Error("Vendor creation transaction did not create a vendor.");
  const vendor = await Vendor.findById(createdVendorId)
    .populate("ownerId", "name email")
    .select("-payoutDetails.accountNumberEncrypted -payoutDetails.routingNumber");
  if (!vendor) throw new Error("Created vendor could not be loaded.");
  res.status(201).json({ vendor: publicVendor(vendor) });
}

export async function updateVendor(req: Request, res: Response): Promise<void> {
  const input = updateVendorSchema.parse(req.body);
  const session = await mongoose.startSession();
  let updatedVendorId: mongoose.Types.ObjectId | undefined;

  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findById(req.params.id).session(session);
      if (!vendor) throw new HttpError(404, "Vendor not found.");

      if (input.storeName !== undefined) vendor.storeName = input.storeName;
      if (input.slug !== undefined) vendor.slug = input.slug;
      vendor.commissionRate = PLATFORM_COMMISSION_RATE;

      const ownerChanges: Record<string, string> = {};
      if (input.ownerName !== undefined) ownerChanges.name = input.ownerName;
      if (input.ownerEmail !== undefined) ownerChanges.email = input.ownerEmail;
      if (Object.keys(ownerChanges).length > 0) {
        const ownerUpdate = await User.updateOne(
          { _id: vendor.ownerId },
          { $set: ownerChanges },
          { session, runValidators: true }
        );
        if (ownerUpdate.matchedCount !== 1) throw new HttpError(409, "Vendor owner account is missing.");
      }

      await vendor.save({ session });
      updatedVendorId = vendor._id;
    });
  } finally {
    await session.endSession();
  }

  if (!updatedVendorId) throw new Error("Vendor update transaction did not update a vendor.");
  const vendor = await Vendor.findById(updatedVendorId)
    .populate("ownerId", "name email")
    .select("-payoutDetails.accountNumberEncrypted -payoutDetails.routingNumber");
  if (!vendor) throw new Error("Updated vendor could not be loaded.");
  res.json({ vendor: publicVendor(vendor) });
}

export async function updateVendorStatus(req: Request, res: Response): Promise<void> {
  const { status } = statusSchema.parse(req.body);
  const vendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    { $set: { status, commissionRate: PLATFORM_COMMISSION_RATE } },
    { new: true, runValidators: true }
  ).select("-payoutDetails.accountNumberEncrypted -payoutDetails.routingNumber");
  if (!vendor) {
    res.status(404).json({ message: "Vendor not found." });
    return;
  }
  res.json({ vendor: publicVendor(vendor) });
}

export async function archiveVendor(req: Request, res: Response): Promise<void> {
  const vendor = await Vendor.findByIdAndUpdate(
    req.params.id,
    { $set: { status: "ARCHIVED", commissionRate: PLATFORM_COMMISSION_RATE } },
    { new: true, runValidators: true }
  ).select("-payoutDetails.accountNumberEncrypted -payoutDetails.routingNumber");
  if (!vendor) {
    res.status(404).json({ message: "Vendor not found." });
    return;
  }
  res.json({ vendor: publicVendor(vendor) });
}
