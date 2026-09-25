/*
  Warnings:

  - A unique constraint covering the columns `[attemptId,questionId]` on the table `Answer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");
