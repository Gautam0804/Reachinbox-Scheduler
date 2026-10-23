-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerGoogleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "notes" TEXT,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_ownerGoogleId_createdAt_idx" ON "Contact"("ownerGoogleId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_ownerGoogleId_company_idx" ON "Contact"("ownerGoogleId", "company");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerGoogleId_email_key" ON "Contact"("ownerGoogleId", "email");
