/**
 * API Types for E-commerce CMS Template
 */

// API Error Response
export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// API Success Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Session Token
export interface SessionToken {
  code: string;
  expiresAt: Date;
}

// Newsletter
export interface NewsletterSubscription {
  email: string;
  date: string;
}

// Contact Form
export interface ContactForm {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// Reclamation Form
export interface ReclamationForm {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  productCode: string;
  productName: string;
  reason: string;
  description: string;
  images?: string[];
}
