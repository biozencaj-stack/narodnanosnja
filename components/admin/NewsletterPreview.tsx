"use client";

import { Eye } from "lucide-react";
import { storeName, storePhone, storeEmail } from "@/lib/config/store";

interface NewsletterPreviewProps {
  subject: string;
  content: string;
}

export function NewsletterPreview({ subject, content }: NewsletterPreviewProps) {
  // Generate the email HTML preview (matches sendNewsletterCampaign template)
  // Design: Black header with green accents
  const emailHtml = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; background-color: #4F46E5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">

        <!-- Header - Black -->
        <div style="background-color: #4F46E5; padding: 32px 24px; text-align: center; border-bottom: 3px solid #4F46E5;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">${storeName}</h1>
          <p style="color: #888888; margin: 8px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Newsletter</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
          <h2 style="color: #4F46E5; font-size: 22px; margin: 0 0 24px; font-weight: 600;">${subject || "Naslov newsletter-a"}</h2>
          <div style="color: #444444; font-size: 16px; line-height: 1.7;">
            ${content || '<p style="color: #999;">Sadržaj newsletter-a će se prikazati ovde...</p>'}
          </div>

          <div style="margin-top: 32px; text-align: center;">
            <a href="#" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">
              Posetite naš sajt
            </a>
          </div>
        </div>

        <!-- Footer - Dark -->
        <div style="background-color: #4F46E5; padding: 24px; text-align: center;">
          <p style="color: #888888; font-size: 14px; margin: 0 0 8px;">
            Za sva pitanja možete nas kontaktirati:
          </p>
          <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px; font-weight: 500;">
            Tel: ${storePhone} | Email: ${storeEmail}
          </p>
          <p style="color: #666666; font-size: 12px; margin: 0;">
            <a href="#" style="color: #888888; text-decoration: underline;">Odjavi se sa newsletter-a</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden bg-white h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-stone-200 p-3 bg-stone-50 flex items-center gap-2">
        <Eye className="h-4 w-4 text-stone-500" />
        <span className="text-sm font-medium text-stone-700">Preview</span>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-stone-100 p-4">
        <div
          className="transform scale-[0.85] origin-top"
          dangerouslySetInnerHTML={{ __html: emailHtml }}
        />
      </div>
    </div>
  );
}
