'use client';

import Link from 'next/link';
import { Search, ShoppingBag, Menu, X, User, LogOut, Settings } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { useCartStore, useCartTotals } from '@/store';
import { useUIStore } from '@/store';
import { Logo } from './Logo';
import { Navigation } from './Navigation';
import { MobileMenu } from './MobileMenu';
import { CartDrawer } from './CartDrawer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Header() {
  const { data: session } = useSession();
  const { openCart } = useCartStore();
  const { totalItems } = useCartTotals();
  const {
    isMobileMenuOpen,
    toggleMobileMenu,
    openSearch,
  } = useUIStore();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    setIsUserMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full">
        {/* Main header */}
        <div className="bg-background/95 backdrop-blur-md border-b border-border">
          <div className="container-wide">
            <div className="flex items-center justify-between h-16 lg:h-20">

              {/* Mobile menu button */}
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 -ml-2 text-text hover:text-primary transition-colors"
                aria-label={isMobileMenuOpen ? 'Zatvori meni' : 'Otvori meni'}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>

              {/* Znak radionice */}
              <Logo className="lg:mr-8" />

              {/* Desktop Navigation */}
              <div className="hidden lg:flex lg:flex-1 justify-center">
                <Navigation />
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-1 lg:gap-3">
                <LanguageSwitcher />
                {/* Search */}
                <button
                  onClick={openSearch}
                  className="p-2.5 text-text hover:text-primary hover:bg-primary-light rounded-full transition-all duration-200"
                  aria-label="Pretraga"
                >
                  <Search className="h-5 w-5" />
                </button>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`relative p-2.5 rounded-full transition-all duration-200 ${
                      session
                        ? 'text-primary bg-primary-light hover:bg-primary hover:text-white'
                        : 'text-text hover:text-primary hover:bg-primary-light'
                    }`}
                    aria-label="Korisnički meni"
                  >
                    <User className="h-5 w-5" />
                    {session && (
                      <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-success rounded-full border-2 border-white" />
                    )}
                  </button>

                  {/* Dropdown menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-2 z-50">
                      {session ? (
                        <>
                          <div className="px-4 py-3 border-b border-stone-100">
                            <p className="text-sm font-medium text-stone-900">
                              {session.user.firstName} {session.user.lastName}
                            </p>
                            <p className="text-xs text-stone-500 truncate">
                              {session.user.email}
                            </p>
                          </div>
                          <Link
                            href="/moj-nalog"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                          >
                            <User className="h-4 w-4" />
                            Moj nalog
                          </Link>
                          {(session.user.role === 'ADMIN' || session.user.role === 'OPERATOR') && (
                            <Link
                              href={session.user.role === 'OPERATOR' ? '/admin/orders' : '/admin'}
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                            >
                              <Settings className="h-4 w-4" />
                              {session.user.role === 'OPERATOR' ? 'Porudžbine' : 'Admin panel'}
                            </Link>
                          )}
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <LogOut className="h-4 w-4" />
                            Odjava
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/login"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                          >
                            Prijava
                          </Link>
                          <Link
                            href="/register"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                          >
                            Registracija
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Cart */}
                <button
                  onClick={openCart}
                  className="relative p-2.5 text-text hover:text-primary hover:bg-primary-light rounded-full transition-all duration-200"
                  aria-label="Korpa"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full shadow-sm animate-fade-in">
                      {totalItems > 9 ? '9+' : totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu />

      {/* Cart Drawer */}
      <CartDrawer />
    </>
  );
}
