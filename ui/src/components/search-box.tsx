import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Search, X } from 'lucide-react';

import { api, type Category, type SearchEngine, type SearchResult } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SearchData {
  results: SearchResult[];
  engine: SearchEngine;
  /** The folder the search was limited to, if any */
  category: Category | null;
}

interface Props {
  categories: Category[];
  onResults: (data: SearchData) => void;
  onClear: () => void;
}

const DEBOUNCE_MS = 300;
const ALL = '__all__';

/**
 * Search input with a debounced query and an optional folder filter. Results
 * replace the page tree below as you type, so there is no separate
 * suggestions dropdown.
 */
export function SearchBox({ categories, onResults, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(ALL);
  const requestId = useRef(0);

  // A deleted folder must not stay selected
  useEffect(() => {
    if (categoryId !== ALL && !categories.some((c) => c.id === categoryId)) setCategoryId(ALL);
  }, [categories, categoryId]);

  const runSearch = async (q: string, cat: string) => {
    const id = ++requestId.current;
    if (!q || q.length < 2) {
      onClear();
      return;
    }
    try {
      const search = await api.search(q, 10, cat === ALL ? undefined : cat);
      if (id !== requestId.current) return; // stale
      onResults({ ...search, category: categories.find((c) => c.id === cat) ?? null });
    } catch (e) {
      console.error('Search error:', e);
    }
  };

  // Debounce typing; a folder change re-runs the search right away
  useEffect(() => {
    const t = window.setTimeout(() => void runSearch(query, categoryId), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryId]);

  const clear = () => {
    setQuery('');
    onClear();
  };

  const scoped = categoryId !== ALL;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) clear();
          }}
          placeholder={scoped ? `Search in ${categories.find((c) => c.id === categoryId)?.name ?? 'folder'}…` : 'Search pages…'}
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

      {/* Folder filter: all folders, or one category */}
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger
          aria-label="Search in folder"
          className={cn(
            'h-7 w-full gap-1.5 border-dashed bg-transparent px-2 text-[11px] text-muted-foreground shadow-none',
            scoped && 'border-solid text-foreground'
          )}
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            All folders
          </SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
