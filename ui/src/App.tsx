import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import {
  api,
  type Category,
  type LinkedPages as LinkedPagesData,
  type Page,
  type Template,
  type TemplateInput,
} from '@/lib/api';
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
import { DeleteCategoryDialog, RenameCategoryDialog } from '@/components/category-dialogs';
import { SaveTemplateDialog } from '@/components/save-template-dialog';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  // The editor shows either a page or a template, never both
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [editorText, setEditorText] = useState('');
  const [mode, setMode] = useState<ViewMode>('visual');
  const [links, setLinks] = useState<LinkedPagesData | null>(null);
  // New page dialog: closed, or open with an optional preselected category
  const [newPage, setNewPage] = useState<{ open: boolean; category?: string }>({ open: false });
  const openNewPage = useCallback((category?: string) => setNewPage({ open: true, category }), []);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  // Rename / delete a category from its sidebar menu
  const [categoryAction, setCategoryAction] = useState<{ kind: 'rename' | 'delete'; category: Category } | null>(null);
  // Save-as-template (from the open page) or new template (from the sidebar)
  const [templateDialog, setTemplateDialog] = useState<'closed' | 'from-page' | 'new'>('closed');
  const [saving, setSaving] = useState(false);
  // Set when a document was just created so the editor can place the cursor ready to type
  const [fresh, setFresh] = useState(false);

  const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // ---- Data loading -------------------------------------------------------

  const loadCategories = useCallback(async () => setCategories(await api.listCategories()), []);
  const loadPages = useCallback(async () => setPages(await api.listPages()), []);
  const loadTemplates = useCallback(async () => setTemplates(await api.listTemplates()), []);

  useEffect(() => {
    Promise.all([loadCategories(), loadPages(), loadTemplates()]).catch((e) => toast.error(errorMessage(e)));
  }, [loadCategories, loadPages, loadTemplates]);

  const loadLinks = useCallback(async (page: Page) => {
    try {
      setLinks(await api.getLinks(page.category_id, page.slug));
    } catch (e) {
      console.error('Failed to load links:', e);
      setLinks(null);
    }
  }, []);

  // ---- Open / close -------------------------------------------------------

  const openPage = useCallback(
    async (category: string, slug: string, isFresh = false) => {
      try {
        const page = await api.getPage(category, slug);
        setFresh(isFresh);
        setCurrentTemplate(null);
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

  const openTemplate = useCallback(async (id: string, isFresh = false) => {
    try {
      const template = await api.getTemplate(id);
      setFresh(isFresh);
      setCurrentPage(null);
      setLinks(null);
      setCurrentTemplate(template);
      setEditorText(template.body);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, []);

  const closeDocument = useCallback(() => {
    setCurrentPage(null);
    setCurrentTemplate(null);
    setEditorText('');
    setLinks(null);
  }, []);

  // ---- Save / delete (page or template) -----------------------------------

  const saveDocument = useCallback(async () => {
    if (saving) return;
    if (currentTemplate) {
      setSaving(true);
      try {
        const updated = await api.updateTemplate(currentTemplate.id, { body: editorText });
        toast.success('Template saved');
        setCurrentTemplate(updated);
        setEditorText(updated.body);
        await loadTemplates();
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!currentPage) return;
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
  }, [currentPage, currentTemplate, editorText, saving, loadPages, loadTemplates, loadLinks]);

  const deleteDocument = useCallback(async () => {
    try {
      if (currentTemplate) {
        await api.deleteTemplate(currentTemplate.id);
        toast.success('Template deleted');
        closeDocument();
        await loadTemplates();
      } else if (currentPage) {
        await api.deletePage(currentPage.category_id, currentPage.slug);
        toast.success('Page deleted');
        closeDocument();
        await loadPages();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [currentPage, currentTemplate, closeDocument, loadPages, loadTemplates]);

  // ---- Create -------------------------------------------------------------

  const createPage = useCallback(
    async (input: { category: string; slug: string; title: string; template?: string }) => {
      const { template, ...page } = input;
      // From a template, or a blank body with the title as heading; the rest is written in the visual editor
      await api.createPage(template ? { ...page, template } : { ...page, content: `# ${input.title}\n\n` });
      toast.success('Page created');
      await loadPages();
      setMode('visual');
      await openPage(input.category, input.slug, true);
    },
    [loadPages, openPage]
  );

  const createTemplate = useCallback(
    async (input: TemplateInput & { id: string }, openAfter: boolean) => {
      const template = await api.createTemplate(input);
      toast.success(`Template "${template.name}" saved`);
      await loadTemplates();
      if (openAfter) {
        setMode('visual');
        await openTemplate(template.id, true);
      }
    },
    [loadTemplates, openTemplate]
  );

  const createCategory = useCallback(
    async (input: { id: string; name: string; description: string }) => {
      await api.createCategory(input);
      toast.success(`Category "${input.name}" created`);
      await Promise.all([loadCategories(), loadPages()]);
    },
    [loadCategories, loadPages]
  );

  const renameCategory = useCallback(
    async (id: string, input: { name: string; description: string }) => {
      await api.updateCategory(id, input);
      toast.success(`Category renamed to "${input.name}"`);
      await Promise.all([loadCategories(), loadPages()]);
    },
    [loadCategories, loadPages]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const { pagesRemoved } = await api.deleteCategory(id, true);
      toast.success(pagesRemoved === 0 ? 'Category deleted' : `Category and ${pagesRemoved} page${pagesRemoved === 1 ? '' : 's'} deleted`);
      if (currentPage?.category_id === id) closeDocument();
      await Promise.all([loadCategories(), loadPages()]);
    },
    [currentPage, closeDocument, loadCategories, loadPages]
  );

  // ---- Keyboard shortcuts -------------------------------------------------

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveDocument();
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        // Ctrl+N from an open page starts in that page's category
        openNewPage(currentPage?.category_id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDocument, openNewPage, currentPage]);

  // ---- Render -------------------------------------------------------------

  const original = currentTemplate
    ? currentTemplate.body
    : currentPage
      ? stripFrontmatter(currentPage.raw_markdown || currentPage.content)
      : null;
  const dirty = original !== null && editorText !== original;
  const documentKey = currentTemplate ? `template:${currentTemplate.id}` : currentPage ? currentPage.id : null;

  return (
    <SidebarProvider style={{ '--sidebar-width': '17rem' } as CSSProperties}>
      <AppSidebar
        categories={categories}
        pages={pages}
        templates={templates}
        currentPage={currentPage}
        currentTemplate={currentTemplate}
        onOpenPage={openPage}
        onOpenTemplate={openTemplate}
        onNewPage={openNewPage}
        onNewCategory={() => setNewCategoryOpen(true)}
        onNewTemplate={() => setTemplateDialog('new')}
        onRenameCategory={(category) => setCategoryAction({ kind: 'rename', category })}
        onDeleteCategory={(category) => setCategoryAction({ kind: 'delete', category })}
      />

      <SidebarInset className="h-svh overflow-hidden">
        <PageHeader
          page={currentPage}
          template={currentTemplate}
          mode={mode}
          onModeChange={setMode}
          dirty={dirty}
          saving={saving}
          onSave={saveDocument}
          onDelete={deleteDocument}
          onSaveAsTemplate={() => setTemplateDialog('from-page')}
        />

        {documentKey ? (
          <>
            <div className="flex min-h-0 flex-1">
              {mode === 'visual' && (
                <VisualEditor
                  key={documentKey}
                  value={editorText}
                  onChange={setEditorText}
                  pages={pages}
                  autofocus={fresh ? 'end' : false}
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
            {currentPage && <LinkedPages links={links} onOpenPage={openPage} />}
          </>
        ) : (
          <Welcome onNewPage={() => openNewPage()} />
        )}
      </SidebarInset>

      <NewPageDialog
        open={newPage.open}
        onOpenChange={(open) => setNewPage((s) => ({ ...s, open }))}
        categories={categories}
        initialCategory={newPage.category}
        onCreate={createPage}
      />
      <NewCategoryDialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen} onCreate={createCategory} />
      <RenameCategoryDialog
        open={categoryAction?.kind === 'rename'}
        onOpenChange={(open) => !open && setCategoryAction(null)}
        category={categoryAction?.category ?? null}
        onSave={renameCategory}
      />
      <DeleteCategoryDialog
        open={categoryAction?.kind === 'delete'}
        onOpenChange={(open) => !open && setCategoryAction(null)}
        category={categoryAction?.category ?? null}
        pageCount={categoryAction ? pages.filter((p) => p.category_id === categoryAction.category.id).length : 0}
        onConfirm={deleteCategory}
      />
      <SaveTemplateDialog
        open={templateDialog !== 'closed'}
        onOpenChange={(open) => !open && setTemplateDialog('closed')}
        // From the open page: copy its body. From the sidebar: start a new template
        page={templateDialog === 'from-page' ? currentPage : null}
        body={templateDialog === 'from-page' ? editorText : ''}
        categories={categories}
        onCreate={(input) => createTemplate(input, templateDialog === 'new')}
      />
    </SidebarProvider>
  );
}
