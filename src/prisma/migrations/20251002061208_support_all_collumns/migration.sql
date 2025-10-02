/*
  Warnings:

  - You are about to drop the column `bumpEnabled` on the `Thread` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Thread" DROP COLUMN "bumpEnabled",
ADD COLUMN     "appliedTags" TEXT[],
ADD COLUMN     "archiveTimestamp" BIGINT,
ADD COLUMN     "invitable" BOOLEAN,
ADD COLUMN     "lastPinTimestamp" BIGINT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberCount" INTEGER,
ADD COLUMN     "messageCount" INTEGER,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "rateLimitPerUser" INTEGER,
ADD COLUMN     "totalMessageSent" INTEGER;
