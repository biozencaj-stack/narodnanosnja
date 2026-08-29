"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/admin/ImageUpload";

interface ArticleFormProps {
  articleId?: string;
}

export default function ArticleForm({ articleId }: ArticleFormProps) {
  const router = useRouter();
  const isEditing = !!articleId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    image1: null as string | null,
    image2: null as string | null,
    image3: null as string | null,
    author: "",
    published: false,
    metaTitle: "",
    metaDescription: "",
  });

  useEffect(() => {
    if (!articleId) return;
    fetch(`/api/admin/articles/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.article) {
          const a = data.article;
          setForm({
            title: a.title || "",
            content: a.content || "",
            excerpt: a.excerpt || "",
            image1: a.image1,
            image2: a.image2,
            image3: a.image3,
            author: a.author || "",
            published: a.published,
            metaTitle: a.metaTitle || "",
            metaDescription: a.metaDescription || "",
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      alert("Naslov i sadržaj su obavezni");
      return;
    }

    setIsSaving(true);
    try {
      const url = isEditing
        ? `/api/admin/articles/${articleId}`
        : "/api/admin/articles";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          excerpt: form.excerpt || null,
          image1: form.image1,
          image2: form.image2,
          image3: form.image3,
          author: form.author || null,
          published: form.published,
          metaTitle: form.metaTitle || null,
          metaDescription: form.metaDescription || null,
        }),
      });

      if (res.ok) {
        router.push("/admin/articles");
      } else {
        const err = await res.json();
        alert(err.error || "Greška pri čuvanju");
      }
    } catch {
      alert("Greška");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Nazad na listu
        </Link>
        <h1 className="text-2xl font-display font-bold text-stone-900">
          {isEditing ? "Izmeni članak" : "Novi članak"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Sadržaj</h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Naslov *
            </label>
            <input
              type="text"
              value={form.title}
              required
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className="w-full px-4 py-2 border border-stone-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Izvod (excerpt)
            </label>
            <textarea
              value={form.excerpt}
              rows={2}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
              placeholder="Kratki opis za listu članaka..."
              className="w-full px-4 py-2 border border-stone-300 rounded-lg resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Sadržaj *
            </label>
            <textarea
              value={form.content}
              rows={12}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              required
              className="w-full px-4 py-2 border border-stone-300 rounded-lg resize-y"
            />
            <p className="text-xs text-stone-400 mt-1">
              Podržava HTML formatiranje
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Autor
              </label>
              <input
                type="text"
                value={form.author}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author: e.target.value }))
                }
                className="w-full px-4 py-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Slike (max 3)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ImageUpload
              value={form.image1}
              folder="articles"
              label="Slika 1 (glavna)"
              onChange={(path) => setForm((f) => ({ ...f, image1: path }))}
            />
            <ImageUpload
              value={form.image2}
              folder="articles"
              label="Slika 2"
              onChange={(path) => setForm((f) => ({ ...f, image2: path }))}
            />
            <ImageUpload
              value={form.image3}
              folder="articles"
              label="Slika 3"
              onChange={(path) => setForm((f) => ({ ...f, image3: path }))}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">Objavljivanje</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) =>
                setForm((f) => ({ ...f, published: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm text-stone-700">Objavi odmah</span>
          </label>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-900">SEO</h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Meta naslov
            </label>
            <input
              type="text"
              value={form.metaTitle}
              onChange={(e) =>
                setForm((f) => ({ ...f, metaTitle: e.target.value }))
              }
              className="w-full px-4 py-2 border border-stone-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Meta opis
            </label>
            <textarea
              value={form.metaDescription}
              rows={2}
              onChange={(e) =>
                setForm((f) => ({ ...f, metaDescription: e.target.value }))
              }
              className="w-full px-4 py-2 border border-stone-300 rounded-lg resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 font-medium"
          >
            {isSaving
              ? "Čuvanje..."
              : isEditing
                ? "Sačuvaj izmene"
                : "Kreiraj članak"}
          </button>
          <Link
            href="/admin/articles"
            className="px-8 py-3 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
          >
            Otkaži
          </Link>
        </div>
      </form>
    </div>
  );
}
