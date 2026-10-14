-- CreateEnum
CREATE TYPE "LicenseKind" AS ENUM ('SUBSCRIPTION', 'PERPETUAL');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "commercial_licenses" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "kind" "LicenseKind" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "license_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "token_digest" TEXT NOT NULL,
    "signed_token" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "max_branches" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 3,
    "features" JSONB NOT NULL,
    "activated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "commercial_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_licenses_license_id_key" ON "commercial_licenses"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_licenses_token_digest_key" ON "commercial_licenses"("token_digest");

-- CreateIndex
CREATE INDEX "commercial_licenses_establishment_id_status_expires_at_idx" ON "commercial_licenses"("establishment_id", "status", "expires_at");

-- AddForeignKey
ALTER TABLE "commercial_licenses" ADD CONSTRAINT "commercial_licenses_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
