import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/security/html";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const faqs = await prisma.chatFAQ.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
      },
    });

    const safeFaqs = faqs.map((faq) => ({
      ...faq,
      answer: sanitizeRichHtml(faq.answer),
    }));

    return NextResponse.json({ faqs: safeFaqs }, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("Fetch FAQs error:", error);
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}
