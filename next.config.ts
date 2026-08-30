import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https:",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google.com https://www.gstatic.com https://www.google-analytics.com https://*.google-analytics.com https://graph.facebook.com",
  "frame-src 'self' https://www.google.com https://recaptcha.google.com https://www.youtube.com",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  ...(process.env.ENABLE_HSTS === 'true'
    ? [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      }]
    : []),
];

const sensitiveCredentialHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

const nextConfig: NextConfig = {
  // NAPOMENA: standalone mode uklonjen jer zahteva drugačiji startup
  // Ako trebaš Docker deployment, dodaj: output: 'standalone'
  // i koristi: node .next/standalone/server.js umesto next start
  // Source maps configuration
  // In development, source maps are enabled by default
  // In production, we can control source map generation
  productionBrowserSourceMaps: false, // Disable in production for security and performance
  // Turbopack is default in Next.js 16
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Reduce page buffer to free memory faster
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 1 minute
    pagesBufferLength: 5,
  },
  images: {
    // Modern image formats for better performance (AVIF first for best compression)
    formats: ['image/avif', 'image/webp'],
    // Optimized device sizes matching actual breakpoints used in the app
    deviceSizes: [420, 640, 750, 828, 1080, 1200, 1440, 1920],
    // Smaller image sizes for thumbnails and icons
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Allowed quality values (70 for banners, 75 for products)
    qualities: [70, 75],
    // Minimize layout shift by keeping aspect ratios
    minimumCacheTTL: 31536000, // 1 year cache for optimized images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/newsletter/odjava',
        headers: sensitiveCredentialHeaders,
      },
      {
        source: '/api/newsletter/unsubscribe',
        headers: sensitiveCredentialHeaders,
      },
      {
        source: '/verify-email/:path*',
        headers: sensitiveCredentialHeaders,
      },
      {
        source: '/api/auth/verify-email/:path*',
        headers: sensitiveCredentialHeaders,
      },
      {
        source: '/reset-password/:token',
        headers: sensitiveCredentialHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Legacy -> new English routes
      { source: '/akcija', destination: '/catalog?sale=true', permanent: true },
      { source: '/akcije', destination: '/catalog?sale=true', permanent: true },
      { source: '/zenska-obuca', destination: '/catalog', permanent: true },
      { source: '/muska-obuca', destination: '/catalog', permanent: true },
      { source: '/torbe', destination: '/catalog', permanent: true },
      { source: '/zenska-obuca/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/muska-obuca/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/pol/zenske', destination: '/catalog', permanent: true },
      { source: '/pol/muske', destination: '/catalog', permanent: true },
      { source: '/pol/svi-proizvodi', destination: '/catalog', permanent: true },
      { source: '/pol/zenske/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/pol/muske/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/pol/svi-proizvodi/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/zamena-obuce', destination: '/zamena-proizvoda', permanent: true },
      { source: '/opsti-uslovi', destination: '/uslovi-koriscenja', permanent: true },
      { source: '/veleprodaja', destination: '/contact', permanent: true },
      // Serbian -> English storefront
      { source: '/katalog', destination: '/catalog', permanent: true },
      { source: '/katalog/brend/:brand', destination: '/catalog/brand/:brand', permanent: true },
      { source: '/kategorija/:path*', destination: '/category/:path*', permanent: true },
      { source: '/proizvod/:id', destination: '/product/:id', permanent: true },
      { source: '/moja-korpa', destination: '/cart', permanent: true },
      { source: '/placanje', destination: '/checkout', permanent: true },
      { source: '/uspesna-narudzbina', destination: '/order/success', permanent: true },
      { source: '/kontakt', destination: '/contact', permanent: true },
      // Serbian -> English admin
      { source: '/admin/statistika', destination: '/admin/statistics', permanent: true },
      { source: '/admin/proizvodi', destination: '/admin/products', permanent: true },
      { source: '/admin/proizvodi/novi', destination: '/admin/products/new', permanent: true },
      { source: '/admin/proizvodi/:id', destination: '/admin/products/:id', permanent: true },
      { source: '/admin/kategorije', destination: '/admin/categories', permanent: true },
      { source: '/admin/brendovi', destination: '/admin/brands', permanent: true },
      { source: '/admin/boje', destination: '/admin/colors', permanent: true },
      { source: '/admin/promocije', destination: '/admin/promotions', permanent: true },
      { source: '/admin/promocije/nova', destination: '/admin/promotions/new', permanent: true },
      { source: '/admin/promocije/:id', destination: '/admin/promotions/:id', permanent: true },
      { source: '/admin/porudzbine', destination: '/admin/orders', permanent: true },
      { source: '/admin/porudzbine/:id', destination: '/admin/orders/:id', permanent: true },
      { source: '/admin/korisnici', destination: '/admin/users', permanent: true },
      { source: '/admin/clanci', destination: '/admin/articles', permanent: true },
      { source: '/admin/clanci/novi', destination: '/admin/articles/new', permanent: true },
      { source: '/admin/clanci/:id', destination: '/admin/articles/:id', permanent: true },
      { source: '/admin/baneri', destination: '/admin/banners', permanent: true },
      { source: '/admin/trakica', destination: '/admin/ticker', permanent: true },
      { source: '/admin/prodajna-mesta', destination: '/admin/store-locations', permanent: true },
      { source: '/admin/podesavanja', destination: '/admin/settings', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
