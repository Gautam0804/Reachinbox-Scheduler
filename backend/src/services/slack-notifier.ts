
import { env } from "../config/env.js";

export async function notifyRateLimit(message: string): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_ALERT_CHANNEL) {
    console.warn("Slack is not connected; skipping rate-limit notification.");
    return;
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: env.SLACK_ALERT_CHANNEL,
        text: message,
      }),
    });

    const result = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!response.ok || !result.ok) {
      console.error(
        "Slack notification failed:",
        result.error ?? response.statusText,
      );
    } else {
      console.log("Slack notification sent successfully.");
    }
  } catch (error) {
    console.error("Unable to send Slack notification:", error);
  }
}
