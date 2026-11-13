import { Router } from "express";
import { getSummary } from "../controllers/analyticsController";
import { getCurrentUser, login, logout, registerVendor } from "../controllers/authController";
import { listOrders, checkout, updateFulfillment } from "../controllers/orderController";
import { createProduct, deleteProduct, listProducts, updateProduct } from "../controllers/productController";
import { archiveVendor, createVendor, listVendors, updateVendor, updateVendorStatus } from "../controllers/vendorController";
import { authenticate, allowRoles } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { asyncHandler } from "../utils/asyncHandler";

export const apiRouter = Router();
const vendorRoles = ["VENDOR_ADMIN", "FULFILLMENT_STAFF"] as const;

apiRouter.get("/health", (_req, res) => res.json({ status: "ok" }));
apiRouter.post("/auth/register", asyncHandler(registerVendor));
apiRouter.post("/auth/login", asyncHandler(login));
apiRouter.post("/auth/logout", logout);
apiRouter.get("/auth/me", authenticate, asyncHandler(getCurrentUser));
apiRouter.post("/orders/checkout", asyncHandler(checkout));

apiRouter.use(authenticate, tenantIsolation);
apiRouter.get("/products", allowRoles("SUPER_ADMIN", ...vendorRoles), asyncHandler(listProducts));
apiRouter.post("/products", allowRoles("VENDOR_ADMIN"), asyncHandler(createProduct));
apiRouter.patch("/products/:id", allowRoles("VENDOR_ADMIN"), asyncHandler(updateProduct));
apiRouter.delete("/products/:id", allowRoles("VENDOR_ADMIN"), asyncHandler(deleteProduct));

apiRouter.get("/orders", allowRoles("SUPER_ADMIN", ...vendorRoles), asyncHandler(listOrders));
apiRouter.patch("/orders/:id/fulfillment", allowRoles("SUPER_ADMIN", ...vendorRoles), asyncHandler(updateFulfillment));

apiRouter.get("/vendors", allowRoles("SUPER_ADMIN"), asyncHandler(listVendors));
apiRouter.post("/vendors", allowRoles("SUPER_ADMIN"), asyncHandler(createVendor));
apiRouter.patch("/vendors/:id", allowRoles("SUPER_ADMIN"), asyncHandler(updateVendor));
apiRouter.patch("/vendors/:id/status", allowRoles("SUPER_ADMIN"), asyncHandler(updateVendorStatus));
apiRouter.delete("/vendors/:id", allowRoles("SUPER_ADMIN"), asyncHandler(archiveVendor));
apiRouter.get("/analytics/summary", allowRoles("SUPER_ADMIN", ...vendorRoles), asyncHandler(getSummary));
