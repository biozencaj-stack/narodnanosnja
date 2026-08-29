# E-commerce CMS Template

A full-featured e-commerce template with a built-in CMS, built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.

**No WordPress needed** - manage products, categories, brands, articles, banners, and more directly through the admin panel.

## Features

### CMS / Admin Panel

- **Products** - Full CRUD with 3 images, sizes/stock, SEO fields
- **Categories** - Hierarchical categories with images
- **Brands** - Brand management with logos
- **Blog/Articles** - Blog system with 3 images, rich content, publish/draft
- **Banners** - Hero carousel and promotional banners
- **Ticker** - Scrolling announcement messages
- **Newsletter** - Rich text editor, subscriber management, campaign history
- **Orders** - Order management with status tracking and export
- **Users** - User management with roles (Admin, Operator, Customer)
- **Statistics** - Revenue, orders, top products dashboard
### E-commerce

- Product catalog with filtering (category, brand, size, price, gender)
- Search functionality
- Shopping cart (Zustand + sessionStorage)
- Checkout with guest support
- Payment integration (NestPay/card + cash on delivery)
- Order tracking and history
- User accounts with saved addresses
- Wishlist with sale alerts
- Product reviews and ratings
- Recently viewed products

### Technical

- **Next.js 16** with App Router and Turbopack
- **TypeScript** for type safety
- **Prisma** ORM with PostgreSQL
- **Tailwind CSS 4** for styling
- **NextAuth.js** for authentication
- **Sharp** for image processing
- **Zustand** for state management
- **i18n** support (Serbian + English, extensible)
- SEO optimized (JSON-LD, Open Graph, sitemap, robots.txt)
- Email notifications (order confirmations, password reset, etc.)
- reCAPTCHA v3 bot protection
- Google Analytics support

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Clone/copy the template
cd EcommerceTemplate

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your database URL and other settings
# (see .env.example for all available options)

# Run database migration
npx prisma migrate dev --name init

# Seed the database with sample data
npx prisma db seed

# Create admin user
npx tsx scripts/create-admin.ts --email admin@example.com --password YourPassword123! --role ADMIN

# Start development server
npm run dev
```

Visit `http://localhost:3000` for the storefront and `http://localhost:3000/admin` for the admin panel.

### Image Upload

Product and article images are stored in `public/uploads/`. The upload API automatically:

- Resizes images to max 1200x1200px
- Converts to WebP format for optimal file size
- Saves to the appropriate subfolder (products, articles, categories, brands)

### i18n (Internationalization)

The template includes a simple i18n system:

- Translation files: `messages/sr.json`, `messages/en.json`
- Set `NEXT_PUBLIC_LOCALE=sr` or `NEXT_PUBLIC_LOCALE=en` in `.env.local`
- Add more languages by creating `messages/{locale}.json`
- Use `t("key")` from `@/i18n` for translations

### Payment Integration

**NestPay (Banca Intesa)** is configured out of the box. To enable:

1. Set NestPay credentials in `.env.local`
2. Configure callback URLs

To add a different payment provider, see `lib/nestpay/` for the existing implementation pattern.

## Project Structure

```
app/
  (auth)/          - Authentication pages (login, register, reset password)
  (legal)/         - Legal pages (terms, privacy, returns)
  (shop)/          - Storefront pages (catalog, product, cart, checkout, blog)
  (user)/          - User dashboard (orders, addresses, settings)
  admin/           - Admin panel pages
  api/             - API routes
    admin/         - Admin API (products, categories, brands, articles, upload, etc.)
    payments/      - Payment callbacks
    products/      - Public product API

components/
  admin/           - Admin-specific components (ImageUpload)
  checkout/        - Checkout components
  filter/          - Product filter components
  home/            - Homepage sections
  layout/          - Header, footer, navigation
  product/         - Product display components
  ui/              - Reusable UI primitives

lib/
  auth/            - NextAuth configuration
  db/              - Prisma client
  email/           - Email templates and sending
  nestpay/         - NestPay payment integration
  orders/          - Order processing logic
  products.ts      - Local product data layer
  utils/           - Utility functions

messages/          - i18n translation files
prisma/            - Database schema and migrations
public/uploads/    - User-uploaded images
store/             - Zustand state stores (cart, wishlist, UI)
types/             - TypeScript type definitions
```

## Deployment

### Docker

```bash
docker build -t ecommerce-template .
docker run -p 3000:3000 --env-file .env.local ecommerce-template
```

### PM2

```bash
npm run build
pm2 start ecosystem.config.js
```

### Hetzner / VPS

See `docs/HETZNER-DEPLOY-GUIDE.md` for a complete deployment guide.
For automatic main-branch releases, see `docs/GITHUB-DEPLOY.md`.

## License

This template is provided as-is for commercial and personal use.
