import { create } from 'zustand';

interface UIState {
  // Mobile menu
  isMobileMenuOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;

  // Search modal
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  // Mobile filters
  isMobileFiltersOpen: boolean;
  openMobileFilters: () => void;
  closeMobileFilters: () => void;
  toggleMobileFilters: () => void;

  // Size guide dialog
  isSizeGuideOpen: boolean;
  openSizeGuide: () => void;
  closeSizeGuide: () => void;

  // Global loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Scroll position (for navbar visibility)
  scrollY: number;
  setScrollY: (y: number) => void;
  isNavbarVisible: boolean;
  setNavbarVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  // Mobile menu
  isMobileMenuOpen: false,
  openMobileMenu: () => set({ isMobileMenuOpen: true }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

  // Search modal
  isSearchOpen: false,
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  // Mobile filters
  isMobileFiltersOpen: false,
  openMobileFilters: () => set({ isMobileFiltersOpen: true }),
  closeMobileFilters: () => set({ isMobileFiltersOpen: false }),
  toggleMobileFilters: () => set((state) => ({ isMobileFiltersOpen: !state.isMobileFiltersOpen })),

  // Size guide dialog
  isSizeGuideOpen: false,
  openSizeGuide: () => set({ isSizeGuideOpen: true }),
  closeSizeGuide: () => set({ isSizeGuideOpen: false }),

  // Global loading state
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // Scroll position
  scrollY: 0,
  setScrollY: (y) => set({ scrollY: y }),
  isNavbarVisible: true,
  setNavbarVisible: (visible) => set({ isNavbarVisible: visible }),
}));
