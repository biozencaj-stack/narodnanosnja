"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store";

export interface CartCommerceSettings {
  shippingCost: number;
  freeShippingThreshold: number;
}

interface AppliedPromotion {
  id: string;
  name: string;
  type: string;
  discount: number;
  description: string;
}

export interface QuotedCartLine {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PromotionState {
  quotedLines: QuotedCartLine[];
  promotions: AppliedPromotion[];
  totalDiscount: number;
  freeShipping: boolean;
  couponCode: string | null;
  couponError: string | null;
  isLoadingCoupon: boolean;
  isLoadingQuote: boolean;
  quoteError: string | null;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;
  finalTotal: number;
  finalShipping: number;
  subtotal: number;
}

export function useCartWithPromotions(
  commerceSettings: CartCommerceSettings,
): PromotionState {
  const items = useCartStore((s) => s.items);
  const couponCode = useCartStore((s) => s.couponCode);
  const setCouponCode = useCartStore((s) => s.setCouponCode);
  const [promotions, setPromotions] = useState<AppliedPromotion[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [freeShipping, setFreeShipping] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [serverQuote, setServerQuote] = useState<{
    lines: QuotedCartLine[];
    subtotal: number;
    shipping: number;
    total: number;
  } | null>(null);

  const subtotal = items.reduce((sum, item) => {
    const price = item.price2 || item.price1 || item.price;
    return sum + price * item.quantity;
  }, 0);

  const baseShipping =
    subtotal >= commerceSettings.freeShippingThreshold
      ? 0
      : commerceSettings.shippingCost;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (items.length === 0) {
      setPromotions([]);
      setTotalDiscount(0);
      setFreeShipping(false);
      setServerQuote(null);
      setQuoteError(null);
      setIsLoadingQuote(false);
      setCouponError(null);
      setIsLoadingCoupon(false);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setIsLoadingQuote(true);
    setQuoteError(null);
    setServerQuote(null);

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const cartItems = items.map((item) => ({
            productId: item.id,
            size: item.size,
            quantity: item.quantity,
          }));

          const res = await fetch("/api/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cartItems, couponCode }),
            signal: controller.signal,
          });
          const data = await res.json();
          if (cancelled) return;

          if (res.ok) {
            setPromotions(data.promotions || []);
            setTotalDiscount(data.totalDiscount || 0);
            setFreeShipping(data.freeShipping || false);
            setServerQuote({
              lines: Array.isArray(data.lines)
                ? data.lines.map((line: QuotedCartLine) => ({
                    productId: String(line.productId),
                    productName: String(line.productName),
                    size: String(line.size),
                    quantity: Number(line.quantity),
                    unitPrice: Number(line.unitPrice),
                    lineTotal: Number(line.lineTotal),
                  }))
                : [],
              subtotal: Number(data.subtotal) || 0,
              shipping: Number(data.shipping) || 0,
              total: Number(data.total) || 0,
            });
            if (couponCode) setCouponError(null);
            setIsLoadingCoupon(false);
            return;
          }

          if (
            couponCode &&
            ["INVALID_COUPON", "COUPON_CONDITIONS_NOT_MET"].includes(data.code)
          ) {
            setPromotions([]);
            setTotalDiscount(0);
            setFreeShipping(false);
            setServerQuote(null);
            setCouponError(data.error || "Kupon nije važeći za ovu korpu");
            setIsLoadingCoupon(false);
            setCouponCode(null);
            return;
          }

          setPromotions([]);
          setTotalDiscount(0);
          setFreeShipping(false);
          setServerQuote(null);
          setQuoteError(data.error || "Korpa trenutno ne može da se obračuna");
          setIsLoadingCoupon(false);
        } catch (error) {
          if (cancelled || (error instanceof Error && error.name === "AbortError")) {
            return;
          }
          console.error("Failed to fetch promotions:", error);
          setPromotions([]);
          setTotalDiscount(0);
          setFreeShipping(false);
          setServerQuote(null);
          setQuoteError("Korpa trenutno ne može da se obračuna");
          setIsLoadingCoupon(false);
        } finally {
          if (!cancelled) setIsLoadingQuote(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    items,
    couponCode,
    commerceSettings.shippingCost,
    commerceSettings.freeShippingThreshold,
  ]);

  const applyCoupon = (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setCouponError("Unesite kupon kod");
      return;
    }
    setIsLoadingCoupon(true);
    setCouponError(null);
    setCouponCode(normalized);
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setCouponError(null);
    setIsLoadingCoupon(false);
  };

  const finalShipping = serverQuote?.shipping ?? (freeShipping ? 0 : baseShipping);
  const finalTotal = serverQuote?.total ?? Math.max(0, subtotal - totalDiscount + finalShipping);
  const quotedSubtotal = serverQuote?.subtotal ?? subtotal;

  return {
    quotedLines: serverQuote?.lines ?? [],
    promotions,
    totalDiscount,
    freeShipping,
    couponCode,
    couponError,
    isLoadingCoupon,
    isLoadingQuote,
    quoteError,
    applyCoupon,
    removeCoupon,
    finalTotal,
    finalShipping,
    subtotal: quotedSubtotal,
  };
}
