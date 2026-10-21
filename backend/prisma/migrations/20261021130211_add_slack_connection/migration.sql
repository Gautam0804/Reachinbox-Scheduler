-- CreateTable
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "ownerGoogleId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnection_ownerGoogleId_key" ON "SlackConnection"("ownerGoogleId");

-- CreateIndex
CREATE INDEX "SlackConnection_teamId_idx" ON "SlackConnection"("teamId");
