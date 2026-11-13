import type { NextFunction, Request, Response } from "express";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireCustomHeaderForCookieWrites(req: Request, res: Response, next: NextFunction): void {
  if (
    req.cookies?.vendorhub_token &&
    !safeMethods.has(req.method) &&
    req.header("x-vendorhub-request") !== "1"
  ) {
    res.status(403).json({ message: "A valid application request header is required." });
    return;
  }
  next();
}
