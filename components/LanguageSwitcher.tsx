'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocaleAction, type Locale } from '@/app/actions/locale';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(async () => {
      await setLocaleAction(newLocale);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => handleChange('sr')}
        className={`px-2 py-1 rounded transition-colors ${
          locale === 'sr'
            ? 'bg-primary text-white font-medium'
            : 'text-text-muted hover:text-text hover:bg-background-alt'
        }`}
        disabled={isPending}
      >
        SR
      </button>
      <button
        type="button"
        onClick={() => handleChange('en')}
        className={`px-2 py-1 rounded transition-colors ${
          locale === 'en'
            ? 'bg-primary text-white font-medium'
            : 'text-text-muted hover:text-text hover:bg-background-alt'
        }`}
        disabled={isPending}
      >
        EN
      </button>
    </div>
  );
}
