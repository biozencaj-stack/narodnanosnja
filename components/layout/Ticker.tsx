'use client';

import { useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getLocalized } from '@/lib/i18n/localized';

interface TickerMessage {
  id: string;
  text: unknown;
}

interface TickerProps {
  messages: TickerMessage[];
  speed?: number; // Animation duration in seconds
  pauseOnHover?: boolean;
  closeable?: boolean;
}

export function Ticker({
  messages,
  speed = 30,
  pauseOnHover = true,
  closeable = false
}: TickerProps) {
  const locale = useLocale();
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isHoverPaused, setIsHoverPaused] = useState(false);

  if (!isVisible || messages.length === 0) return null;

  // Duplicate messages 3x for seamless loop
  const duplicatedMessages = [...messages, ...messages, ...messages];

  return (
    <div
      className="bg-primary text-white overflow-hidden relative z-50"
      role="region"
      aria-label="Obaveštenja"
      onMouseEnter={() => pauseOnHover && setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
    >
      <ul className="sr-only">
        {messages.map((message) => (
          <li key={message.id}>{getLocalized(message.text, locale)}</li>
        ))}
      </ul>
      <div className="py-2.5">
        <div
          aria-hidden="true"
          className="animate-marquee flex whitespace-nowrap"
          style={{
            animationDuration: `${speed}s`,
            animationPlayState: isPaused || isHoverPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedMessages.map((message, index) => (
            <span
              key={`${message.id}-${index}`}
              className="mx-6 sm:mx-8 flex items-center text-sm sm:text-base font-medium"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full mr-3 sm:mr-4 flex-shrink-0" />
              {getLocalized(message.text, locale)}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 bg-primary pl-2 sm:right-4">
        <button
          type="button"
          onClick={() => setIsPaused((current) => !current)}
          className="rounded p-1 text-white/80 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={isPaused ? "Pokreni obaveštenja" : "Pauziraj obaveštenja"}
          aria-pressed={isPaused}
        >
          {isPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
        {closeable && (
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="rounded p-1 text-white/70 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Zatvori obaveštenja"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// Server component wrapper that fetches ticker messages
export async function TickerServer() {
  try {
    // Fetch active ticker messages from API
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/ticker`, {
      next: { revalidate: 60 } // Revalidate every 60 seconds
    });

    if (!response.ok) {
      return null;
    }

    const messages = await response.json();

    if (!messages || messages.length === 0) {
      return null;
    }

    return <Ticker messages={messages} />;
  } catch (error) {
    console.error('Failed to fetch ticker messages:', error);
    return null;
  }
}

// Default export for direct usage with data
export default Ticker;
