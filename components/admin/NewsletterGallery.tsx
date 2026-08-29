"use client";

import { useState, useEffect, useRef } from "react";
import {
  ImagePlus,
  Copy,
  Trash2,
  Upload,
  Check,
  X,
  Loader2,
  Images,
} from "lucide-react";

interface NewsletterImage {
  id: string;
  name: string;
  imageData: string;
  contentType: string;
  createdAt: string;
}

interface NewsletterGalleryProps {
  onInsertImage: (imageUrl: string) => void;
}

export function NewsletterGallery({ onInsertImage }: NewsletterGalleryProps) {
  const [images, setImages] = useState<NewsletterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await fetch("/api/admin/newsletter/images");
      if (res.ok) {
        const data = await res.json();
        setImages(data.images);
      }
    } catch (err) {
      console.error("Failed to fetch images:", err);
    } finally {
      setLoading(false);
    }
  };

  // Funkcija za skaliranje slike
  const resizeImage = (
    file: File,
    maxWidth: number = 1200,
    maxHeight: number = 1200,
    quality: number = 0.85
  ): Promise<{ base64: string; contentType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Izračunaj nove dimenzije sačuvavši aspect ratio
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          // Kreiraj canvas i nacrtaj skaliranu sliku
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Neuspešno kreiranje canvas konteksta"));
            return;
          }

          // Koristi smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Konvertuj u base64 sa kvalitetom
          const mimeType = file.type || "image/jpeg";
          const base64 = canvas.toDataURL(mimeType, quality).split(",")[1];
          resolve({ base64, contentType: mimeType });
        };
        img.onerror = () => reject(new Error("Greška pri učitavanju slike"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Greška pri čitanju fajla"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Dozvoljeni formati: JPEG, PNG, WebP, GIF");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Maksimalna veličina slike je 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Skaliraj sliku pre konverzije u base64
      const { base64, contentType } = await resizeImage(file, 1200, 1200, 0.85);

      const res = await fetch("/api/admin/newsletter/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          imageData: base64,
          contentType: contentType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setImages((prev) => [data.image, ...prev]);
      } else {
        setError(data.error || "Greška pri uploadovanju");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Greška pri uploadovanju slike");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Da li ste sigurni da želite da obrišete ovu sliku?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/newsletter/images?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || "Greška pri brisanju");
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError("Greška pri brisanju slike");
    }
  };

  // Base64 URL za lokalni preview
  const getPreviewUrl = (image: NewsletterImage) => {
    return `data:${image.contentType};base64,${image.imageData}`;
  };

  // Kratki URL za email (servira se preko API-ja)
  const getImageUrl = (image: NewsletterImage) => {
    // U produkciji koristiti puni domen
    const baseUrl = typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    return `${baseUrl}/api/newsletter/image/${image.id}`;
  };

  const handleCopyUrl = async (image: NewsletterImage) => {
    const url = getImageUrl(image);
    await navigator.clipboard.writeText(url);
    setCopiedId(image.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (image: NewsletterImage) => {
    onInsertImage(getImageUrl(image));
  };

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 p-4 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images className="h-5 w-5 text-stone-500" />
          <span className="font-medium text-stone-700">Galerija slika</span>
          <span className="text-sm text-stone-500">({images.length})</span>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                       hover:bg-primary-hover disabled:opacity-50 transition-colors text-sm"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploaduje se...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload slike
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="m-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Gallery */}
      <div className="p-4 max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8">
            <ImagePlus className="h-12 w-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">Nema uploadovanih slika</p>
            <p className="text-stone-400 text-xs mt-1">
              Kliknite &quot;Upload slike&quot; da dodate prvu sliku
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative border border-stone-200 rounded-lg overflow-hidden bg-stone-50"
              >
                {/* Image preview */}
                <div className="aspect-square relative">
                  <img
                    src={getPreviewUrl(image)}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleInsert(image)}
                      className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                      title="Ubaci u editor"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(image)}
                      className="p-2 bg-white text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                      title="Kopiraj URL"
                    >
                      {copiedId === image.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(image.id)}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      title="Obriši"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Name */}
                <div className="p-2 border-t border-stone-200">
                  <p className="text-xs text-stone-600 truncate" title={image.name}>
                    {image.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
