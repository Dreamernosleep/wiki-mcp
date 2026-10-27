import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, FileText, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';

import type { Category, Page, Template } from '@/lib/api';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  categories: Category[];
  pages: Page[];
  templates: Template[];
  currentPage: Page | null;
  currentTemplate: Template | null;
  onOpenPage: (category: string, slug: string) => void;
  onOpenTemplate: (id: string) => void;
  /** Opens the New page dialog with this category preselected */
  onNewPage: (category: string) => void;
  onNewTemplate: () => void;
  onRenameCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}

const TEMPLATES_KEY = '_templates';

export function PageTree({
  categories,
  pages,
  templates,
  currentPage,
  currentTemplate,
  onOpenPage,
  onOpenTemplate,
  onNewPage,
  onNewTemplate,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
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
        return (
          <Section
            key={cat.id}
            id={cat.id}
            label={cat.name}
            title={cat.description || cat.name}
            count={catPages.length}
            open={!collapsed.has(cat.id)}
            onToggle={() => toggle(cat.id)}
            action={
              <>
                <AddButton label={`New page in ${cat.name}`} onClick={() => onNewPage(cat.id)} />
                <CategoryMenu
                  name={cat.name}
                  onRename={() => onRenameCategory(cat)}
                  onDelete={() => onDeleteCategory(cat)}
                />
              </>
            }
          >
            {catPages.length === 0 ? (
              <Empty>No pages</Empty>
            ) : (
              catPages.map((p) => (
                <Item
                  key={p.id}
                  active={currentPage?.id === p.id}
                  title={`${p.category_id}/${p.slug}`}
                  onClick={() => onOpenPage(p.category_id, p.slug)}
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{p.title}</span>
                </Item>
              ))
            )}
          </Section>
        );
      })}

      {/* Templates: content/_templates, editable like pages */}
      <Section
        id={TEMPLATES_KEY}
        label="Templates"
        title="Page templates (content/_templates)"
        count={templates.length}
        open={!collapsed.has(TEMPLATES_KEY)}
        onToggle={() => toggle(TEMPLATES_KEY)}
        action={<AddButton label="New template" onClick={onNewTemplate} />}
      >
        {templates.length === 0 ? (
          <Empty>No templates</Empty>
        ) : (
          templates.map((t) => (
            <Item
              key={t.id}
              active={currentTemplate?.id === t.id}
              title={t.description || `_templates/${t.id}`}
              onClick={() => onOpenTemplate(t.id)}
            >
              <LayoutTemplate className="size-3.5 text-muted-foreground" />
              <span className="truncate">{t.name}</span>
              {t.category && (
                <span
                  className={cn(
                    'ml-auto shrink-0 rounded-sm border px-1 font-mono text-[10px] text-muted-foreground',
                    t.default && 'border-foreground/40 text-foreground'
                  )}
                  title={t.default ? `Default for ${t.category}` : t.category}
                >
                  {t.category}
                  {t.default && ' ★'}
                </span>
              )}
            </Item>
          ))
        )}
      </Section>
    </>
  );
}

function Section({
  id,
  label,
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  id: string;
  label: string;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <SidebarGroup className="py-1" data-section={id}>
        <div className="flex items-center gap-1 pr-1">
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel
              asChild
              className="group/label h-7 min-w-0 flex-1 cursor-pointer select-none justify-start gap-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-sidebar-accent"
            >
              <button type="button" title={title}>
                <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                <span className="truncate">{label}</span>
                <span className="ml-auto rounded-sm bg-sidebar-accent px-1.5 font-mono text-[10px] font-normal tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          {action}
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">{children}</SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

/** The small "+" at the right of a section header */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label={label}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The "…" menu at the right of a category header: rename or delete the folder */
function CategoryMenu({ name, onRename, onDelete }: { name: string; onRename: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Options for ${name}`}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete folder…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="px-7 py-1.5 text-[11px] text-muted-foreground/70">{children}</li>;
}

function Item({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={onClick}
        className="h-7 pl-5 text-[13px] data-[active=true]:font-medium"
        title={title}
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
