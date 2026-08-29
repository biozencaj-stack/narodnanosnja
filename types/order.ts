/**
 * Order Types for CMS Template
 */

export interface OrderForm {
  // Contact Info
  email: string;
  firstName: string;
  lastName: string;
  tel: string;

  // Address
  address: string;
  addressOptional?: string;
  city: string;
  postalCode: string;
  country: string;

  // Alternate Address (optional)
  useDifferentAddress?: boolean;
  addressAdd?: string;
  cityAdd?: string;
  postalCodeAdd?: string;
  countryAdd?: string;

  // Additional
  note?: string;

  // Payment (set during checkout)
  paymentMethod?: 'cash' | 'card';
}

export interface OrderLine {
  lineCode: string;        // ATBM format: artikal~tip~boja~model
  lineName: string;
  lineQuantity: number;
  linePrice: number;
  lineUOM: string;         // Unit of measure (KOM)
  linePictureName?: string;
  linePicture?: string;
  lineItemType?: string;   // Size
}

export interface Order {
  contactEmail: string;
  contactFirstName: string;
  contactLastName: string;
  contactTelephone: string;
  contactAddress: string;
  contactCity: string;
  contactPostalCode: string;
  contactCountry: string;
  contactNote?: string;
  orderLines: OrderLine[];
}

export interface TransactionDetails {
  authCode: string;
  transDate: string;
  transId: string;
  amount: number;
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash',
  CARD = 'card',
}

export interface CheckoutState {
  step: CheckoutStep;
  form: Partial<OrderForm>;
  paymentMethod: PaymentMethod;
  isProcessing: boolean;
  error: string | null;
}

export enum CheckoutStep {
  INFORMATION = 1,
  SHIPPING = 2,
  PAYMENT = 3,
  CONFIRMATION = 4,
}
