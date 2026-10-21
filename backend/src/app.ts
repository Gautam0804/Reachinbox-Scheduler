import express from "express";
import session from "express-session";

import { emailRouter } from "./routes/email.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { queueRouter } from "./routes/queue.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { env } from "./config/env.js";
import { slackRouter } from "./routes/slack.routes.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "reachinbox.sid",
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);
app.use("/api/search", searchRouter);
app.use("/admin/queues", queueRouter);
app.use("/api/slack", slackRouter);
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
