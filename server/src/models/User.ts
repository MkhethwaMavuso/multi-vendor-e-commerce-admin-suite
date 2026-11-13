import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const roles = ["SUPER_ADMIN", "VENDOR_ADMIN", "FULFILLMENT_STAFF"] as const;
export type Role = (typeof roles)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      validate: {
        validator(this: { role: Role }, value: unknown) {
          return this.role === "SUPER_ADMIN" ? value == null : value != null;
        },
        message: "Vendor accounts require a vendor; super admins must not have one."
      }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.index({ vendorId: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", userSchema);
