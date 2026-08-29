"use client";

import { useState, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (path: string | null) => void;
  folder?: string;
  label?: string;
}

export default function ImageUpload({
  value,
  onChange,
  folder = "products",
  label = "Slika",
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      // Validate
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowedTypes.includes(file.type)) {
        alert("Dozvoljeni formati: JPEG, PNG, WebP, GIF");
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        alert("Maksimalna veličina je 1MB. Smanjite rezoluciju ili kompresujte sliku pre uploada.");
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          onChange(data.path);
        } else {
          alert("Greška pri uploadu slike");
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert("Greška pri uploadu");
      } finally {
        setIsUploading(false);
      }
    },
    [folder, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {label}
      </label>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Preview"
            className="h-32 w-auto object-cover rounded-lg border border-stone-200"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1
                       hover:bg-red-600 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                      transition-colors ${
                        dragActive
                          ? "border-stone-900 bg-stone-50"
                          : "border-stone-300 hover:border-stone-400"
                      }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              <span className="text-sm text-stone-500">Učitavanje...</span>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-8 w-8 text-stone-400" />
              <span className="text-sm text-stone-500">
                Prevucite sliku ili kliknite za izbor
              </span>
              <span className="text-xs text-stone-400">
                JPEG, PNG, WebP, GIF (max 1MB)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
