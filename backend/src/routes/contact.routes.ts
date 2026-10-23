
import { Router, type Request } from "express";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse/sync";

import { prisma } from "../config/prisma.js";
import { requireAuth } from "../middleware/require-auth.js";

export const contactRouter = Router();

contactRouter.use(requireAuth);

// -------------------- CONTACT VALIDATION --------------------

const contactSchema = z.object({
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  company: z.string().trim().max(150).optional(),
  jobTitle: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(2000).optional(),
});

type AuthenticatedRequest = Request & {
  authUser: {
    googleId: string;
    email: string;
  };
};

function getOwnerGoogleId(req: Request): string | null {
  const user = (req as AuthenticatedRequest).authUser;

  return typeof user?.googleId === "string"
    ? user.googleId
    : null;
}

// -------------------- CSV UPLOAD CONFIG --------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      callback(new Error("Please upload a .csv file."));
      return;
    }

    callback(null, true);
  },
});

// -------------------- IMPORT CONTACTS FROM CSV --------------------

// POST /api/contacts/import
contactRouter.post(
  "/import",
  (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        const status =
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

        res.status(status).json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "CSV file must be 2 MB or smaller."
              : error.message,
        });
        return;
      }

      if (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid file upload.",
        });
        return;
      }

      next();
    });
  },
  async (req, res, next) => {
    try {
      const ownerGoogleId = getOwnerGoogleId(req);

      if (!ownerGoogleId) {
        res.status(401).json({
          error: "Authentication required.",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: 'Please select a CSV file using the "file" field.',
        });
        return;
      }

      const csvText = req.file.buffer.toString("utf8");

      let rows: Record<string, string>[];

      try {
        rows = parse(csvText, {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: false,
          max_record_size: 10_000,

          // Normalize headers so FirstName, firstName,
          // and firstname are treated identically.
          columns: (headers: string[]) => {
            const normalized = headers.map((header) =>
              header.trim().toLowerCase()
            );

            if (new Set(normalized).size !== normalized.length) {
              throw new Error(
                "CSV contains duplicate column headers."
              );
            }

            return normalized;
          },
        }) as Record<string, string>[];
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? `Invalid CSV: ${error.message}`
              : "Unable to read the CSV file.",
        });
        return;
      }

      if (rows.length === 0) {
        res.status(400).json({
          error: "CSV file contains no contact rows.",
        });
        return;
      }

      if (rows.length > 1000) {
        res.status(400).json({
          error: "A maximum of 1,000 contacts can be imported at once.",
        });
        return;
      }

      // All allowed headers are normalized to lowercase.
      const allowedColumns = new Set([
        "email",
        "firstname",
        "lastname",
        "company",
        "jobtitle",
        "notes",
      ]);

      const headers = Object.keys(rows[0] ?? {});
      const unsupportedHeaders = headers.filter(
        (header) => !allowedColumns.has(header)
      );

      if (unsupportedHeaders.length > 0) {
        res.status(400).json({
          error: "CSV contains unsupported columns.",
          unsupportedHeaders,
          allowedColumns: [
            "email",
            "firstName",
            "lastName",
            "company",
            "jobTitle",
            "notes",
          ],
        });
        return;
      }

      if (!headers.includes("email")) {
        res.status(400).json({
          error: 'CSV must contain an "email" column.',
        });
        return;
      }

      const validContacts: Array<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        company: string | null;
        jobTitle: string | null;
        notes: string | null;
      }> = [];

      const seenEmails = new Set<string>();

      let invalid = 0;
      let duplicatesInFile = 0;

      for (const row of rows) {
        const email =
          typeof row.email === "string"
            ? row.email.trim().toLowerCase()
            : "";

        const parsed = contactSchema.safeParse({
          email,
          firstName: row.firstname ?? "",
          lastName: row.lastname ?? "",
          company: row.company ?? "",
          jobTitle: row.jobtitle ?? "",
          notes: row.notes ?? "",
        });

        if (!parsed.success) {
          invalid++;
          continue;
        }

        const normalizedEmail = parsed.data.email.toLowerCase();

        if (seenEmails.has(normalizedEmail)) {
          duplicatesInFile++;
          continue;
        }

        seenEmails.add(normalizedEmail);

        validContacts.push({
          email: normalizedEmail,
          firstName: parsed.data.firstName || null,
          lastName: parsed.data.lastName || null,
          company: parsed.data.company || null,
          jobTitle: parsed.data.jobTitle || null,
          notes: parsed.data.notes || null,
        });
      }

      // Nothing valid to insert.
      if (validContacts.length === 0) {
        res.json({
          message: "CSV processed. No contacts were imported.",
          totalRows: rows.length,
          imported: 0,
          invalid,
          duplicatesInFile,
          alreadyExisted: 0,
        });
        return;
      }

      const emails = validContacts.map((contact) => contact.email);

      // Check existing contacts belonging to this user only.
      const existingContacts = await prisma.contact.findMany({
        where: {
          ownerGoogleId,
          email: { in: emails },
        },
        select: { email: true },
      });

      const existingEmails = new Set(
        existingContacts.map((contact) => contact.email.toLowerCase())
      );

      const newContacts = validContacts.filter(
        (contact) => !existingEmails.has(contact.email)
      );

      const alreadyExisted = validContacts.length - newContacts.length;

      let imported = 0;

      if (newContacts.length > 0) {
        const result = await prisma.contact.createMany({
          data: newContacts.map((contact) => ({
            ownerGoogleId,
            ...contact,
          })),
          skipDuplicates: true,
        });

        imported = result.count;
      }

      // Includes any duplicates that appeared concurrently
      // between the lookup and database insert.
      const skippedDuringInsert = newContacts.length - imported;

      res.status(200).json({
        message: "CSV import completed.",
        totalRows: rows.length,
        imported,
        invalid,
        duplicatesInFile,
        alreadyExisted: alreadyExisted + skippedDuringInsert,
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- LIST AND SEARCH CONTACTS --------------------

// GET /api/contacts?search=rahul
contactRouter.get("/", async (req, res, next) => {
  try {
    const ownerGoogleId = getOwnerGoogleId(req);

    if (!ownerGoogleId) {
      res.status(401).json({
        error: "Authentication required.",
      });
      return;
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const contacts = await prisma.contact.findMany({
      where: {
        ownerGoogleId,
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
});

// -------------------- CREATE CONTACT --------------------

// POST /api/contacts
contactRouter.post("/", async (req, res, next) => {
  try {
    const ownerGoogleId = getOwnerGoogleId(req);

    if (!ownerGoogleId) {
      res.status(401).json({
        error: "Authentication required.",
      });
      return;
    }

    const parsed = contactSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid contact data.",
        details: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;

    const contact = await prisma.contact.create({
      data: {
        ownerGoogleId,
        email: data.email.toLowerCase(),
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        company: data.company || null,
        jobTitle: data.jobTitle || null,
        notes: data.notes || null,
      },
    });

    res.status(201).json({ contact });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "A contact with this email already exists.",
      });
      return;
    }

    next(error);
  }
});

// -------------------- UPDATE CONTACT --------------------

// PATCH /api/contacts/:id
contactRouter.patch("/:id", async (req, res, next) => {
  try {
    const ownerGoogleId = getOwnerGoogleId(req);

    if (!ownerGoogleId) {
      res.status(401).json({
        error: "Authentication required.",
      });
      return;
    }

    const parsed = contactSchema.partial().safeParse(req.body);

    if (
      !parsed.success ||
      typeof req.body !== "object" ||
      req.body === null ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      res.status(400).json({
        error: "Invalid contact update.",
        ...(parsed.success ? {} : { details: parsed.error.issues }),
      });
      return;
    }

    const existing = await prisma.contact.findFirst({
      where: {
        id: req.params.id,
        ownerGoogleId,
      },
    });

    if (!existing) {
      res.status(404).json({
        error: "Contact not found.",
      });
      return;
    }

    const data = parsed.data;

    const contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        ...(data.email !== undefined
          ? { email: data.email.toLowerCase() }
          : {}),
        ...(data.firstName !== undefined
          ? { firstName: data.firstName || null }
          : {}),
        ...(data.lastName !== undefined
          ? { lastName: data.lastName || null }
          : {}),
        ...(data.company !== undefined
          ? { company: data.company || null }
          : {}),
        ...(data.jobTitle !== undefined
          ? { jobTitle: data.jobTitle || null }
          : {}),
        ...(data.notes !== undefined
          ? { notes: data.notes || null }
          : {}),
      },
    });

    res.json({ contact });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "A contact with this email already exists.",
      });
      return;
    }

    next(error);
  }
});

// -------------------- DELETE CONTACT --------------------

// DELETE /api/contacts/:id
contactRouter.delete("/:id", async (req, res, next) => {
  try {
    const ownerGoogleId = getOwnerGoogleId(req);

    if (!ownerGoogleId) {
      res.status(401).json({
        error: "Authentication required.",
      });
      return;
    }

    const result = await prisma.contact.deleteMany({
      where: {
        id: req.params.id,
        ownerGoogleId,
      },
    });

    if (result.count === 0) {
      res.status(404).json({
        error: "Contact not found.",
      });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
