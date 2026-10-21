
import { Router } from "express";
import type { Request, Response } from "express";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Session } from "express-session";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import {
  decryptSlackToken,
  encryptSlackToken,
} from "../services/slack-token.service.js";

export const slackRouter = Router();

const FRONTEND_URL = env.FRONTEND_URL;
const STATE_TTL_MS = 10 * 60 * 1000;

type AuthenticatedUser = {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
};

type SlackAuthSession = Session & {
  user?: AuthenticatedUser;
  slackOauthState?: string;
  slackOauthStateExpiresAt?: number;
  slackCodeVerifier?: string;
};

type SlackTokenResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  team?: {
    id?: string;
    name?: string;
  };
};

type SlackChannelsResponse = {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
  channels?: Array<{
    id: string;
    name: string;
    is_member: boolean;
  }>;
};

function getSession(req: Request): SlackAuthSession {
  return req.session as SlackAuthSession;
}

function createCodeChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64url");
}

function saveSession(session: SlackAuthSession): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function isAuthenticated(
  req: Request,
  res: Response,
): boolean {
  if (!getSession(req).user) {
    res.status(401).json({
      error: "Please sign in with Google first.",
    });
    return false;
  }

  return true;
}

// Start Slack OAuth using PKCE.
slackRouter.get("/connect", (req, res, next) => {
  if (!isAuthenticated(req, res)) return;

  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    res.status(503).json({
      error: "Slack OAuth is not configured on the server.",
    });
    return;
  }

  const session = getSession(req);
  const state = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createCodeChallenge(codeVerifier);

  session.slackOauthState = state;
  session.slackOauthStateExpiresAt = Date.now() + STATE_TTL_MS;
  session.slackCodeVerifier = codeVerifier;

  session.save((error) => {
    if (error) {
      next(error);
      return;
    }

    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID!,
      scope: "chat:write,channels:read,groups:read",
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    res.redirect(
      `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    );
  });
});

// Slack redirects here after authorization.
slackRouter.get("/callback", async (req, res, next) => {
  try {
    const session = getSession(req);
    const returnedState = req.query.state;
    const code = req.query.code;
    const oauthError = req.query.error;

    if (oauthError) {
      delete session.slackOauthState;
      delete session.slackOauthStateExpiresAt;
      delete session.slackCodeVerifier;

      await saveSession(session);

      res.status(400).send(
        "Slack authorization was cancelled or denied. Start again from the app.",
      );
      return;
    }

    if (
      typeof code !== "string" ||
      typeof returnedState !== "string"
    ) {
      res.status(400).send(
        "Missing Slack OAuth callback parameters. Start again from /api/slack/connect.",
      );
      return;
    }

    const expectedState = session.slackOauthState;
    const expiresAt = session.slackOauthStateExpiresAt;
    const codeVerifier = session.slackCodeVerifier;

    const validState =
      typeof expectedState === "string" &&
      typeof expiresAt === "number" &&
      expiresAt > Date.now() &&
      expectedState.length === returnedState.length &&
      timingSafeEqual(
        Buffer.from(expectedState),
        Buffer.from(returnedState),
      );

    if (!validState || !codeVerifier) {
      delete session.slackOauthState;
      delete session.slackOauthStateExpiresAt;
      delete session.slackCodeVerifier;

      await saveSession(session);

      res.status(400).send(
        "Invalid or expired Slack OAuth session. Start the connection again.",
      );
      return;
    }

    if (!session.user) {
      res.status(401).send(
        "Please sign in with Google before connecting Slack.",
      );
      return;
    }

    // Consume OAuth state and verifier before exchanging the code.
    delete session.slackOauthState;
    delete session.slackOauthStateExpiresAt;
    delete session.slackCodeVerifier;

    await saveSession(session);

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      res.status(503).send(
        "Slack OAuth is not configured on the server.",
      );
      return;
    }

    const tokenResponse = await fetch(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID,
          client_secret: env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      },
    );

    const result =
      (await tokenResponse.json()) as SlackTokenResponse;

    if (
      !tokenResponse.ok ||
      !result.ok ||
      !result.access_token
    ) {
      console.error(
        "Slack OAuth token exchange failed:",
        result.error ?? `HTTP ${tokenResponse.status}`,
      );

      res.status(502).send(
        "Slack token exchange failed. Check the backend logs and Slack OAuth configuration.",
      );
      return;
    }

    if (!result.team?.id || !result.team.name) {
      res.status(502).send(
        "Slack authorization succeeded, but workspace details are missing.",
      );
      return;
    }

    // Encrypt the token before storing it in PostgreSQL.
    const encryptedToken = encryptSlackToken(result.access_token);

    await prisma.slackConnection.upsert({
      where: {
        ownerGoogleId: session.user.googleId,
      },
      create: {
        ownerGoogleId: session.user.googleId,
        teamId: result.team.id,
        teamName: result.team.name,
        accessToken: encryptedToken,
      },
      update: {
        teamId: result.team.id,
        teamName: result.team.name,
        accessToken: encryptedToken,
      },
    });

    console.log(
      `Slack connection saved for Google user ${session.user.googleId}; workspace ${result.team.name} (${result.team.id}).`,
    );

    res.redirect(`${FRONTEND_URL}?slack=authorized`);
  } catch (error) {
    next(error);
  }
});

// Return connection status without exposing the access token.
slackRouter.get("/status", async (req, res, next) => {
  try {
    if (!isAuthenticated(req, res)) return;

    const session = getSession(req);

    const connection = await prisma.slackConnection.findUnique({
      where: {
        ownerGoogleId: session.user!.googleId,
      },
      select: {
        teamId: true,
        teamName: true,
        updatedAt: true,
      },
    });

    if (!connection) {
      res.json({
        connected: false,
        workspace: null,
      });
      return;
    }

    res.json({
      connected: true,
      workspace: {
        id: connection.teamId,
        name: connection.teamName,
        updatedAt: connection.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// List Slack channels visible to the connected bot.
slackRouter.get("/channels", async (req, res, next) => {
  try {
    if (!isAuthenticated(req, res)) return;

    const session = getSession(req);

    const connection = await prisma.slackConnection.findUnique({
      where: {
        ownerGoogleId: session.user!.googleId,
      },
      select: {
        accessToken: true,
      },
    });

    if (!connection) {
      res.status(404).json({
        error: "Slack is not connected.",
      });
      return;
    }

    const accessToken = decryptSlackToken(connection.accessToken);
    const channels: NonNullable<SlackChannelsResponse["channels"]> = [];
    let cursor: string | undefined;

    // Follow pagination so the endpoint can return more than 200 channels.
    do {
      const params = new URLSearchParams({
        types: "public_channel,private_channel",
        exclude_archived: "true",
        limit: "200",
      });

      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(
        `https://slack.com/api/conversations.list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const result =
        (await response.json()) as SlackChannelsResponse;

      if (!response.ok || !result.ok) {
        console.error(
          "Slack channel listing failed:",
          result.error ?? `HTTP ${response.status}`,
        );

        res.status(502).json({
          error:
            result.error ?? "Unable to retrieve Slack channels.",
        });
        return;
      }

      channels.push(...(result.channels ?? []));
      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);

    res.json({
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        isMember: channel.is_member,
      })),
    });
  } catch (error) {
    next(error);
  }
});
