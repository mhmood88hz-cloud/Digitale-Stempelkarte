-- CreateEnum
CREATE TYPE "WalletMode" AS ENUM ('pwa', 'apple', 'google');

-- AlterTable
ALTER TABLE "loyalty_cards" ADD COLUMN     "walletMode" "WalletMode" NOT NULL DEFAULT 'pwa';
