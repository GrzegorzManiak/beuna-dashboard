-- CreateTable
CREATE TABLE "public"."PropertySection" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "headingText" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "textPosition" JSONB NOT NULL,
    "sectionType" VARCHAR(80) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertySection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertySection_propertyId_idx" ON "public"."PropertySection"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySection_propertyId_sectionIndex_key" ON "public"."PropertySection"("propertyId", "sectionIndex");

-- AddForeignKey
ALTER TABLE "public"."PropertySection" ADD CONSTRAINT "PropertySection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
