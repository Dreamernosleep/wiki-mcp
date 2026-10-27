import { useMemo, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';

import type { Category, Page } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface Props {
  categories: Category[];
  pages: Page[];
  currentPage: Page | null;
  onOpenPage: (category: string, slug: string) => void;
}

export function PageTree({ categories, pages, currentPage, onOpenPage }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const byCategory = useMemo(() => {
    const map = new Map<string, Page[]>();
    for (const p of pages) {
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return map;
  }, [pages]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (categories.length === 0) {
    return <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</p>;
  }

  return (
    <>
      {categories.map((cat) => {
        const catPages = byCategory.get(cat.id) ?? [];
        const open = !collapsed.has(cat.id);
        return (
          <Collapsible key={cat.id} open={open} onOpenChange={() => toggle(cat.id)}>
            <SidebarGroup className="py-1">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel
                  asChild
                  className="group/label h-7 cursor-pointer select-none justify-start gap-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-sidebar-accent"
                >
                  <button type="button" title={cat.description || cat.name}>
                    <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto rounded-sm bg-sidebar-accent px-1.5 font-mono text-[10px] font-normal tabular-nums text-muted-foreground">
                      {catPages.length}
                    </span>
                  </button>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-px">
                    {catPages.length === 0 ? (
                      <li className="px-7 py-1.5 text-[11px] text-muted-foreground/70">No pages</li>
                    ) : (
                      catPages.map((p) => {
                        const active = currentPage?.id === p.id;
                        return (
                          <SidebarMenuItem key={p.id}>
                            <SidebarMenuButton
                              isActive={active}
                              onClick={() => onOpenPage(p.category_id, p.slug)}
                              className="h-7 pl-5 text-[13px] data-[active=true]:font-medium"
                              title={`${p.category_id}/${p.slug}`}
                            >
                              <FileText className="size-3.5 text-muted-foreground" />
                              <span className="truncate">{p.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}
    </>
  );
}
