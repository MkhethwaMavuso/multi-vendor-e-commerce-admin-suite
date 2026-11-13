declare module "cookie-parser" {
  import type { RequestHandler } from "express";

  export default function cookieParser(
    secret?: string | string[],
    options?: { decode?: (value: string) => string }
  ): RequestHandler;
}
