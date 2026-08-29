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

class ProductTypeMutationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function parseExpectedUpdatedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const productType = await prisma.productType.findUnique({
    where: { id },
    include: productTypeInclude,
  });

  if (!productType) {
    return NextResponse.json({ error: "Product type not found" }, { status: 404 });
  }

  return NextResponse.json({ productType });
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
    if (body.expectedUpdatedAt === undefined) {
      return NextResponse.json(
        { error: "expectedUpdatedAt is required" },
        { status: 428 },
      );
    }
    const expectedUpdatedAt = parseExpectedUpdatedAt(body.expectedUpdatedAt);
    if (!expectedUpdatedAt) {
      return NextResponse.json(
        { error: "expectedUpdatedAt must be a valid ISO timestamp" },
        { status: 400 },
      );
    }

    const assignments =
      body.attributes === undefined
        ? undefined
        : parseProductTypeAttributeAssignments(body.attributes);

    const code =
      body.code === undefined ? undefined : normalizeCode(body.code);
    const name =
      body.name === undefined ? undefined : parseLocalized(body.name);

    if (code === "" || name === null || assignments === null) {
      return NextResponse.json(
        { error: "Code, name and attribute assignments must be valid" },
        { status: 400 },
      );
    }

    const productType = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.productType.findUnique({
          where: { id },
          include: {
            attributes: {
              select: {
                attributeDefinitionId: true,
                isRequired: true,
                sortOrder: true,
              },
            },
          },
        });
        if (!existing) {
          throw new ProductTypeMutationError("Product type not found", 404);
        }
        if (code !== undefined && code !== existing.code) {
          throw new ProductTypeMutationError(
            "Product type code is immutable",
            409,
          );
        }
        if (body.active === false) {
          const activeProducts = await tx.product.count({
            where: { productTypeId: id, active: true },
          });
          if (activeProducts > 0) {
            throw new ProductTypeMutationError(
              "Cannot archive a product type used by active products",
              409,
            );
          }
        }
        if (
          body.active === true &&
          assignments === undefined &&
          !existing.active
        ) {
          const archivedAssignments = await tx.productTypeAttribute.count({
            where: {
              productTypeId: id,
              attributeDefinition: { active: false },
            },
          });
          if (archivedAssignments > 0) {
            throw new ProductTypeMutationError(
              "Archived attributes must be removed or reactivated first",
              409,
            );
          }
        }

        const touched = await tx.productType.updateMany({
          where: { id, updatedAt: expectedUpdatedAt },
          data: {
            ...(name !== undefined && { name }),
            ...(body.description !== undefined && {
              description: optionalLocalizedJson(body.description),
            }),
            ...(typeof body.active === "boolean" && { active: body.active }),
            ...(Number.isInteger(body.sortOrder) && {
              sortOrder: integerOrDefault(body.sortOrder),
            }),
            // Explicitno pomeranje verzije pokriva i PUT koji menja samo veze.
            updatedAt: new Date(),
          },
        });
        if (touched.count !== 1) {
          throw new ProductTypeMutationError(
            "Product type was changed by another request",
            409,
          );
        }

        if (assignments !== undefined) {
          const definitions = await tx.attributeDefinition.findMany({
            where: {
              id: {
                in: assignments.map((item) => item.attributeDefinitionId),
              },
              active: true,
            },
            select: { id: true, isRequiredByDefault: true },
          });
          if (definitions.length !== assignments.length) {
            throw new ProductTypeMutationError(
              "One or more attribute definitions do not exist or are archived",
              400,
            );
          }

          const currentById = new Map(
            existing.attributes.map((assignment) => [
              assignment.attributeDefinitionId,
              assignment,
            ]),
          );
          const defaults = new Map(
            definitions.map((definition) => [
              definition.id,
              definition.isRequiredByDefault,
            ]),
          );
          const desired = assignments.map((assignment) => ({
            attributeDefinitionId: assignment.attributeDefinitionId,
            isRequired:
              assignment.isRequired ??
              currentById.get(assignment.attributeDefinitionId)?.isRequired ??
              defaults.get(assignment.attributeDefinitionId) ??
              false,
            sortOrder: assignment.sortOrder,
          }));
          const desiredIds = new Set(
            desired.map((assignment) => assignment.attributeDefinitionId),
          );
          const removedIds = existing.attributes
            .map((assignment) => assignment.attributeDefinitionId)
            .filter((attributeId) => !desiredIds.has(attributeId));

          if (removedIds.length > 0) {
            const valuesThatWouldBeOrphaned =
              await tx.productAttributeValue.count({
                where: {
                  attributeDefinitionId: { in: removedIds },
                  product: { productTypeId: id },
                },
              });
            if (valuesThatWouldBeOrphaned > 0) {
              throw new ProductTypeMutationError(
                "Cannot remove attributes that already have product values",
                409,
              );
            }
          }

          for (const assignment of desired) {
            const becomingRequired =
              assignment.isRequired &&
              currentById.get(assignment.attributeDefinitionId)?.isRequired !==
                true;
            if (becomingRequired) {
              const productsMissingValue = await tx.product.count({
                where: {
                  productTypeId: id,
                  attributeValues: {
                    none: {
                      attributeDefinitionId:
                        assignment.attributeDefinitionId,
                    },
                  },
                },
              });
              if (productsMissingValue > 0) {
                throw new ProductTypeMutationError(
                  "Required attributes must be backfilled before activation",
                  409,
                );
              }
            }

            await tx.productTypeAttribute.upsert({
              where: {
                productTypeId_attributeDefinitionId: {
                  productTypeId: id,
                  attributeDefinitionId: assignment.attributeDefinitionId,
                },
              },
              create: { productTypeId: id, ...assignment },
              update: {
                isRequired: assignment.isRequired,
                sortOrder: assignment.sortOrder,
              },
            });
          }

          if (removedIds.length > 0) {
            await tx.productTypeAttribute.deleteMany({
              where: {
                productTypeId: id,
                attributeDefinitionId: { in: removedIds },
              },
            });
          }
        }

        return tx.productType.findUniqueOrThrow({
          where: { id },
          include: productTypeInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ productType });
  } catch (error) {
    if (error instanceof ProductTypeMutationError) {
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
        { error: "Product type code already exists" },
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
    console.error("Update product type error:", error);
    return NextResponse.json(
      { error: "Failed to update product type" },
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
    const productType = await prisma.$transaction(
      async (tx) => {
        const activeProducts = await tx.product.count({
          where: { productTypeId: id, active: true },
        });
        if (activeProducts > 0) {
          throw new ProductTypeMutationError(
            "Cannot archive a product type used by active products",
            409,
          );
        }

        return tx.productType.update({
          where: { id },
          data: { active: false },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ productType });
  } catch (error) {
    if (error instanceof ProductTypeMutationError) {
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
        { error: "Product type not found" },
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
    console.error("Archive product type error:", error);
    return NextResponse.json(
      { error: "Failed to archive product type" },
      { status: 500 },
    );
  }
}
