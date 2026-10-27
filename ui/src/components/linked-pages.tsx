import { ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react';

import type { LinkedPages as LinkedPagesData, Page } from '@/lib/api';

interface Props {
  links: LinkedPagesData | null;
  onOpenPage: (category: string, slug: string) => void;
}

export function LinkedPages({ links, onOpenPage }: Props) {
  return (
    <section className="shrink-0 border-t bg-muted/30">
      <div className="flex items-center gap-1.5 px-4 pt-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Link2 className="size-3.5" />
        Linked pages
      </div>
      <div className="grid grid-cols-1 gap-x-6 px-4 pt-1.5 pb-3 sm:grid-cols-2">
        <LinkColumn label="Outgoing" icon={ArrowUpRight} items={links?.outgoing ?? []} onOpenPage={onOpenPage} />
        <LinkColumn label="Incoming" icon={ArrowDownLeft} items={links?.incoming ?? []} onOpenPage={onOpenPage} />
      </div>
    </section>
  );
}

function LinkColumn({
  label,
  icon: Icon,
  items,
  onOpenPage,
}: {
  label: string;
  icon: typeof ArrowUpRight;
  items: Array<{ page: Page; anchor_text: string }>;
  onOpenPage: (category: string, slug: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] text-muted-foreground">
        {label} <span className="font-mono tabular-nums">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground/70">None</div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map(({ page }) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => onOpenPage(page.category_id, page.slug)}
                title={`${page.category_id}/${page.slug}`}
                className="flex max-w-60 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
              >
                <Icon className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{page.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
