-- Invalidate short-lived legacy plaintext challenges; preserve all account/history data.
DELETE FROM "Otp";
ALTER TABLE "Otp" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Otp_email_type_key" ON "Otp"("email", "type");
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");
CREATE UNIQUE INDEX "Priority_type_key" ON "Priority"("type");
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_attempts_range" CHECK ("failedAttempts" BETWEEN 0 AND 5);
ALTER TABLE "User" ADD CONSTRAINT "User_role_valid" CHECK ("role" IN ('USER', 'ADMIN'));
ALTER TABLE "Question" ADD CONSTRAINT "Question_type_valid" CHECK ("type" IN ('R','I','A','S','E','C'));
ALTER TABLE "Priority" ADD CONSTRAINT "Priority_type_valid" CHECK ("type" IN ('R','I','A','S','E','C'));
ALTER TABLE "Priority" ADD CONSTRAINT "Priority_range" CHECK ("priority" BETWEEN 1 AND 6);
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_total_positive" CHECK ("totalQuestions" > 0);
-- Existing legacy answers may use older scales; preserve them and enforce binary in submit services.
