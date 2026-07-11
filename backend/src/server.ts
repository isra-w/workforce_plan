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
import dotenv from "dotenv";
import authRoutes from "src/routes/authRoutes";
import workforcePlanRoutes from "src/routes/workforcePlanRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
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

app.listen(PORT, () => {
  console.log(`Workforce API running on http://localhost:${PORT}`);
});

export default app;
