import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import { api, type SearchEngine, type SearchResult } from '@/lib/api';
import { Input } from '@/components/ui/input';

interface Props {
  onResults: (data: { results: SearchResult[]; engine: SearchEngine }) => void;
  onClear: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Search input with a debounced query. Results replace the page tree below
 * as you type, so there is no separate suggestions dropdown.
 */
export function SearchBox({ onResults, onClear }: Props) {
  const [query, setQuery] = useState('');
  const requestId = useRef(0);

  const runSearch = async (q: string) => {
    const id = ++requestId.current;
    if (!q || q.length < 2) {
      onClear();
      return;
    }
    try {
      const search = await api.search(q, 10);
      if (id !== requestId.current) return; // stale
      onResults(search);
    } catch (e) {
      console.error('Search error:', e);
    }
  };

  // Debounce typing
  useEffect(() => {
    const t = window.setTimeout(() => void runSearch(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clear = () => {
    setQuery('');
    onClear();
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && query) clear();
        }}
        placeholder="Search pages…"
        aria-label="Search pages"
        autoComplete="off"
        className="h-8 bg-background pl-8 pr-7 text-[13px]"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
