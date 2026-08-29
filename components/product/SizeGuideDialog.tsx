'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { useUIStore } from '@/store';
import { clearProductSufix } from '@/lib/utils/format';

interface SizeTableEntry {
  size: number;
  length: string;
}

// Size tables per brand - add your brand-specific size charts here
const sizeTables: Record<string, SizeTableEntry[]> = {};

interface SizeGuideDialogProps {
  brand?: string;
  productName?: string;
}

export function SizeGuideDialog({ brand, productName }: SizeGuideDialogProps) {
  const { isSizeGuideOpen, closeSizeGuide } = useUIStore();

  // Clean product name from special characters
  const cleanName = productName ? clearProductSufix(productName) : undefined;

  // Find matching size table and brand name
  let sizeTable: SizeTableEntry[] | null = null;
  let matchedBrandName: string | null = null;

  if (brand && sizeTables[brand.toUpperCase()]) {
    sizeTable = sizeTables[brand.toUpperCase()];
    matchedBrandName = brand.toUpperCase();
  } else if (cleanName) {
    const foundBrand = Object.keys(sizeTables).find(b =>
      cleanName.toUpperCase().includes(b)
    );
    if (foundBrand) {
      sizeTable = sizeTables[foundBrand];
      matchedBrandName = foundBrand;
    }
  }

  return (
    <Dialog open={isSizeGuideOpen} onOpenChange={(open) => !open && closeSizeGuide()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" closeButtonVariant="light">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary to-primary-hover px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-full">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-semibold">
                Vodič za veličine
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                {matchedBrandName || 'Tabela veličina'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6">
          {sizeTable ? (
            <>
              {/* Column headers - always visible */}
              <div className="grid grid-cols-2 gap-4 mb-3 px-1">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  EU veličina
                </div>
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                  Dužina stopala
                </div>
              </div>

              {/* Size list - scrollable */}
              <div className="max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                {sizeTable.map((row, index) => (
                  <div
                    key={row.size}
                    className={`
                      flex items-center justify-between px-4 py-3 rounded-lg mb-1
                      ${index % 2 === 0 ? 'bg-background-alt' : 'bg-white'}
                      hover:bg-primary-light transition-colors
                    `}
                  >
                    <span className="text-lg font-semibold text-text">{row.size}</span>
                    <span className="text-sm text-text-muted">{row.length}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-background-alt rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-text-muted">
                Vodič za veličine nije dostupan za ovaj model.
              </p>
            </div>
          )}

          {/* Measuring tips */}
          <div className="mt-5 p-4 bg-gradient-to-r from-primary-light to-background-alt rounded-xl">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-primary mb-1">Kako izmeriti stopalo?</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Stanite na papir i olovkom ocrtajte obris stopala.
                  Izmerite rastojanje od pete do vrha najdužeg prsta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
