
import express from "express";
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

const sessionRedisClient = createClient({
  url: `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
});

sessionRedisClient.on("error", (error) => {
  console.error("Session Redis error:", error);
});

await sessionRedisClient.connect();

const sessionStore = new RedisStore({
  client: sessionRedisClient,
  prefix: "reachinbox:sess:",
});

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    },
  }),
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);
app.use("/api/search", searchRouter);
app.use("/admin/queues", queueRouter);
app.use("/api/slack", slackRouter);
app.use("/api/ai", aiWriterRouter);
app.use("/api/contacts", contactRouter);

// Central error handler
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled API error:", error);

    res.status(500).json({
      error: "Internal server error.",
    });
  },
);
