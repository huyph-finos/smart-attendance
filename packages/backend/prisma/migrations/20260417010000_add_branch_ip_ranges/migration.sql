-- AlterTable
ALTER TABLE "branches" ADD COLUMN "allowed_ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[];
