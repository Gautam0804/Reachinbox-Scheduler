
import { Client } from "@elastic/elasticsearch";
import { env } from "./env.js";

export const elasticsearch = new Client({
  node: env.ELASTICSEARCH_NODE,
  ...(env.ELASTICSEARCH_PASSWORD
    ? {
        auth: {
          username: env.ELASTICSEARCH_USERNAME,
          password: env.ELASTICSEARCH_PASSWORD,
        },
      }
    : {}),
});
