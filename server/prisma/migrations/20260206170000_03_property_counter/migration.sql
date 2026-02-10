CREATE TABLE IF NOT EXISTS "public"."PropertyCounter" (
    "id" INTEGER NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PropertyCounter_pkey" PRIMARY KEY ("id")
);
