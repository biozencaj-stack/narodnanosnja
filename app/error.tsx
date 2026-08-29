'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <div className="w-16 h-16 bg-error-light rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl lg:text-3xl font-medium text-text mb-4">
          Došlo je do greške
        </h2>
        <p className="text-text-muted max-w-md mx-auto mb-8">
          Nešto je pošlo naopako. Pokušajte ponovo ili nas kontaktirajte ako
          problem potraje.
        </p>
        <Button onClick={reset}>
          Pokušaj ponovo
        </Button>
      </div>
    </div>
  );
}
