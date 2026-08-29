'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface VerifyEmailPageProps {
  params: Promise<{ token: string }>;
}

export default function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const { token } = await params;
        // Redirect to API route which handles verification and login
        window.location.href = `/api/auth/verify-email/${token}`;
      } catch (error) {
        setStatus('error');
        setErrorMessage('Došlo je do greške pri verifikaciji.');
      }
    };

    verifyEmail();
  }, [params, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-display text-text">
            Verifikujemo vaš email...
          </h1>
          <p className="text-text-muted">
            Molimo sačekajte, automatski ćete biti preusmreni.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md mx-auto px-4">
          <XCircle className="h-16 w-16 text-error mx-auto" />
          <h1 className="text-2xl font-display text-text">
            Verifikacija nije uspela
          </h1>
          <p className="text-text-muted">
            {errorMessage || 'Link je nevažeći ili je istekao.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/register"
              className="inline-block bg-primary text-white px-6 py-3 rounded-lg
                       hover:bg-primary-hover transition-colors font-medium"
            >
              Registrujte se ponovo
            </Link>
            <Link
              href="/login"
              className="inline-block text-primary hover:text-primary-hover transition-colors"
            >
              Već imate nalog? Prijavite se
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <CheckCircle className="h-16 w-16 text-success mx-auto" />
        <h1 className="text-2xl font-display text-text">
          Email je uspešno verifikovan!
        </h1>
        <p className="text-text-muted">
          Preusmeravanje na vaš nalog...
        </p>
      </div>
    </div>
  );
}
