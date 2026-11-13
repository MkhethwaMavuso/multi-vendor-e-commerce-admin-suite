import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { connectDatabase } from "./config/database";
import { requireCustomHeaderForCookieWrites } from "./middleware/csrf";
import { errorHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";
import { startDemoSimulator } from "./services/demoSimulator";

async function startServer(): Promise<void> {
  const { MONGO_URI, JWT_SECRET, CLIENT_ORIGIN, PORT = "4000" } = process.env;
  if (!MONGO_URI) throw new Error("MONGO_URI is required.");
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  if (!CLIENT_ORIGIN) throw new Error("CLIENT_ORIGIN is required.");
  await connectDatabase(MONGO_URI);

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin: CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-VendorHub-Request"]
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requireCustomHeaderForCookieWrites);
  app.use("/api", apiRouter);
  app.use((_req, res) => res.status(404).json({ message: "Route not found." }));
  app.use(errorHandler);

  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  app.listen(port, () => {
    console.info(`VendorHub API listening on port ${port}`);
    startDemoSimulator();
  });
}

void startServer().catch((error: unknown) => {
  console.error("Failed to start VendorHub API.", error);
  process.exitCode = 1;
});
