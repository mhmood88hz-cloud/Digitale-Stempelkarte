-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "salons_stripeCustomerId_key" ON "salons"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "salons_stripeSubscriptionId_key" ON "salons"("stripeSubscriptionId");
