"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, Pencil, Trash2, Eye, FileText } from "lucide-react";

interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image1: string | null;
  author: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/articles?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni?")) return;
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchArticles();
    } catch {
      alert("Greška");
    }
  };

  const togglePublish = async (id: string, published: boolean) => {
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (res.ok) fetchArticles();
    } catch {
      console.error("Toggle failed");
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("sr-RS");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900">
            Članci / Blog
          </h1>
          <p className="text-stone-600">Ukupno: {total} članaka</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> Novi članak
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-stone-300" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Nema članaka
          </h2>
          <p className="text-stone-500 mb-4">Napišite prvi članak</p>
          <Link
            href="/admin/articles/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg"
          >
            <Plus className="h-4 w-4" /> Novi članak
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Članak
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Autor
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">
                  Datum
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {article.image1 ? (
                        <img
                          src={article.image1}
                          alt=""
                          className="h-12 w-16 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-16 bg-stone-100 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-stone-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-stone-900">
                          {article.title}
                        </p>
                        {article.excerpt && (
                          <p className="text-xs text-stone-500 line-clamp-1">
                            {article.excerpt}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {article.author || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {article.published ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Objavljen
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600">
                    {formatDate(article.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          togglePublish(article.id, article.published)
                        }
                        className="p-2 hover:bg-stone-100 rounded-lg"
                        title={
                          article.published ? "Premesti u draft" : "Objavi"
                        }
                      >
                        <Eye
                          className={`h-4 w-4 ${article.published ? "text-green-600" : "text-stone-400"}`}
                        />
                      </button>
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Link>
                      <button
                        onClick={() => handleDelete(article.id)}
                        className="p-2 hover:bg-stone-100 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
              <p className="text-sm text-stone-600">
                Strana {page} od {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  Prethodna
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  Sledeća
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
