
import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeEmailSearch } from "./services/email-search.js";

async function startServer() {
  await initializeEmailSearch();

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  async function shutdown() {
    server.close(() => {
      console.log("API server closed.");
    });
  }

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
