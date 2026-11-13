import type { NextFunction, Request, Response } from "express";

const tenantRoles = ["VENDOR_ADMIN", "FULFILLMENT_STAFF"];

export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || !tenantRoles.includes(user.role)) {
    next();
    return;
  }
  if (!user.vendorId) {
    res.status(403).json({ message: "This account is not assigned to a vendor." });
    return;
  }

  const vendorId = user.vendorId.toString();
  if (req.query.vendorId && String(req.query.vendorId) !== vendorId) {
    res.status(403).json({ message: "Cross-tenant access is not allowed." });
    return;
  }
  if (req.body && typeof req.body === "object" && req.body.vendorId && String(req.body.vendorId) !== vendorId) {
    res.status(403).json({ message: "Cross-tenant access is not allowed." });
    return;
  }

  req.tenantVendorId = user.vendorId;
  req.query.vendorId = vendorId;
  if (req.body && typeof req.body === "object") req.body.vendorId = vendorId;
  next();
}
