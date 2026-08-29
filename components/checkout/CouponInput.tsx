"use client";

import { useState } from "react";
import { Loader2, Tag, X, Check } from "lucide-react";

interface CouponInputProps {
  onApply: (code: string) => void;
  onRemove: () => void;
  appliedCode: string | null;
  isLoading: boolean;
  error: string | null;
  discount: number | null;
}

export function CouponInput({ onApply, onRemove, appliedCode, isLoading, error, discount }: CouponInputProps) {
  const [code, setCode] = useState("");

  const handleApply = () => {
    if (code.trim()) onApply(code.trim().toUpperCase());
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Kupon: {appliedCode}</span>
          {discount && discount > 0 && (
            <span className="text-xs text-green-600">(-{new Intl.NumberFormat("sr-RS").format(discount)} RSD)</span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 hover:bg-green-100 rounded"
          aria-label={`Ukloni kupon ${appliedCode}`}
        >
          <X className="h-4 w-4 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder="Unesite kupon kod"
            className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
          className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Primeni"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
