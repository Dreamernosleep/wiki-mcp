import { useState } from 'react';
import { BookOpen, FolderPlus, Plus } from 'lucide-react';

import type { Category, Page, SearchEngine, SearchResult, Template } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchBox } from '@/components/search-box';
import { SearchResults } from '@/components/search-results';
import { PageTree } from '@/components/page-tree';
import { ThemeToggle } from '@/components/theme-toggle';

/** Brand name shown in the sidebar header. Colours live in src/styles/brand.css. */
export const APP_NAME = 'Wiki';
export const APP_TAGLINE = 'Knowledge base';

interface Props {
  categories: Category[];
  pages: Page[];
  templates: Template[];
  currentPage: Page | null;
  currentTemplate: Template | null;
  onOpenPage: (category: string, slug: string) => void;
  onOpenTemplate: (id: string) => void;
  onNewPage: () => void;
  onNewCategory: () => void;
  onNewTemplate: () => void;
}

export function AppSidebar({
  categories,
  pages,
  templates,
  currentPage,
  currentTemplate,
  onOpenPage,
  onOpenTemplate,
  onNewPage,
  onNewCategory,
  onNewTemplate,
}: Props) {
  const [search, setSearch] = useState<{ results: SearchResult[]; engine: SearchEngine } | null>(null);

  const open = (category: string, slug: string) => {
    setSearch(null);
    onOpenPage(category, slug);
  };

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 border-b px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-4" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{APP_NAME}</div>
            <div className="truncate text-[11px] text-muted-foreground">{APP_TAGLINE}</div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={onNewCategory} aria-label="New category">
                <FolderPlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New category</TooltipContent>
          </Tooltip>
        </div>
        <Button size="sm" className="w-full justify-start" onClick={onNewPage}>
          <Plus className="size-4" />
          New page
          <kbd className="ml-auto rounded border border-primary-foreground/30 px-1 font-mono text-[10px] opacity-70">
            Ctrl N
          </kbd>
        </Button>
        <SearchBox onResults={setSearch} onClear={() => setSearch(null)} />
      </SidebarHeader>

      <SidebarContent>
        {search ? (
          <SearchResults results={search.results} engine={search.engine} onOpenPage={open} onClear={() => setSearch(null)} />
        ) : (
          <PageTree
            categories={categories}
            pages={pages}
            templates={templates}
            currentPage={currentPage}
            currentTemplate={currentTemplate}
            onOpenPage={open}
            onOpenTemplate={(id) => {
              setSearch(null);
              onOpenTemplate(id);
            }}
            onNewTemplate={onNewTemplate}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between border-t px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'} · {categories.length}{' '}
          {categories.length === 1 ? 'category' : 'categories'}
        </span>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
