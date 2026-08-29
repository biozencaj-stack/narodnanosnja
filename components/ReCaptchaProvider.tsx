'use client';

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

interface ReCaptchaProviderProps {
  children: React.ReactNode;
}

export function ReCaptchaProvider({ children }: ReCaptchaProviderProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // If no site key, just render children without reCAPTCHA
  if (!siteKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('reCAPTCHA site key not configured');
    }
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
      language="sr"
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
