import { Code2, Eye, LayoutTemplate, Pencil, Save, Trash2 } from 'lucide-react';

import type { Page, Template } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** visual = WYSIWYG, markdown = source + live preview, preview = read-only render */
export type ViewMode = 'visual' | 'markdown' | 'preview';

interface Props {
  /** The open page, or null when a template (or nothing) is open */
  page: Page | null;
  /** The open template, or null */
  template: Template | null;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
}

export function PageHeader({
  page,
  template,
  mode,
  onModeChange,
  dirty,
  saving,
  onSave,
  onDelete,
  onSaveAsTemplate,
}: Props) {
  const doc = page ?? template;
  const kind = template ? 'template' : 'page';
  const title = template ? template.name : page?.title;
  const filePath = template ? `content/_templates/${template.id}.md` : page ? `content/${page.category_id}/${page.slug}.md` : '';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="h-5 md:hidden" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap gap-1.5 text-[13px] sm:gap-1.5">
          {doc ? (
            <>
              <BreadcrumbItem>
                <span className="rounded-sm border bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                  {template ? 'templates' : page?.category_id}
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate font-medium">
                  {title}
                  {template?.category && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {template.default ? `default for ${template.category}` : template.category}
                    </span>
                  )}
                  {dirty && <span className="ml-1.5 text-muted-foreground" title="Unsaved changes">•</span>}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <span className="text-muted-foreground">Select a page or create a new one</span>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {doc && (
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            onValueChange={(v) => v && onModeChange(v as ViewMode)}
            aria-label="View mode"
          >
            <ToggleGroupItem value="visual" aria-label="Visual editor" className="h-7 gap-1.5 px-2.5 text-xs">
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">Visual</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="markdown" aria-label="Markdown source" className="h-7 gap-1.5 px-2.5 text-xs">
              <Code2 className="size-3.5" />
              <span className="hidden sm:inline">Markdown</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Preview" className="h-7 gap-1.5 px-2.5 text-xs">
              <Eye className="size-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </ToggleGroupItem>
          </ToggleGroup>

          <Separator orientation="vertical" className="h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={onSave} disabled={saving}>
                <Save className="size-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ctrl+S</TooltipContent>
          </Tooltip>

          {page && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={onSaveAsTemplate}
                  aria-label="Save as template"
                >
                  <LayoutTemplate className="size-3.5" />
                  <span className="hidden lg:inline">Template</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save this page as a template</TooltipContent>
            </Tooltip>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the {kind} from the wiki and deletes{' '}
                  <code className="font-mono text-xs">{filePath}</code>. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete {kind}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </header>
  );
}
