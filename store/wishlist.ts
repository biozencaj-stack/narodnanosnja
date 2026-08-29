'use client';

import { create } from 'zustand';

interface WishlistState {
  items: string[]; // Product IDs
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      const response = await fetch('/api/wishlist');
      const data = await response.json();

      if (data.success) {
        set({ items: data.data, isInitialized: true });
      }
    } catch (error) {
      console.error('Failed to initialize wishlist:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId: string) => {
    // Optimistic update
    set((state) => ({ items: [...state.items, productId] }));

    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (!data.success) {
        // Revert on failure
        set((state) => ({ items: state.items.filter((id) => id !== productId) }));
      }
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
      // Revert on error
      set((state) => ({ items: state.items.filter((id) => id !== productId) }));
    }
  },

  removeItem: async (productId: string) => {
    const previousItems = get().items;

    // Optimistic update
    set((state) => ({ items: state.items.filter((id) => id !== productId) }));

    try {
      const response = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (!data.success) {
        // Revert on failure
        set({ items: previousItems });
      }
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      // Revert on error
      set({ items: previousItems });
    }
  },

  toggleItem: async (productId: string) => {
    const isInList = get().isInWishlist(productId);

    if (isInList) {
      await get().removeItem(productId);
    } else {
      await get().addItem(productId);
    }
  },

  isInWishlist: (productId: string) => {
    return get().items.includes(productId);
  },

  clear: () => {
    set({ items: [], isInitialized: false });
  },
}));
