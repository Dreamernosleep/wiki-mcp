import { FileText } from 'lucide-react';

import type { Category, SearchEngine, SearchResult } from '@/lib/api';
import { sanitizeHighlight } from '@/lib/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from '@/components/ui/sidebar';

interface Props {
  results: SearchResult[];
  engine: SearchEngine;
  /** The folder the search was limited to, if any */
  category?: Category | null;
  onOpenPage: (category: string, slug: string) => void;
  onClear: () => void;
}

const SNIPPET_LENGTH = 150;

export function SearchResults({ results, engine, category, onOpenPage, onClear }: Props) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="justify-between pr-0">
        <span className="flex items-center gap-2">
          {results.length} {results.length === 1 ? 'result' : 'results'}
          {category && <span className="font-normal normal-case text-muted-foreground">in {category.name}</span>}
          <Badge variant="outline" className="h-4 px-1 font-mono text-[10px] font-normal uppercase">
            {engine}
          </Badge>
        </span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClear}>
          Clear
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {category ? `No results in ${category.name}` : 'No results found'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((r) => {
              const title = r._formatted?.title ? sanitizeHighlight(r._formatted.title) : escapeHtml(r.title);
              const snippetSrc = r._formatted?.content ?? r.content ?? '';
              const snippet = sanitizeHighlight(snippetSrc.slice(0, SNIPPET_LENGTH)) + (snippetSrc.length > SNIPPET_LENGTH ? '…' : '');
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPage(r.category, r.slug)}
                    className="flex w-full flex-col gap-0.5 rounded-md border bg-background px-2.5 py-2 text-left hover:bg-accent"
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate" dangerouslySetInnerHTML={{ __html: title }} />
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.path}</span>
                    <span
                      className="line-clamp-2 text-[11px] leading-4 text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: snippet }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
