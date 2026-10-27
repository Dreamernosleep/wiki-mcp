import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

export interface Page {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface PageLink {
  id: number;
  source_page_id: string;
  target_page_id: string;
  anchor_text: string;
  created_at: string;
}

export interface PageWithCategory extends Page {
  category_name: string;
}

let db: DatabaseSync | null = null;

export function initDatabase(dbPath?: string): DatabaseSync {
  const finalPath = dbPath || path.join(__dirname, '..', 'wiki.db');
  db = new DatabaseSync(finalPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  createSchema(db);
  seedCategories(db);

  return db;
}

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    -- Hardcoded branches (categories)
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    );

    -- Agent-created leaves (pages)
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'agent',
      UNIQUE(category_id, slug)
    );

    -- Graph edges (interlinks between pages)
    CREATE TABLE IF NOT EXISTS page_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      anchor_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_page_id, target_page_id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category_id);
    CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
    CREATE INDEX IF NOT EXISTS idx_links_source ON page_links(source_page_id);
    CREATE INDEX IF NOT EXISTS idx_links_target ON page_links(target_page_id);

    -- Full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_search USING fts5(
      title,
      content,
      category_id UNINDEXED,
      page_id UNINDEXED,
      content=pages,
      content_rowid=rowid
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_search(rowid, title, content, category_id, page_id)
      VALUES (new.rowid, new.title, new.content, new.category_id, new.id);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
      INSERT INTO pages_search(pages_search, rowid, title, content, category_id, page_id)
      VALUES('delete', old.rowid, old.title, old.content, old.category_id, old.id);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
      INSERT INTO pages_search(pages_search, rowid, title, content, category_id, page_id)
      VALUES('delete', old.rowid, old.title, old.content, old.category_id, old.id);
      INSERT INTO pages_search(rowid, title, content, category_id, page_id)
      VALUES (new.rowid, new.title, new.content, new.category_id, new.id);
    END;
  `);
}

function seedCategories(database: DatabaseSync): void {
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)
  `);

  stmt.run('finance', 'Finance', 'Budgets, expenses, revenue, tax, accounting', 1);
  stmt.run('operations', 'Operations', 'Processes, procurement, logistics, supply chain', 2);
  stmt.run('service', 'Service', 'Customer support, SLAs, onboarding, success', 3);
}

// ==================== CATEGORY OPERATIONS ====================

export function listCategories(): Category[] {
  const database = getDb();
  return database.prepare('SELECT * FROM categories ORDER BY sort_order').all() as unknown as Category[];
}

export function createCategory(id: string, name: string, description: string): Category {
  const database = getDb();
  const maxSort = database.prepare('SELECT MAX(sort_order) as max FROM categories').get() as { max: number };
  const sortOrder = (maxSort.max || 0) + 1;

  database.prepare(
    'INSERT INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)'
  ).run(id, name, description, sortOrder);

  return database.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Category;
}

export function getCategory(id: string): Category | undefined {
  const database = getDb();
  return database.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Category | undefined;
}

export function deleteCategory(id: string): boolean {
  const database = getDb();
  // Don't delete if there are pages in this category
  const pageCount = database.prepare('SELECT COUNT(*) as count FROM pages WHERE category_id = ?').get(id) as { count: number };
  if (pageCount.count > 0) {
    throw new Error(`Cannot delete category "${id}": it contains ${pageCount.count} page(s)`);
  }
  const result = database.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return result.changes > 0;
}

// ==================== PAGE OPERATIONS ====================

export function createPage(
  categoryId: string,
  slug: string,
  title: string,
  content: string,
  createdBy: string = 'agent'
): Page {
  const database = getDb();
  const id = crypto.randomUUID();

  const stmt = database.prepare(`
    INSERT INTO pages (id, category_id, slug, title, content, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, categoryId, slug, title, content, createdBy);

  // Parse and create links from [[wiki-style]] links
  const links = extractWikiLinks(content);
  for (const link of links) {
    resolveAndCreateLink(id, link);
  }

  return getPage(categoryId, slug)!;
}

export function getPage(categoryId: string, slug: string): Page | undefined {
  const database = getDb();
  return database.prepare(
    'SELECT * FROM pages WHERE category_id = ? AND slug = ?'
  ).get(categoryId, slug) as unknown as Page | undefined;
}

export function getPageById(id: string): Page | undefined {
  const database = getDb();
  return database.prepare('SELECT * FROM pages WHERE id = ?').get(id) as unknown as Page | undefined;
}

export function updatePage(
  categoryId: string,
  slug: string,
  updates: { title?: string; content?: string }
): Page | undefined {
  const database = getDb();
  const page = getPage(categoryId, slug);
  if (!page) return undefined;

  const newTitle = updates.title ?? page.title;
  const newContent = updates.content ?? page.content;

  database.prepare(`
    UPDATE pages SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE category_id = ? AND slug = ?
  `).run(newTitle, newContent, categoryId, slug);

  // Re-parse links if content changed
  if (updates.content !== undefined) {
    // Remove old outgoing links
    database.prepare('DELETE FROM page_links WHERE source_page_id = ?').run(page.id);
    // Create new links
    const links = extractWikiLinks(newContent);
    for (const link of links) {
      resolveAndCreateLink(page.id, link);
    }
  }

  return getPage(categoryId, slug);
}

export function deletePage(categoryId: string, slug: string): boolean {
  const database = getDb();
  const stmt = database.prepare(
    'DELETE FROM pages WHERE category_id = ? AND slug = ?'
  );
  const result = stmt.run(categoryId, slug);
  return result.changes > 0;
}

export function listPages(categoryId?: string): PageWithCategory[] {
  const database = getDb();
  if (categoryId) {
    return database.prepare(`
      SELECT p.*, c.name as category_name
      FROM pages p
      JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ?
      ORDER BY p.updated_at DESC
    `).all(categoryId) as unknown as PageWithCategory[];
  }
  return database.prepare(`
    SELECT p.*, c.name as category_name
    FROM pages p
    JOIN categories c ON p.category_id = c.id
    ORDER BY c.sort_order, p.updated_at DESC
  `).all() as unknown as PageWithCategory[];
}

export function searchPages(query: string): PageWithCategory[] {
  const database = getDb();
  return database.prepare(`
    SELECT p.*, c.name as category_name
    FROM pages_search ps
    JOIN pages p ON p.rowid = ps.rowid
    JOIN categories c ON p.category_id = c.id
    WHERE pages_search MATCH ?
    ORDER BY rank
    LIMIT 20
  `).all(query) as unknown as PageWithCategory[];
}

// ==================== LINK OPERATIONS ====================

export function getLinkedPages(categoryId: string, slug: string): {
  outgoing: Array<{ page: PageWithCategory; anchor_text: string }>;
  incoming: Array<{ page: PageWithCategory; anchor_text: string }>;
} {
  const database = getDb();
  const page = getPage(categoryId, slug);
  if (!page) return { outgoing: [], incoming: [] };

  const outgoing = database.prepare(`
    SELECT p.*, c.name as category_name, pl.anchor_text
    FROM page_links pl
    JOIN pages p ON pl.target_page_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE pl.source_page_id = ?
  `).all(page.id) as unknown as Array<PageWithCategory & { anchor_text: string }>;

  const incoming = database.prepare(`
    SELECT p.*, c.name as category_name, pl.anchor_text
    FROM page_links pl
    JOIN pages p ON pl.source_page_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE pl.target_page_id = ?
  `).all(page.id) as unknown as Array<PageWithCategory & { anchor_text: string }>;

  return {
    outgoing: outgoing.map(r => ({ page: { ...r, anchor_text: undefined } as any, anchor_text: r.anchor_text })),
    incoming: incoming.map(r => ({ page: { ...r, anchor_text: undefined } as any, anchor_text: r.anchor_text }))
  };
}

export function getGraph(categoryId?: string): {
  nodes: Array<{ id: string; title: string; category: string; slug: string }>;
  edges: Array<{ from: string; to: string; anchor: string }>;
} {
  const database = getDb();

  const nodes = categoryId
    ? database.prepare(`
        SELECT p.id, p.title, p.category_id as category, p.slug
        FROM pages p WHERE p.category_id = ?
      `).all(categoryId) as unknown as any[]
    : database.prepare(`
        SELECT p.id, p.title, p.category_id as category, p.slug
        FROM pages p
      `).all() as unknown as any[];

  const edges = database.prepare(`
    SELECT pl.source_page_id as "from", pl.target_page_id as "to", pl.anchor_text as anchor
    FROM page_links pl
    JOIN pages p1 ON pl.source_page_id = p1.id
    JOIN pages p2 ON pl.target_page_id = p2.id
    ${categoryId ? 'WHERE p1.category_id = ? OR p2.category_id = ?' : ''}
  `).all(...(categoryId ? [categoryId, categoryId] : [])) as unknown as any[];

  return { nodes, edges };
}

// ==================== HELPERS ====================

function extractWikiLinks(content: string): Array<{ category?: string; slug: string; anchor: string }> {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: Array<{ category?: string; slug: string; anchor: string }> = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const target = match[1].trim();
    const anchor = match[2]?.trim() || target;

    // Support both [[slug]] and [[category/slug]]
    if (target.includes('/')) {
      const [category, slug] = target.split('/', 2);
      links.push({ category, slug, anchor });
    } else {
      links.push({ slug: target, anchor });
    }
  }

  return links;
}

function resolveAndCreateLink(sourcePageId: string, link: { category?: string; slug: string; anchor: string }): void {
  const database = getDb();

  let targetPage: Page | undefined;

  if (link.category) {
    targetPage = getPage(link.category, link.slug);
  } else {
    // Search across all categories for the slug
    targetPage = database.prepare(
      'SELECT * FROM pages WHERE slug = ? LIMIT 1'
    ).get(link.slug) as unknown as Page | undefined;
  }

  if (targetPage && targetPage.id !== sourcePageId) {
    database.prepare(`
      INSERT OR IGNORE INTO page_links (source_page_id, target_page_id, anchor_text)
      VALUES (?, ?, ?)
    `).run(sourcePageId, targetPage.id, link.anchor);
  }
}
