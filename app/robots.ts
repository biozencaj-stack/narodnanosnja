import { MetadataRoute } from 'next';
import { getStorefrontUrl } from '@/lib/config/storefront-url';
import { isSearchIndexingEnabled } from '@/lib/config/search-indexing';

export default function robots(): MetadataRoute.Robots {
  if (!isSearchIndexingEnabled()) {
    // Crawlers must be able to read the page-level noindex directive. A full
    // robots.txt crawl block can leave already discovered URLs indexed.
    return {
      rules: [{ userAgent: '*', allow: '/' }],
    };
  }

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
