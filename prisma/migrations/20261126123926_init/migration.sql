-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEARNER', 'INSTRUCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TRUE_FALSE', 'MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'SHORT_ANSWER', 'IDENTIFICATION', 'ESSAY');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('REVIEWER', 'QUIZ', 'EXAM');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "GradingStatus" AS ENUM ('AUTO_GRADED', 'PENDING_GRADING', 'GRADED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "googleSub" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromRole" "Role" NOT NULL,
    "toRole" "Role" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionInstructor" (
    "sectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionInstructor_pkey" PRIMARY KEY ("sectionId","userId")
);

-- CreateTable
CREATE TABLE "SectionCode" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "SectionCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrolledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinAttempt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "points" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "explanation" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSetItem" (
    "setId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionSetItem_pkey" PRIMARY KEY ("setId","questionId")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" "AssessmentMode" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "versionId" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "timeLimitSec" INTEGER,
    "attemptLimit" INTEGER NOT NULL DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "feedbackRelease" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "itemOrder" JSONB NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "gradingStatus" "GradingStatus",
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "answer" JSONB,
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EssayGrade" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "rubricScores" JSONB,
    "feedback" TEXT,
    "gradedById" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE INDEX "RoleChange_userId_idx" ON "RoleChange"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "SectionInstructor_userId_idx" ON "SectionInstructor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCode_code_key" ON "SectionCode"("code");

-- CreateIndex
CREATE INDEX "SectionCode_sectionId_status_idx" ON "SectionCode"("sectionId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_sectionId_userId_key" ON "Enrollment"("sectionId", "userId");

-- CreateIndex
CREATE INDEX "JoinAttempt_userId_createdAt_idx" ON "JoinAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JoinAttempt_ip_createdAt_idx" ON "JoinAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "Question_ownerId_archived_idx" ON "Question"("ownerId", "archived");

-- CreateIndex
CREATE INDEX "Question_subject_topic_idx" ON "Question"("subject", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_version_key" ON "AssessmentVersion"("assessmentId", "version");

-- CreateIndex
CREATE INDEX "SectionAssignment_sectionId_idx" ON "SectionAssignment"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionAssignment_assessmentId_sectionId_key" ON "SectionAssignment"("assessmentId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_idempotencyKey_key" ON "Attempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Attempt_userId_status_idx" ON "Attempt"("userId", "status");

-- CreateIndex
CREATE INDEX "Attempt_status_deadlineAt_idx" ON "Attempt"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_assignmentId_userId_attemptNumber_key" ON "Attempt"("assignmentId", "userId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_itemKey_key" ON "Response"("attemptId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "EssayGrade_responseId_key" ON "EssayGrade"("responseId");

-- AddForeignKey
ALTER TABLE "RoleChange" ADD CONSTRAINT "RoleChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleChange" ADD CONSTRAINT "RoleChange_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInstructor" ADD CONSTRAINT "SectionInstructor_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInstructor" ADD CONSTRAINT "SectionInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCode" ADD CONSTRAINT "SectionCode_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCode" ADD CONSTRAINT "SectionCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinAttempt" ADD CONSTRAINT "JoinAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSetItem" ADD CONSTRAINT "QuestionSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSetItem" ADD CONSTRAINT "QuestionSetItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SectionAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayGrade" ADD CONSTRAINT "EssayGrade_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayGrade" ADD CONSTRAINT "EssayGrade_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EssayGrade" ADD CONSTRAINT "EssayGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
