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

class AttributeMutationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function assertAttributeCanBeArchived(
  tx: Prisma.TransactionClient,
  attributeDefinitionId: string,
) {
  const [activeTypeAssignments, activeProductValues] = await Promise.all([
    tx.productTypeAttribute.count({
      where: {
        attributeDefinitionId,
        productType: { active: true },
      },
    }),
    tx.productAttributeValue.count({
      where: {
        attributeDefinitionId,
        product: { active: true },
      },
    }),
  ]);

  if (activeTypeAssignments > 0 || activeProductValues > 0) {
    throw new AttributeMutationError(
      "Cannot archive an attribute referenced by active product types or products",
      409,
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attribute = await prisma.attributeDefinition.findUnique({
    where: { id },
    include: attributeInclude,
  });

  if (!attribute) {
    return NextResponse.json({ error: "Attribute not found" }, { status: 404 });
  }

  return NextResponse.json({ attribute });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    if (
      body.dataType !== undefined &&
      !isProductAttributeDataType(body.dataType)
    ) {
      return NextResponse.json(
        { error: "Invalid dataType" },
        { status: 400 },
      );
    }

    const code =
      body.code === undefined ? undefined : normalizeCode(body.code);
    const name =
      body.name === undefined ? undefined : parseLocalized(body.name);
    if (code === "" || name === null) {
      return NextResponse.json(
        { error: "Code and name cannot be empty" },
        { status: 400 },
      );
    }

    const choices =
      body.choices === undefined
        ? undefined
        : parseAttributeChoices(body.choices);
    if (choices === null) {
      return NextResponse.json(
        { error: "Choices must be a valid, duplicate-free array" },
        { status: 400 },
      );
    }
    const attribute = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.attributeDefinition.findUnique({
          where: { id },
          include: { _count: { select: { values: true, choices: true } } },
        });
        if (!existing) {
          throw new AttributeMutationError("Attribute not found", 404);
        }
        if (code !== undefined && code !== existing.code) {
          throw new AttributeMutationError("Attribute code is immutable", 409);
        }

        const dataType = body.dataType ?? existing.dataType;
        if (
          dataType !== existing.dataType &&
          (existing._count.values > 0 || existing._count.choices > 0)
        ) {
          throw new AttributeMutationError(
            "Cannot change dataType after values or choices have been created",
            409,
          );
        }
        if (
          choices &&
          choices.length > 0 &&
          dataType !== "SELECT" &&
          dataType !== "MULTI_SELECT"
        ) {
          throw new AttributeMutationError(
            "Choices are allowed only for SELECT attributes",
            400,
          );
        }
        if (body.active === false) {
          await assertAttributeCanBeArchived(tx, id);
        }

        await tx.attributeDefinition.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(body.description !== undefined && {
              description: optionalLocalizedJson(body.description),
            }),
            dataType,
            ...(body.unit !== undefined && {
              unit: optionalTrimmedString(body.unit),
            }),
            ...(typeof body.isFilterable === "boolean" && {
              isFilterable: body.isFilterable,
            }),
            ...(typeof body.isSearchable === "boolean" && {
              isSearchable: body.isSearchable,
            }),
            ...(typeof body.isRequiredByDefault === "boolean" && {
              isRequiredByDefault: body.isRequiredByDefault,
            }),
            ...(typeof body.active === "boolean" && { active: body.active }),
            ...(Number.isInteger(body.sortOrder) && {
              sortOrder: integerOrDefault(body.sortOrder),
            }),
          },
        });

        // Lista je upsert-only: izostavljena vrednost se ne brise i time se ne
        // gube vec sacuvani izbori proizvoda. Za uklanjanje se salje active=false.
        if (choices !== undefined) {
          for (const choice of choices) {
            await tx.attributeChoice.upsert({
              where: {
                attributeDefinitionId_code: {
                  attributeDefinitionId: id,
                  code: choice.code,
                },
              },
              create: { attributeDefinitionId: id, dataType, ...choice },
              update: {
                label: choice.label,
                metadata: choice.metadata,
                active: choice.active,
                sortOrder: choice.sortOrder,
              },
            });
          }
        }

        return tx.attributeDefinition.findUniqueOrThrow({
          where: { id },
          include: attributeInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ attribute });
  } catch (error) {
    if (error instanceof AttributeMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Attribute or choice code already exists" },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Concurrent catalog update; reload and try again" },
        { status: 409 },
      );
    }
    console.error("Update attribute definition error:", error);
    return NextResponse.json(
      { error: "Failed to update attribute definition" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const attribute = await prisma.$transaction(
      async (tx) => {
        await assertAttributeCanBeArchived(tx, id);
        return tx.attributeDefinition.update({
          where: { id },
          data: { active: false },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ attribute });
  } catch (error) {
    if (error instanceof AttributeMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Attribute not found" },
        { status: 404 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Concurrent catalog update; reload and try again" },
        { status: 409 },
      );
    }
    console.error("Archive attribute definition error:", error);
    return NextResponse.json(
      { error: "Failed to archive attribute definition" },
      { status: 500 },
    );
  }
}
