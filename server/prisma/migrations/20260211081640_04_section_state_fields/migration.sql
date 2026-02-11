-- AlterTable
ALTER TABLE "public"."PropertySection" ADD COLUMN     "fields" JSONB,
ADD COLUMN     "state" VARCHAR(40);
