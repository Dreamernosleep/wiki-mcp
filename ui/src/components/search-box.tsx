import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import { api, type SearchEngine, type SearchResult } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Props {
  onResults: (data: { results: SearchResult[]; engine: SearchEngine }) => void;
  onClear: () => void;
}

const DEBOUNCE_MS = 300;

/** Search input with a debounced query and a suggestions dropdown. */
export function SearchBox({ onResults, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const runSearch = async (q: string) => {
    const id = ++requestId.current;
    if (!q || q.length < 2) {
      setSuggestions([]);
      onClear();
      return;
    }
    try {
      const [search, suggest] = await Promise.all([api.search(q, 10), api.suggest(q).catch(() => ({ suggestions: [] }))]);
      if (id !== requestId.current) return; // stale
      onResults(search);
      setSuggestions(suggest.suggestions);
      setShowSuggestions(suggest.suggestions.length > 0);
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

  // Close the suggestion list on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const clear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onClear();
  };

  const pick = (s: string) => {
    setQuery(s);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowSuggestions(false);
            if (query) clear();
          }
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

      {showSuggestions && (
        <ul
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-sm"
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(s)}
                className={cn('block w-full truncate px-2.5 py-1.5 text-left text-[13px] hover:bg-accent')}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
