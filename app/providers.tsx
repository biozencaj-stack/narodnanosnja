"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ReCaptchaProvider } from "@/components/ReCaptchaProvider";
import { shouldLoadThirdPartyScripts } from "@/lib/security/credential-path";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const allowThirdPartyScripts = shouldLoadThirdPartyScripts(pathname);

  return (
    <SessionProvider>
      {allowThirdPartyScripts ? (
        <ReCaptchaProvider>{children}</ReCaptchaProvider>
      ) : (
        children
      )}
    </SessionProvider>
  );
}
