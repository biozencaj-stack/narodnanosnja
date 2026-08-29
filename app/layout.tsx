import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { PT_Serif, PT_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getStoreSettings,
  storeThemeStyle,
} from "@/lib/config/store-settings";
import type { StoreSettingsMap } from "@/lib/config/store-settings-schema";
import { storeIdentityFromSettings } from "@/lib/config/store-identity";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import { StoreIdentityProvider } from "@/components/StoreIdentityProvider";
import { serializeJsonLd } from "@/lib/security/json-ld";

const configuredGaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_ID = configuredGaId && /^G-[A-Z0-9]+$/i.test(configuredGaId)
  ? configuredGaId
  : undefined;

// PT Serif i PT Sans su crtani za ćirilicu, pa srpska slova nisu naknadno
// dodata nego deo osnovnog pisma. latin-ext nosi kvačice (č, ć, š, ž, đ).
const ptSerif = PT_Serif({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const ptSans = PT_Sans({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const storeName = settings["store.name"];
  const title = settings["seo.title"] || `${storeName} – Online prodavnica`;
  const description = settings["seo.description"] || settings["store.description"];
  const metadataBase = getStorefrontUrl();

  return {
    title: { default: title, template: `%s | ${storeName}` },
    description,
    keywords: ["online prodavnica", "webshop", storeName],
    authors: [{ name: storeName }],
    metadataBase,
    openGraph: {
      type: "website",
      locale: "sr_RS",
      siteName: storeName,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  };
}

// Organization JSON-LD Schema
function OrganizationJsonLd({ settings }: { settings: StoreSettingsMap }) {
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings["store.name"],
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: settings["store.description"],
    email: settings["contact.email"] || undefined,
    telephone: settings["contact.phone"] || undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

// WebSite JSON-LD Schema with SearchAction
function WebSiteJsonLd({ settings }: { settings: StoreSettingsMap }) {
  const siteUrl = getStorefrontUrl().toString().replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings["store.name"],
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/pretraga?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, messages, settings] = await Promise.all([
    getLocale(),
    getMessages(),
    getStoreSettings(),
  ]);
  const htmlLang = locale === "en" ? "en" : "sr";
  return (
    <html
      lang={htmlLang}
      className={`${ptSerif.variable} ${ptSans.variable}`}
      style={storeThemeStyle(settings) as CSSProperties}
    >
      <head>
        <meta charSet="utf-8" />
        {/* DNS Prefetch for external resources */}
        <link rel="dns-prefetch" href="https://www.instagram.com" />
        <link rel="dns-prefetch" href="https://cdninstagram.com" />

        <OrganizationJsonLd settings={settings} />
        <WebSiteJsonLd settings={settings} />
      </head>
      <body className="font-body antialiased bg-background text-text">
        {/* Google Analytics 4 */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
        <NextIntlClientProvider messages={messages}>
          <StoreIdentityProvider identity={storeIdentityFromSettings(settings)}>
            <Providers>
              <a className="skip-link" href="#glavni-sadrzaj">
                Preskoči na glavni sadržaj
              </a>
              {children}
            </Providers>
          </StoreIdentityProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
