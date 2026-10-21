
import { Router } from "express";
import { searchEmails } from "../services/email-search.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/require-auth.js";

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();

    if (!query) {
      res.status(400).json({
        error: "Provide a search query using ?q=your-search",
      });
      return;
    }

    const googleId = (req as AuthenticatedRequest).authUser.googleId;

    const emails = await searchEmails(query, googleId);

    res.json({ emails });
  } catch (error) {
    console.error("Email search failed:", error);

    res.status(500).json({
      error: "Email search failed. Check backend logs.",
    });
  }
});
