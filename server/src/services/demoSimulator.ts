import bcrypt from "bcryptjs";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { PLATFORM_COMMISSION_RATE } from "../constants/commission";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";

const HOUR_MS = 60 * 60 * 1000;
const ORDER_INTERVAL_MS = 20 * 60 * 1000;
const ORDERS_PER_VENDOR = 10;
const REFILL_STOCK_AT = 30;
const REFILL_STOCK_TO = 10_000;

let vendorJobRunning = false;
let orderJobRunning = false;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createDemoVendor(): Promise<mongoose.Types.ObjectId> {
  const suffix = randomBytes(4).toString("hex");
  const slug = `demo-store-${Date.now()}-${suffix}`;
  const vendorId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await User.create([{
        _id: ownerId,
        name: `Demo Owner ${suffix}`,
        email: `owner-${suffix}-${Date.now()}@example.invalid`,
        passwordHash,
        role: "VENDOR_ADMIN",
        vendorId,
        isActive: false
      }], { session });
      await Vendor.create([{
        _id: vendorId,
        storeName: `Demo Store ${suffix}`,
        slug,
        ownerId,
        status: "ACTIVE",
        commissionRate: PLATFORM_COMMISSION_RATE,
        isDemoData: true
      }], { session });
      await Product.create([{
        vendorId,
        title: `Demo product ${suffix}`,
        slug: `demo-product-${suffix}`,
        description: "Automatically generated product for local marketplace simulation.",
        category: "Simulation",
        variants: [{
          sku: `SIM-${suffix.toUpperCase()}-001`,
          price: randomInt(1500, 12000) / 100,
          stock: REFILL_STOCK_TO
        }],
        isDemoData: true
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  console.info(`Demo vendor ${slug} created.`);
  return vendorId;
}

async function ensureDemoProduct(vendorId: mongoose.Types.ObjectId): Promise<InstanceType<typeof Product>> {
  let product = await Product.findOne({ vendorId, isDemoData: true, isActive: true });
  if (!product) {
    const suffix = randomBytes(4).toString("hex");
    product = await Product.create({
      vendorId,
      title: `Demo product ${suffix}`,
      slug: `demo-product-${suffix}`,
      description: "Automatically generated product for local marketplace simulation.",
      category: "Simulation",
      variants: [{
        sku: `SIM-${suffix.toUpperCase()}-001`,
        price: randomInt(1500, 12000) / 100,
        stock: REFILL_STOCK_TO
      }],
      isDemoData: true
    });
  } else if (product.variants.some((variant) => variant.stock < REFILL_STOCK_AT)) {
    for (const variant of product.variants) {
      if (variant.stock < REFILL_STOCK_AT) variant.stock = REFILL_STOCK_TO;
    }
    await product.save();
  }
  return product;
}

export async function createOrdersForVendor(
  vendorId: mongoose.Types.ObjectId,
  orderCount = ORDERS_PER_VENDOR
): Promise<void> {
  if (!Number.isInteger(orderCount) || orderCount < 1) {
    throw new Error("Demo order count must be a positive integer.");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const vendor = await Vendor.findOne({ _id: vendorId, status: "ACTIVE" }).session(session);
      if (!vendor) throw new Error(`Vendor ${vendorId.toString()} is no longer active.`);

      let product = await Product.findOne({ vendorId, isDemoData: true, isActive: true }).session(session);
      if (!product) {
        const suffix = randomBytes(4).toString("hex");
        [product] = await Product.create([{
          vendorId,
          title: `Demo product ${suffix}`,
          slug: `demo-product-${suffix}`,
          description: "Automatically generated product for local marketplace simulation.",
          category: "Simulation",
          variants: [{
            sku: `SIM-${suffix.toUpperCase()}-001`,
            price: randomInt(1500, 12000) / 100,
            stock: REFILL_STOCK_TO
          }],
          isDemoData: true
        }], { session });
      }

      const variant = product.variants[0];
      if (!variant) throw new Error(`Demo product ${product._id.toString()} has no variants.`);
      const requiredStock = orderCount * 3;
      if (variant.stock < requiredStock) {
        variant.stock = Math.max(REFILL_STOCK_TO, requiredStock);
        await product.save({ session });
      }

      const orders = [];
      for (let index = 0; index < orderCount; index += 1) {
        const quantity = randomInt(1, 4);
        const inventoryUpdate = await Product.updateOne(
          {
            _id: product._id,
            vendorId,
            isActive: true,
            isDemoData: true,
            variants: { $elemMatch: { sku: variant.sku, stock: { $gte: quantity } } }
          },
          { $inc: { "variants.$.stock": -quantity } },
          { session }
        );
        if (inventoryUpdate.modifiedCount !== 1) {
          throw new Error(`Insufficient demo inventory for SKU ${variant.sku}.`);
        }

        const totalPrice = roundCurrency(variant.price * quantity);
        const commissionFee = roundCurrency(totalPrice * (PLATFORM_COMMISSION_RATE / 100));
        orders.push({
          customer: {
            name: `Demo Customer ${randomBytes(3).toString("hex")}`,
            email: `customer-${randomUUID()}@example.invalid`,
            shippingAddress: {
              line1: "100 Demo Street",
              city: "Sample City",
              region: "CA",
              postalCode: "00000",
              country: "US"
            }
          },
          items: [{
            productId: product._id,
            vendorId,
            variantSku: variant.sku,
            title: product.title,
            quantity,
            unitPrice: variant.price,
            totalPrice,
            commissionFee,
            netVendorPayout: roundCurrency(totalPrice - commissionFee),
            fulfillmentStatus: "PENDING" as const
          }],
          totalAmount: totalPrice,
          totalCommission: commissionFee,
          paymentStatus: "PAID" as const,
          paymentIntentId: `demo-${randomUUID()}`,
          isSimulated: true
        });
        variant.stock -= quantity;
      }

      await Order.create(orders, { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }
}

async function runVendorJob(): Promise<void> {
  if (vendorJobRunning) {
    console.warn("Skipping demo vendor generation; the previous run is still in progress.");
    return;
  }
  vendorJobRunning = true;
  try {
    await createDemoVendor();
  } finally {
    vendorJobRunning = false;
  }
}

async function runOrderJob(): Promise<void> {
  if (orderJobRunning) {
    console.warn("Skipping demo order generation; the previous run is still in progress.");
    return;
  }
  orderJobRunning = true;
  try {
    const vendors = await Vendor.find({ status: "ACTIVE" }).select("_id");
    const failures: Error[] = [];
    for (const vendor of vendors) {
      try {
        await ensureDemoProduct(vendor._id);
        await createOrdersForVendor(vendor._id);
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `Demo orders failed for ${failures.length} active vendor(s).`);
    }
    console.info(`Generated ${ORDERS_PER_VENDOR} demo orders for each of ${vendors.length} active vendor(s).`);
  } finally {
    orderJobRunning = false;
  }
}

export function startDemoSimulator(): void {
  if (process.env.NODE_ENV !== "development" || process.env.DEMO_SIMULATOR_ENABLED !== "true") return;

  console.info("Demo simulator enabled: one vendor per hour and 10 orders per active vendor every 20 minutes.");
  const vendorTimer = setInterval(() => {
    void runVendorJob().catch((error: unknown) => console.error("Demo vendor generation failed.", error));
  }, HOUR_MS);
  const orderTimer = setInterval(() => {
    void runOrderJob().catch((error: unknown) => console.error("Demo order generation failed.", error));
  }, ORDER_INTERVAL_MS);
  vendorTimer.unref();
  orderTimer.unref();
}
