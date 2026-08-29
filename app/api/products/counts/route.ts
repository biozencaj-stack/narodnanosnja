import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFilterCounts } from "@/lib/products";
import { defaultLocale, isValidLocale } from "@/i18n/config";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
    const locale = localeCookie && isValidLocale(localeCookie) ? localeCookie : defaultLocale;

    const gender = searchParams.get("gender") || undefined;
    const groupId = searchParams.get("groupId") || undefined;
    const sizes = searchParams.getAll("size");
    const colors = searchParams.getAll("color");
    const types = searchParams.getAll("type");
    const brandIds = searchParams.getAll("brand");
    const priceMin = searchParams.get("priceMin");
    const priceMax = searchParams.get("priceMax") || searchParams.get("price");
    const sale = searchParams.get("sale") === "true";
    const novo = searchParams.get("novo") === "true";

    const counts = await getFilterCounts({
      gender,
      groupId: groupId || undefined,
      brandIds: brandIds.length ? brandIds : undefined,
      sizes: sizes.length ? sizes : undefined,
      colors: colors.length ? colors : undefined,
      types: types.length ? types : undefined,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      sale,
      novo,
      locale,
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error("Products counts API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch counts" },
      { status: 500 }
    );
  }
}
