import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AutocompleteItem } from '@/hooks/use-wiki-autocomplete';

export interface WikiLinkListProps {
  items: AutocompleteItem[];
  query: string;
  loading: boolean;
  command: (item: AutocompleteItem) => void;
}

export interface WikiLinkListRef {
  /** Returns true when the key was handled (↑ ↓ Enter Tab). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Popup shown by the visual editor after typing `[[`. Same look and keys as
 * the Markdown editor's autocomplete.
 */
export const WikiLinkList = forwardRef<WikiLinkListRef, WikiLinkListProps>(function WikiLinkList(
  { items, query, loading, command },
  ref
) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      const n = items.length;
      switch (event.key) {
        case 'ArrowDown':
          if (n) setSelected((i) => (i + 1) % n);
          return true;
        case 'ArrowUp':
          if (n) setSelected((i) => (i - 1 + n) % n);
          return true;
        case 'Enter':
        case 'Tab': {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        default:
          return false;
      }
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Link to page"
      className="z-50 w-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div className="flex items-center justify-between border-b bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>Link to page</span>
        <span className="font-mono">↑↓ · Enter · Esc</span>
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {items.length === 0 ? (
          <li className="px-2.5 py-2 text-xs text-muted-foreground">
            {loading ? 'Searching…' : query ? `No pages found for “${query}”` : 'Type to search pages…'}
          </li>
        ) : (
          items.map((item, i) => (
            <li key={item.path}>
              <button
                type="button"
                role="option"
                aria-selected={i === selected}
                onMouseDown={(e) => e.preventDefault()} // keep editor focus
                onMouseEnter={() => setSelected(i)}
                onClick={() => command(item)}
                className={cn('flex w-full items-center gap-2 px-2.5 py-1.5 text-left', i === selected && 'bg-accent')}
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{item.title}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">{item.path}</span>
                </span>
                <span className="rounded-sm border px-1 font-mono text-[10px] text-muted-foreground">{item.category}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
});
