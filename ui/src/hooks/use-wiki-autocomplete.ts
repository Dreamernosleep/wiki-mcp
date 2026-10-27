import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { api, type Page } from '@/lib/api';

export interface AutocompleteItem {
  category: string;
  slug: string;
  title: string;
  path: string;
}

export interface AutocompleteState {
  active: boolean;
  /** Index of the opening `[[` in the text */
  startPos: number;
  /** Text typed after `[[` */
  query: string;
  selectedIndex: number;
  items: AutocompleteItem[];
}

const IDLE: AutocompleteState = { active: false, startPos: -1, query: '', selectedIndex: 0, items: [] };
const MAX_ITEMS = 8;

/**
 * Pages to offer for a `[[` query. Shared by the textarea and visual editors:
 *  - <2 chars: filters the already loaded pages locally
 *  - ≥2 chars: asks the search API (typo-tolerant when Meilisearch is up)
 */
export async function searchWikiLinkItems(query: string, pages: Page[]): Promise<AutocompleteItem[]> {
  let items: AutocompleteItem[];
  if (query.length >= 2) {
    try {
      const { results } = await api.search(query, MAX_ITEMS);
      items = results.map((r) => ({ category: r.category, slug: r.slug, title: r.title, path: r.path }));
    } catch {
      items = [];
    }
  } else {
    items = pages.map((p) => ({
      category: p.category_id,
      slug: p.slug,
      title: p.title,
      path: `${p.category_id}/${p.slug}`,
    }));
  }
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)
    );
  }
  return items.slice(0, MAX_ITEMS);
}

interface Options {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  /** All loaded pages, used for client-side filtering on short queries */
  pages: Page[];
}

/**
 * Wiki-link autocomplete for the editor. Call `detect()` from the textarea's
 * onChange, `onKeyDown` from its onKeyDown, and render `state.items`.
 * Behaviour matches the original vanilla implementation:
 *  - opens when the cursor is after an unclosed `[[` on the same line
 *  - <2 chars: filters loaded pages locally; ≥2 chars: queries the search API
 *  - ↑/↓ navigate, Enter/Tab insert `[[category/slug]]`, Esc closes
 */
export function useWikiAutocomplete({ textareaRef, value, onChange, pages }: Options) {
  const [state, setState] = useState<AutocompleteState>(IDLE);
  const timer = useRef<number | undefined>(undefined);
  const latestQuery = useRef('');

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setState(IDLE);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const fetchItems = useCallback(
    async (query: string) => {
      const items = await searchWikiLinkItems(query, pages);
      // Ignore stale responses
      if (latestQuery.current !== query) return;
      setState((s) => (s.active ? { ...s, items, selectedIndex: 0 } : s));
    },
    [pages]
  );

  /** Inspect the text around the cursor and open/close the list accordingly. */
  const detect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const open = before.lastIndexOf('[[');
    if (open === -1) return close();
    const after = before.slice(open + 2);
    if (after.includes('\n') || after.includes(']]')) return close();

    latestQuery.current = after;
    setState((s) => ({ ...s, active: true, startPos: open, query: after, selectedIndex: 0 }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void fetchItems(after), 150);
  }, [textareaRef, close, fetchItems]);

  const select = useCallback(
    (index: number) => {
      const item = state.items[index];
      const ta = textareaRef.current;
      if (!item || !ta) return;
      const before = value.slice(0, state.startPos);
      const after = value.slice(ta.selectionStart);
      const link = `${item.category}/${item.slug}`;
      onChange(`${before}[[${link}]]${after}`);
      const pos = before.length + link.length + 4; // "[[" + link + "]]"
      requestAnimationFrame(() => {
        ta.setSelectionRange(pos, pos);
        ta.focus();
      });
      close();
    },
    [state.items, state.startPos, textareaRef, value, onChange, close]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!state.active) return;
      const n = state.items.length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (n) setState((s) => ({ ...s, selectedIndex: (s.selectedIndex + 1) % n }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (n) setState((s) => ({ ...s, selectedIndex: (s.selectedIndex - 1 + n) % n }));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          select(state.selectedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [state.active, state.items.length, state.selectedIndex, select, close]
  );

  const setSelectedIndex = useCallback((i: number) => setState((s) => ({ ...s, selectedIndex: i })), []);

  return { state, detect, select, close, onKeyDown, setSelectedIndex };
}
