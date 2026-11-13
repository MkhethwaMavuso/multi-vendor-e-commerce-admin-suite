import type { Types } from "mongoose";
import type { Role } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        vendorId: Types.ObjectId | null;
      };
      tenantVendorId?: Types.ObjectId;
    }
  }
}

export {};
