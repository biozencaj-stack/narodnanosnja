"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { getLocalized } from "@/lib/i18n/localized";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  HomeIcon,
  HeartIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Logo } from "./Logo";
import { useSession, signOut } from "next-auth/react";
import { useUIStore, useCartStore, useCartTotals } from "@/store";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
} from "@/components/ui/Drawer";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { storeCapabilities } from "@/lib/config/capabilities";

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface NavCategory {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
}

interface NavBarProps {
  groupsAvailable?: Brand[];
  navCategories?: NavCategory[];
  hasSale?: boolean;
  hasNovo?: boolean;
  hasTickerAbove?: boolean;
  storeName?: string;
  storeTagline?: string;
}

function desktopTriggerId(panelId: string) {
  return `desktop-nav-trigger-${encodeURIComponent(panelId)}`;
}

function desktopPanelId(panelId: string) {
  return `desktop-nav-panel-${encodeURIComponent(panelId)}`;
}

export function NavBar({
  groupsAvailable = [],
  navCategories = [],
  hasSale = false,
  hasNovo = false,
  hasTickerAbove = false,
  storeName,
  storeTagline,
}: NavBarProps) {
  const { data: session } = useSession();

  const { openSearch } = useUIStore();
  const { openCart } = useCartStore();
  const { totalItems } = useCartTotals();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openDesktopPanel, setOpenDesktopPanel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const desktopNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setActiveCategory(null);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!openDesktopPanel) return;
    const activePanel = openDesktopPanel;
    function handleClickOutside(e: MouseEvent) {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenDesktopPanel(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenDesktopPanel(null);
        document.getElementById(desktopTriggerId(activePanel))?.focus();
      }
    }
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openDesktopPanel]);

  const toggleDesktopPanel = (id: string) => {
    setOpenDesktopPanel((prev) => (prev === id ? null : id));
  };

  const locale = useLocale();
  const categoriesToUse = navCategories;

  // Navigacija sme da prikazuje samo podatke koji zaista postoje u katalogu.
  // Kada kategorije nisu dostupne, siguran link ka celom katalogu renderuje se
  // u glavnom meniju ispod.
  const dynamicCategories = categoriesToUse.map((cat) => {
    const catName = typeof cat.name === "string" ? cat.name : getLocalized(cat.name, locale);
    return {
    id: cat.slug,
    name: catName,
    slug: cat.slug,
    sections: [
      {
        id: "categories",
        name: "Kategorije",
        items: [
          { name: `Sve - ${catName}`, href: `/category/${cat.slug}` },
          ...cat.children.map((child) => {
            const childName = typeof child.name === "string" ? child.name : getLocalized(child.name, locale);
            return { name: childName, href: `/category/${cat.slug}/${child.slug}` };
          }),
        ],
      },
      {
        id: "highlights",
        name: "Izdvajamo",
        items: [
          { name: "Sniženje", href: `/category/${cat.slug}?sale=true`, highlight: true },
          { name: "Novo", href: `/category/${cat.slug}?novo=true` },
        ],
      },
    ],
  };
  });

  const brandsToUse = groupsAvailable;

  const navigation = {
    categories: dynamicCategories,
    brands: brandsToUse.map((group) => ({
      name: group.name,
      href: `/catalog/brand/${encodeURIComponent(group.slug)}`,
    })),
  };

  const topOffset = hasTickerAbove ? "top-10" : "top-0";

  return (
    <div className="bg-white">
      {/* Mobile menu - Drawer from left */}
      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent side="left" className="max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Meni</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="p-0 overflow-hidden h-full">
            <div className="relative h-full overflow-hidden">
              {/* Main Menu View */}
              <div
                className={cn(
                  "absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out",
                  activeCategory !== null
                    ? "-translate-x-full"
                    : "translate-x-0",
                )}
              >
                <div className="py-4">
                  <div className="space-y-1">
                    {navigation.categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        {category.name}
                        <ChevronRightIcon className="h-5 w-5 text-text-muted" />
                      </button>
                    ))}
                    {brandsToUse.length > 0 && (
                      <button
                        onClick={() => setActiveCategory("brands")}
                        className="flex w-full items-center justify-between px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        Brendovi
                        <ChevronRightIcon className="h-5 w-5 text-text-muted" />
                      </button>
                    )}
                  </div>

                  <div className="my-4 border-t border-border" />

                  <div className="space-y-1">
                    <Link
                      href="/catalog"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                    >
                      Svi proizvodi
                    </Link>
                    {hasSale && (
                      <Link
                        href="/catalog?sale=true"
                        onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-3 text-base font-medium text-error hover:bg-background-alt"
                      >
                        Akcije
                      </Link>
                    )}
                    {hasNovo && (
                      <Link
                        href="/catalog?novo=true"
                        onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-3 text-base font-medium text-primary hover:bg-background-alt"
                      >
                        Novo
                      </Link>
                    )}
                  </div>

                  <div className="my-4 border-t border-border" />

                  <div className="space-y-1">
                    {session ? (
                      <Link
                        href="/moj-nalog"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        <UserIcon className="h-5 w-5 mr-3 text-text-muted" />
                        Moj nalog
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        <UserIcon className="h-5 w-5 mr-3 text-text-muted" />
                        Prijavi se
                      </Link>
                    )}
                    {storeCapabilities.wishlist && (
                      <Link
                        href="/moj-nalog/favoriti"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        <HeartIcon className="h-5 w-5 mr-3 text-text-muted" />
                        Favoriti
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        openCart();
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                    >
                      <ShoppingBagIcon className="h-5 w-5 mr-3 text-text-muted" />
                      Korpa ({totalItems})
                    </button>
                    {storeCapabilities.storeLocations && (
                      <Link
                        href="/prodajna-mesta"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center px-4 py-3 text-base font-medium text-text hover:bg-background-alt"
                      >
                        <HomeIcon className="h-5 w-5 mr-3 text-text-muted" />
                        Prodajna mesta
                      </Link>
                    )}
                  </div>

                  {storeCapabilities.englishLocale && (
                    <>
                      <div className="my-4 border-t border-border" />
                      <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-sm text-text-muted">Jezik</span>
                        <LanguageSwitcher />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Category Submenus */}
              {navigation.categories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "absolute inset-0 overflow-y-auto bg-background transition-transform duration-300 ease-in-out",
                    activeCategory === category.id
                      ? "translate-x-0"
                      : "translate-x-full",
                  )}
                >
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="flex w-full items-center px-4 py-4 text-base font-medium text-primary border-b border-border hover:bg-background-alt"
                  >
                    <ChevronLeftIcon className="h-5 w-5 mr-2" />
                    Svi
                  </button>
                  <div className="px-4 py-6">
                    <p className="text-lg font-semibold text-text mb-4">
                      {category.name}
                    </p>
                    {category.sections.map((section) => (
                      <div key={section.id} className="mb-6">
                        <p className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                          {section.name}
                        </p>
                        <ul className="space-y-2">
                          {section.items.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "block py-2",
                                  "highlight" in item && item.highlight
                                    ? "text-error font-medium"
                                    : "text-text hover:text-primary",
                                )}
                              >
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Brands Submenu */}
              <div
                className={cn(
                  "absolute inset-0 overflow-y-auto bg-background transition-transform duration-300 ease-in-out",
                  activeCategory === "brands"
                    ? "translate-x-0"
                    : "translate-x-full",
                )}
              >
                <button
                  onClick={() => setActiveCategory(null)}
                  className="flex w-full items-center px-4 py-4 text-base font-medium text-primary border-b border-border hover:bg-background-alt"
                >
                  <ChevronLeftIcon className="h-5 w-5 mr-2" />
                  Svi
                </button>
                <div className="px-4 py-6">
                  <p className="text-lg font-semibold text-text mb-4">
                    Brendovi
                  </p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {navigation.brands.map((brand) => (
                      <li key={brand.name}>
                        <Link
                          href={brand.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-text hover:text-primary"
                        >
                          {brand.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>



            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Header - sticky, always visible (no scroll-hide) */}
      <header
        className={cn(
          "fixed z-40 w-full bg-white border-b border-border",
          topOffset,
        )}
      >
        <nav aria-label="Glavna navigacija" className="bg-white">
          <div className="container-wide">
            <div className="flex h-16 items-center justify-between">
              <button
                type="button"
                className="relative rounded-md p-2 text-text-muted hover:text-primary xl:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="sr-only">Otvori meni</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
              </button>

              <div className="shrink-0 mr-2 xl:mr-4 -ml-2">
                <Logo ime={storeName} slogan={storeTagline} />
              </div>

              {/* Desktop navigation - controlled mega-menu */}
              <div ref={desktopNavRef} className="hidden xl:flex xl:flex-1 xl:items-center xl:justify-center xl:gap-0.5 2xl:gap-1">
                {navigation.categories.length === 0 && (
                  <Link
                    href="/catalog"
                    className="flex h-16 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary 2xl:px-4"
                  >
                    Svi proizvodi
                  </Link>
                )}

                {navigation.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    id={desktopTriggerId(category.id)}
                    onClick={() => toggleDesktopPanel(category.id)}
                    aria-expanded={openDesktopPanel === category.id}
                    aria-controls={desktopPanelId(category.id)}
                    className={cn(
                      "relative flex items-center gap-1 px-2 xl:px-3 2xl:px-4 h-16 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                      openDesktopPanel === category.id
                        ? "border-primary text-primary"
                        : "border-transparent text-text hover:text-primary"
                    )}
                  >
                    {category.name}
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        openDesktopPanel === category.id && "rotate-180"
                      )}
                    />
                  </button>
                ))}

                {brandsToUse.length > 0 && (
                  <button
                    type="button"
                    id={desktopTriggerId("brands")}
                    onClick={() => toggleDesktopPanel("brands")}
                    aria-expanded={openDesktopPanel === "brands"}
                    aria-controls={desktopPanelId("brands")}
                    className={cn(
                      "relative flex items-center gap-1 px-2 xl:px-3 2xl:px-4 h-16 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                      openDesktopPanel === "brands"
                        ? "border-primary text-primary"
                        : "border-transparent text-text hover:text-primary"
                    )}
                  >
                    Brendovi
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        openDesktopPanel === "brands" && "rotate-180"
                      )}
                    />
                  </button>
                )}

                {hasSale && (
                  <Link
                    href="/catalog?sale=true"
                    className="flex items-center px-2 xl:px-3 2xl:px-4 h-16 text-sm font-medium text-error hover:text-error/80 transition-colors whitespace-nowrap border-b-2 border-transparent"
                    onClick={() => setOpenDesktopPanel(null)}
                  >
                    Akcije
                  </Link>
                )}

                {hasNovo && (
                  <Link
                    href="/catalog?novo=true"
                    className="flex items-center px-2 xl:px-3 2xl:px-4 h-16 text-sm font-medium text-primary hover:text-primary-hover transition-colors whitespace-nowrap border-b-2 border-transparent"
                    onClick={() => setOpenDesktopPanel(null)}
                  >
                    Novo
                  </Link>
                )}
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-1 lg:gap-2 2xl:gap-2">
                {storeCapabilities.englishLocale && (
                  <div className="hidden lg:block">
                    <LanguageSwitcher />
                  </div>
                )}

                {storeCapabilities.storeLocations && (
                  <Link
                    href="/prodajna-mesta"
                    className="hidden lg:flex p-2 text-text-muted hover:text-primary transition-colors rounded-md"
                  >
                    <span className="sr-only">Prodajna mesta</span>
                    <HomeIcon className="h-6 w-6" aria-hidden="true" />
                  </Link>
                )}

                <button
                  onClick={openSearch}
                  className="p-2 text-text-muted hover:text-primary transition-colors rounded-md"
                >
                  <span className="sr-only">Pretraga</span>
                  <MagnifyingGlassIcon className="h-6 w-6" aria-hidden="true" />
                </button>

                {mounted && storeCapabilities.wishlist && (
                  <Link
                    href="/moj-nalog/favoriti"
                    className="p-2 text-text-muted hover:text-primary transition-colors rounded-md"
                  >
                    <span className="sr-only">Favoriti</span>
                    <HeartIcon className="h-6 w-6" aria-hidden="true" />
                  </Link>
                )}

                <UserAccountDropdown
                  session={session}
                  mounted={mounted}
                  signOut={signOut}
                />

                <button
                  onClick={openCart}
                  className="flex items-center gap-1 p-2 text-text-muted hover:text-primary transition-colors rounded-md"
                >
                  <ShoppingBagIcon className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm font-medium min-w-[1rem]">
                    {totalItems}
                  </span>
                  <span className="sr-only">artikala u korpi</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Desktop mega-menu panels - render below the nav */}
        {openDesktopPanel && (
          <div className="hidden xl:block bg-white border-b border-border shadow-lg">
            <div className="container-wide py-8">
              {/* Dynamic category panels */}
              {navigation.categories.map((category) =>
                openDesktopPanel === category.id ? (
                  <div
                    key={category.id}
                    id={desktopPanelId(category.id)}
                    role="region"
                    aria-labelledby={desktopTriggerId(category.id)}
                    className="grid grid-cols-3 gap-12"
                  >
                    {category.sections.map((section) => (
                      <div key={section.id}>
                        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-5 pb-2 border-b border-border">
                          {section.name}
                        </p>
                        <ul className="space-y-1">
                          {section.items.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                onClick={() => setOpenDesktopPanel(null)}
                                className={cn(
                                  "block text-sm py-1.5 transition-colors",
                                  "highlight" in item && item.highlight
                                    ? "text-error font-medium hover:text-error/80"
                                    : "text-text-muted hover:text-text hover:pl-1 transition-all"
                                )}
                              >
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null
              )}

              {/* Brands panel */}
              {openDesktopPanel === "brands" && (
                <div
                  id={desktopPanelId("brands")}
                  role="region"
                  aria-labelledby={desktopTriggerId("brands")}
                >
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-5 pb-2 border-b border-border">
                    Brendovi
                  </p>
                  <div className="grid grid-cols-4 gap-x-8 gap-y-2">
                    {navigation.brands.map((brand) => (
                      <Link
                        key={brand.name}
                        href={brand.href}
                        onClick={() => setOpenDesktopPanel(null)}
                        className="text-sm text-text-muted hover:text-text hover:pl-1 transition-all py-1.5"
                      >
                        {brand.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Backdrop when desktop panel is open */}
      {openDesktopPanel && (
        <div
          className="fixed inset-0 z-30 bg-black/20 hidden xl:block"
          onClick={() => setOpenDesktopPanel(null)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}


function UserAccountDropdown({
  session,
  mounted,
  signOut,
}: {
  session: { user?: { name?: string | null; email?: string | null } } | null;
  mounted: boolean;
  signOut: (options?: { callbackUrl?: string }) => void;
}) {
  if (!mounted) {
    return (
      <button className="relative p-2 rounded-md transition-colors text-text-muted">
        <span className="sr-only">Korisnički meni</span>
        <UserIcon className="h-6 w-6" aria-hidden="true" />
      </button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "relative p-2 rounded-md transition-colors",
            mounted && session
              ? "text-primary"
              : "text-text-muted hover:text-primary hover:bg-background-alt",
          )}
        >
          <span className="sr-only">Korisnički meni</span>
          <UserIcon className="h-6 w-6" aria-hidden="true" />
          {mounted && session && (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-success ring-2 ring-white" />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="min-w-[180px] bg-background rounded-lg shadow-lg border border-border p-1 z-50"
        >
          {session ? (
            <>
              <DropdownMenu.Item asChild>
                <Link
                  href="/moj-nalog"
                  className="block px-4 py-2 text-sm text-text hover:bg-background-alt rounded-md outline-none cursor-pointer"
                >
                  Moj nalog
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => signOut({ callbackUrl: "/" })}
                className="block w-full text-left px-4 py-2 text-sm text-text hover:bg-background-alt rounded-md outline-none cursor-pointer"
              >
                Odjavi se
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item asChild>
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm text-text hover:bg-background-alt rounded-md outline-none cursor-pointer"
                >
                  Prijavi se
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/register"
                  className="block px-4 py-2 text-sm text-text hover:bg-background-alt rounded-md outline-none cursor-pointer"
                >
                  Registruj se
                </Link>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default NavBar;
