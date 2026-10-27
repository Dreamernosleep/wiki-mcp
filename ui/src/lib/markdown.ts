import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// DOMPurify's default URI allow-list drops unknown schemes; permit wiki:// so
// internal links survive sanitising. Everything else stays at the defaults.
const ALLOWED_URI = /^(?:(?:https?|mailto|tel|wiki):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

/** Remove a leading YAML frontmatter block. */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER, '');
}

/**
 * Render wiki markdown to sanitised HTML.
 * [[category/slug]] and [[slug|Label]] become <a href="wiki://…"> links that
 * the Preview component intercepts.
 */
export function renderMarkdown(markdown: string): string {
  const body = stripFrontmatter(markdown);
  const withLinks = body.replace(WIKI_LINK, (_m, target: string, anchor?: string) => {
    const t = target.trim();
    return `[${(anchor ?? t).trim()}](wiki://${t})`;
  });
  const html = marked.parse(withLinks) as string;
  return DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: ALLOWED_URI });
}

/** Sanitise a Meilisearch `_formatted` snippet, keeping only <mark>. */
export function sanitizeHighlight(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] });
}

/**
 * Title used when saving: the frontmatter `title:` line, else the first
 * `# heading`, else the fallback (current title). Mirrors the original UI.
 */
export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^title:\s*(.+)$/m) || markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}
