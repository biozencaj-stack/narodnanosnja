import { create } from 'zustand';
import type { ProductCard } from '@/types/product';

interface QuickViewState {
  isOpen: boolean;
  product: ProductCard | null;

  openQuickView: (product: ProductCard) => void;
  closeQuickView: () => void;
}

export const useQuickViewStore = create<QuickViewState>((set) => ({
  isOpen: false,
  product: null,

  openQuickView: (product) => set({ isOpen: true, product }),
  closeQuickView: () => set({ isOpen: false, product: null }),
}));
