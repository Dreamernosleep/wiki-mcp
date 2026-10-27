import { useRef } from 'react';
import { FileText } from 'lucide-react';

import type { Page } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useWikiAutocomplete } from '@/hooks/use-wiki-autocomplete';

interface Props {
  value: string;
  onChange: (next: string) => void;
  pages: Page[];
}

/** Plain-text markdown editor with `[[` wiki-link autocomplete. */
export function Editor({ value, onChange, pages }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ac = useWikiAutocomplete({ textareaRef, value, onChange, pages });

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          ac.detect();
        }}
        onKeyDown={ac.onKeyDown}
        onClick={() => !ac.state.active && ac.close()}
        onBlur={() => window.setTimeout(ac.close, 150)}
        spellCheck={false}
        placeholder="Write markdown here. Type [[ to link to another page."
        aria-label="Markdown editor"
        className="h-full w-full flex-1 resize-none bg-background p-6 font-mono text-[13px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
      />

      {ac.state.active && (
        <div
          role="listbox"
          aria-label="Link to page"
          className="absolute right-4 bottom-4 left-4 z-20 max-w-md overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center justify-between border-b bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <span>Link to page</span>
            <span className="font-mono">↑↓ · Enter · Esc</span>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {ac.state.items.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-muted-foreground">
                {ac.state.query ? `No pages found for “${ac.state.query}”` : 'Type to search pages…'}
              </li>
            ) : (
              ac.state.items.map((item, i) => (
                <li key={item.path}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === ac.state.selectedIndex}
                    onMouseDown={(e) => e.preventDefault()} // keep textarea focus
                    onMouseEnter={() => ac.setSelectedIndex(i)}
                    onClick={() => ac.select(i)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
                      i === ac.state.selectedIndex && 'bg-accent'
                    )}
                  >
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{item.title}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{item.path}</span>
                    </span>
                    <span className="rounded-sm border px-1 font-mono text-[10px] text-muted-foreground">
                      {item.category}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
