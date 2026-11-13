export type Role = "SUPER_ADMIN" | "VENDOR_ADMIN" | "FULFILLMENT_STAFF";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  vendorId: string | null;
}

export interface Summary {
  vendorCounts: Array<{ _id: string; count: number }> | null;
  activeProducts: number;
  orderCount: number;
  grossSales: number;
  commissions: number;
  payouts: number;
}

export interface Vendor {
  _id: string;
  storeName: string;
  slug: string;
  ownerId: string | { name: string; email: string } | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  commissionRate: number;
  isDemoData: boolean;
  createdAt: string;
}

export interface ProductVariant {
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

export interface Product {
  _id: string;
  title: string;
  slug: string;
  category: string;
  variants: ProductVariant[];
  isActive: boolean;
}

export interface OrderItem {
  _id: string;
  vendorId: string;
  title: string;
  variantSku: string;
  quantity: number;
  totalPrice: number;
  commissionFee: number;
  fulfillmentStatus: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
}

export interface Order {
  _id: string;
  createdAt: string;
  customer: { name: string; email: string; shippingAddress: Record<string, unknown> };
  items: OrderItem[];
  totalAmount: number;
  totalCommission: number;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  isSimulated: boolean;
}
