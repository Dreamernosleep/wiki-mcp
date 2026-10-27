import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import type { Category, Page, TemplateInput } from '@/lib/api';
import { slugify } from '@/lib/slug';
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

const GENERAL = '__general__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: Page;
  /** Current editor body (no frontmatter) */
  body: string;
  categories: Category[];
  onCreate: (input: TemplateInput & { id: string }) => Promise<void>;
}

/**
 * Turn a page body into a template body: the page's own H1 becomes {{title}}
 * so the template works for any page.
 */
export function bodyToTemplate(body: string, title: string): string {
  const lines = body.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  if (first !== -1 && lines[first].trim() === `# ${title}`.trim()) {
    lines[first] = '# {{title}}';
  }
  return lines.join('\n');
}

/** Saves the open page as a reusable template in content/_templates. */
export function SaveTemplateDialog({ open, onOpenChange, page, body, categories, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(GENERAL);
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setCategory(page.category_id);
      setIsDefault(false);
    }
  }, [open, page.category_id]);

  const id = slugify(name);
  const hasCategory = category !== GENERAL;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return toast.error('The name must contain at least one letter or number');
    setSubmitting(true);
    try {
      await onCreate({
        id,
        name: name.trim(),
        description: description.trim(),
        category: hasCategory ? category : null,
        default: hasCategory && isDefault,
        body: bodyToTemplate(body, page.title),
      });
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
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Copies the current content of “{page.title}” into a reusable template. The page heading becomes the new
              page’s title.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer profile"
              autoFocus
              required
            />
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              content/_templates/<span className="text-foreground">{id || 'template-name'}</span>.md
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tpl-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tpl-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One page per customer account"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tpl-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                if (v === GENERAL) setIsDefault(false);
              }}
            >
              <SelectTrigger id="tpl-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL}>General (any category)</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} <span className="font-mono text-xs text-muted-foreground">({c.id})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label
            className={`flex items-start gap-2 text-[13px] ${hasCategory ? '' : 'cursor-not-allowed text-muted-foreground'}`}
          >
            <input
              type="checkbox"
              checked={isDefault}
              disabled={!hasCategory}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mt-0.5 size-3.5 accent-primary"
            />
            <span>
              Use as the default for this category
              <span className="block text-[11px] text-muted-foreground">
                Preselected when creating a page there. Replaces the current default, if any.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
