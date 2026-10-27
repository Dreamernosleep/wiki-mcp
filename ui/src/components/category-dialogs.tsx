import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import type { Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Rename a category: display name and description. The folder name (id) never changes. */
export function RenameCategoryDialog({
  category,
  open,
  onOpenChange,
  onSave,
}: {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, input: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setDescription(category.description ?? '');
    }
  }, [open, category]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setSubmitting(true);
    try {
      await onSave(category.id, { name: name.trim(), description: description.trim() });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>
              The folder <code className="font-mono">content/{category?.id}/</code> and its pages stay as they are; only the
              name shown in the sidebar changes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="rename-category-name">Name</Label>
            <Input
              id="rename-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rename-category-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="rename-category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a category and every page in it. */
export function DeleteCategoryDialog({
  category,
  pageCount,
  open,
  onOpenChange,
  onConfirm,
}: {
  category: Category | null;
  pageCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!category) return;
    setSubmitting(true);
    try {
      await onConfirm(category.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{category?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {pageCount === 0 ? (
              <>The empty folder </>
            ) : (
              <>
                This deletes the folder and <strong>all {pageCount === 1 ? '1 page' : `${pageCount} pages`}</strong> in it:{' '}
              </>
            )}
            <code className="font-mono">content/{category?.id}/</code> will be removed from disk. Links from other pages
            to these pages will stop resolving. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {submitting ? 'Deleting…' : pageCount === 0 ? 'Delete folder' : `Delete folder and ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
