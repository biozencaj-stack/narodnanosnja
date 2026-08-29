-- Prisma-generated expand SQL, dopunjen ručno pregledanim DB invariantama.
-- Sve izmene posle odvojenih enum migracija primenjuju se atomski.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

-- CreateEnum
CREATE TYPE "PaymentCallbackKind" AS ENUM ('APPROVED', 'DECLINED', 'REVIEW');

-- CreateEnum
CREATE TYPE "PaymentEventResult" AS ENUM ('APPLIED', 'REPLAYED', 'REVIEW');

-- CreateEnum
CREATE TYPE "ProductAttributeDataType" AS ENUM ('TEXT', 'RICH_TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'JSON');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutIdempotencyKey" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'RSD',
ADD COLUMN     "inventoryAllocated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "inventoryStockId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productTypeId" TEXT;

-- AlterTable
ALTER TABLE "ProductSize" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'NESTPAY',
    "eventKey" TEXT NOT NULL,
    "callbackKind" "PaymentCallbackKind" NOT NULL,
    "result" "PaymentEventResult" NOT NULL,
    "reason" TEXT,
    "transId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "rawResponse" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "dataType" "ProductAttributeDataType" NOT NULL,
    "unit" TEXT,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "isRequiredByDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeAttribute" (
    "productTypeId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductTypeAttribute_pkey" PRIMARY KEY ("productTypeId","attributeDefinitionId")
);

-- CreateTable
CREATE TABLE "AttributeChoice" (
    "id" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "dataType" "ProductAttributeDataType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "dataType" "ProductAttributeDataType" NOT NULL,
    "valueText" JSONB,
    "valueInteger" INTEGER,
    "valueDecimal" DECIMAL(18,6),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeSelectedChoice" (
    "productAttributeValueId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "attributeChoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAttributeSelectedChoice_pkey" PRIMARY KEY ("productAttributeValueId","attributeChoiceId")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOptionValue" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantOptionValue" (
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("variantId","optionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventKey_key" ON "PaymentEvent"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentEvent_orderId_createdAt_idx" ON "PaymentEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_transId_idx" ON "PaymentEvent"("transId");

-- CreateIndex
CREATE INDEX "PaymentEvent_result_idx" ON "PaymentEvent"("result");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_code_key" ON "ProductType"("code");

-- CreateIndex
CREATE INDEX "ProductType_active_sortOrder_idx" ON "ProductType"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_code_key" ON "AttributeDefinition"("code");

-- CreateIndex
CREATE INDEX "AttributeDefinition_active_sortOrder_idx" ON "AttributeDefinition"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "AttributeDefinition_dataType_idx" ON "AttributeDefinition"("dataType");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_id_dataType_key" ON "AttributeDefinition"("id", "dataType");

-- CreateIndex
CREATE INDEX "ProductTypeAttribute_attributeDefinitionId_idx" ON "ProductTypeAttribute"("attributeDefinitionId");

-- CreateIndex
CREATE INDEX "ProductTypeAttribute_productTypeId_sortOrder_idx" ON "ProductTypeAttribute"("productTypeId", "sortOrder");

-- CreateIndex
CREATE INDEX "AttributeChoice_attributeDefinitionId_active_sortOrder_idx" ON "AttributeChoice"("attributeDefinitionId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeChoice_attributeDefinitionId_code_key" ON "AttributeChoice"("attributeDefinitionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeChoice_id_attributeDefinitionId_key" ON "AttributeChoice"("id", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_attributeDefinitionId_idx" ON "ProductAttributeValue"("attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeDefinitionId_key" ON "ProductAttributeValue"("productId", "attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_id_attributeDefinitionId_key" ON "ProductAttributeValue"("id", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "ProductAttributeSelectedChoice_attributeChoiceId_idx" ON "ProductAttributeSelectedChoice"("attributeChoiceId");

-- CreateIndex
CREATE INDEX "ProductAttributeSelectedChoice_productAttributeValueId_sort_idx" ON "ProductAttributeSelectedChoice"("productAttributeValueId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductOption_productId_sortOrder_idx" ON "ProductOption"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_code_key" ON "ProductOption"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_id_productId_key" ON "ProductOption"("id", "productId");

-- CreateIndex
CREATE INDEX "ProductOptionValue_optionId_active_sortOrder_idx" ON "ProductOptionValue"("optionId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_optionId_code_key" ON "ProductOptionValue"("optionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOptionValue_id_optionId_key" ON "ProductOptionValue"("id", "optionId");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_productId_idx" ON "ProductVariantOptionValue"("productId");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_optionValueId_optionId_idx" ON "ProductVariantOptionValue"("optionValueId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOptionValue_variantId_optionValueId_key" ON "ProductVariantOptionValue"("variantId", "optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutIdempotencyKey_key" ON "Order"("checkoutIdempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_inventoryStockId_idx" ON "OrderItem"("inventoryStockId");

-- CreateIndex
CREATE INDEX "Product_productTypeId_idx" ON "Product"("productTypeId");

-- CreateIndex
CREATE INDEX "ProductSize_productId_active_idx" ON "ProductSize"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_size_key" ON "ProductSize"("productId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_id_productId_key" ON "ProductVariant"("id", "productId");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "ProductTypeAttribute_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "ProductTypeAttribute_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeChoice" ADD CONSTRAINT "AttributeChoice_attributeDefinitionId_dataType_fkey" FOREIGN KEY ("attributeDefinitionId", "dataType") REFERENCES "AttributeDefinition"("id", "dataType") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeDefinitionId_dataType_fkey" FOREIGN KEY ("attributeDefinitionId", "dataType") REFERENCES "AttributeDefinition"("id", "dataType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeSelectedChoice" ADD CONSTRAINT "ProductAttributeSelectedChoice_productAttributeValueId_att_fkey" FOREIGN KEY ("productAttributeValueId", "attributeDefinitionId") REFERENCES "ProductAttributeValue"("id", "attributeDefinitionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeSelectedChoice" ADD CONSTRAINT "ProductAttributeSelectedChoice_attributeChoiceId_attribute_fkey" FOREIGN KEY ("attributeChoiceId", "attributeDefinitionId") REFERENCES "AttributeChoice"("id", "attributeDefinitionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOptionValue" ADD CONSTRAINT "ProductOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionId_productId_fkey" FOREIGN KEY ("optionId", "productId") REFERENCES "ProductOption"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionValueId_optionId_fkey" FOREIGN KEY ("optionValueId", "optionId") REFERENCES "ProductOptionValue"("id", "optionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ručno upravljani CHECK constraints koje Prisma schema ne može da izrazi.
ALTER TABLE "AttributeChoice"
  ADD CONSTRAINT "AttributeChoice_select_data_type_check"
  CHECK ("dataType" IN ('SELECT', 'MULTI_SELECT'));

ALTER TABLE "ProductAttributeValue"
  ADD CONSTRAINT "ProductAttributeValue_typed_scalar_check"
  CHECK (
    ("dataType" IN ('TEXT', 'RICH_TEXT')
      AND "valueText" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'INTEGER'
      AND "valueInteger" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'DECIMAL'
      AND "valueDecimal" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'BOOLEAN'
      AND "valueBoolean" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" IN ('DATE', 'DATETIME')
      AND "valueDate" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" = 'JSON'
      AND "valueJson" IS NOT NULL
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 1)
    OR ("dataType" IN ('SELECT', 'MULTI_SELECT')
      AND num_nonnulls("valueText", "valueInteger", "valueDecimal",
        "valueBoolean", "valueDate", "valueJson") = 0)
  );

ALTER TABLE "ProductSize"
  ADD CONSTRAINT "ProductSize_stock_nonnegative_check"
  CHECK ("stock" >= 0),
  ADD CONSTRAINT "ProductSize_size_format_check"
  CHECK (
    char_length("size") BETWEEN 1 AND 100
    AND "size" = btrim("size")
  );

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_nonnegative_check"
  CHECK (
    "subtotal" >= 0
    AND "shipping" >= 0
    AND "discount" >= 0
    AND "total" >= 0
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive_check"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_price_nonnegative_check"
  CHECK ("price" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_prices_nonnegative_check"
  CHECK (
    "price" >= 0
    AND ("salePrice" IS NULL OR "salePrice" >= 0)
  ),
  ADD CONSTRAINT "Product_measurements_nonnegative_check"
  CHECK (
    ("weight" IS NULL OR "weight" >= 0)
    AND ("length" IS NULL OR "length" >= 0)
    AND ("width" IS NULL OR "width" >= 0)
    AND ("height" IS NULL OR "height" >= 0)
  );

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_nonnegative_check"
  CHECK ("stock" >= 0),
  ADD CONSTRAINT "ProductVariant_price_nonnegative_check"
  CHECK ("price" IS NULL OR "price" >= 0);

ALTER TABLE "ProductType"
  ADD CONSTRAINT "ProductType_code_format_check"
  CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

ALTER TABLE "AttributeDefinition"
  ADD CONSTRAINT "AttributeDefinition_code_format_check"
  CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

ALTER TABLE "AttributeChoice"
  ADD CONSTRAINT "AttributeChoice_code_format_check"
  CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

ALTER TABLE "ProductOption"
  ADD CONSTRAINT "ProductOption_code_format_check"
  CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

ALTER TABLE "ProductOptionValue"
  ADD CONSTRAINT "ProductOptionValue_code_format_check"
  CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

-- Cross-table cardinality se proverava na kraju transakcije, kada su nested
-- Prisma upisi ProductAttributeValue + selectedChoices kompletni.
CREATE FUNCTION public.assert_product_attribute_choice_cardinality(value_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_type public."ProductAttributeDataType";
  selected_count BIGINT;
BEGIN
  IF value_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "dataType"
  INTO current_type
  FROM public."ProductAttributeValue"
  WHERE "id" = value_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*)
  INTO selected_count
  FROM public."ProductAttributeSelectedChoice"
  WHERE "productAttributeValueId" = value_id;

  IF current_type = 'SELECT' AND selected_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'ProductAttributeSelectedChoice_cardinality_check',
      MESSAGE = format(
        'SELECT attribute value %s must have exactly one selected choice',
        value_id
      );
  ELSIF current_type NOT IN ('SELECT', 'MULTI_SELECT')
      AND selected_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'ProductAttributeSelectedChoice_cardinality_check',
      MESSAGE = format(
        'Scalar attribute value %s cannot have selected choices',
        value_id
      );
  END IF;
END;
$$;

CREATE FUNCTION public.enforce_product_attribute_value_cardinality()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.assert_product_attribute_choice_cardinality(NEW."id");
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.assert_product_attribute_choice_cardinality(OLD."id");
    PERFORM public.assert_product_attribute_choice_cardinality(NEW."id");
  ELSE
    PERFORM public.assert_product_attribute_choice_cardinality(OLD."id");
  END IF;

  RETURN NULL;
END;
$$;

CREATE FUNCTION public.enforce_product_attribute_selected_choice_cardinality()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.assert_product_attribute_choice_cardinality(
      NEW."productAttributeValueId"
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.assert_product_attribute_choice_cardinality(
      OLD."productAttributeValueId"
    );
    PERFORM public.assert_product_attribute_choice_cardinality(
      NEW."productAttributeValueId"
    );
  ELSE
    PERFORM public.assert_product_attribute_choice_cardinality(
      OLD."productAttributeValueId"
    );
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ProductAttributeValue_choice_cardinality_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ProductAttributeValue"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_product_attribute_value_cardinality();

CREATE CONSTRAINT TRIGGER "ProductAttributeSelectedChoice_cardinality_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ProductAttributeSelectedChoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_product_attribute_selected_choice_cardinality();

COMMIT;
