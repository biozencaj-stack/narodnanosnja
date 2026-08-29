"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ReCaptchaProvider } from "@/components/ReCaptchaProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ReCaptchaProvider>
        {children}
      </ReCaptchaProvider>
    </SessionProvider>
  );
}
