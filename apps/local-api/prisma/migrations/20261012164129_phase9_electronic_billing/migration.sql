-- CreateEnum
CREATE TYPE "ElectronicDocumentType" AS ENUM ('INVOICE', 'POS_EQUIVALENT', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "ElectronicDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "electronic_documents" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "sale_id" UUID,
    "type" "ElectronicDocumentType" NOT NULL,
    "status" "ElectronicDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider_document_id" TEXT,
    "cufe" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "xml_url" TEXT,
    "pdf_url" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "electronic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "electronic_documents_sale_id_key" ON "electronic_documents"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_documents_cufe_key" ON "electronic_documents"("cufe");

-- CreateIndex
CREATE INDEX "electronic_documents_establishment_id_status_created_at_idx" ON "electronic_documents"("establishment_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "electronic_documents_establishment_id_idempotency_key_key" ON "electronic_documents"("establishment_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electronic_documents" ADD CONSTRAINT "electronic_documents_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
