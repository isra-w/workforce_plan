/**
 * Application entry point. Creates the Express app, registers global middleware
 * (CORS, request logging via Morgan, JSON body parsing), mounts the auth and
 * workforce-plan route groups under /api, and attaches a catch-all error handler
 * that returns a JSON 500 response. Starts the HTTP server on the port defined
 * in the environment (defaults to 5000).
 */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "src/config";
import authRoutes from "src/routes/authRoutes";
import workforcePlanRoutes from "src/routes/workforcePlanRoutes";

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "workforce-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/workforce", workforcePlanRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ status: "error", message: err.message || "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`[${config.nodeEnv}] Workforce API running on http://localhost:${config.port}`);
});

export default app;
