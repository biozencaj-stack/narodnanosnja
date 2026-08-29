/**
 * Product Types for CMS Template
 */

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  price1?: number; // Discounted price 1
  price2?: number; // Discounted price 2
  percent1?: number; // Discount percentage 1
  percent2?: number; // Discount percentage 2
  picture?: string; // Base64 image
  pictureName?: string;
  type?: string;
  color?: string;
  model?: string;
  description?: string;
  groupId?: string;
  groupName?: string;
  subgroupId?: string;
  itemMaterial?: string;
  itemPurpose?: string;
  itemGender?: string;
  itemFactory?: string;  // Factory/origin country (bags/accessories)
  itemManuf?: string;    // Manufacturer (bags/accessories)
  quantity?: number;
  itemLength?: number;
  itemWidth?: number;
  itemHeight?: number;
}

export interface ProductCard {
  id: string;
  code: string;
  name: string;
  price: number;
  price1?: number;
  price2?: number;
  percent1?: number;
  percent2?: number;
  picture?: string;
  pictureName?: string;
}

export interface ProductDetail extends Product {
  types: Map<string, boolean>; // Size -> availability
}

export interface ProductFilter {
  categoryId?: string;
  groupId?: string | string[];
  subgroupId?: string;
  limit?: number;
  offset?: number;
  sort?: SortOption;
  itemType?: string[]; // Sizes
  itemColor?: string[];
  footWearType?: string[];
  filterPrice?: number;    // Max price
  filterPriceMin?: number; // Min price (client-side filtering)
  forSale?: boolean;
  itemId?: string;
  itemTitle?: string;
  itemGender?: string;
}

export enum SortOption {
  RELEVANTLY = 0,
  PRICE_ASC = 1,
  PRICE_DESC = 2,
  DATE_DESC = 3,
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  parentId: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
}
