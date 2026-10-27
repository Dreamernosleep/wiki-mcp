import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { id: string; name: string; description: string }) => Promise<void>;
}

/** "Product Team" -> "product-team" (same rule as the original UI). */
export function toCategoryId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function NewCategoryDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idEdited, setIdEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setId('');
      setIdEdited(false);
      setDescription('');
    }
  }, [open]);

  const onNameChange = (value: string) => {
    setName(value);
    if (!idEdited) setId(toCategoryId(value));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({ id, name, description });
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
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Categories are folders that organise your wiki pages.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input
              id="new-category-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Engineering"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-category-id">Category ID</Label>
            <Input
              id="new-category-id"
              value={id}
              onChange={(e) => {
                setIdEdited(true);
                setId(e.target.value);
              }}
              placeholder="engineering"
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
              required
              className="font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens. Becomes the folder name under <code className="font-mono">content/</code>.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-category-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="new-category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical documentation and architecture"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
