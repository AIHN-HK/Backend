/*
  Warnings:

  - Made the column `userId` on table `ChatSession` required. This step will fail if there are existing NULL values in that column.
  - Made the column `attemptId` on table `ChatSession` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ChatSession" ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "attemptId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ChatSession_attemptId_idx" ON "ChatSession"("attemptId");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
