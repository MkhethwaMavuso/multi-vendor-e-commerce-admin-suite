import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database";
import { Order } from "../models/Order";
import { Vendor } from "../models/Vendor";
import { createDemoVendor, createOrdersForVendor } from "../services/demoSimulator";

const TARGET_VENDOR_COUNT = 20;
const TARGET_ORDERS_PER_VENDOR = 100;

async function seedDemoMarketplace(): Promise<void> {
  const { MONGO_URI, NODE_ENV, DEMO_SIMULATOR_ENABLED } = process.env;
  if (NODE_ENV !== "development" || DEMO_SIMULATOR_ENABLED !== "true") {
    throw new Error("Demo seeding requires NODE_ENV=development and DEMO_SIMULATOR_ENABLED=true.");
  }
  if (!MONGO_URI) throw new Error("MONGO_URI is required.");

  await connectDatabase(MONGO_URI);
  let vendors = await Vendor.find({ isDemoData: true, status: "ACTIVE" })
    .sort({ createdAt: 1 })
    .limit(TARGET_VENDOR_COUNT)
    .select("_id");

  while (vendors.length < TARGET_VENDOR_COUNT) {
    await createDemoVendor();
    vendors = await Vendor.find({ isDemoData: true, status: "ACTIVE" })
      .sort({ createdAt: 1 })
      .limit(TARGET_VENDOR_COUNT)
      .select("_id");
  }

  for (const vendor of vendors) {
    const existingOrders = await Order.countDocuments({
      isSimulated: true,
      "items.vendorId": vendor._id
    });
    if (existingOrders < TARGET_ORDERS_PER_VENDOR) {
      await createOrdersForVendor(vendor._id, TARGET_ORDERS_PER_VENDOR - existingOrders);
    }
  }

  const vendorIds = vendors.map((vendor) => vendor._id);
  const [orderCount, totals] = await Promise.all([
    Order.countDocuments({ isSimulated: true, "items.vendorId": { $in: vendorIds } }),
    Order.aggregate([
      { $match: { isSimulated: true, paymentStatus: "PAID", "items.vendorId": { $in: vendorIds } } },
      { $unwind: "$items" },
      { $match: { "items.vendorId": { $in: vendorIds } } },
      {
        $group: {
          _id: null,
          grossIncome: { $sum: "$items.totalPrice" },
          platformCommission: { $sum: "$items.commissionFee" }
        }
      }
    ])
  ]);
  if (orderCount < TARGET_VENDOR_COUNT * TARGET_ORDERS_PER_VENDOR) {
    throw new Error("Demo seed completed with fewer than 100 orders per vendor.");
  }

  const summary = totals[0] ?? { grossIncome: 0, platformCommission: 0 };
  console.info(
    `Demo seed complete: ${vendors.length} vendors, ${orderCount} paid orders, ` +
    `gross income $${summary.grossIncome.toFixed(2)}, platform commission (15%) $${summary.platformCommission.toFixed(2)}.`
  );
}

void seedDemoMarketplace()
  .catch((error: unknown) => {
    console.error("Could not seed the demo marketplace.", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
