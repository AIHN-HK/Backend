/*
  Warnings:

  - The values [system] on the enum `ChatRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChatRole_new" AS ENUM ('user', 'assistant');
ALTER TABLE "ChatMessage" ALTER COLUMN "role" TYPE "ChatRole_new" USING ("role"::text::"ChatRole_new");
ALTER TYPE "ChatRole" RENAME TO "ChatRole_old";
ALTER TYPE "ChatRole_new" RENAME TO "ChatRole";
DROP TYPE "ChatRole_old";
COMMIT;
