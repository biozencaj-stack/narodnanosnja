import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeHtmlText,
  sanitizeLocalizedRichText,
  sanitizeRichHtml,
} from "./html";

test("sanitizeRichHtml removes executable markup and unsafe URLs", () => {
  const sanitized = sanitizeRichHtml(
    '<p onclick="alert(1)">Opis</p><script>alert(1)</script>' +
      '<a href="javascript:alert(2)">link</a><img src="x" onerror="alert(3)">',
  );

  assert.equal(
    sanitized,
    '<p>Opis</p><a>link</a><img src="x" loading="lazy" />',
  );
  assert.doesNotMatch(sanitized, /script|onclick|onerror|javascript/i);
});

test("sanitizeRichHtml preserves approved editorial formatting", () => {
  const sanitized = sanitizeRichHtml(
    '<h2>Naslov</h2><p><strong>Važno</strong> <a href="https://example.com" target="_blank">više</a></p>',
  );

  assert.equal(
    sanitized,
    '<h2>Naslov</h2><p><strong>Važno</strong> <a href="https://example.com" target="_blank" rel="noopener noreferrer">više</a></p>',
  );
});

test("sanitizeLocalizedRichText sanitizes each supported locale", () => {
  assert.deepEqual(
    sanitizeLocalizedRichText({
      sr: '<p onmouseover="x">Srpski</p>',
      en: '<iframe src="https://example.com"></iframe><p>English</p>',
      unexpected: "ignored",
    }),
    { sr: "<p>Srpski</p>", en: "<p>English</p>" },
  );
});

test("escapeHtmlText keeps plain newsletter fields out of HTML markup", () => {
  assert.equal(
    escapeHtmlText('<img src=x onerror="alert(1)"> O\'Reilly & partneri'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; O&#39;Reilly &amp; partneri",
  );
});
