#!/usr/bin/env node
/**
 * Manual sync script - rebuild database and search index from markdown files
 * Usage: npm run sync
 */
import path from 'path';
import fs from 'fs';

// Set environment before importing modules
process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'wiki.db');
process.env.CONTENT_PATH = process.env.CONTENT_PATH || path.join(process.cwd(), 'content');

// Ensure directories
fs.mkdirSync(process.env.CONTENT_PATH, { recursive: true });
fs.mkdirSync(path.dirname(process.env.DATABASE_PATH), { recursive: true });

async function main() {
  console.log('🔄 Wiki Sync Tool\n');

  const db = await import('./db.js');
  const search = await import('./search.js');
  const watcher = await import('./watcher.js');

  // Initialize
  db.initDatabase(process.env.DATABASE_PATH);
  console.log('✅ Database initialized');

  const meilisearchOk = await search.initSearch();
  console.log(meilisearchOk ? '✅ Meilisearch connected' : '⚠️  Meilisearch not available (using SQLite only)');

  // Full sync
  console.log('\n🔄 Syncing files → database...');
  const result = await watcher.fullSync();

  console.log(`\n✅ Sync complete!`);
  console.log(`   📄 Pages synced: ${result.synced}`);
  console.log(`   🗑️  Pages removed: ${result.removed}`);

  // Show stats
  const pages = db.listPages();
  console.log(`\n📊 Current state:`);
  console.log(`   Total pages: ${pages.length}`);

  const categories = db.listCategories();
  for (const cat of categories) {
    const catPages = db.listPages(cat.id);
    console.log(`   ${cat.id}: ${catPages.length} pages`);
  }

  if (meilisearchOk) {
    const stats = await search.getStats();
    console.log(`   Meilisearch index: ${stats?.count || 0} documents`);
  }
}

main().catch(console.error);
