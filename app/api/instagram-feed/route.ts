import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
}

interface InstagramAPIResponse {
  data: InstagramPost[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

export async function GET() {
  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessId = process.env.INSTAGRAM_BUSINESS_ID;

    if (!token || !businessId) {
      console.error('Missing Instagram credentials');
      return NextResponse.json(
        { error: 'Instagram credentials not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${businessId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&access_token=${token}&limit=8`,
      {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instagram API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch Instagram posts', details: errorData },
        { status: response.status }
      );
    }

    const data: InstagramAPIResponse = await response.json();

    if (!data || !data.data) {
      console.error('Invalid response format from Instagram API:', data);
      return NextResponse.json(
        { error: 'Invalid response format from Instagram API' },
        { status: 500 }
      );
    }

    return NextResponse.json(data.data, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
