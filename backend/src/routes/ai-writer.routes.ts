
import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/require-auth.js";

export const aiWriterRouter = Router();

const genAI = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

const generateEmailSchema = z.object({
  purpose: z.string().trim().min(3).max(2000),
  tone: z
    .enum(["professional", "friendly", "formal", "persuasive"])
    .default("professional"),
  recipient: z.string().trim().max(254).optional(),
  extraContext: z.string().trim().max(2000).optional(),
});

const emailDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

/**
 * Generate email with retries for temporary API errors.
 * Retries 429, 500, 502, 503 and 504 responses.
 */
async function generateWithRetry(prompt: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await genAI.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: "A concise email subject line",
              },
              body: {
                type: Type.STRING,
                description: "The complete email body",
              },
            },
            required: ["subject", "body"],
          },
        },
      });
    } catch (error: unknown) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error
          ? Number(error.status)
          : 0;

      const retryable = [429, 500, 502, 503, 504].includes(status);

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      // Wait 1 second, then 2 seconds before retrying.
      const delay = attempt * 1000;

      console.warn(
        `Gemini request failed (HTTP ${status}). ` +
          `Retrying in ${delay / 1000}s (${attempt}/${maxAttempts - 1})...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Gemini generation failed after retries.");
}

aiWriterRouter.use(requireAuth);

aiWriterRouter.post("/generate-email", async (req, res, next) => {
  const parsed = generateEmailSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid email generation request.",
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const { purpose, tone, recipient, extraContext } = parsed.data;

    const prompt = `
You are an expert email writing assistant.

Generate a clear, natural email based only on the information provided.

Rules:
- Follow the requested tone.
- Do not invent names, facts, dates, credentials, or promises.
- Create a concise, relevant subject line.
- Write a complete email body.
- Return JSON with "subject" and "body" fields.
- The user must review the draft before scheduling or sending it.

Email details:
Purpose: ${purpose}
Tone: ${tone}
Recipient: ${recipient || "Not specified"}
Additional context: ${extraContext || "None provided"}
`;

    const response = await generateWithRetry(prompt);
    const output = response.text;

    if (!output?.trim()) {
      res.status(502).json({
        error: "The AI returned an empty draft. Please try again.",
      });
      return;
    }

    let rawDraft: unknown;

    try {
      rawDraft = JSON.parse(output);
    } catch {
      res.status(502).json({
        error: "The AI returned an invalid draft. Please try again.",
      });
      return;
    }

    const draft = emailDraftSchema.safeParse(rawDraft);

    if (!draft.success) {
      res.status(502).json({
        error: "The AI returned an incomplete draft. Please try again.",
      });
      return;
    }

    res.json({
      subject: draft.data.subject,
      body: draft.data.body,
    });
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error
        ? Number(error.status)
        : 0;

    console.error("Gemini email generation failed:", error);

    if (status === 503) {
      res.status(503).json({
        error:
          "Gemini is temporarily busy. Please try again shortly.",
      });
      return;
    }

    if (status === 429) {
      res.status(429).json({
        error:
          "Gemini request limit reached. Please try again later.",
      });
      return;
    }

    if (status === 404) {
      res.status(502).json({
        error:
          "The configured Gemini model is unavailable. Check GEMINI_MODEL in your backend .env file.",
      });
      return;
    }

    next(error);
  }
});
