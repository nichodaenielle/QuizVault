-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "draft" JSONB;

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "versionId" TEXT;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
