import { Columns2, Eye, Pencil, Save, Trash2 } from 'lucide-react';

import type { Page } from '@/lib/api';
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

export type ViewMode = 'edit' | 'preview' | 'split';

interface Props {
  page: Page | null;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
}

export function PageHeader({ page, mode, onModeChange, dirty, saving, onSave, onDelete }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="h-5 md:hidden" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap gap-1.5 text-[13px] sm:gap-1.5">
          {page ? (
            <>
              <BreadcrumbItem>
                <span className="rounded-sm border bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                  {page.category_id}
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate font-medium">
                  {page.title}
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

      {page && (
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            onValueChange={(v) => v && onModeChange(v as ViewMode)}
            aria-label="View mode"
          >
            <ToggleGroupItem value="edit" aria-label="Edit" className="h-7 gap-1.5 px-2.5 text-xs">
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-label="Preview" className="h-7 gap-1.5 px-2.5 text-xs">
              <Eye className="size-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="split" aria-label="Split" className="h-7 gap-1.5 px-2.5 text-xs">
              <Columns2 className="size-3.5" />
              <span className="hidden sm:inline">Split</span>
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
                <AlertDialogTitle>Delete “{page.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the page from the wiki and deletes{' '}
                  <code className="font-mono text-xs">
                    content/{page.category_id}/{page.slug}.md
                  </code>
                  . This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete page
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </header>
  );
}
