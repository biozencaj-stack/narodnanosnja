'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'recentlyViewed';
const MAX_ITEMS = 10;

interface RecentlyViewedItem {
  id: string;
  code: string;
  name: string;
  picture?: string;
  price: number;
  price1?: number;
  price2?: number;
  percent1?: number;
  percent2?: number;
  viewedAt: number;
}

/**
 * Hook to manage recently viewed products
 * Stores in sessionStorage to persist across page navigation
 */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedItem[];
        // Sort by most recent first
        parsed.sort((a, b) => b.viewedAt - a.viewedAt);
        setItems(parsed);
      }
    } catch (error) {
      console.error('[RecentlyViewed] Failed to load:', error);
    }
    setIsLoaded(true);
  }, []);

  // Add a product to recently viewed
  const addItem = useCallback((product: Omit<RecentlyViewedItem, 'viewedAt'>) => {
    if (typeof window === 'undefined') return;

    setItems(prevItems => {
      // Remove if already exists
      const filtered = prevItems.filter(item => item.id !== product.id);

      // Add at the beginning with timestamp
      const newItem: RecentlyViewedItem = {
        ...product,
        viewedAt: Date.now(),
      };

      // Keep only MAX_ITEMS
      const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);

      // Save to sessionStorage
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('[RecentlyViewed] Failed to save:', error);
      }

      return updated;
    });
  }, []);

  // Get items excluding a specific product (useful on product page)
  const getItemsExcluding = useCallback((excludeId: string) => {
    return items.filter(item => item.id !== excludeId);
  }, [items]);

  // Clear all items
  const clearItems = useCallback(() => {
    if (typeof window === 'undefined') return;

    setItems([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[RecentlyViewed] Failed to clear:', error);
    }
  }, []);

  return {
    items,
    isLoaded,
    addItem,
    getItemsExcluding,
    clearItems,
  };
}
