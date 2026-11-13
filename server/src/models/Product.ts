import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const variantSchema = new Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    attributes: { type: Map, of: String, default: {} },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, trim: true, index: true },
    variants: {
      type: [variantSchema],
      required: true,
      validate: {
        validator(variants: Array<{ sku: string }>) {
          const skus = variants.map(({ sku }) => sku.toUpperCase());
          return skus.length > 0 && new Set(skus).size === skus.length;
        },
        message: "A product must have variants with unique SKUs."
      }
    },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isDemoData: { type: Boolean, default: false }
  },
  { timestamps: true }
);

productSchema.index({ vendorId: 1, slug: 1 }, { unique: true });
productSchema.index({ vendorId: 1, "variants.sku": 1 }, { unique: true });
productSchema.index({ vendorId: 1, category: 1, isActive: 1 });

export type ProductDocument = InferSchemaType<typeof productSchema>;
export const Product = (models.Product as Model<ProductDocument> | undefined) ?? model<ProductDocument>("Product", productSchema);
