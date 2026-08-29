/**
 * Parse product ID into components
 * Format: code-color-model
 */
export function parseProductId(id: string): { code: string; color: string; model: string } {
  const parts = id.split('-');
  return {
    code: parts[0] || '',
    color: parts[1] || '',
    model: parts[2] || '',
  };
}
