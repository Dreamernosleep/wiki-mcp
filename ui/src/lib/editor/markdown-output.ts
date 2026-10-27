/**
 * Post-processing for Markdown produced by the visual editor.
 *
 * @tiptap/markdown backslash-escapes `[` `]` and HTML-encodes `&` in text
 * nodes. That is valid CommonMark, but it turns the wiki shortcode
 * `[[category/slug]]` into `\[\[category/slug\]\]`, which the preview, the
 * link index and other agents no longer recognise, and it makes plain prose
 * like "R&D" read as "R&amp;D" in the .md file. This undoes both, leaving
 * fenced code blocks and inline code spans untouched.
 */

// Odd split segments are code (fenced blocks or inline spans) and are kept verbatim
const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g;
const ESCAPED_WIKI_LINK = /\\\[\\\[((?:\\.|[^\]\n])*?)\\\]\\\]/g;
const MARKDOWN_ESCAPE = /\\([\\`*_[\]~])/g;

function tidyText(text: string): string {
  return text
    .replace(ESCAPED_WIKI_LINK, (_m, inner: string) => `[[${inner.replace(MARKDOWN_ESCAPE, '$1')}]]`)
    .replace(/&amp;/g, '&');
}

export function tidyMarkdown(markdown: string): string {
  return markdown
    .split(CODE_SEGMENT)
    .map((segment, i) => (i % 2 === 1 ? segment : tidyText(segment)))
    .join('');
}
