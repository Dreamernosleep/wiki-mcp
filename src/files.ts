import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface PageFrontmatter {
  id: string;
  category: string;
  slug: string;
  title: string;
  created: string;
  updated: string;
  created_by: string;
}

export interface ParsedPage {
  frontmatter: PageFrontmatter;
  content: string;
  filePath: string;
}

const CONTENT_DIR = process.env.CONTENT_PATH || path.join(process.cwd(), 'content');

// Category IDs, page slugs and template IDs become folder/file names, so they
// share one strict pattern. Folders starting with "_" (e.g. _templates) are
// reserved for non-page data and can never be categories.
export const ID_PATTERN = /^[a-z0-9-]+$/;
export const ID_RULE = 'lowercase letters, numbers, and hyphens only';

/** Folders under content/ whose files are not wiki pages (e.g. _templates) */
export function isReservedDir(name: string): boolean {
  return name.startsWith('_');
}

/**
 * Get the file path for a page
 */
export function getPagePath(category: string, slug: string): string {
  const filePath = path.resolve(CONTENT_DIR, category, `${slug}.md`);
  // Refuse any path that escapes the content directory (e.g. slug "../../x")
  const root = path.resolve(CONTENT_DIR) + path.sep;
  if (!filePath.startsWith(root)) {
    throw new Error(`Invalid page path: ${category}/${slug}`);
  }
  return filePath;
}

/**
 * Ensure a category directory exists
 */
export function ensureCategoryDir(category: string): void {
  const dir = path.join(CONTENT_DIR, category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a page to a markdown file with frontmatter
 */
export function writePageFile(
  category: string,
  slug: string,
  title: string,
  content: string,
  id: string,
  createdBy: string = 'agent',
  existingCreated?: string
): string {
  ensureCategoryDir(category);
  const filePath = getPagePath(category, slug);

  const now = new Date().toISOString().split('T')[0];
  const frontmatter: PageFrontmatter = {
    id,
    category,
    slug,
    title,
    created: existingCreated || now,
    updated: now,
    created_by: createdBy,
  };

  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * Read a page from a markdown file
 */
export function readPageFile(filePath: string): ParsedPage | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  return {
    frontmatter: parsed.data as PageFrontmatter,
    content: parsed.content.trim(),
    filePath,
  };
}

/**
 * Read a page by category and slug
 */
export function readPage(category: string, slug: string): ParsedPage | null {
  const filePath = getPagePath(category, slug);
  return readPageFile(filePath);
}

/**
 * Delete a page file
 */
export function deletePageFile(category: string, slug: string): boolean {
  const filePath = getPagePath(category, slug);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}

/**
 * List all markdown files in the content directory
 */
export function listAllPageFiles(): string[] {
  const files: string[] = [];

  if (!fs.existsSync(CONTENT_DIR)) {
    return files;
  }

  const categories = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });

  for (const cat of categories) {
    if (!cat.isDirectory() || isReservedDir(cat.name)) continue;

    const catDir = path.join(CONTENT_DIR, cat.name);
    const pages = fs.readdirSync(catDir, { withFileTypes: true });

    for (const page of pages) {
      if (page.isFile() && page.name.endsWith('.md')) {
        files.push(path.join(catDir, page.name));
      }
    }
  }

  return files;
}

/**
 * Parse all markdown files and return page data
 */
export function parseAllPages(): Array<{
  category: string;
  slug: string;
  title: string;
  content: string;
  id: string;
  createdBy: string;
  filePath: string;
}> {
  const files = listAllPageFiles();
  const pages: Array<{
    category: string;
    slug: string;
    title: string;
    content: string;
    id: string;
    createdBy: string;
    filePath: string;
  }> = [];

  for (const filePath of files) {
    const parsed = readPageFile(filePath);
    if (parsed) {
      pages.push({
        category: parsed.frontmatter.category,
        slug: parsed.frontmatter.slug,
        title: parsed.frontmatter.title,
        content: parsed.content,
        id: parsed.frontmatter.id,
        createdBy: parsed.frontmatter.created_by,
        filePath,
      });
    }
  }

  return pages;
}

/**
 * Get the relative path from content directory (e.g., "finance/q4-budget.md")
 */
export function getRelativePath(filePath: string): string {
  return path.relative(CONTENT_DIR, filePath).replace(/\\/g, '/');
}

/**
 * Parse category and slug from a file path
 */
export function parsePath(filePath: string): { category: string; slug: string } | null {
  const relative = getRelativePath(filePath);
  const parts = relative.split('/');
  if (parts.length !== 2 || !parts[1].endsWith('.md') || isReservedDir(parts[0])) {
    return null;
  }
  return {
    category: parts[0],
    slug: parts[1].replace(/\.md$/, ''),
  };
}

/**
 * Get the content directory path
 */
export function getContentDir(): string {
  return CONTENT_DIR;
}
