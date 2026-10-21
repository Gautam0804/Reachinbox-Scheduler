
import { elasticsearch } from "../config/elasticsearch.js";

const INDEX_NAME = "scheduled-emails";

export interface EmailSearchDocument {
  id: string;
  ownerGoogleId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
}

export async function initializeEmailSearch() {
  const exists = await elasticsearch.indices.exists({
    index: INDEX_NAME,
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: INDEX_NAME,
      mappings: {
        properties: {
          id: { type: "keyword" },
          ownerGoogleId: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
        },
      },
    });

    console.log(`Elasticsearch index "${INDEX_NAME}" created.`);
  } else {
    await elasticsearch.indices.putMapping({
      index: INDEX_NAME,
      properties: {
        ownerGoogleId: { type: "keyword" },
      },
    });
  }
}

export async function indexEmail(email: EmailSearchDocument) {
  await elasticsearch.index({
    index: INDEX_NAME,
    id: email.id,
    document: email,
    refresh: "wait_for",
  });
}

export async function searchEmails(
  query: string,
  ownerGoogleId: string,
) {
  const result = await elasticsearch.search<EmailSearchDocument>({
    index: INDEX_NAME,
    query: {
      bool: {
        filter: [
          {
            term: {
              ownerGoogleId,
            },
          },
        ],
        must: [
          {
            multi_match: {
              query,
              fields: ["recipient", "subject", "body"],
              type: "best_fields",
              fuzziness: "AUTO",
            },
          },
        ],
      },
    },
  });

  return result.hits.hits
    .filter((hit) => hit._source !== undefined)
    .map((hit) => ({
      ...hit._source!,
      id: hit._id!,
    }));
}

export async function deleteIndexedEmail(id: string) {
  await elasticsearch.delete({
    index: INDEX_NAME,
    id,
  });
}
