/**
 * "Q4 Budget Planning!" -> "q4-budget-planning"
 * Matches the server-side rule for slugs and category ids: [a-z0-9-]+
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_PATTERN = '[a-z0-9-]+';
export const SLUG_RULE = 'Lowercase letters, numbers, and hyphens only';
