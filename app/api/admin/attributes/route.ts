import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@/lib/db";
import {
  integerOrDefault,
  isProductAttributeDataType,
  normalizeCode,
  optionalLocalizedJson,
  optionalTrimmedString,
  parseAttributeChoices,
  parseLocalized,
} from "@/lib/catalog/admin-input";

const attributeInclude = {
  choices: {
    orderBy: [{ sortOrder: "asc" as const }, { code: "asc" as const }],
  },
  productTypes: {
    include: {
      productType: { select: { id: true, code: true, name: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  _count: { select: { values: true } },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attributes = await prisma.attributeDefinition.findMany({
    include: attributeInclude,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ attributes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const code = normalizeCode(body.code);
    const name = parseLocalized(body.name);
    const dataType = body.dataType;
    const choices =
      body.choices === undefined ? [] : parseAttributeChoices(body.choices);

    if (
      !code ||
      !name ||
      !isProductAttributeDataType(dataType) ||
      choices === null
    ) {
      return NextResponse.json(
        { error: "Code, name, dataType and choices must be valid" },
        { status: 400 },
      );
    }

    if (
      choices.length > 0 &&
      dataType !== "SELECT" &&
      dataType !== "MULTI_SELECT"
    ) {
      return NextResponse.json(
        { error: "Choices are allowed only for SELECT attributes" },
        { status: 400 },
      );
    }

    const attribute = await prisma.attributeDefinition.create({
      data: {
        code,
        name,
        description: optionalLocalizedJson(body.description),
        dataType,
        unit: optionalTrimmedString(body.unit),
        isFilterable:
          typeof body.isFilterable === "boolean" ? body.isFilterable : false,
        isSearchable:
          typeof body.isSearchable === "boolean" ? body.isSearchable : false,
        isRequiredByDefault:
          typeof body.isRequiredByDefault === "boolean"
            ? body.isRequiredByDefault
            : false,
        active: typeof body.active === "boolean" ? body.active : true,
        sortOrder: integerOrDefault(body.sortOrder),
        choices:
          choices.length > 0
            ? {
                create: choices.map((choice) => ({
                  ...choice,
                  dataType,
                })),
              }
            : undefined,
      },
      include: attributeInclude,
    });

    return NextResponse.json({ attribute }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Attribute or choice code already exists" },
        { status: 409 },
      );
    }
    console.error("Create attribute definition error:", error);
    return NextResponse.json(
      { error: "Failed to create attribute definition" },
      { status: 500 },
    );
  }
}
