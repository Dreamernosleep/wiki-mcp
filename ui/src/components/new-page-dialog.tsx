import { useEffect, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { api, type Category, type Template } from '@/lib/api';
import { SLUG_PATTERN, SLUG_RULE, slugify } from '@/lib/slug';
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

const BLANK = '__blank__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  /** `template` is a template id; undefined = blank page */
  onCreate: (input: { category: string; slug: string; title: string; template?: string }) => Promise<void>;
}

export function NewPageDialog({ open, onOpenChange, categories, onCreate }: Props) {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false); // user typed a custom slug
  const [slugEditing, setSlugEditing] = useState(false); // slug input is visible
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog opens; default to the first category
  useEffect(() => {
    if (open) {
      setCategory(categories[0]?.id ?? '');
      setTitle('');
      setSlug('');
      setSlugEdited(false);
      setSlugEditing(false);
      setTemplate(BLANK);
      api
        .listTemplates()
        .then(setTemplates)
        .catch((err) => {
          setTemplates([]);
          toast.error(`Could not load templates: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
  }, [open, categories]);

  // Templates offered for the chosen category: general ones first, then the category's own
  const offered = [
    ...templates.filter((t) => !t.category),
    ...templates.filter((t) => t.category === category),
  ];

  // Preselect the category's default template (or blank) whenever the category changes
  useEffect(() => {
    const def = templates.find((t) => t.category === category && t.default);
    setTemplate(def ? def.id : BLANK);
  }, [category, templates]);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const onSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(value);
  };

  const resetSlug = () => {
    setSlugEdited(false);
    setSlug(slugify(title));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) return toast.error('Create a category first');
    if (!slug) return toast.error('The title must contain at least one letter or number');
    setSubmitting(true);
    try {
      await onCreate({ category, slug, title, template: template === BLANK ? undefined : template });
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
            <DialogDescription>The page opens in the editor right after it is created.</DialogDescription>
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

          {offered.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="new-page-template">Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger id="new-page-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BLANK}>Blank page</SelectItem>
                  {offered.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.description && (
                        <span className="ml-1.5 text-xs text-muted-foreground">— {t.description}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="new-page-title">Title</Label>
            <Input
              id="new-page-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Q4 Budget Planning"
              autoFocus
              required
            />
          </div>

          {/* Slug: derived from the title, shown read-only until the user chooses to edit it */}
          <div className="grid gap-1.5">
            <Label htmlFor="new-page-slug">File name</Label>
            {slugEditing ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-page-slug"
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value)}
                    placeholder="q4-budget-planning"
                    pattern={SLUG_PATTERN}
                    title={SLUG_RULE}
                    autoFocus
                    required
                    className="font-mono"
                  />
                  {slugEdited && (
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={resetSlug}>
                      Reset
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{SLUG_RULE}.</p>
              </>
            ) : (
              <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {category || 'category'}/<span className="text-foreground">{slug || 'page-title'}</span>.md
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                  onClick={() => setSlugEditing(true)}
                  aria-label="Edit file name"
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              </div>
            )}
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
