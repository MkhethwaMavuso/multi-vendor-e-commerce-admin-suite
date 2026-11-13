import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const fulfillmentStatuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    variantSku: { type: String, required: true, uppercase: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    commissionFee: { type: Number, required: true, min: 0 },
    netVendorPayout: { type: Number, required: true, min: 0 },
    fulfillmentStatus: { type: String, enum: fulfillmentStatuses, default: "PENDING" }
  },
  { _id: true }
);

const orderSchema = new Schema(
  {
    customer: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      shippingAddress: { type: Schema.Types.Mixed, required: true }
    },
    items: { type: [orderItemSchema], required: true, validate: [(items: unknown[]) => items.length > 0, "Order must include items."] },
    totalAmount: { type: Number, required: true, min: 0 },
    totalCommission: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },
    paymentIntentId: { type: String, trim: true },
    isSimulated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

orderSchema.index({ "items.vendorId": 1, createdAt: -1 });
orderSchema.index({ "customer.userId": 1, createdAt: -1 });

export type OrderDocument = InferSchemaType<typeof orderSchema>;
export const Order = (models.Order as Model<OrderDocument> | undefined) ?? model<OrderDocument>("Order", orderSchema);
