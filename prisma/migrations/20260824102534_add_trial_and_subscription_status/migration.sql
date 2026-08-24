/*
  Warnings:

  - Added the required column `trialEndsAt` to the `salons` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3) NOT NULL;
