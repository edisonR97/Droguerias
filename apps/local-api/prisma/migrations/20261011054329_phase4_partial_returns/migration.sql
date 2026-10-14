-- CreateTable
CREATE TABLE "sale_returns" (
    "id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "number" BIGSERIAL NOT NULL,
    "reason" TEXT NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_items" (
    "id" UUID NOT NULL,
    "sale_return_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_allocations" (
    "sale_return_item_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "sale_return_allocations_pkey" PRIMARY KEY ("sale_return_item_id","batch_id")
);

-- CreateIndex
CREATE INDEX "sale_returns_sale_id_created_at_idx" ON "sale_returns"("sale_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sale_returns_establishment_id_idempotency_key_key" ON "sale_returns"("establishment_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_return_id_fkey" FOREIGN KEY ("sale_return_id") REFERENCES "sale_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_allocations" ADD CONSTRAINT "sale_return_allocations_sale_return_item_id_fkey" FOREIGN KEY ("sale_return_item_id") REFERENCES "sale_return_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_allocations" ADD CONSTRAINT "sale_return_allocations_sale_item_id_batch_id_fkey" FOREIGN KEY ("sale_item_id", "batch_id") REFERENCES "sale_item_allocations"("sale_item_id", "batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;
