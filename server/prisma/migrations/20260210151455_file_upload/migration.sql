-- AlterEnum
ALTER TYPE "public"."PropertyManagementType" ADD VALUE 'UNKNOWN';

-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "documentData" BYTEA,
ADD COLUMN     "documentMimeType" VARCHAR(100),
ADD COLUMN     "documentName" VARCHAR(255),
ADD COLUMN     "documentUploadedAt" TIMESTAMP(3);
