/**
 * Basic slugify helper shared across the CMS.
 * Normalizes text to lowercase kebab-case and falls back to a timestamp if empty.
 */
export function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return normalized;
  }

  return `item-${Date.now().toString(36)}`;
}
