
import { prisma } from "../config/prisma.js";
import { decryptSlackToken } from "./slack-token.service.js";

const SLACK_CHANNEL_ID = "C0CA6ATDH0C";

type SlackPostResponse = {
  ok: boolean;
  error?: string;
};

export async function sendSlackNotification(
  ownerGoogleId: string,
  text: string,
): Promise<void> {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { ownerGoogleId },
      select: {
        accessToken: true,
        teamId: true,
      },
    });

    if (!connection) {
      return;
    }

    const accessToken = decryptSlackToken(connection.accessToken);

    const response = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel: SLACK_CHANNEL_ID,
          text,
        }),
      },
    );

    const result = (await response.json()) as SlackPostResponse;

    if (!response.ok || !result.ok) {
      console.error(
        "Slack notification failed:",
        result.error ?? `HTTP ${response.status}`,
      );
    }
  } catch (error) {
    console.error("Could not send Slack notification:", error);
  }
}
