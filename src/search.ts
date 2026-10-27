import { MeiliSearch, Index } from 'meilisearch';

let client: MeiliSearch | null = null;
let index: Index | null = null;
let available = false;

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  path: string;
  created_by: string;
  updated_at: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  path: string;
  created_by: string;
  updated_at: string;
  _formatted?: {
    title: string;
    content: string;
  };
  _matchesPosition?: Record<string, Array<{ start: number; length: number }>>;
}

/**
 * Initialize Meilisearch client and configure the index
 */
export async function initSearch(): Promise<boolean> {
  const host = process.env.MEILISEARCH_URL || 'http://localhost:7700';
  const apiKey = process.env.MEILISEARCH_KEY || 'masterKey';

  try {
    client = new MeiliSearch({ host, apiKey });
    index = client.index('pages');

    // Test connection
    await client.health();

    // Configure index settings
    await index.updateSettings({
      searchableAttributes: ['title', 'content'],
      filterableAttributes: ['category', 'created_by', 'updated_at'],
      sortableAttributes: ['updated_at', 'title'],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 8,
        },
      },
      pagination: {
        maxTotalHits: 1000,
      },
    });

    available = true;
    console.error('✅ Meilisearch connected and configured');
    return true;
  } catch (error) {
    console.error('⚠️  Meilisearch not available, falling back to SQLite FTS5');
    available = false;
    return false;
  }
}

/**
 * Check if Meilisearch is available
 */
export function isSearchAvailable(): boolean {
  return available;
}

/**
 * Index a page in Meilisearch
 */
export async function indexPage(page: {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  created_by?: string;
  updated_at?: string;
}): Promise<void> {
  if (!available || !index) return;

  const doc: SearchDocument = {
    id: page.id,
    title: page.title,
    content: page.content,
    category: page.category,
    slug: page.slug,
    path: `${page.category}/${page.slug}`,
    created_by: page.created_by || 'agent',
    updated_at: page.updated_at || new Date().toISOString(),
  };

  try {
    await index.addDocuments([doc], { primaryKey: 'id' });
  } catch (error) {
    console.error('Failed to index page in Meilisearch:', error);
  }
}

/**
 * Update a page in Meilisearch (delete + re-add)
 */
export async function updatePage(page: {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  created_by?: string;
  updated_at?: string;
}): Promise<void> {
  if (!available || !index) return;
  await deletePage(page.id);
  await indexPage(page);
}

/**
 * Delete a page from Meilisearch
 */
export async function deletePage(id: string): Promise<void> {
  if (!available || !index) return;

  try {
    await index.deleteDocument(id);
  } catch (error) {
    // Ignore if document doesn't exist
  }
}

/**
 * Search pages with Meilisearch
 */
export async function searchPages(
  query: string,
  options: {
    category?: string;
    limit?: number;
    highlight?: boolean;
  } = {}
): Promise<SearchResult[]> {
  if (!available || !index) {
    return [];
  }

  const filter = options.category ? `category = ${options.category}` : undefined;

  try {
    const results = await index.search(query, {
      filter,
      limit: options.limit || 20,
      attributesToHighlight: options.highlight ? ['title', 'content'] : undefined,
      attributesToCrop: options.highlight ? ['content:200'] : undefined,
      cropMarker: '...',
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    });

    return results.hits as SearchResult[];
  } catch (error) {
    console.error('Meilisearch search error:', error);
    return [];
  }
}

/**
 * Get search suggestions (autocomplete)
 */
export async function getSuggestions(query: string, limit: number = 5): Promise<string[]> {
  if (!available || !index || query.length < 2) {
    return [];
  }

  try {
    const results = await index.search(query, {
      limit,
      attributesToRetrieve: ['title'],
    });

    return results.hits.map((hit: any) => hit.title);
  } catch (error) {
    return [];
  }
}

/**
 * Reindex all pages (full rebuild)
 */
export async function reindexAll(pages: Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  created_by?: string;
  updated_at?: string;
}>): Promise<void> {
  if (!available || !index) return;

  try {
    // Clear existing index
    await index.deleteAllDocuments();

    // Add all pages
    const docs: SearchDocument[] = pages.map(page => ({
      id: page.id,
      title: page.title,
      content: page.content,
      category: page.category,
      slug: page.slug,
      path: `${page.category}/${page.slug}`,
      created_by: page.created_by || 'agent',
      updated_at: page.updated_at || new Date().toISOString(),
    }));

    await index.addDocuments(docs, { primaryKey: 'id' });
    console.error(`✅ Reindexed ${docs.length} pages in Meilisearch`);
  } catch (error) {
    console.error('Failed to reindex:', error);
  }
}

/**
 * Get index stats
 */
export async function getStats(): Promise<{ count: number } | null> {
  if (!available || !index) return null;

  try {
    const stats = await index.getStats();
    return { count: stats.numberOfDocuments };
  } catch (error) {
    return null;
  }
}
