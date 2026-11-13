import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";

const vendorSchema = new Schema(
  {
    storeName: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"], default: "PENDING" },
    commissionRate: { type: Number, min: 0, max: 100, default: PLATFORM_COMMISSION_RATE },
    isDemoData: { type: Boolean, default: false },
    payoutDetails: {
      bankName: { type: String, trim: true },
      accountNumberEncrypted: { type: String, select: false },
      routingNumber: { type: String, select: false }
    }
  },
  { timestamps: true }
);

vendorSchema.index({ status: 1, createdAt: -1 });

export type VendorDocument = InferSchemaType<typeof vendorSchema>;
export const Vendor = (models.Vendor as Model<VendorDocument> | undefined) ?? model<VendorDocument>("Vendor", vendorSchema);
