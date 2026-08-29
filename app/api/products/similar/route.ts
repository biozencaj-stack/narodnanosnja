import { NextRequest, NextResponse } from "next/server";
import { fetchSimilarProducts } from "@/lib/products";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") || "";
  const category = searchParams.get("category") || undefined;
  const brand = searchParams.get("brand") || undefined;

  if (!productId) {
    return NextResponse.json([]);
  }

  try {
    const similar = await fetchSimilarProducts(productId, category, brand, 6);
    return NextResponse.json(similar);
  } catch (error) {
    console.error("Similar products error:", error);
    return NextResponse.json([]);
  }
}
