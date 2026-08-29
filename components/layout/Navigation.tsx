'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const quickLinks = [
  { name: 'Novo', href: '/catalog?novo=true' },
  { name: 'Sniženje', href: '/catalog?sale=true', highlight: true },
];

const navPages = [
  { name: 'Katalog', href: '/catalog' },
  { name: 'Sniženje', href: '/catalog?sale=true', highlight: true },
];

export function Navigation() {
  const pathname = usePathname();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => setBrands(Array.isArray(data) ? data : data.brands || []))
      .catch(console.error);

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        const cats = Array.isArray(data) ? data : [];
        setCategories(cats);
      })
      .catch(console.error);
  }, []);

  const closeMenu = () => setActiveMenu(null);

  return (
    <>
      <nav className="hidden lg:flex items-center h-full gap-1">
        {/* Katalog sa mega-menijem */}
        <div
          className="relative h-full flex items-center z-50"
          onMouseEnter={() => setActiveMenu('shop')}
          onMouseLeave={closeMenu}
        >
          <button className={cn(
            "flex items-center gap-1 text-sm font-medium transition-colors border-b-2 h-full px-3 xl:px-4 whitespace-nowrap",
            activeMenu === 'shop'
              ? "border-primary text-primary"
              : "border-transparent text-gray-700 hover:text-gray-900"
          )}>
            Katalog
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              activeMenu === 'shop' && "rotate-180"
            )} />
          </button>

          {activeMenu === 'shop' && (
            <>
              <div className="absolute left-0 right-0 top-full h-2 bg-transparent" />
              <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] w-screen max-w-4xl bg-white shadow-xl z-50 rounded-lg">
                <div className="py-10 px-8">
                  <div className="grid grid-cols-3 gap-x-12">
                    <div className="col-span-2">
                      <h3 className="text-xl font-semibold text-black mb-3">Brendovi</h3>
                      <hr className="h-px my-4 bg-black border-0 w-16" />
                      <ul className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4">
                        {brands.map((brand) => (
                          <li key={brand.id}>
                            <Link
                              href={`/catalog/brand/${encodeURIComponent(brand.slug || brand.name)}`}
                              onClick={closeMenu}
                              className="relative group text-gray-700 hover:text-primary text-sm"
                            >
                              {brand.name}
                              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-primary transition-all duration-300 group-hover:w-full" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-black mb-3">Kategorije</h3>
                      <hr className="h-px my-4 bg-black border-0 w-16" />
                      <ul className="space-y-3 mt-4">
                        {categories.slice(0, 8).map((cat) => (
                          <li key={cat.id}>
                            <Link
                              href={`/category/${cat.slug}`}
                              onClick={closeMenu}
                              className="relative group text-gray-700 hover:text-primary text-sm"
                            >
                              {cat.name}
                              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-primary transition-all duration-300 group-hover:w-full" />
                            </Link>
                          </li>
                        ))}
                        {quickLinks.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              onClick={closeMenu}
                              className={cn(
                                "relative group text-sm",
                                item.highlight
                                  ? "text-red-600 hover:text-red-700 font-medium"
                                  : "text-gray-700 hover:text-primary"
                              )}
                            >
                              {item.name}
                              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-primary transition-all duration-300 group-hover:w-full" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Ostale stranice */}
        {navPages.map((page) => (
          <Link
            key={page.name}
            href={page.href}
            className={cn(
              "px-3 xl:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              page.highlight
                ? "text-red-600 hover:text-red-700"
                : pathname === page.href
                  ? "text-primary"
                  : "text-gray-700 hover:text-gray-900"
            )}
          >
            {page.name}
          </Link>
        ))}
      </nav>

      {activeMenu && (
        <div
          className="fixed inset-0 bg-black/25 z-40"
          onClick={closeMenu}
        />
      )}
    </>
  );
}

export function MobileNavigation({ onClose }: { onClose: () => void }) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/brands')
      .then(res => res.json())
      .then(data => setBrands(Array.isArray(data) ? data : data.brands || []))
      .catch(console.error);

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <nav className="flex flex-col py-4">
      {/* Katalog */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => toggleSection('shop')}
          className="flex items-center justify-between w-full px-4 py-3 text-base font-medium text-gray-900"
        >
          Katalog
          <ChevronDown className={cn(
            "h-5 w-5 transition-transform",
            openSection === 'shop' && "rotate-180"
          )} />
        </button>
        {openSection === 'shop' && (
          <div className="px-4 pb-6 space-y-6">
            {categories.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-3">Kategorije</p>
                <div className="space-y-2">
                  {categories.slice(0, 8).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/category/${cat.slug}`}
                      onClick={onClose}
                      className="block py-1.5 text-sm text-gray-600 hover:text-primary"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {brands.length > 0 && (
              <div>
                <p className="font-medium text-gray-900 mb-3">Brendovi</p>
                <div className="grid grid-cols-2 gap-2">
                  {brands.map((brand) => (
                    <Link
                      key={brand.id}
                      href={`/catalog/brand/${encodeURIComponent(brand.slug || brand.name)}`}
                      onClick={onClose}
                      className="py-1.5 text-sm text-gray-600 hover:text-primary"
                    >
                      {brand.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ostale stranice */}
      <div className="py-4 space-y-1">
        <Link
          href="/catalog"
          onClick={onClose}
          className="block px-4 py-3 text-base font-medium text-gray-900 border-b border-gray-200"
        >
          Svi proizvodi
        </Link>
        <Link
          href="/catalog?novo=true"
          onClick={onClose}
          className="block px-4 py-3 text-base font-medium text-gray-900 border-b border-gray-200"
        >
          Novo
        </Link>
        <Link
          href="/catalog?sale=true"
          onClick={onClose}
          className="block px-4 py-3 text-base font-medium text-red-600 border-b border-gray-200"
        >
          Sniženje
        </Link>
      </div>
    </nav>
  );
}
