import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@/lib/db";
import {
  integerOrDefault,
  normalizeCode,
  optionalLocalizedJson,
  parseProductTypeAttributeAssignments,
  parseLocalized,
} from "@/lib/catalog/admin-input";

const productTypeInclude = {
  attributes: {
    include: {
      attributeDefinition: {
        include: {
          choices: { orderBy: [{ sortOrder: "asc" as const }, { code: "asc" as const }] },
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  _count: { select: { products: true } },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productTypes = await prisma.productType.findMany({
    include: productTypeInclude,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ productTypes });
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
    const assignments =
      body.attributes === undefined
        ? []
        : parseProductTypeAttributeAssignments(body.attributes);

    if (!code || !name || assignments === null) {
      return NextResponse.json(
        { error: "Code, name and valid attribute assignments are required" },
        { status: 400 },
      );
    }

    let resolvedAssignments: Array<{
      attributeDefinitionId: string;
      isRequired: boolean;
      sortOrder: number;
    }> = [];

    if (assignments.length > 0) {
      const existingAttributes = await prisma.attributeDefinition.findMany({
        where: {
          id: { in: assignments.map((item) => item.attributeDefinitionId) },
          active: true,
        },
        select: { id: true, isRequiredByDefault: true },
      });
      if (existingAttributes.length !== assignments.length) {
        return NextResponse.json(
          { error: "One or more attribute definitions do not exist or are archived" },
          { status: 400 },
        );
      }

      const defaults = new Map(
        existingAttributes.map((attribute) => [
          attribute.id,
          attribute.isRequiredByDefault,
        ]),
      );
      resolvedAssignments = assignments.map((assignment) => ({
        ...assignment,
        isRequired:
          assignment.isRequired ??
          defaults.get(assignment.attributeDefinitionId) ??
          false,
      }));
    }

    const productType = await prisma.productType.create({
      data: {
        code,
        name,
        description: optionalLocalizedJson(body.description),
        active: typeof body.active === "boolean" ? body.active : true,
        sortOrder: integerOrDefault(body.sortOrder),
        attributes:
          resolvedAssignments.length > 0
            ? { create: resolvedAssignments }
            : undefined,
      },
      include: productTypeInclude,
    });

    return NextResponse.json({ productType }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Product type code already exists" },
        { status: 409 },
      );
    }
    console.error("Create product type error:", error);
    return NextResponse.json(
      { error: "Failed to create product type" },
      { status: 500 },
    );
  }
}
