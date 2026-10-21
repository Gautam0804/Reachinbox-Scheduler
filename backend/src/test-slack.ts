
import "dotenv/config";
import { notifyRateLimit } from "./services/slack-notifier.js";

async function main() {
  await notifyRateLimit(
    "✅ ReachInbox Scheduler: Slack integration test successful!"
  );
}

main().catch((error) => {
  console.error("Slack test failed:", error);
  process.exitCode = 1;
});
