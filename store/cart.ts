import { create } from 'zustand';
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from 'zustand/middleware';
import type { CartItem, CartState } from '@/types/cart';

/**
 * Get the effective price for a cart item
 */
function getItemPrice(item: CartItem): number {
  if (item.price2 && item.price2 > 0) return item.price2;
  if (item.price1 && item.price1 > 0) return item.price1;
  return item.price;
}

const unavailableStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function safeSessionStorage(): StateStorage {
  if (typeof window === 'undefined') return unavailableStorage;
  try {
    const storage = window.sessionStorage;
    return {
      getItem: (name) => {
        try {
          return storage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          storage.setItem(name, value);
        } catch {
          // Korpa ostaje funkcionalna u memoriji kada je storage blokiran.
        }
      },
      removeItem: (name) => {
        try {
          storage.removeItem(name);
        } catch {
          // Nema dodatnog oporavka za blokiran storage.
        }
      },
    };
  } catch {
    return unavailableStorage;
  }
}

/**
 * Cart Store using Zustand with persistence
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      couponCode: null,
      hasHydrated: false,

      addItem: (newItem) => {
        set((state) => {
          if (newItem.stock !== undefined && newItem.stock <= 0) {
            return state;
          }

          const existingIndex = state.items.findIndex(
            (item) => item.id === newItem.id && item.size === newItem.size
          );

          if (existingIndex >= 0) {
            // Update quantity of existing item
            const updatedItems = [...state.items];
            const requestedQuantity = updatedItems[existingIndex].quantity + (newItem.quantity || 1);
            const availableStock = newItem.stock ?? updatedItems[existingIndex].stock;
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              stock: availableStock,
              quantity: availableStock === undefined
                ? requestedQuantity
                : Math.min(requestedQuantity, availableStock),
            };
            return { items: updatedItems, isOpen: true };
          }

          // Add new item
          return {
            items: [...state.items, {
              ...newItem,
              quantity: newItem.stock === undefined
                ? newItem.quantity || 1
                : Math.min(newItem.quantity || 1, newItem.stock),
            }],
            isOpen: true,
          };
        });
      },

      removeItem: (id, size) => {
        set((state) => {
          const items = state.items.filter(
            (item) => !(item.id === id && item.size === size)
          );
          return {
            items,
            couponCode: items.length === 0 ? null : state.couponCode,
          };
        });
      },

      updateQuantity: (id, size, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id, size);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.size === size
              ? {
                  ...item,
                  quantity: item.stock === undefined ? quantity : Math.min(quantity, item.stock),
                }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [], couponCode: null }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      setCouponCode: (couponCode) => set({ couponCode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          return total + getItemPrice(item) * item.quantity;
        }, 0);
      },

    }),
    {
      name: 'cart',
      storage: createJSONStorage(safeSessionStorage),
      partialize: (state) => ({
        items: state.items,
        couponCode: state.couponCode,
      }),
      onRehydrateStorage: (currentState) => (rehydratedState) => {
        const state = rehydratedState || currentState;
        if (state.items.length === 0) state.setCouponCode(null);
        state.setHasHydrated(true);
      },
    }
  )
);

/**
 * Hook to get cart totals
 */
export function useCartTotals() {
  const items = useCartStore((state) => state.items);

  const subtotal = items.reduce((total, item) => {
    const price = item.price2 || item.price1 || item.price;
    return total + price * item.quantity;
  }, 0);

  const totalItems = items.reduce((count, item) => count + item.quantity, 0);

  return {
    subtotal,
    totalItems,
  };
}
