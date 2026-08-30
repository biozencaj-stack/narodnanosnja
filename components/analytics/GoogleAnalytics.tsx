"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { shouldTrackGoogleAnalyticsPath } from "@/lib/analytics/google-analytics";

type GtagArguments = [command: string, ...parameters: unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArguments) => void;
    storefrontGaId?: string;
  }
}

interface GoogleAnalyticsProps {
  measurementId: string;
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const shouldTrack = shouldTrackGoogleAnalyticsPath(pathname);
  const [isReady, setIsReady] = useState(false);

  const initializeAnalytics = useCallback(() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        // gtag.js expects its command queue entries to be Arguments objects.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };

    if (window.storefrontGaId !== measurementId) {
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
      window.storefrontGaId = measurementId;
    }

    setIsReady(true);
  }, [measurementId]);

  useEffect(() => {
    if (!isReady || !shouldTrack || !window.gtag) return;

    window.gtag("event", "page_view", {
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
    });
  }, [isReady, pathname, shouldTrack]);

  if (!shouldTrack) return null;

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
      onReady={initializeAnalytics}
    />
  );
}
