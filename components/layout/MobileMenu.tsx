'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import { useStoreIdentity } from '@/components/StoreIdentityProvider';
import { MobileNavigation } from './Navigation';

export function MobileMenu() {
  const { name: storeName, phone: storePhone } = useStoreIdentity();
  const { isMobileMenuOpen, closeMobileMenu } = useUIStore();

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity lg:hidden',
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-background shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          <span className="font-display text-xl font-bold text-primary">
            {storeName}
          </span>
          <button
            onClick={closeMobileMenu}
            className="p-2 -mr-2 text-text hover:text-primary transition-colors"
            aria-label="Zatvori meni"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <div className="overflow-y-auto h-[calc(100%-4rem)]">
          <MobileNavigation onClose={closeMobileMenu} />

          {/* Footer links */}
          <div className="px-4 py-6 border-t border-border mt-4">
            <div className="space-y-3">
              <a
                href="/contact"
                className="block text-sm text-text-muted hover:text-primary transition-colors"
              >
                Kontakt
              </a>
              <a
                href="/prodajna-mesta"
                className="block text-sm text-text-muted hover:text-primary transition-colors"
              >
                Prodajna mesta
              </a>
              <a
                href="/o-nama"
                className="block text-sm text-text-muted hover:text-primary transition-colors"
              >
                O nama
              </a>
            </div>

            {/* Contact info */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-text-muted">Pozovite nas:</p>
              {storePhone ? (
                <a
                  href={`tel:${storePhone.replace(/\s/g, '')}`}
                  className="text-lg font-medium text-primary"
                >
                  {storePhone}
                </a>
              ) : (
                <span className="text-lg font-medium text-primary">—</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
