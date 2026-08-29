import { prisma } from "@/lib/db";

export interface NavCategory {
  id: string;
  name: unknown; // Json: { sr, en }
  slug: string;
  children: { id: string; name: unknown; slug: string }[];
}

/**
 * Fetch root categories marked as showInNav, with their active children.
 * Used by NavBarWrapper to pass dynamic navigation data to NavBar.
 */
export async function getNavCategories(): Promise<NavCategory[]> {
  const categories = await prisma.category.findMany({
    where: { active: true, showInNav: true, parentId: null },
    orderBy: { navOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return categories;
}

/**
 * Check if there are active products on sale or marked as new.
 * Used to conditionally show "Akcije" / "Novo" in the nav.
 */
export async function getNavFlags(): Promise<{ hasSale: boolean; hasNovo: boolean }> {
  const [saleCount, novoCount] = await Promise.all([
    prisma.product.count({ where: { active: true, onSale: true } }),
    prisma.product.count({ where: { active: true, novo: true } }),
  ]);
  return { hasSale: saleCount > 0, hasNovo: novoCount > 0 };
}
