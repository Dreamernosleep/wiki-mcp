import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import {
  getContentDir,
  getRelativePath,
  parsePath,
  readPageFile,
  listAllPageFiles,
} from './files.js';
import * as db from './db.js';
import * as search from './search.js';

let watcher: FSWatcher | null = null;

/**
 * Sync a single file to the database and search index
 */
async function syncFileToDb(filePath: string): Promise<void> {
  const parsed = parsePath(filePath);
  if (!parsed) return;

  const { category, slug } = parsed;
  const pageData = readPageFile(filePath);
  if (!pageData) return;

  const { frontmatter, content } = pageData;

  // Check if page exists in DB
  const existing = db.getPage(category, slug);

  if (existing) {
    // Update existing page
    db.updatePage(category, slug, {
      title: frontmatter.title,
      content,
    });
    // Update id if it changed (from frontmatter)
    if (existing.id !== frontmatter.id) {
      // ID mismatch - this shouldn't happen normally, but handle it
      console.error(`⚠️  ID mismatch for ${category}/${slug}: DB=${existing.id}, File=${frontmatter.id}`);
    }
  } else {
    // Create new page, keeping the ID from frontmatter when present.
    // Passing the ID up front avoids an insert-then-rename that would
    // violate the page_links foreign key once links have been created.
    db.createPage(
      category,
      slug,
      frontmatter.title || slug,
      content,
      frontmatter.created_by || 'user',
      frontmatter.id
    );
  }

  // Index in Meilisearch
  const page = db.getPage(category, slug);
  if (page) {
    await search.updatePage({
      id: page.id,
      title: page.title,
      content: page.content,
      category: page.category_id,
      slug: page.slug,
      created_by: page.created_by,
      updated_at: page.updated_at,
    });
  }

  console.error(`🔄 Synced: ${category}/${slug}`);
}

/**
 * Remove a page from DB and search index when file is deleted
 */
async function removeFileFromDb(filePath: string): Promise<void> {
  const parsed = parsePath(filePath);
  if (!parsed) return;

  const { category, slug } = parsed;

  // Get page ID before deleting
  const page = db.getPage(category, slug);
  const pageId = page?.id;

  // Delete from DB
  db.deletePage(category, slug);

  // Delete from search index
  if (pageId) {
    await search.deletePage(pageId);
  }

  console.error(`🗑️  Removed: ${category}/${slug}`);
}

/**
 * Full sync: scan all files and sync to DB + search index
 * Called on startup and can be called manually
 */
export async function fullSync(): Promise<{ synced: number; removed: number }> {
  console.error('🔄 Starting full sync from files...');

  const files = listAllPageFiles();
  const filePaths = new Set(files);
  let synced = 0;

  // Get all pages currently in DB
  const dbPages = db.listPages();
  const dbPaths = new Set(
    dbPages.map(p => path.join(getContentDir(), p.category_id, `${p.slug}.md`))
  );

  // Sync files to DB (one bad file must not abort the whole sync)
  for (const filePath of files) {
    try {
      await syncFileToDb(filePath);
      synced++;
    } catch (error) {
      console.error(`❌ Failed to sync ${getRelativePath(filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Remove DB pages that no longer have files
  let removed = 0;
  for (const page of dbPages) {
    const pagePath = path.join(getContentDir(), page.category_id, `${page.slug}.md`);
    if (!filePaths.has(pagePath)) {
      db.deletePage(page.category_id, page.slug);
      await search.deletePage(page.id);
      removed++;
      console.error(`🗑️  Removed (no file): ${page.category_id}/${page.slug}`);
    }
  }

  // Reindex search
  const allPages = db.listPages();
  await search.reindexAll(allPages.map(p => ({
    id: p.id,
    title: p.title,
    content: p.content,
    category: p.category_id,
    slug: p.slug,
    created_by: p.created_by,
    updated_at: p.updated_at,
  })));

  console.error(`✅ Full sync complete: ${synced} synced, ${removed} removed`);
  return { synced, removed };
}

/**
 * Start watching the content directory for changes
 */
export function startWatcher(): FSWatcher {
  const contentDir = getContentDir();

  console.error(`👀 Watching ${contentDir} for changes...`);

  watcher = chokidar.watch('**/*.md', {
    cwd: contentDir,
    ignoreInitial: true, // Don't fire on startup (fullSync handles that)
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500, // Wait 500ms after last write
      pollInterval: 100,
    },
  });

  // Errors inside these handlers would otherwise be unhandled rejections
  const safe = (label: string, fn: (filePath: string) => Promise<void>) => async (relativePath: string) => {
    const filePath = path.join(contentDir, relativePath);
    console.error(`${label}: ${relativePath}`);
    try {
      await fn(filePath);
    } catch (error) {
      console.error(`❌ Failed to process ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  watcher.on('add', safe('➕ File added', syncFileToDb));
  watcher.on('change', safe('📝 File changed', syncFileToDb));
  watcher.on('unlink', safe('🗑️  File deleted', removeFileFromDb));

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  return watcher;
}

/**
 * Stop the file watcher
 */
export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.error('🛑 File watcher stopped');
  }
}
