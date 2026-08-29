import { NextRequest, NextResponse } from "next/server";
import { fetchProductById, fetchProductBySlug } from "@/lib/products";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Try by slug first, then by ID
    const product = (await fetchProductBySlug(id)) || (await fetchProductById(id));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
