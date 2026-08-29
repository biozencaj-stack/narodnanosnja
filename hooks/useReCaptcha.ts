'use client';

import { useCallback, useState } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

interface UseReCaptchaReturn {
  executeRecaptcha: (action: string) => Promise<string | null>;
  verifyRecaptcha: (action: string) => Promise<boolean>;
  isVerifying: boolean;
  error: string | null;
}

export function useReCaptcha(): UseReCaptchaReturn {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeRecaptchaAction = useCallback(
    async (action: string): Promise<string | null> => {
      if (!executeRecaptcha) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('reCAPTCHA not available');
        }
        return null;
      }

      try {
        const token = await executeRecaptcha(action);
        return token;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('reCAPTCHA execution error:', err);
        }
        return null;
      }
    },
    [executeRecaptcha]
  );

  const verifyRecaptcha = useCallback(
    async (action: string): Promise<boolean> => {
      setIsVerifying(true);
      setError(null);

      try {
        const token = await executeRecaptchaAction(action);

        if (!token) {
          // If no reCAPTCHA available (e.g., in development without keys), allow
          if (process.env.NODE_ENV === 'development') {
            setIsVerifying(false);
            return true;
          }
          setError('reCAPTCHA nije dostupan');
          setIsVerifying(false);
          return false;
        }

        const response = await fetch('/api/recaptcha/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'reCAPTCHA verifikacija nije uspela');
          setIsVerifying(false);
          return false;
        }

        setIsVerifying(false);
        return true;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('reCAPTCHA verification error:', err);
        }
        setError('Greška pri verifikaciji');
        setIsVerifying(false);
        return false;
      }
    },
    [executeRecaptchaAction]
  );

  return {
    executeRecaptcha: executeRecaptchaAction,
    verifyRecaptcha,
    isVerifying,
    error,
  };
}
