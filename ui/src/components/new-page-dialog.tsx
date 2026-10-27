import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import type { Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCreate: (input: { category: string; slug: string; title: string; content: string }) => Promise<void>;
}

export const SLUG_PATTERN = '[a-z0-9-]+';

export function NewPageDialog({ open, onOpenChange, categories, onCreate }: Props) {
  const [category, setCategory] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog opens; default to the first category
  useEffect(() => {
    if (open) {
      setCategory(categories[0]?.id ?? '');
      setSlug('');
      setTitle('');
      setContent('');
    }
  }, [open, categories]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error('Create a category first');
    setSubmitting(true);
    try {
      await onCreate({ category, slug, title, content });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>Pages are markdown files stored in the category folder.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="new-page-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="new-page-category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} <span className="font-mono text-xs text-muted-foreground">({c.id})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-page-slug">Slug</Label>
            <Input
              id="new-page-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="q4-budget"
              pattern={SLUG_PATTERN}
              title="Lowercase letters, numbers, and hyphens only"
              autoFocus
              required
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers, and hyphens. Becomes the file name.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-page-title">Title</Label>
            <Input
              id="new-page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q4 Budget Planning"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-page-content">Content (Markdown)</Label>
            <Textarea
              id="new-page-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'# Q4 Budget Planning\n\nWrite your content here. Use [[links]] to link other pages.'}
              rows={8}
              required
              className="font-mono text-[13px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
