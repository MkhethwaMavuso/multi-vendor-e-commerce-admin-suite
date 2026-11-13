import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Vendor } from "../models/Vendor";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const vendorId = req.tenantVendorId;
  const orderFilter = vendorId ? { "items.vendorId": vendorId } : {};
  const productFilter = vendorId ? { vendorId } : {};
  const [vendors, products, orderStats] = await Promise.all([
    vendorId ? Promise.resolve(null) : Vendor.aggregate([
      { $match: { status: { $ne: "ARCHIVED" } } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    Product.countDocuments({ ...productFilter, isActive: true }),
    Order.aggregate([
      { $match: orderFilter },
      { $unwind: "$items" },
      ...(vendorId ? [{ $match: { "items.vendorId": new mongoose.Types.ObjectId(vendorId) } }] : []),
      {
        $group: {
          _id: "$_id",
          grossSales: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$items.totalPrice", 0] } },
          commissions: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$items.commissionFee", 0] } },
          payouts: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$items.netVendorPayout", 0] } }
        }
      },
      {
        $group: {
          _id: 0,
          orderCount: { $sum: 1 },
          grossSales: { $sum: "$grossSales" },
          commissions: { $sum: "$commissions" },
          payouts: { $sum: "$payouts" }
        }
      }
    ])
  ]);
  res.json({
    summary: {
      vendorCounts: vendors,
      activeProducts: products,
      ...(orderStats[0] ?? { orderCount: 0, grossSales: 0, commissions: 0, payouts: 0 })
    }
  });
}
