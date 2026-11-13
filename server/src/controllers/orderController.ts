import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Vendor } from "../models/Vendor";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";
import { HttpError } from "../utils/HttpError";

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    shippingAddress: z.record(z.string(), z.unknown())
  }),
  items: z.array(z.object({
    productId: z.string().refine(mongoose.isValidObjectId),
    variantSku: z.string().trim().min(1).max(80),
    quantity: z.number().int().min(1).max(100)
  })).min(1).max(100),
  paymentIntentId: z.string().trim().max(200).optional()
});

const fulfillmentSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  itemId: z.string().refine(mongoose.isValidObjectId),
  vendorId: z.string().refine(mongoose.isValidObjectId).optional()
});

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function checkout(req: Request, res: Response): Promise<void> {
  const input = checkoutSchema.parse(req.body);
  const session = await mongoose.startSession();
  let createdOrder: InstanceType<typeof Order> | undefined;
  try {
    await session.withTransaction(async () => {
      const orderItems = [];
      let totalAmount = 0;
      let totalCommission = 0;

      for (const requestedItem of input.items) {
        const product = await Product.findOne({
          _id: requestedItem.productId,
          isActive: true,
          "variants.sku": requestedItem.variantSku.toUpperCase()
        }).session(session);
        const variant = product?.variants.find((item) => item.sku === requestedItem.variantSku.toUpperCase());
        if (!product || !variant) throw new HttpError(409, "One or more requested products are unavailable.");

        const vendor = await Vendor.findOne({ _id: product.vendorId, status: "ACTIVE" }).session(session);
        if (!vendor) throw new HttpError(409, "One or more requested vendors are not accepting orders.");

        const inventoryUpdate = await Product.updateOne(
          {
            _id: product._id,
            vendorId: vendor._id,
            isActive: true,
            variants: { $elemMatch: { sku: variant.sku, stock: { $gte: requestedItem.quantity } } }
          },
          { $inc: { "variants.$.stock": -requestedItem.quantity } },
          { session }
        );
        if (inventoryUpdate.modifiedCount !== 1) throw new HttpError(409, `Insufficient stock for SKU ${variant.sku}.`);

        const totalPrice = roundCurrency(variant.price * requestedItem.quantity);
        const commissionFee = roundCurrency(totalPrice * (PLATFORM_COMMISSION_RATE / 100));
        totalAmount = roundCurrency(totalAmount + totalPrice);
        totalCommission = roundCurrency(totalCommission + commissionFee);
        orderItems.push({
          productId: product._id,
          vendorId: vendor._id,
          variantSku: variant.sku,
          title: product.title,
          quantity: requestedItem.quantity,
          unitPrice: variant.price,
          totalPrice,
          commissionFee,
          netVendorPayout: roundCurrency(totalPrice - commissionFee),
          fulfillmentStatus: "PENDING" as const
        });
      }

      const [order] = await Order.create(
        [{
          customer: {
            ...(req.user ? { userId: req.user.id } : {}),
            name: input.customer.name,
            email: input.customer.email,
            shippingAddress: input.customer.shippingAddress
          },
          items: orderItems,
          totalAmount,
          totalCommission,
          paymentIntentId: input.paymentIntentId
        }],
        { session }
      );
      createdOrder = order;
    });
  } finally {
    await session.endSession();
  }

  if (!createdOrder) throw new Error("Checkout transaction did not create an order.");
  res.status(201).json({ order: createdOrder });
}

function visibleOrder(order: InstanceType<typeof Order>, vendorId?: mongoose.Types.ObjectId) {
  const object = order.toObject();
  if (!vendorId) return object;
  const items = object.items.filter((item) => item.vendorId.toString() === vendorId.toString());
  return {
    ...object,
    items,
    totalAmount: roundCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0)),
    totalCommission: roundCurrency(items.reduce((sum, item) => sum + item.commissionFee, 0))
  };
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const vendorId = req.tenantVendorId;
  const query: Record<string, unknown> = vendorId ? { "items.vendorId": vendorId } : {};
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(200);
  res.json({ orders: orders.map((order) => visibleOrder(order, vendorId)) });
}

export async function updateFulfillment(req: Request, res: Response): Promise<void> {
  const input = fulfillmentSchema.parse(req.body);
  const vendorId = req.tenantVendorId ?? (input.vendorId ? new mongoose.Types.ObjectId(input.vendorId) : undefined);
  if (!vendorId) {
    res.status(400).json({ message: "A vendor scope is required to update fulfillment." });
    return;
  }
  const allowedPreviousStatuses: Record<typeof input.status, string[]> = {
    PENDING: [],
    PROCESSING: ["PENDING"],
    SHIPPED: ["PROCESSING"],
    DELIVERED: ["SHIPPED"],
    CANCELLED: ["PENDING", "PROCESSING"]
  };
  const result = await Order.updateOne(
    { _id: req.params.id, items: { $elemMatch: { _id: input.itemId, vendorId } } },
    { $set: { "items.$[item].fulfillmentStatus": input.status } },
    {
      arrayFilters: [{
        "item._id": new mongoose.Types.ObjectId(input.itemId),
        "item.vendorId": vendorId,
        "item.fulfillmentStatus": { $in: allowedPreviousStatuses[input.status] }
      }]
    }
  );
  if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
    res.status(409).json({ message: "Order item not found in this vendor scope or the status transition is not allowed." });
    return;
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found." });
    return;
  }
  res.json({ order: visibleOrder(order, req.tenantVendorId) });
}
