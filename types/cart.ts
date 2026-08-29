/**
 * Cart Types for CMS Template
 */

export interface CartItem {
  id: string;           // Product ID (code-color-model)
  code: string;         // Product code
  name: string;         // Product name
  size: string;         // Selected size
  quantity: number;     // Quantity
  stock?: number;       // Available stock for the selected variant
  price: number;        // Current price
  price1?: number;      // Discounted price 1
  price2?: number;      // Discounted price 2
  picture?: string;     // Base64 image
  pictureName?: string;
  model?: string;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  couponCode: string | null;
  hasHydrated: boolean;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string, size: string) => void;
  updateQuantity: (id: string, size: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setCouponCode: (code: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;

  // Computed
  getTotalItems: () => number;
  getSubtotal: () => number;
}

// Re-export from centralized config (env vars)
export {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
} from "@/lib/config/checkout";
