import type { Request, Response } from "express";
import { z } from "zod";
import { Product } from "../models/Product";

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  attributes: z.record(z.string(), z.string()).default({}),
  price: z.number().finite().min(0),
  compareAtPrice: z.number().finite().min(0).optional(),
  stock: z.number().int().min(0)
});

const productSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: z.string().max(10000).optional(),
  category: z.string().trim().min(1).max(100),
  variants: z.array(variantSchema).min(1),
  images: z.array(z.string().url()).max(20).optional(),
  isActive: z.boolean().optional()
});

function productFilter(req: Request): Record<string, unknown> {
  return req.tenantVendorId ? { vendorId: req.tenantVendorId } : {};
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const filter = productFilter(req);
  if (typeof req.query.category === "string") filter.category = req.query.category;
  if (req.query.isActive === "true" || req.query.isActive === "false") {
    Object.assign(filter, { isActive: req.query.isActive === "true" });
  }
  const products = await Product.find(filter).sort({ updatedAt: -1 }).limit(200);
  res.json({ products });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const input = productSchema.parse(req.body);
  if (!req.tenantVendorId) {
    res.status(400).json({ message: "A vendor scope is required to create products." });
    return;
  }
  const product = await Product.create({ ...input, vendorId: req.tenantVendorId });
  res.status(201).json({ product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const input = productSchema.partial().parse(req.body);
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, ...productFilter(req) },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return;
  }
  res.json({ product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, ...productFilter(req) },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!product) {
    res.status(404).json({ message: "Product not found." });
    return;
  }
  res.json({ product });
}
