
import { Router } from "express";
import type { Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Session } from "express-session";
import { env } from "../config/env.js";

export const authRouter = Router();

const oauthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL,
);

const FRONTEND_URL = env.FRONTEND_URL;
const STATE_TTL_MS = 10 * 60 * 1000;

type AuthenticatedUser = {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
};

type AuthSession = Session & {
  oauthState?: string;
  oauthStateExpiresAt?: number;
  user?: AuthenticatedUser;
};

function getAuthSession(req: Request): AuthSession {
  return req.session as AuthSession;
}

// --------------------------------------------------
// Start Google OAuth
// --------------------------------------------------

authRouter.get("/google", (req, res, next) => {
  const session = getAuthSession(req);
  const state = randomBytes(32).toString("hex");

  session.oauthState = state;
  session.oauthStateExpiresAt = Date.now() + STATE_TTL_MS;

  session.save((error) => {
    if (error) {
      console.error("OAuth start session save failed:", error.message);
      next(error);
      return;
    }

    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });

    // Diagnostic logging: do not log the actual OAuth state.
    console.log("OAuth start diagnostics:", {
      sessionID: req.sessionID,
      hasSession: Boolean(req.session),
      hasStoredState: Boolean(session.oauthState),
      hasExpiry: typeof session.oauthStateExpiresAt === "number",
    });

    res.redirect(authorizationUrl);
  });
});

// --------------------------------------------------
// Google OAuth callback
// --------------------------------------------------

authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const code = req.query.code;
    const returnedState = req.query.state;
    const oauthError = req.query.error;

    if (oauthError) {
      res.status(400).send("Google sign-in was cancelled or denied.");
      return;
    }

    if (
      typeof code !== "string" ||
      typeof returnedState !== "string"
    ) {
      res.status(400).send("Missing Google OAuth callback parameters.");
      return;
    }

    const session = getAuthSession(req);
    const expectedState = session.oauthState;
    const expiresAt = session.oauthStateExpiresAt;

    // Diagnostic logging: never log state, cookies, or authorization code.
    console.log("OAuth state diagnostics:", {
      sessionID: req.sessionID,
      hasSession: Boolean(req.session),
      hasExpectedState: Boolean(expectedState),
      hasExpiry: typeof expiresAt === "number",
      isExpired:
        typeof expiresAt === "number"
          ? expiresAt <= Date.now()
          : null,
      returnedStatePresent: typeof returnedState === "string",
    });

    // Remove the one-time state from this session.
    delete session.oauthState;
    delete session.oauthStateExpiresAt;

    if (
      !expectedState ||
      !expiresAt ||
      expiresAt <= Date.now() ||
      expectedState.length !== returnedState.length ||
      !timingSafeEqual(
        Buffer.from(expectedState),
        Buffer.from(returnedState),
      )
    ) {
      console.warn("OAuth state validation failed.");
      res.status(400).send("Invalid or expired OAuth state. Please try again.");
      return;
    }

    // Persist removal of the one-time OAuth state before continuing.
    await new Promise<void>((resolve, reject) => {
      session.save((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      res.status(401).send("Google did not return an ID token.");
      return;
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      res.status(401).send("Google account could not be verified.");
      return;
    }

    const user: AuthenticatedUser = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture ?? null,
    };

    // Rotate session ID after authentication.
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        next(regenerateError);
        return;
      }

      const authenticatedSession = getAuthSession(req);
      authenticatedSession.user = user;

      authenticatedSession.save((saveError) => {
        if (saveError) {
          next(saveError);
          return;
        }

        console.log("Google authentication successful.", {
          hasAuthenticatedUser: Boolean(authenticatedSession.user),
        });

        res.redirect(FRONTEND_URL);
      });
    });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// Current authenticated user
// --------------------------------------------------

authRouter.get("/me", (req, res) => {
  const session = getAuthSession(req);

  if (!session.user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  res.json({ user: session.user });
});

// --------------------------------------------------
// Logout
// --------------------------------------------------

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("reachinbox.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.status(200).json({
      message: "Logged out successfully.",
    });
  });
});
