import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchBrands } from "@/lib/products";
import { getLocalized } from "@/lib/i18n/localized";
import { defaultLocale, isValidLocale } from "@/i18n/config";

export async function GET(request: NextRequest) {
  try {
    const brands = await fetchBrands();
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
    const locale = localeCookie && isValidLocale(localeCookie) ? localeCookie : defaultLocale;

    const localized = brands.map((b) => ({
      id: b.id,
      name: getLocalized(b.name, locale),
      slug: b.slug,
      logo: b.logo,
      description: b.description ? getLocalized(b.description, locale) : null,
      active: b.active,
      sortOrder: b.sortOrder,
      _count: b._count,
    }));

    return NextResponse.json(localized);
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return NextResponse.json([], { status: 500 });
  }
}
