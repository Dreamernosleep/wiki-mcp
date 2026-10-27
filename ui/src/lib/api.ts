/**
 * Typed client for the Wiki REST API (see src/server.ts in the repo root).
 * The base URL is relative so the same build works behind the nginx proxy in
 * Docker and behind Vite's dev proxy locally. Override with VITE_API_URL.
 */

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
}

export interface Page {
  id: string;
  category_id: string;
  category_name?: string;
  slug: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  /** Full file contents including frontmatter (only on GET /pages/:cat/:slug) */
  raw_markdown?: string | null;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  slug: string;
  path: string;
  _formatted?: { title?: string; content?: string };
}

export type SearchEngine = 'meilisearch' | 'sqlite';

export interface LinkedPages {
  outgoing: Array<{ page: Page; anchor_text: string }>;
  incoming: Array<{ page: Page; anchor_text: string }>;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const api = {
  // Categories
  listCategories: () => request<Category[]>('/categories'),
  createCategory: (body: { id: string; name: string; description?: string }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),

  // Pages
  listPages: (category?: string) =>
    request<Page[]>(category ? `/pages?category=${enc(category)}` : '/pages'),
  getPage: (category: string, slug: string) => request<Page>(`/pages/${enc(category)}/${enc(slug)}`),
  createPage: (body: { category: string; slug: string; title: string; content: string }) =>
    request<Page>('/pages', { method: 'POST', body: JSON.stringify(body) }),
  updatePage: (category: string, slug: string, body: { title?: string; content?: string }) =>
    request<Page>(`/pages/${enc(category)}/${enc(slug)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePage: (category: string, slug: string) =>
    request<{ deleted: boolean }>(`/pages/${enc(category)}/${enc(slug)}`, { method: 'DELETE' }),
  getLinks: (category: string, slug: string) =>
    request<LinkedPages>(`/pages/${enc(category)}/${enc(slug)}/links`),

  // Search
  search: async (q: string, limit = 10): Promise<{ results: SearchResult[]; engine: SearchEngine }> => {
    const data = await request<{ results: Array<Partial<SearchResult> & Partial<Page>>; engine: SearchEngine }>(
      `/search?q=${enc(q)}&limit=${limit}`
    );
    // The SQLite fallback returns raw page rows (category_id, no path); normalise
    // so callers always get the Meilisearch shape.
    const results: SearchResult[] = data.results.map((r) => {
      const category = r.category ?? r.category_id ?? '';
      const slug = r.slug ?? '';
      return {
        id: r.id ?? `${category}/${slug}`,
        title: r.title ?? '',
        content: r.content ?? '',
        category,
        slug,
        path: r.path ?? `${category}/${slug}`,
        _formatted: r._formatted,
      };
    });
    return { results, engine: data.engine };
  },
  suggest: (q: string) => request<{ suggestions: string[] }>(`/search/suggest?q=${enc(q)}`),
};
