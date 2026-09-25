/*
  Warnings:

  - You are about to drop the column `isactive` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('REGISTER', 'FORGOT_PASSWORD');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isactive";

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);
