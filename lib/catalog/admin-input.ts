import { Prisma } from "@/lib/db";

export const PRODUCT_ATTRIBUTE_DATA_TYPES = [
  "TEXT",
  "RICH_TEXT",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTI_SELECT",
  "JSON",
] as const;

export type ProductAttributeDataTypeInput =
  (typeof PRODUCT_ATTRIBUTE_DATA_TYPES)[number];

export type ProductTypeAttributeAssignment = {
  attributeDefinitionId: string;
  isRequired?: boolean;
  sortOrder: number;
};

export type AttributeChoiceWrite = {
  code: string;
  label: { sr: string; en: string };
  metadata: Prisma.InputJsonValue | typeof Prisma.DbNull;
  active: boolean;
  sortOrder: number;
};

type LocalizedJson = { sr: string; en: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeCode(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[šś]/g, "s")
    .replace(/[žź]/g, "z")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseLocalized(value: unknown): LocalizedJson | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { sr: text, en: text } : null;
  }

  if (!isRecord(value)) return null;

  const sr = typeof value.sr === "string" ? value.sr.trim() : "";
  const en = typeof value.en === "string" ? value.en.trim() : "";
  if (!sr && !en) return null;

  return { sr: sr || en, en: en || sr };
}

export function optionalLocalizedJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return parseLocalized(value) ?? Prisma.DbNull;
}

export function optionalJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

export function optionalTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function integerOrDefault(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

export function isProductAttributeDataType(
  value: unknown,
): value is ProductAttributeDataTypeInput {
  return (
    typeof value === "string" &&
    PRODUCT_ATTRIBUTE_DATA_TYPES.includes(
      value as ProductAttributeDataTypeInput,
    )
  );
}

export function parseProductTypeAttributeAssignments(
  value: unknown,
): ProductTypeAttributeAssignment[] | null {
  if (!Array.isArray(value)) return null;

  const assignments = new Map<string, ProductTypeAttributeAssignment>();
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return null;
    if (typeof item.attributeDefinitionId !== "string") return null;

    const attributeDefinitionId = item.attributeDefinitionId.trim();
    if (!attributeDefinitionId || assignments.has(attributeDefinitionId)) {
      return null;
    }
    if (item.isRequired !== undefined && typeof item.isRequired !== "boolean") {
      return null;
    }
    if (item.sortOrder !== undefined && !Number.isInteger(item.sortOrder)) {
      return null;
    }

    assignments.set(attributeDefinitionId, {
      attributeDefinitionId,
      ...(typeof item.isRequired === "boolean" && {
        isRequired: item.isRequired,
      }),
      sortOrder: integerOrDefault(item.sortOrder, index),
    });
  }

  return [...assignments.values()];
}

export function parseAttributeChoices(
  value: unknown,
): AttributeChoiceWrite[] | null {
  if (!Array.isArray(value)) return null;

  const choices = new Map<string, AttributeChoiceWrite>();
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return null;

    const code = normalizeCode(item.code);
    const label = parseLocalized(item.label);
    if (!code || !label || choices.has(code)) return null;
    if (item.active !== undefined && typeof item.active !== "boolean") {
      return null;
    }
    if (item.sortOrder !== undefined && !Number.isInteger(item.sortOrder)) {
      return null;
    }

    choices.set(code, {
      code,
      label,
      metadata: optionalJson(item.metadata),
      active: item.active !== false,
      sortOrder: integerOrDefault(item.sortOrder, index),
    });
  }

  return [...choices.values()];
}
