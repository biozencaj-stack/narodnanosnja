'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

export interface FilterCounts {
  gender: Record<string, number>;
  brands: Record<string, number>;
  types: Record<string, number>;
  colors: Record<string, number>;
  sizes: Record<string, number>;
  total: number;
}

interface UseFilterCountsOptions {
  debounceMs?: number;
  baseGender?: string;
  groupId?: string; // For brand pages
}

export function useFilterCounts(options: UseFilterCountsOptions = {}) {
  const { debounceMs = 300, baseGender, groupId } = options;
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [counts, setCounts] = useState<FilterCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCounts = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Build query params from current filters
      const params = new URLSearchParams();

      if (baseGender) {
        params.set('gender', baseGender);
      } else if (searchParams.get('gender')) {
        params.set('gender', searchParams.get('gender')!);
      }

      // Add group ID if provided, BUT NOT if we're on a brand page
      // On brand pages, we want counts for ALL brands so user can select multiple
      const isOnBrandPage = pathname.includes('/brend/');
      if (groupId && !isOnBrandPage) {
        params.set('groupId', groupId);
      }

      // Add current filters (standardized params only)
      searchParams.getAll('size').forEach(s => params.append('size', s));
      searchParams.getAll('color').forEach(c => params.append('color', c));
      searchParams.getAll('type').forEach(t => params.append('type', t));
      searchParams.getAll('brand').forEach(b => params.append('brand', b));

      const price = searchParams.get('priceMax');
      if (price) params.set('price', price);

      const sale = searchParams.get('sale');
      if (sale === 'true') params.set('sale', 'true');

      const novo = searchParams.get('novo');
      if (novo === 'true') params.set('novo', 'true');

      const response = await fetch(`/api/products/counts?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch counts');
      }

      const data = await response.json();

      if (data.success) {
        setCounts(data.counts);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch counts');
    } finally {
      setLoading(false);
    }
  }, [searchParams, pathname, baseGender, groupId]);

  // Debounced fetch
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchCounts();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchCounts, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { counts, loading, error, refetch: fetchCounts };
}
