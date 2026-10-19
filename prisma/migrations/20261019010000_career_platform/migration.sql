-- CreateTable
CREATE TABLE "Career" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riasec" JSONB NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerSkill" (
    "careerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CareerSkill_pkey" PRIMARY KEY ("careerId","skillId")
);

-- CreateTable
CREATE TABLE "CareerProfile" (
    "userId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "skills" JSONB NOT NULL,
    "interests" JSONB,
    "targetCareerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerGoal" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "careerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalTask" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GoalTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationRun_userId_createdAt_id_idx" ON "RecommendationRun"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CareerGoal_userId_careerId_key" ON "CareerGoal"("userId", "careerId");

-- CreateIndex
CREATE INDEX "GoalTask_goalId_position_idx" ON "GoalTask"("goalId", "position");

-- AddForeignKey
ALTER TABLE "CareerSkill" ADD CONSTRAINT "CareerSkill_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerSkill" ADD CONSTRAINT "CareerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_targetCareerId_fkey" FOREIGN KEY ("targetCareerId") REFERENCES "Career"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationRun" ADD CONSTRAINT "RecommendationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationRun" ADD CONSTRAINT "RecommendationRun_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTask" ADD CONSTRAINT "GoalTask_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CareerGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "CareerSkill" ADD CONSTRAINT "CareerSkill_valid_levels" CHECK ("importance" > 0 AND "importance" <= 5 AND "level" >= 0 AND "level" <= 5);
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_positive_revision" CHECK ("revision" > 0);
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_positive_revision" CHECK ("revision" > 0);
