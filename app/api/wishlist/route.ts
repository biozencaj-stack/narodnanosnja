import { resolveServerSession } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db";
import {
  createWishlistDeleteHandler,
  createWishlistGetHandler,
  createWishlistPostHandler,
  type WishlistFailure,
} from "@/lib/wishlist/wishlist-route";

function reportWishlistFailure(failure: WishlistFailure): void {
  try {
    console.error("Wishlist request failed", failure);
  } catch {
    // Observability must never replace the fail-closed private response.
  }
}

export const GET = createWishlistGetHandler({
  resolveSession: () => resolveServerSession(),
  findItemsByUserId: (userId) =>
    prisma.wishlist.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: "desc" },
    }),
  reportFailure: reportWishlistFailure,
});

export const POST = createWishlistPostHandler({
  resolveSession: () => resolveServerSession(),
  upsertItem: (userId, productId) =>
    prisma.wishlist.upsert({
      where: {
        userId_productId: {
          userId,
          productId: productId as string,
        },
      },
      update: {},
      create: {
        userId,
        productId: productId as string,
      },
    }),
  reportFailure: reportWishlistFailure,
});

export const DELETE = createWishlistDeleteHandler({
  resolveSession: () => resolveServerSession(),
  deleteItems: (userId, productId) =>
    prisma.wishlist.deleteMany({
      where: {
        userId,
        productId: productId as string,
      },
    }),
  reportFailure: reportWishlistFailure,
});
