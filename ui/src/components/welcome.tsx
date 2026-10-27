import { BookOpen, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Welcome({ onNewPage }: { onNewPage: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg border bg-muted">
          <BookOpen className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold">No page selected</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a page from the sidebar, search, or create a new one.
        </p>
        <p className="mt-3 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Tip: link pages with{' '}
          <code className="rounded-sm bg-background px-1 font-mono">[[page-slug]]</code> or{' '}
          <code className="rounded-sm bg-background px-1 font-mono">[[category/page-slug]]</code>
        </p>
        <Button className="mt-5" onClick={onNewPage}>
          <Plus className="size-4" />
          Create your first page
        </Button>
      </div>
    </div>
  );
}
