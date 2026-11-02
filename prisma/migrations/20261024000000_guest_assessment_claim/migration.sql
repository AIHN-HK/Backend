CREATE TABLE "GuestAssessmentClaim" (
  "id" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "attemptId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestAssessmentClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestAssessmentClaim_attemptId_key" ON "GuestAssessmentClaim"("attemptId");
CREATE INDEX "GuestAssessmentClaim_userId_idx" ON "GuestAssessmentClaim"("userId");
ALTER TABLE "GuestAssessmentClaim" ADD CONSTRAINT "GuestAssessmentClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAssessmentClaim" ADD CONSTRAINT "GuestAssessmentClaim_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
