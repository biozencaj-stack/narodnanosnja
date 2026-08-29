import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { fetchProductById, fetchProductBySlug } from '@/lib/products';
import { getLocalized } from '@/lib/i18n/localized';
import { getStoreIdentity } from '@/lib/config/store-settings';
import { getStorefrontUrl } from '@/lib/config/storefront-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  let fallbackStoreName = 'Online prodavnica';

  try {
    const { itemId } = await params;
    const { name: storeName } = await getStoreIdentity();
    fallbackStoreName = storeName;
    const siteUrl = getStorefrontUrl().toString().replace(/\/$/, '');

    // Try to fetch product by slug first, then by ID
    const product = (await fetchProductBySlug(itemId)) || (await fetchProductById(itemId));

    if (!product) {
      // Return default OG image if product not found
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              backgroundColor: '#1a1a2e',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 'bold' }}>{storeName}</div>
            <div style={{ display: 'flex', fontSize: 32, marginTop: 20, color: '#999' }}>
              Proizvod nije pronađen
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }

    const productName = getLocalized(product.name, 'sr') || 'Proizvod';
    const effectivePrice = product.salePrice || product.price;
    const productPrice = new Intl.NumberFormat('sr-RS').format(effectivePrice) + ' RSD';
    const hasDiscount = product.salePrice && product.salePrice < product.price;
    const originalPrice = hasDiscount
      ? new Intl.NumberFormat('sr-RS').format(product.price) + ' RSD'
      : null;
    const discountPercent = hasDiscount
      ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
      : 0;

    // Use local image if available
    const imageUrl = product.image1
      ? `${siteUrl}${product.image1}`
      : null;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Left side - Product Image */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '50%',
              height: '100%',
              backgroundColor: '#f5f5f5',
              padding: 40,
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 400,
                  height: 400,
                  backgroundColor: '#e5e5e5',
                  borderRadius: 20,
                  color: '#999',
                  fontSize: 24,
                }}
              >
                Nema slike
              </div>
            )}
          </div>

          {/* Right side - Product Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: '50%',
              height: '100%',
              padding: 60,
              backgroundColor: '#1a1a2e',
            }}
          >
            {/* Logo/Brand */}
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: 'bold',
                color: '#c9a050',
                marginBottom: 40,
                letterSpacing: 4,
              }}
            >
              {storeName.toUpperCase()}
            </div>

            {/* Product Name */}
            <div
              style={{
                display: 'flex',
                fontSize: 42,
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: 20,
                lineHeight: 1.2,
                maxHeight: 160,
                overflow: 'hidden',
              }}
            >
              {productName}
            </div>

            {/* Product Code */}
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                color: '#888888',
                marginBottom: 40,
              }}
            >
              {product.sku || product.id.slice(0, 8)}
            </div>

            {/* Price */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hasDiscount && originalPrice && (
                <div
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    color: '#888888',
                    textDecoration: 'line-through',
                    marginBottom: 8,
                  }}
                >
                  {originalPrice}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: hasDiscount ? '#dc2626' : '#c9a050',
                }}
              >
                {productPrice}
              </div>
            </div>

            {/* Discount badge */}
            {hasDiscount && discountPercent > 0 && (
              <div
                style={{
                  display: 'flex',
                  position: 'absolute',
                  top: 60,
                  right: 60,
                  backgroundColor: '#dc2626',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: 8,
                  fontSize: 24,
                  fontWeight: 'bold',
                }}
              >
                -{discountPercent}%
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);

    // Return fallback image on error
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a2e',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 'bold', color: '#c9a050' }}>
            {fallbackStoreName.toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 28, marginTop: 20, color: '#ffffff' }}>
            Online prodavnica
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
