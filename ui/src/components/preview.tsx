import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
// Common-languages bundle (~40 languages) instead of the full 190-language build
import hljs from 'highlight.js/lib/common';

import { renderMarkdown } from '@/lib/markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  markdown: string;
  onOpenPage: (category: string, slug: string) => void;
}

/** Rendered markdown. Wiki links (wiki://category/slug) open pages in-app. */
export function Preview({ markdown, onOpenPage }: Props) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('pre code').forEach((block) => {
      if (!block.dataset.highlighted) hljs.highlightElement(block);
    });
  }, [html]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (!href?.startsWith('wiki://')) return;
    e.preventDefault();
    const [category, slug] = href.slice('wiki://'.length).split('/');
    if (category && slug) onOpenPage(category, slug);
  };

  return (
    <ScrollArea className="h-full w-full">
      <div
        ref={ref}
        onClick={onClick}
        className="markdown-body mx-auto max-w-3xl px-8 py-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  );
}
