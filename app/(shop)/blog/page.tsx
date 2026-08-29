import Link from "next/link";
import { fetchArticles } from "@/lib/products";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  description: "Najnoviji članci i vesti",
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const { articles, totalPages } = await fetchArticles(page, 9);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-bold text-stone-900 mb-8">
        Blog
      </h1>

      {articles.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-stone-500 text-lg">Nema objavljenih članaka.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {article.image1 ? (
                  <div className="aspect-video bg-stone-100">
                    <img
                      src={article.image1}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-stone-100 flex items-center justify-center">
                    <span className="text-stone-400">Bez slike</span>
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-stone-900 group-hover:text-stone-700 mb-2">
                    {article.title}
                  </h2>
                  {article.excerpt && (
                    <p className="text-sm text-stone-600 line-clamp-3">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
                    {article.author && <span>{article.author}</span>}
                    {article.publishedAt && (
                      <time>
                        {new Date(article.publishedAt).toLocaleDateString(
                          "sr-RS",
                        )}
                      </time>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/blog?page=${page - 1}`}
                  className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Prethodna
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/blog?page=${page + 1}`}
                  className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Sledeća
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
