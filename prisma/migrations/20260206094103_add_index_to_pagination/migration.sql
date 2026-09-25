-- CreateIndex
CREATE INDEX "Attempt_userId_finishAt_createdAt_id_idx" ON "Attempt"("userId", "finishAt", "createdAt", "id");
