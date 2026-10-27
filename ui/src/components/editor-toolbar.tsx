import { useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  editor: Editor;
}

export function EditorToolbar({ editor }: Props) {
  // Re-render only when these change (Tiptap 3 does not re-render on every transaction)
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive('paragraph'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      linkHref: (e.getAttributes('link').href as string | undefined) ?? '',
    }),
  });

  const run = () => editor.chain().focus();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
      <Group>
        <Btn label="Paragraph" active={s.paragraph} onClick={() => run().setParagraph().run()}>
          <Pilcrow />
        </Btn>
        <Btn label="Heading 1" active={s.h1} onClick={() => run().toggleHeading({ level: 1 }).run()}>
          <Heading1 />
        </Btn>
        <Btn label="Heading 2" active={s.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
          <Heading2 />
        </Btn>
        <Btn label="Heading 3" active={s.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>
          <Heading3 />
        </Btn>
      </Group>
      <Sep />
      <Group>
        <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()}>
          <Bold />
        </Btn>
        <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()}>
          <Italic />
        </Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => run().toggleStrike().run()}>
          <Strikethrough />
        </Btn>
        <Btn label="Inline code" active={s.code} onClick={() => run().toggleCode().run()}>
          <Code />
        </Btn>
        <LinkButton editor={editor} active={s.link} href={s.linkHref} />
      </Group>
      <Sep />
      <Group>
        <Btn label="Bullet list" active={s.bulletList} onClick={() => run().toggleBulletList().run()}>
          <List />
        </Btn>
        <Btn label="Numbered list" active={s.orderedList} onClick={() => run().toggleOrderedList().run()}>
          <ListOrdered />
        </Btn>
        <Btn label="Task list" active={s.taskList} onClick={() => run().toggleTaskList().run()}>
          <ListChecks />
        </Btn>
      </Group>
      <Sep />
      <Group>
        <Btn label="Quote" active={s.blockquote} onClick={() => run().toggleBlockquote().run()}>
          <Quote />
        </Btn>
        <Btn label="Code block" active={s.codeBlock} onClick={() => run().toggleCodeBlock().run()}>
          <SquareCode />
        </Btn>
        <Btn
          label="Table"
          onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table2 />
        </Btn>
        <Btn label="Divider" onClick={() => run().setHorizontalRule().run()}>
          <Minus />
        </Btn>
      </Group>
      <div className="ml-auto" />
      <Group>
        <Btn label="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => run().undo().run()}>
          <Undo2 />
        </Btn>
        <Btn label="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={() => run().redo().run()}>
          <Redo2 />
        </Btn>
      </Group>
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Sep() {
  return <Separator orientation="vertical" className="mx-1 h-5" />;
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} // keep editor selection
          onClick={onClick}
          className={cn('size-7 [&_svg]:size-3.5', active && 'bg-accent text-accent-foreground')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkButton({ editor, active, href }: { editor: Editor; active: boolean; href: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const apply = () => {
    const value = url.trim();
    if (!value) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(href);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Link"
              aria-pressed={active}
              onMouseDown={(e) => e.preventDefault()}
              className={cn('size-7 [&_svg]:size-3.5', active && 'bg-accent text-accent-foreground')}
            >
              <Link2 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            className="h-8 text-[13px]"
          />
          <Button type="submit" size="sm" className="h-8">
            {url.trim() ? 'Apply' : 'Remove'}
          </Button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          To link another wiki page, type <code className="font-mono">[[category/slug]]</code> in the text.
        </p>
      </PopoverContent>
    </Popover>
  );
}
