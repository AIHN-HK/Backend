/*
  Warnings:

  - You are about to drop the column `attempId` on the `ChatSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ChatSession" DROP COLUMN "attempId",
ADD COLUMN     "attemptId" INTEGER;
