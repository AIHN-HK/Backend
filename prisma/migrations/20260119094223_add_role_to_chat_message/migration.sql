-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'system');

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "role" "ChatRole";
