
import express from "express";
import cors from "cors";
import session from "express-session";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";

import { emailRouter } from "./routes/email.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { queueRouter } from "./routes/queue.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { slackRouter } from "./routes/slack.routes.js";
import { aiWriterRouter } from "./routes/ai-writer.routes.js";
import { contactRouter } from "./routes/contact.routes.js";
import { env } from "./config/env.js";

export const app = express();

// --------------------------------------------------
// Render reverse proxy
// --------------------------------------------------

app.set("trust proxy", 1);

// --------------------------------------------------
// CORS configuration
// --------------------------------------------------

const allowedOrigins = [
  "https://reachinbox-frontend-0ag8.onrender.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// --------------------------------------------------
// Redis configuration
// --------------------------------------------------

const redisUrl = env.REDIS_URL
  ? new URL(env.REDIS_URL)
  : null;

console.log("Redis config:", {
  configured: Boolean(redisUrl),
  protocol: redisUrl?.protocol ?? "redis:",
  host: redisUrl?.hostname ?? env.REDIS_HOST,
  port: redisUrl?.port || env.REDIS_PORT,
});

const sessionRedisClient = createClient({
  url:
    env.REDIS_URL ??
    `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
  socket: {
    connectTimeout: 10000,
  },
});

sessionRedisClient.on("error", (error) => {
  console.error("Session Redis error:", error.message);
});

try {
  await sessionRedisClient.connect();

  const pingResponse = await sessionRedisClient.ping();

  console.log("Session Redis connected successfully.");
  console.log("Session Redis PING:", pingResponse);
} catch (error) {
  console.error(
    "Session Redis connection failed:",
    error instanceof Error ? error.message : "Unknown error",
  );

  throw error;
}

// --------------------------------------------------
// Redis-backed session store
// --------------------------------------------------

const sessionStore = new RedisStore({
  client: sessionRedisClient,
  prefix: "reachinbox:sess:",
});

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "reachinbox.sid",
    store: sessionStore,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    },
  }),
);

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// --------------------------------------------------
// API routes
// --------------------------------------------------

app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);
app.use("/api/search", searchRouter);
app.use("/admin/queues", queueRouter);
app.use("/api/slack", slackRouter);
app.use("/api/ai", aiWriterRouter);
app.use("/api/contacts", contactRouter);

// --------------------------------------------------
// Central error handler
// --------------------------------------------------

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (
      error instanceof Error &&
      error.message.startsWith("CORS blocked origin:")
    ) {
      res.status(403).json({
        error: "Origin not allowed.",
      });
      return;
    }

    console.error("Unhandled API error:", error);

    res.status(500).json({
      error: "Internal server error.",
    });
  },
);
