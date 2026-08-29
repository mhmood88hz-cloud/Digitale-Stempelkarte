-- Add the column as nullable first so existing rows don't block the ALTER TABLE, backfill a
-- sequential per-salon number for them, then tighten to NOT NULL + unique.
ALTER TABLE "customers" ADD COLUMN "customerNumber" INTEGER;

UPDATE "customers" c
SET "customerNumber" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "salonId" ORDER BY "createdAt") AS rn
  FROM "customers"
) sub
WHERE c.id = sub.id;

ALTER TABLE "customers" ALTER COLUMN "customerNumber" SET NOT NULL;

CREATE UNIQUE INDEX "customers_salonId_customerNumber_key" ON "customers"("salonId", "customerNumber");
