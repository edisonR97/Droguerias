CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');
CREATE TYPE "BatchStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'BLOCKED', 'EXPIRED', 'DEPLETED', 'RECALLED');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'SALE', 'RETURN_IN', 'RETURN_TO_SUPPLIER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DAMAGE', 'LOSS', 'EXPIRATION', 'QUARANTINE', 'RELEASE', 'RECALL');
CREATE TYPE "ExpiryAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

CREATE TABLE "product_categories" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "default_expiry_alert_days" INTEGER[] NOT NULL DEFAULT ARRAY[30, 60, 90, 180]::INTEGER[],
  CONSTRAINT "product_categories_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "product_categories_establishment_id_code_key" ON "product_categories"("establishment_id", "code");
CREATE INDEX "product_categories_establishment_id_active_idx" ON "product_categories"("establishment_id", "active");

CREATE TABLE "laboratories" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "tax_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "laboratories_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "laboratories_establishment_id_name_key" ON "laboratories"("establishment_id", "name");

CREATE TABLE "suppliers" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "tax_id" TEXT NOT NULL,
  "legal_name" TEXT NOT NULL,
  "trade_name" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "suppliers_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "suppliers_establishment_id_tax_id_key" ON "suppliers"("establishment_id", "tax_id");
CREATE INDEX "suppliers_establishment_id_active_idx" ON "suppliers"("establishment_id", "active");

CREATE TABLE "products" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "laboratory_id" UUID,
  "internal_code" TEXT NOT NULL,
  "barcode" TEXT,
  "commercial_name" TEXT NOT NULL,
  "generic_name" TEXT,
  "active_ingredient" TEXT,
  "concentration" TEXT,
  "presentation" TEXT NOT NULL,
  "manufacturer" TEXT,
  "sanitary_registration" TEXT,
  "sanitary_registration_expires_at" DATE,
  "purchase_unit" TEXT NOT NULL DEFAULT 'UNIDAD',
  "sale_unit" TEXT NOT NULL DEFAULT 'UNIDAD',
  "units_per_purchase" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "sale_price" DECIMAL(18,2) NOT NULL,
  "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "minimum_stock" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "maximum_stock" DECIMAL(18,6),
  "storage_conditions" TEXT,
  "physical_location_hint" TEXT,
  "prescription_required" BOOLEAN NOT NULL DEFAULT false,
  "controlled_substance" BOOLEAN NOT NULL DEFAULT false,
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "products_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT,
  CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT,
  CONSTRAINT "products_laboratory_id_fkey" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "products_establishment_id_internal_code_key" ON "products"("establishment_id", "internal_code");
CREATE UNIQUE INDEX "products_establishment_id_barcode_key" ON "products"("establishment_id", "barcode");
CREATE INDEX "products_establishment_id_commercial_name_idx" ON "products"("establishment_id", "commercial_name");
CREATE INDEX "products_establishment_id_active_ingredient_idx" ON "products"("establishment_id", "active_ingredient");

CREATE TABLE "branch_inventory" (
  "branch_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "on_hand" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "reserved" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "minimum_stock" DECIMAL(18,6),
  "maximum_stock" DECIMAL(18,6),
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("branch_id", "product_id"),
  CONSTRAINT "branch_inventory_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "branch_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);
CREATE INDEX "branch_inventory_branch_id_on_hand_idx" ON "branch_inventory"("branch_id", "on_hand");

CREATE TABLE "warehouse_locations" (
  "id" UUID PRIMARY KEY,
  "branch_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "warehouse_locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "warehouse_locations_branch_id_code_key" ON "warehouse_locations"("branch_id", "code");

CREATE TABLE "inventory_batches" (
  "id" UUID PRIMARY KEY,
  "branch_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "supplier_id" UUID,
  "location_id" UUID,
  "lot_number" TEXT NOT NULL,
  "expires_at" DATE NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unit_cost" DECIMAL(18,6) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "reserved" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "status" "BatchStatus" NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT "inventory_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL,
  CONSTRAINT "inventory_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "inventory_batches_branch_id_product_id_lot_number_key" ON "inventory_batches"("branch_id", "product_id", "lot_number");
CREATE INDEX "inventory_batches_branch_id_product_id_status_expires_at_idx" ON "inventory_batches"("branch_id", "product_id", "status", "expires_at");
CREATE INDEX "inventory_batches_expires_at_status_idx" ON "inventory_batches"("expires_at", "status");

CREATE TABLE "inventory_movements" (
  "id" BIGSERIAL PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID,
  "user_id" UUID NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unit_cost" DECIMAL(18,6),
  "balance_after" DECIMAL(18,6) NOT NULL,
  "reason" TEXT NOT NULL,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT,
  CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "inventory_movements_establishment_id_idempotency_key_key" ON "inventory_movements"("establishment_id", "idempotency_key");
CREATE INDEX "inventory_movements_branch_id_product_id_occurred_at_idx" ON "inventory_movements"("branch_id", "product_id", "occurred_at" DESC);
CREATE INDEX "inventory_movements_batch_id_occurred_at_idx" ON "inventory_movements"("batch_id", "occurred_at" DESC);

CREATE TABLE "expiry_alert_rules" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "days_before" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "expiry_alert_rules_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "expiry_alert_rules_establishment_id_days_before_key" ON "expiry_alert_rules"("establishment_id", "days_before");

CREATE TABLE "expiry_alerts" (
  "id" UUID PRIMARY KEY,
  "establishment_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "threshold_days" INTEGER NOT NULL,
  "status" "ExpiryAlertStatus" NOT NULL DEFAULT 'OPEN',
  "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  "resolved_by_id" UUID,
  "resolution_notes" TEXT,
  CONSTRAINT "expiry_alerts_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT,
  CONSTRAINT "expiry_alerts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "expiry_alerts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT,
  CONSTRAINT "expiry_alerts_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "expiry_alerts_batch_id_threshold_days_key" ON "expiry_alerts"("batch_id", "threshold_days");
CREATE INDEX "expiry_alerts_establishment_id_status_detected_at_idx" ON "expiry_alerts"("establishment_id", "status", "detected_at" DESC);
