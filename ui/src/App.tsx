import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { api, type Category, type LinkedPages as LinkedPagesData, type Page } from '@/lib/api';
import { extractTitle, stripFrontmatter } from '@/lib/markdown';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { PageHeader, type ViewMode } from '@/components/page-header';
import { Editor } from '@/components/editor';
import { VisualEditor } from '@/components/visual-editor';
import { Preview } from '@/components/preview';
import { LinkedPages } from '@/components/linked-pages';
import { Welcome } from '@/components/welcome';
import { NewPageDialog } from '@/components/new-page-dialog';
import { NewCategoryDialog } from '@/components/new-category-dialog';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [editorText, setEditorText] = useState('');
  const [mode, setMode] = useState<ViewMode>('visual');
  const [links, setLinks] = useState<LinkedPagesData | null>(null);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set when a page was just created so the editor can place the cursor ready to type
  const [freshPage, setFreshPage] = useState(false);

  const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // ---- Data loading -------------------------------------------------------

  const loadCategories = useCallback(async () => setCategories(await api.listCategories()), []);
  const loadPages = useCallback(async () => setPages(await api.listPages()), []);

  useEffect(() => {
    Promise.all([loadCategories(), loadPages()]).catch((e) => toast.error(errorMessage(e)));
  }, [loadCategories, loadPages]);

  const loadLinks = useCallback(async (page: Page) => {
    try {
      setLinks(await api.getLinks(page.category_id, page.slug));
    } catch (e) {
      console.error('Failed to load links:', e);
      setLinks(null);
    }
  }, []);

  // ---- Page actions -------------------------------------------------------

  const openPage = useCallback(
    async (category: string, slug: string, fresh = false) => {
      try {
        const page = await api.getPage(category, slug);
        setFreshPage(fresh);
        setCurrentPage(page);
        // Edit the body only; the server owns the frontmatter block
        setEditorText(stripFrontmatter(page.raw_markdown || page.content));
        void loadLinks(page);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [loadLinks]
  );

  const closePage = useCallback(() => {
    setCurrentPage(null);
    setEditorText('');
    setLinks(null);
  }, []);

  const savePage = useCallback(async () => {
    if (!currentPage || saving) return;
    setSaving(true);
    try {
      const title = extractTitle(editorText, currentPage.title);
      const updated = await api.updatePage(currentPage.category_id, currentPage.slug, {
        title,
        content: editorText,
      });
      toast.success('Page saved');
      setCurrentPage({ ...currentPage, ...updated, title, content: editorText, raw_markdown: null });
      await loadPages();
      void loadLinks(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [currentPage, editorText, saving, loadPages, loadLinks]);

  const deletePage = useCallback(async () => {
    if (!currentPage) return;
    try {
      await api.deletePage(currentPage.category_id, currentPage.slug);
      toast.success('Page deleted');
      closePage();
      await loadPages();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [currentPage, closePage, loadPages]);

  const createPage = useCallback(
    async (input: { category: string; slug: string; title: string }) => {
      // Start the body with the title as a heading; the rest is written in the visual editor
      await api.createPage({ ...input, content: `# ${input.title}\n\n` });
      toast.success('Page created');
      await loadPages();
      setMode('visual');
      await openPage(input.category, input.slug, true);
    },
    [loadPages, openPage]
  );

  const createCategory = useCallback(
    async (input: { id: string; name: string; description: string }) => {
      await api.createCategory(input);
      toast.success(`Category "${input.name}" created`);
      await Promise.all([loadCategories(), loadPages()]);
    },
    [loadCategories, loadPages]
  );

  // ---- Keyboard shortcuts -------------------------------------------------

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentPage) void savePage();
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewPageOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, savePage]);

  // ---- Render -------------------------------------------------------------

  const dirty =
    currentPage !== null && editorText !== stripFrontmatter(currentPage.raw_markdown || currentPage.content);

  return (
    <SidebarProvider style={{ '--sidebar-width': '17rem' } as CSSProperties}>
      <AppSidebar
        categories={categories}
        pages={pages}
        currentPage={currentPage}
        onOpenPage={openPage}
        onNewPage={() => setNewPageOpen(true)}
        onNewCategory={() => setNewCategoryOpen(true)}
      />

      <SidebarInset className="h-svh overflow-hidden">
        <PageHeader
          page={currentPage}
          mode={mode}
          onModeChange={setMode}
          dirty={dirty}
          saving={saving}
          onSave={savePage}
          onDelete={deletePage}
        />

        {currentPage ? (
          <>
            <div className="flex min-h-0 flex-1">
              {mode === 'visual' && (
                <VisualEditor
                  key={currentPage.id}
                  value={editorText}
                  onChange={setEditorText}
                  pages={pages}
                  autofocus={freshPage ? 'end' : false}
                />
              )}
              {mode === 'markdown' && (
                <>
                  <div className="flex min-w-0 flex-1 border-r">
                    <Editor value={editorText} onChange={setEditorText} pages={pages} />
                  </div>
                  <div className="hidden min-w-0 flex-1 lg:flex">
                    <Preview markdown={editorText} onOpenPage={openPage} />
                  </div>
                </>
              )}
              {mode === 'preview' && (
                <div className="flex min-w-0 flex-1">
                  <Preview markdown={editorText} onOpenPage={openPage} />
                </div>
              )}
            </div>
            <LinkedPages links={links} onOpenPage={openPage} />
          </>
        ) : (
          <Welcome onNewPage={() => setNewPageOpen(true)} />
        )}
      </SidebarInset>

      <NewPageDialog open={newPageOpen} onOpenChange={setNewPageOpen} categories={categories} onCreate={createPage} />
      <NewCategoryDialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen} onCreate={createCategory} />
    </SidebarProvider>
  );
}
