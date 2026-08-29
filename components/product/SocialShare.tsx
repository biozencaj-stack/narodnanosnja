'use client';

import { Share2, Facebook, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
}

export function SocialShare({ url, title, description = '', className }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    viber: `viber://forward?text=${encodedTitle}%20${encodedUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    messenger: `fb-messenger://share/?link=${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const link = shareLinks[platform];
    window.open(link, '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-text-muted mr-1">Podeli:</span>

      {/* Facebook */}
      <button
        onClick={() => handleShare('facebook')}
        className="p-2 rounded-full bg-[#1877F2] text-white hover:opacity-90 transition-opacity"
        aria-label="Podeli na Facebook"
        title="Facebook"
      >
        <Facebook className="h-4 w-4" />
      </button>

      {/* Viber */}
      <button
        onClick={() => handleShare('viber')}
        className="p-2 rounded-full bg-[#665CAC] text-white hover:opacity-90 transition-opacity"
        aria-label="Podeli na Viber"
        title="Viber"
      >
        <MessageCircle className="h-4 w-4" />
      </button>

      {/* WhatsApp */}
      <button
        onClick={() => handleShare('whatsapp')}
        className="p-2 rounded-full bg-[#25D366] text-white hover:opacity-90 transition-opacity"
        aria-label="Podeli na WhatsApp"
        title="WhatsApp"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {/* Copy Link / Native Share */}
      <button
        onClick={handleNativeShare}
        className={cn(
          "p-2 rounded-full transition-all",
          copied
            ? "bg-green-500 text-white"
            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
        )}
        aria-label={copied ? "Link kopiran!" : "Kopiraj link"}
        title={copied ? "Link kopiran!" : "Kopiraj link"}
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
