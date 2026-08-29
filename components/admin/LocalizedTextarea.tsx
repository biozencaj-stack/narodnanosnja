'use client';

import React from 'react';
import { parseLocalized, type LocalizedField } from '@/lib/i18n/localized';
import { cn } from '@/lib/utils';

interface LocalizedTextareaProps {
  label: string;
  name: string;
  value: LocalizedField;
  onChange: (value: { sr: string; en: string }) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}

export function LocalizedTextarea({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  required,
  disabled,
  rows = 4,
}: LocalizedTextareaProps) {
  const { sr, en } = parseLocalized(value);
  const [activeTab, setActiveTab] = React.useState<'sr' | 'en'>('sr');

  const handleChange = (locale: 'sr' | 'en', val: string) => {
    onChange({
      sr: locale === 'sr' ? val : sr,
      en: locale === 'en' ? val : en,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-text-muted">
          {label} {required && '*'}
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('sr')}
            className={`px-2 py-0.5 text-xs rounded ${
              activeTab === 'sr' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            SR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('en')}
            className={`px-2 py-0.5 text-xs rounded ${
              activeTab === 'en' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            EN
          </button>
        </div>
      </div>
      <textarea
        name={activeTab === 'sr' ? `${name}_sr` : `${name}_en`}
        value={activeTab === 'sr' ? sr : en}
        onChange={(e) => handleChange(activeTab, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          'w-full px-4 py-3 rounded-md border bg-background text-base font-body resize-none',
          'placeholder:text-text-light',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-error focus:border-error focus:ring-error/20'
            : 'border-border focus:border-primary focus:ring-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-alt'
        )}
      />
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  );
}
