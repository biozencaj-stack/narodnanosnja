'use client';

import React from 'react';
import { parseLocalized, type LocalizedField } from '@/lib/i18n/localized';
import { Input } from '@/components/ui/Input';

interface LocalizedInputProps {
  label?: string;
  name?: string;
  value: LocalizedField;
  onChange: (value: { sr: string; en: string }) => void;
  error?: string;
  placeholder?: string | { sr: string; en: string };
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  compact?: boolean;
}

export function LocalizedInput({
  label = '',
  name = 'localized',
  value,
  onChange,
  error,
  placeholder,
  required,
  disabled,
  maxLength,
  compact,
}: LocalizedInputProps) {
  const { sr, en } = parseLocalized(value);
  const [activeTab, setActiveTab] = React.useState<'sr' | 'en'>('sr');
  const placeholderStr = typeof placeholder === 'object'
    ? (activeTab === 'sr' ? placeholder.sr : placeholder.en)
    : placeholder;

  const handleChange = (locale: 'sr' | 'en', val: string) => {
    onChange({
      sr: locale === 'sr' ? val : sr,
      en: locale === 'en' ? val : en,
    });
  };

  return (
    <div className={compact ? 'space-y-1' : ''}>
      <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-1.5'}`}>
        {label && (
        <label className="block text-sm font-medium text-text-muted">
          {label} {required && '*'}
        </label>
        )}
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
      <Input
        name={activeTab === 'sr' ? `${name}_sr` : `${name}_en`}
        value={activeTab === 'sr' ? sr : en}
        onChange={(e) => handleChange(activeTab, e.target.value)}
        error={error}
        placeholder={placeholderStr}
        disabled={disabled}
        maxLength={maxLength}
        className={compact ? 'h-9 py-2 text-sm' : undefined}
      />
    </div>
  );
}
