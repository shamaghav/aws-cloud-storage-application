import "dotenv/config";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import fileRoutes from "./routes/fileRoutes";
import authRoutes from "./routes/authRoutes";
import { getAwsConfiguration } from "./config/aws";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { logger } from "./utils/logger";

const app = express();
const port = Number(process.env.PORT ?? 5000);

// Use http://localhost:3000 as the official frontend origin
const frontendOrigin =
  process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// ── Global middleware ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Health check ──────────────────────────────────────────────────────────
app.get("/api/health", (_request, response) => {
  const config = getAwsConfiguration();
  const awsConfigured = Boolean(
    config.accessKeyId && config.secretAccessKey && config.region && config.bucketName,
  );

  logger.info("api.health.check", "Health check requested", {
    awsConfigured,
    region: config.region ?? null,
    bucketName: config.bucketName ?? null,
    uptimeSeconds: process.uptime(),
  });

  response.status(200).json({
    success: true,
    message: "Cloud File Storage backend is running.",
    uptime: process.uptime(),
    aws: {
      configured: awsConfigured,
      region: config.region ?? null,
      bucketName: config.bucketName ?? null,
      credentialsLoaded: Boolean(config.accessKeyId && config.secretAccessKey),
      secretsExposed: false,
    },
  });
});

// ── Authentication routes ──────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── File routes ───────────────────────────────────────────────────────────
app.use("/api/files", fileRoutes);

// ── Error handling ────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────
app.listen(port, () => {
  const config = getAwsConfiguration();
  const awsConfigured = Boolean(
    config.accessKeyId && config.secretAccessKey && config.region && config.bucketName,
  );

  // Read secret for the startup diagnostic
  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    try {
      const fs = require("fs");
      const path = require("path");
      const secretFile = path.join(process.cwd(), ".auth-secret");
      if (fs.existsSync(secretFile)) {
        jwtSecret = fs.readFileSync(secretFile, "utf-8").trim();
        if (jwtSecret && jwtSecret.length >= 32) {
          process.env.JWT_SECRET = jwtSecret;
        }
      }
    } catch {
      // ignore
    }
  }

  const jwtConfigured = Boolean(jwtSecret && jwtSecret.length >= 32);
  const jwtLength = jwtSecret ? jwtSecret.length : 0;

  logger.info("server.start", "Cloud File Storage backend started", {
    port,
    frontendOrigin,
    nodeEnv: process.env.NODE_ENV ?? "development",
    awsConfigured,
    awsRegion: config.region ?? null,
    s3BucketName: config.bucketName ?? null,
    jwt: {
      configured: jwtConfigured,
      length: jwtLength,
    },
  });

  console.log(`JWT_SECRET configured: ${jwtConfigured}`);
  console.log(`JWT_SECRET length: ${jwtLength}`);

  if (!awsConfigured) {
    logger.warn(
      "aws.config.missing",
      "AWS configuration is incomplete — S3 operations will fail until all four environment variables are set",
      {
        requiredVariables: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME"],
      },
    );
  }
});
