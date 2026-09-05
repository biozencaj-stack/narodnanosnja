"use server";

import { prisma } from "@/lib/db";
import { uPromocijuZaPrikaz } from "./promotions-prikaz";

export interface AppliedPromotion {
  id: string;
  name: string;
  type: string;
  discount: number;
  description: string;
}

export interface CartItemForPromo {
  productId: string;
  price: number;
  quantity: number;
}

export interface CartDiscountResult {
  promotions: AppliedPromotion[];
  totalDiscount: number;
  freeShipping: boolean;
}

interface QuantityTier { qty: number; discount: number; }

export async function getActivePromotions() {
  const now = new Date();
  return prisma.promotion.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    include: { products: { select: { productId: true } } },
  });
}

export async function validateCoupon(code: string, userId?: string) {
  const now = new Date();
  const promotion = await prisma.promotion.findUnique({
    where: { code: code.toUpperCase() },
    include: { products: { select: { productId: true } } },
  });
  if (!promotion) return { valid: false, error: "Kupon kod nije pronadjen" };
  if (!promotion.isActive) return { valid: false, error: "Kupon nije aktivan" };
  if (now < promotion.startDate) return { valid: false, error: "Kupon jos nije aktivan" };
  if (now > promotion.endDate) return { valid: false, error: "Kupon je istekao" };
  if (promotion.maxUses && promotion.usedCount >= promotion.maxUses) return { valid: false, error: "Kupon iskoriscen" };
  if (userId) {
    const prev = await prisma.couponUsage.findFirst({ where: { promotionId: promotion.id, userId } });
    if (prev) return { valid: false, error: "Vec ste iskoristili ovaj kupon" };
  }
  return { valid: true, promotion };
}

export async function calculateCartDiscount(items: CartItemForPromo[], couponCode?: string, userId?: string): Promise<CartDiscountResult> {
  const result: CartDiscountResult = { promotions: [], totalDiscount: 0, freeShipping: false };
  if (items.length === 0) return result;

  const autoPromos = (await getActivePromotions()).filter((p) => !p.code);
  let couponPromo = null;
  if (couponCode) {
    const v = await validateCoupon(couponCode, userId);
    if (v.valid && v.promotion) couponPromo = v.promotion;
  }

  const allPromos = [...autoPromos, ...(couponPromo ? [couponPromo] : [])];
  const cartSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  for (const promo of allPromos) {
    const pids = promo.products.map((p) => p.productId);
    const isGlobal = pids.length === 0;
    if (promo.minCartValue && cartSubtotal < Number(promo.minCartValue)) continue;
    if (promo.maxUses && promo.usedCount >= promo.maxUses) continue;
    const now = new Date();
    if (now < promo.startDate || now > promo.endDate) continue;

    const appItems = isGlobal ? items : items.filter((i) => pids.includes(i.productId));
    if (appItems.length === 0 && !isGlobal) continue;

    const appSubtotal = appItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const appQty = appItems.reduce((s, i) => s + i.quantity, 0);
    let discount = 0, description = "";

    switch (promo.type) {
      case "PERCENT_OFF":
        discount = appSubtotal * (Number(promo.value) / 100);
        description = Number(promo.value) + "% popusta";
        break;
      case "FIXED_AMOUNT_OFF":
        discount = Math.min(Number(promo.value), appSubtotal);
        description = Number(promo.value) + " RSD popusta";
        break;
      case "BUY_X_GET_Y_FREE": {
        const mq = promo.minQuantity || 2;
        if (appQty > mq) {
          const prices = appItems.flatMap((i) => Array(i.quantity).fill(i.price)).sort((a, b) => a - b);
          const fc = Math.floor(appQty / (mq + 1));
          discount = prices.slice(0, fc).reduce((s, p) => s + p, 0);
          description = "Kupi " + mq + ", sledeci gratis";
        }
        break;
      }
      case "BUY_X_GET_PERCENT": {
        const mq = promo.minQuantity || 1;
        if (appQty > mq) {
          const prices = appItems.flatMap((i) => Array(i.quantity).fill(i.price)).sort((a, b) => a - b);
          const dc = Math.floor(appQty / (mq + 1));
          discount = prices.slice(0, dc).reduce((s, p) => s + p * (Number(promo.value) / 100), 0);
          description = "Kupi " + mq + ", jeftiniji " + Number(promo.value) + "% popusta";
        }
        break;
      }
      case "QUANTITY_DISCOUNT": {
        const tiers = (promo.quantityTiers as QuantityTier[] | null) || [];
        const sorted = [...tiers].sort((a, b) => b.qty - a.qty);
        const tier = sorted.find((t) => appQty >= t.qty);
        if (tier) {
          discount = appSubtotal * (tier.discount / 100);
          description = tier.discount + "% popusta za " + tier.qty + "+ artikala";
        }
        break;
      }
      case "FREE_SHIPPING":
        result.freeShipping = true;
        description = "Besplatna dostava";
        break;
    }

    if (discount > 0 || promo.type === "FREE_SHIPPING") {
      result.promotions.push({ id: promo.id, name: promo.name, type: promo.type, discount: Math.round(discount), description });
      result.totalDiscount += Math.round(discount);
    }
    if (promo.code && discount > 0) break;
    if (!promo.stackable && discount > 0) break;
  }
  return result;
}

export async function recordCouponUsage(couponCode: string, userId?: string, orderId?: string) {
  const promo = await prisma.promotion.findUnique({ where: { code: couponCode.toUpperCase() } });
  if (!promo) return;
  await prisma.$transaction([
    prisma.couponUsage.create({ data: { promotionId: promo.id, userId: userId || null, orderId: orderId || null } }),
    prisma.promotion.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
  ]);
}

export async function getProductPromotions(productId: string) {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now }, OR: [{ products: { none: {} } }, { products: { some: { productId } } }] },
  });
  return promos.map(uPromocijuZaPrikaz);
}

export async function getPromotionProducts() {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    include: { products: { include: { product: { include: { category: { select: { name: true, slug: true } }, brand: { select: { name: true, slug: true } } } } } } },
  });
  type PromotionProduct =
    (typeof promos)[number]["products"][number]["product"];
  const map = new Map<
    string,
    {
      product: PromotionProduct;
      promoList: { name: string; type: string; value: number }[];
    }
  >();
  for (const pr of promos) {
    const info = { name: pr.name, type: pr.type, value: Number(pr.value) };
    for (const pp of pr.products) {
      if (!pp.product.active) continue;
      const ex = map.get(pp.product.id);
      if (ex) ex.promoList.push(info);
      else map.set(pp.product.id, { product: pp.product, promoList: [info] });
    }
  }
  const saleProds = await prisma.product.findMany({ where: { active: true, onSale: true }, include: { category: { select: { name: true, slug: true } }, brand: { select: { name: true, slug: true } } } });
  for (const p of saleProds) { if (!map.has(p.id)) map.set(p.id, { product: p, promoList: [] }); }
  return Array.from(map.values()).map(({ product: p, promoList }) => ({
    id: p.id, slug: p.slug, name: p.name, price: Number(p.price), salePrice: p.salePrice ? Number(p.salePrice) : null, image1: p.image1, onSale: p.onSale, category: p.category, brand: p.brand, promotions: promoList,
  }));
}
