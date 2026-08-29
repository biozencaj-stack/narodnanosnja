import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchArticleBySlug } from "@/lib/products";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);
  if (!article) return { title: "Članak nije pronađen" };

  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt || undefined,
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);

  if (!article) notFound();

  const images = [article.image1, article.image2, article.image3].filter(
    Boolean,
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Nazad na blog
      </Link>

      <article>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-stone-900 mb-4">
          {article.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-stone-500 mb-8">
          {article.author && <span>Autor: {article.author}</span>}
          {article.publishedAt && (
            <time>
              {new Date(article.publishedAt).toLocaleDateString("sr-RS", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div
            className={`grid gap-4 mb-8 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
          >
            {images.map((img, i) => (
              <img
                key={i}
                src={img!}
                alt={`${article.title} - slika ${i + 1}`}
                className="w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-stone max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>
    </div>
  );
}
