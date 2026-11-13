import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { roles, User, type Role } from "../models/User";
import { Vendor } from "../models/Vendor";

type TokenClaims = JwtPayload & { role: Role; vendorId: string | null };

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error("JWT_SECRET is not configured."));
    return;
  }

  const authorization = req.header("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const token = req.cookies?.vendorhub_token || bearer;
  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  let claims: TokenClaims;
  try {
    claims = jwt.verify(token, secret, {
      issuer: "vendorhub-api",
      audience: "vendorhub-client"
    }) as TokenClaims;
  } catch {
    res.status(401).json({ message: "Invalid or expired authentication token." });
    return;
  }
  if (
    typeof claims.sub !== "string" ||
    !roles.includes(claims.role) ||
    (claims.role === "SUPER_ADMIN" ? claims.vendorId !== null : !mongoose.isValidObjectId(claims.vendorId))
  ) {
    res.status(401).json({ message: "Invalid authentication token." });
    return;
  }
  try {
    const account = await User.findById(claims.sub);
    if (
      !account ||
      !account.isActive ||
      account.role !== claims.role ||
      (account.vendorId?.toString() ?? null) !== claims.vendorId
    ) {
      res.status(401).json({ message: "This account is no longer authorized." });
      return;
    }
    if (account.vendorId && account.role !== "SUPER_ADMIN") {
      const vendor = await Vendor.findById(account.vendorId).select("status");
      if (!vendor || vendor.status === "ARCHIVED") {
        res.status(401).json({ message: "This vendor account is archived or unavailable." });
        return;
      }
    }
    req.user = { id: account._id.toString(), role: account.role, vendorId: account.vendorId ?? null };
    next();
  } catch (error) {
    next(error);
  }
}

export function allowRoles(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
