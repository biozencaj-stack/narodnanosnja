import { MetadataRoute } from 'next';
import { getStorefrontUrl } from '@/lib/config/storefront-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getStorefrontUrl().toString().replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/cart',
          '/checkout',
          '/payment/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
