-- CreateEnum
CREATE TYPE "QuestionDimension" AS ENUM ('personality', 'ABILITY', 'INTEREST');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "dimension" "QuestionDimension";
