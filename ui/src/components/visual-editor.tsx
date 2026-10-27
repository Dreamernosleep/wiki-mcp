import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

import { EditorToolbar } from '@/components/editor-toolbar';
import { WikiLinkHighlight } from '@/lib/editor/wiki-link-highlight';
import { tidyMarkdown } from '@/lib/editor/markdown-output';

const lowlight = createLowlight(common);

interface Props {
  /** Markdown body (no frontmatter) */
  value: string;
  onChange: (markdown: string) => void;
}

/**
 * WYSIWYG editor that round-trips to Markdown. Files on disk stay plain .md;
 * `[[category/slug]]` links are kept as text and only highlighted.
 */
export function VisualEditor({ value, onChange }: Props) {
  // Markdown we last emitted, so external value changes (opening another
  // page) can be told apart from our own updates.
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight below
        underline: false, // no markdown equivalent; keep files HTML-free
        link: { openOnClick: false, autolink: true },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing… Use [[page-slug]] to link to another page.' }),
      WikiLinkHighlight,
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'markdown-body prose-editor mx-auto min-h-full w-full max-w-3xl px-8 py-6 outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const md = tidyMarkdown(editor.getMarkdown());
      lastEmitted.current = md;
      onChange(md);
    },
  });

  // Load new content when a different page is opened (or the markdown
  // source was edited in Markdown mode).
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (value === tidyMarkdown(editor.getMarkdown())) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <EditorToolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && editor.commands.focus('end')}>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  );
}
