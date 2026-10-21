
import "dotenv/config";
import { elasticsearch } from "./config/elasticsearch.js";

async function main() {
  try {
    const health = await elasticsearch.cluster.health();

    console.log("Elasticsearch connected successfully!");
    console.log("Cluster status:", health.status);
  } catch (error) {
    console.error("Elasticsearch connection failed:", error);
    process.exitCode = 1;
  } finally {
    await elasticsearch.close();
  }
}

main();
