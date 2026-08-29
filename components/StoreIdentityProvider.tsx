"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreIdentity } from "@/lib/config/store-identity";

const StoreIdentityContext = createContext<StoreIdentity | null>(null);

export function StoreIdentityProvider({
  children,
  identity,
}: {
  children: ReactNode;
  identity: StoreIdentity;
}) {
  return (
    <StoreIdentityContext.Provider value={identity}>
      {children}
    </StoreIdentityContext.Provider>
  );
}

export function useStoreIdentity(): StoreIdentity {
  const identity = useContext(StoreIdentityContext);
  if (!identity) {
    throw new Error(
      "useStoreIdentity mora biti korišćen unutar StoreIdentityProvider-a",
    );
  }
  return identity;
}
