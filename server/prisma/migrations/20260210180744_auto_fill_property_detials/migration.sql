-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "basicDetailsExtract" JSONB,
ADD COLUMN     "basicDetailsExtractedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."PropertySection" ADD COLUMN     "renderable" BOOLEAN NOT NULL DEFAULT true;
