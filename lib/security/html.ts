import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "a",
    "code",
    "pre",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
  transformTags: {
    a: (_tagName, attributes) => {
      if (attributes.target !== "_blank") {
        const safeAttributes = { ...attributes };
        delete safeAttributes.target;
        return { tagName: "a", attribs: safeAttributes };
      }

      return {
        tagName: "a",
        attribs: {
          ...attributes,
          rel: "noopener noreferrer",
        },
      };
    },
    img: (_tagName, attributes) => ({
      tagName: "img",
      attribs: {
        ...attributes,
        loading: attributes.loading === "eager" ? "eager" : "lazy",
      },
    }),
  },
};

/**
 * Sanitizes administrator-authored rich text using a small storefront
 * allow-list. Scripts, event handlers, inline styles, iframes and unsafe URL
 * schemes are removed.
 */
export function sanitizeRichHtml(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return sanitizeHtml(value, RICH_TEXT_OPTIONS);
}

/** Escape plain text before interpolating it into an HTML template. */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Product rich text is stored as localized JSON. Only supported locale keys
 * are retained so arbitrary object data cannot reach an HTML sink.
 */
export function sanitizeLocalizedRichText(
  value: unknown,
): { sr: string; en: string } | null {
  if (typeof value === "string") {
    const sanitized = sanitizeRichHtml(value);
    return sanitized ? { sr: sanitized, en: sanitized } : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const localized = value as Record<string, unknown>;
  const sr = sanitizeRichHtml(localized.sr);
  const en = sanitizeRichHtml(localized.en);

  if (!sr && !en) return null;
  return { sr, en: en || sr };
}
