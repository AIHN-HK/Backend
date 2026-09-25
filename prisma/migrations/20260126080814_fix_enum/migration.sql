/*
  Warnings:

  - The values [personality] on the enum `QuestionDimension` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuestionDimension_new" AS ENUM ('PERSONA', 'ABILITY', 'INTEREST');
ALTER TABLE "Question" ALTER COLUMN "dimension" TYPE "QuestionDimension_new" USING ("dimension"::text::"QuestionDimension_new");
ALTER TYPE "QuestionDimension" RENAME TO "QuestionDimension_old";
ALTER TYPE "QuestionDimension_new" RENAME TO "QuestionDimension";
DROP TYPE "QuestionDimension_old";
COMMIT;
