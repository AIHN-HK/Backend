-- CreateTable
CREATE TABLE "HollandCase" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "description" TEXT[],
    "advice" TEXT[],
    "careers" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HollandCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HollandCase_code_key" ON "HollandCase"("code");
