-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'MANAGER', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "public"."PropertyManagementType" AS ENUM ('WEG', 'MV');

-- CreateEnum
CREATE TYPE "public"."PropertyStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Property" (
    "id" UUID NOT NULL,
    "propertyNumber" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "managementType" "public"."PropertyManagementType" NOT NULL,
    "status" "public"."PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "managerId" UUID NOT NULL,
    "accountantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Property_propertyNumber_key" ON "public"."Property"("propertyNumber");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "public"."Property"("status");

-- CreateIndex
CREATE INDEX "Property_managementType_idx" ON "public"."Property"("managementType");

-- CreateIndex
CREATE INDEX "Property_managerId_idx" ON "public"."Property"("managerId");

-- CreateIndex
CREATE INDEX "Property_accountantId_idx" ON "public"."Property"("accountantId");

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
