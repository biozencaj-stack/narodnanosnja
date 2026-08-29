"use client";

import { createContext, useContext } from "react";
import {
  useCartWithPromotions,
  type CartCommerceSettings,
  type PromotionState,
} from "@/hooks/useCartPromotions";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
} from "@/lib/config/checkout";

const CheckoutPricingContext = createContext<PromotionState | null>(null);

export function CheckoutPricingProvider({
  children,
  commerceSettings,
}: {
  children: React.ReactNode;
  commerceSettings?: CartCommerceSettings;
}) {
  const pricing = useCartWithPromotions(
    commerceSettings ?? {
      shippingCost: SHIPPING_COST,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    },
  );
  return (
    <CheckoutPricingContext.Provider value={pricing}>
      {children}
    </CheckoutPricingContext.Provider>
  );
}

export function useCheckoutPricing(): PromotionState {
  const context = useContext(CheckoutPricingContext);
  if (!context) {
    throw new Error("useCheckoutPricing mora biti unutar CheckoutPricingProvider-a");
  }
  return context;
}

export const CartPricingProvider = CheckoutPricingProvider;
export const useCartPricing = useCheckoutPricing;
