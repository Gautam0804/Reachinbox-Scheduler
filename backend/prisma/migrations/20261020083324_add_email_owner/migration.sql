-- AlterTable
ALTER TABLE "ScheduledEmail" ADD COLUMN     "ownerGoogleId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledEmail_ownerGoogleId_status_scheduledAt_idx" ON "ScheduledEmail"("ownerGoogleId", "status", "scheduledAt");
