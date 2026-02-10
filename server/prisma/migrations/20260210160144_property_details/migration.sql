-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "addressCity" VARCHAR(100),
ADD COLUMN     "addressPostalCode" VARCHAR(20),
ADD COLUMN     "addressStreet" VARCHAR(255),
ALTER COLUMN "managerId" DROP NOT NULL,
ALTER COLUMN "accountantId" DROP NOT NULL;
