// Wiki MCP - Web UI Application

// Configuration
const API_URL = window.API_URL || 'http://localhost:3000/api';

// State
let categories = [];
let pages = [];
let currentPage = null;
let currentMode = 'edit'; // 'edit', 'preview', 'split'
let searchTimeout = null;

// DOM Elements
const els = {
    pageTree: document.getElementById('page-tree'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    searchSuggestions: document.getElementById('search-suggestions'),
    breadcrumb: document.getElementById('breadcrumb'),
    contentArea: document.getElementById('content-area'),
    welcome: document.getElementById('welcome'),
    editorContainer: document.getElementById('editor-container'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    linkedPages: document.getElementById('linked-pages'),
    outgoingLinks: document.getElementById('outgoing-links'),
    incomingLinks: document.getElementById('incoming-links'),
    saveBtn: document.getElementById('save-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    editBtn: document.getElementById('edit-btn'),
    previewBtn: document.getElementById('preview-btn'),
    splitBtn: document.getElementById('split-btn'),
    newPageBtn: document.getElementById('new-page-btn'),
    newCategoryBtn: document.getElementById('new-category-btn'),
    modal: document.getElementById('modal'),
    categoryModal: document.getElementById('category-modal'),
    toast: document.getElementById('toast'),
    wikiAutocomplete: document.getElementById('wiki-autocomplete'),
    autocompleteList: document.getElementById('autocomplete-list'),
};

// Wiki link autocomplete state
let autocompleteState = {
    active: false,
    startPos: -1,      // Position of [[ in the text
    query: '',         // Text typed after [[
    selectedIndex: 0,
    items: [],         // Suggested pages
};

// ==================== API ====================

async function api(path, options = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || res.statusText);
    }
    return res.json();
}

// ==================== INITIALIZATION ====================

async function init() {
    await loadCategories();
    await loadPages();
    setupEventListeners();
    showToast('Wiki loaded', 'success');
}

async function loadCategories() {
    categories = await api('/categories');
}

async function loadPages() {
    pages = await api('/pages');
    renderPageTree();
}

// ==================== PAGE TREE ====================

function renderPageTree() {
    const html = categories.map(cat => {
        const catPages = pages.filter(p => p.category_id === cat.id);
        return `
            <div class="category" data-category="${cat.id}">
                <div class="category-header" onclick="toggleCategory('${cat.id}')">
                    <span>📁</span>
                    <span>${cat.name}</span>
                    <span style="margin-left: auto; font-size: 11px;">${catPages.length}</span>
                </div>
                <div class="category-pages" id="cat-${cat.id}">
                    ${catPages.map(p => `
                        <div class="page-item ${currentPage?.category_id === p.category_id && currentPage?.slug === p.slug ? 'active' : ''}"
                             onclick="openPage('${p.category_id}', '${p.slug}')">
                            <span class="icon">📄</span>
                            <span>${p.title}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    els.pageTree.innerHTML = html || '<div class="loading">No pages yet</div>';
}

function toggleCategory(catId) {
    const el = document.getElementById(`cat-${catId}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ==================== OPEN PAGE ====================

async function openPage(category, slug) {
    try {
        currentPage = await api(`/pages/${category}/${slug}`);
        showEditor();
        renderPage();
        loadLinkedPages();
        renderPageTree(); // Update active state
        hideSearchResults();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showEditor() {
    els.welcome.classList.add('hidden');
    els.editorContainer.classList.remove('hidden');
    els.saveBtn.classList.remove('hidden');
    els.deleteBtn.classList.remove('hidden');
    els.linkedPages.classList.remove('hidden');
    setMode('preview');  // Default to preview mode
}

function renderPage() {
    if (!currentPage) return;

    // Breadcrumb
    els.breadcrumb.innerHTML = `
        <span class="category-badge">${currentPage.category_id}</span>
        <span>${currentPage.title}</span>
    `;

    // Editor content (use raw markdown if available, otherwise content)
    els.editor.value = currentPage.raw_markdown || currentPage.content;
    updatePreview();
}

// ==================== PREVIEW ====================

function updatePreview() {
    const markdown = els.editor.value;
    // Remove frontmatter for preview
    const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');

    console.log('[Preview] Rendering, marked loaded:', typeof marked !== 'undefined');

    // Check if marked.js is loaded
    if (typeof marked === 'undefined') {
        // Fallback: show raw text in a pre tag with error message
        els.preview.innerHTML = '<div style="color: var(--danger); padding: 20px;">⚠️ marked.js not loaded! Showing raw text:</div>' +
            '<pre style="white-space: pre-wrap; font-family: inherit;">' +
            withoutFrontmatter.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        return;
    }

    // Convert wiki links [[category/slug]] or [[slug]] to markdown links
    // This must happen BEFORE marked.parse() so marked renders them as <a> tags
    const withWikiLinks = withoutFrontmatter.replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (match, target, anchor) => {
            const text = anchor || target;
            // Use wiki:// protocol so we can intercept clicks
            return `[${text}](wiki://${target})`;
        }
    );

    console.log('[Preview] Wiki links converted, sample:', withWikiLinks.substring(0, 200));

    els.preview.innerHTML = marked.parse(withWikiLinks);

    // Highlight code blocks if hljs is loaded
    if (typeof hljs !== 'undefined') {
        els.preview.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    // Make wiki links clickable
    makeLinksClickable(els.preview);

    const linkCount = els.preview.querySelectorAll('a[href^="wiki://"]').length;
    console.log('[Preview] Wiki links found:', linkCount);
}

function makeLinksClickable(container) {
    const links = container.querySelectorAll('a[href^="wiki://"]');
    console.log('[Links] Found', links.length, 'wiki links to make clickable');
    links.forEach((link, index) => {
        const href = link.getAttribute('href');
        console.log('[Links] Link', index, ':', href);
        if (href && href.startsWith('wiki://')) {
            // Style as wiki link
            link.style.color = 'var(--accent)';
            link.style.textDecoration = 'underline';
            link.style.cursor = 'pointer';

            link.onclick = (e) => {
                e.preventDefault();
                console.log('[Links] Clicked:', href);
                const path = href.replace('wiki://', '');
                const [category, slug] = path.split('/');
                console.log('[Links] Opening:', category, slug);
                openPage(category, slug);
            };
        }
    });
}

// ==================== MODE SWITCHING ====================

function setMode(mode) {
    currentMode = mode;
    els.contentArea.className = 'content-area';

    // Update buttons
    els.editBtn.classList.toggle('active', mode === 'edit');
    els.previewBtn.classList.toggle('active', mode === 'preview');
    els.splitBtn.classList.toggle('active', mode === 'split');

    // Update layout
    switch (mode) {
        case 'edit':
            els.contentArea.classList.add('edit-only');
            break;
        case 'preview':
            els.contentArea.classList.add('preview-only');
            updatePreview();
            break;
        case 'split':
            els.contentArea.classList.add('split');
            updatePreview();
            break;
    }
}

// ==================== SAVE / DELETE ====================

async function savePage() {
    if (!currentPage) return;

    try {
        const content = els.editor.value;
        // Extract title from frontmatter or first heading
        const titleMatch = content.match(/^title:\s*(.+)$/m) || content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : currentPage.title;

        await api(`/pages/${currentPage.category_id}/${currentPage.slug}`, {
            method: 'PUT',
            body: JSON.stringify({ title, content }),
        });

        showToast('Page saved!', 'success');
        await loadPages();
        currentPage.title = title;
        renderPage();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deletePage() {
    if (!currentPage) return;
    if (!confirm(`Delete "${currentPage.title}"? This cannot be undone.`)) return;

    try {
        await api(`/pages/${currentPage.category_id}/${currentPage.slug}`, {
            method: 'DELETE',
        });

        showToast('Page deleted', 'success');
        currentPage = null;
        els.welcome.classList.remove('hidden');
        els.editorContainer.classList.add('hidden');
        els.saveBtn.classList.add('hidden');
        els.deleteBtn.classList.add('hidden');
        els.linkedPages.classList.add('hidden');
        els.breadcrumb.innerHTML = '<span class="placeholder">Select a page or create a new one</span>';
        await loadPages();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== SEARCH ====================

async function performSearch(query) {
    if (!query || query.length < 2) {
        hideSearchResults();
        return;
    }

    try {
        const data = await api(`/search?q=${encodeURIComponent(query)}&limit=10`);
        showSearchResults(data.results, data.engine);
    } catch (error) {
        console.error('Search error:', error);
    }
}

function showSearchResults(results, engine) {
    els.pageTree.classList.add('hidden');
    els.searchResults.classList.remove('hidden');

    if (results.length === 0) {
        els.searchResults.innerHTML = '<div class="loading">No results found</div>';
        return;
    }

    els.searchResults.innerHTML = `
        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
            ${results.length} results (${engine})
        </div>
        ${results.map(r => `
            <div class="search-result" onclick="openPage('${r.category}', '${r.slug}')">
                <h5>${r._formatted?.title || r.title}</h5>
                <p>${r._formatted?.content ? r._formatted.content.substring(0, 150) : (r.content || '').substring(0, 150)}...</p>
            </div>
        `).join('')}
    `;
}

function hideSearchResults() {
    els.searchResults.classList.add('hidden');
    els.pageTree.classList.remove('hidden');
    els.searchInput.value = '';
}

async function loadSuggestions(query) {
    if (query.length < 2) {
        els.searchSuggestions.classList.add('hidden');
        return;
    }

    try {
        const data = await api(`/search/suggest?q=${encodeURIComponent(query)}`);
        if (data.suggestions.length > 0) {
            els.searchSuggestions.innerHTML = data.suggestions
                .map(s => `<div onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">${s}</div>`)
                .join('');
            els.searchSuggestions.classList.remove('hidden');
        } else {
            els.searchSuggestions.classList.add('hidden');
        }
    } catch (error) {
        els.searchSuggestions.classList.add('hidden');
    }
}

// ==================== LINKED PAGES ====================

async function loadLinkedPages() {
    if (!currentPage) return;

    try {
        const data = await api(`/pages/${currentPage.category_id}/${currentPage.slug}/links`);

        els.outgoingLinks.innerHTML = data.outgoing.length > 0
            ? data.outgoing.map(l => `<li><a onclick="openPage('${l.page.category_id}', '${l.page.slug}')">${l.page.title}</a></li>`).join('')
            : '<li style="color: var(--text-secondary)">None</li>';

        els.incomingLinks.innerHTML = data.incoming.length > 0
            ? data.incoming.map(l => `<li><a onclick="openPage('${l.page.category_id}', '${l.page.slug}')">${l.page.title}</a></li>`).join('')
            : '<li style="color: var(--text-secondary)">None</li>';
    } catch (error) {
        console.error('Failed to load links:', error);
    }
}

// ==================== NEW PAGE MODAL ====================

function openModal() {
    // Populate category dropdown dynamically
    const select = document.getElementById('new-category');
    select.innerHTML = categories.map(c =>
        `<option value="${c.id}">${c.name} (${c.id})</option>`
    ).join('');
    els.modal.classList.remove('hidden');
    document.getElementById('new-slug').focus();
}

function closeModal() {
    els.modal.classList.add('hidden');
    document.getElementById('new-page-form').reset();
}

async function createPage(e) {
    e.preventDefault();

    const category = document.getElementById('new-category').value;
    const slug = document.getElementById('new-slug').value;
    const title = document.getElementById('new-title').value;
    const content = document.getElementById('new-content').value;

    try {
        await api('/pages', {
            method: 'POST',
            body: JSON.stringify({ category, slug, title, content }),
        });

        closeModal();
        showToast('Page created!', 'success');
        await loadPages();
        openPage(category, slug);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== CATEGORY MODAL ====================

function openCategoryModal() {
    els.categoryModal.classList.remove('hidden');
    document.getElementById('cat-name').focus();
}

function closeCategoryModal() {
    els.categoryModal.classList.add('hidden');
    document.getElementById('new-category-form').reset();
}

async function createCategory(e) {
    e.preventDefault();

    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value;
    const description = document.getElementById('cat-description').value;

    try {
        await api('/categories', {
            method: 'POST',
            body: JSON.stringify({ id, name, description }),
        });

        closeCategoryModal();
        showToast(`Category "${name}" created!`, 'success');
        await loadCategories();
        await loadPages(); // Refresh to show new category in tree
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== TOAST ====================

let toastTimeout = null;

function showToast(message, type = 'success') {
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        els.toast.classList.add('hidden');
    }, 3000);
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // New page
    els.newPageBtn.addEventListener('click', openModal);
    document.getElementById('new-page-form').addEventListener('submit', createPage);

    // New category
    els.newCategoryBtn.addEventListener('click', openCategoryModal);
    document.getElementById('new-category-form').addEventListener('submit', createCategory);

    // Auto-generate category ID from name
    document.getElementById('cat-name').addEventListener('input', (e) => {
        const name = e.target.value;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        document.getElementById('cat-id').value = id;
    });

    // Save / Delete
    els.saveBtn.addEventListener('click', savePage);
    els.deleteBtn.addEventListener('click', deletePage);

    // Mode switching
    els.editBtn.addEventListener('click', () => setMode('edit'));
    els.previewBtn.addEventListener('click', () => setMode('preview'));
    els.splitBtn.addEventListener('click', () => setMode('split'));

    // Editor input
    els.editor.addEventListener('input', (e) => {
        if (currentMode !== 'edit') updatePreview();
        handleWikiAutocomplete(e);
    });

    // Editor keydown for autocomplete navigation
    els.editor.addEventListener('keydown', handleAutocompleteKeydown);

    // Editor click to close autocomplete
    els.editor.addEventListener('click', () => {
        if (!autocompleteState.active) hideAutocomplete();
    });

    // Search with debounce
    els.searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(query);
            loadSuggestions(query);
        }, 300);
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!els.searchInput.contains(e.target) && !els.searchSuggestions.contains(e.target)) {
            els.searchSuggestions.classList.add('hidden');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentPage) savePage();
        }
        // Ctrl/Cmd + N for new page
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openModal();
        }
        // Escape to close modal
        if (e.key === 'Escape') {
            closeModal();
            els.searchSuggestions.classList.add('hidden');
        }
    });
}

// ==================== WIKI LINK AUTOCOMPLETE ====================

let autocompleteTimeout = null;

function handleWikiAutocomplete(e) {
    const textarea = els.editor;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Find [[ before cursor
    const beforeCursor = text.substring(0, cursorPos);
    const lastOpenBracket = beforeCursor.lastIndexOf('[[');

    if (lastOpenBracket === -1) {
        hideAutocomplete();
        return;
    }

    // Check if there's a closing ]] after the cursor (not yet typed)
    const afterBracket = beforeCursor.substring(lastOpenBracket + 2);

    // If there's a newline or ]] in the query, close autocomplete
    if (afterBracket.includes('\n') || afterBracket.includes(']]')) {
        hideAutocomplete();
        return;
    }

    // We're in a wiki link context
    autocompleteState.active = true;
    autocompleteState.startPos = lastOpenBracket;
    autocompleteState.query = afterBracket;
    autocompleteState.selectedIndex = 0;

    // Debounce the search
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(() => {
        searchPagesForAutocomplete(autocompleteState.query);
    }, 150);
}

async function searchPagesForAutocomplete(query) {
    // Get all pages for filtering (we'll filter client-side for better UX)
    // Or use search API if query is long enough
    let items = [];

    if (query.length >= 2) {
        // Use search API for better results
        try {
            const data = await api(`/search?q=${encodeURIComponent(query)}&limit=8`);
            items = data.results.map(r => ({
                category: r.category,
                slug: r.slug,
                title: r.title,
                path: r.path,
            }));
        } catch (error) {
            console.error('Autocomplete search error:', error);
        }
    } else {
        // Show all pages when query is short
        items = pages.map(p => ({
            category: p.category_id,
            slug: p.slug,
            title: p.title,
            path: `${p.category_id}/${p.slug}`,
        }));
    }

    // Filter by query if needed
    if (query.length > 0) {
        const q = query.toLowerCase();
        items = items.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.slug.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q)
        );
    }

    // Limit results
    items = items.slice(0, 8);

    autocompleteState.items = items;
    renderAutocomplete();
}

function renderAutocomplete() {
    const { items, selectedIndex, query } = autocompleteState;

    if (!autocompleteState.active || items.length === 0) {
        // Show "no results" or hide
        if (autocompleteState.active && query.length > 0) {
            els.autocompleteList.innerHTML = '<div class="autocomplete-empty">No pages found for "' + escapeHtml(query) + '"</div>';
            els.wikiAutocomplete.classList.remove('hidden');
        } else if (autocompleteState.active && query.length === 0) {
            els.autocompleteList.innerHTML = '<div class="autocomplete-empty">Type to search pages...</div>';
            els.wikiAutocomplete.classList.remove('hidden');
        } else {
            hideAutocomplete();
        }
        return;
    }

    const html = items.map((item, index) => {
        const selected = index === selectedIndex ? 'selected' : '';
        const icon = getCategoryIcon(item.category);
        return `
            <div class="autocomplete-item ${selected}" data-index="${index}" onclick="selectAutocompleteItem(${index})">
                <span class="item-icon">${icon}</span>
                <div class="item-content">
                    <div class="item-title">${escapeHtml(item.title)}</div>
                    <div class="item-path">${escapeHtml(item.path)}</div>
                </div>
                <span class="item-category">${escapeHtml(item.category)}</span>
            </div>
        `;
    }).join('');

    els.autocompleteList.innerHTML = html;
    els.wikiAutocomplete.classList.remove('hidden');

    // Scroll selected item into view
    const selectedEl = els.autocompleteList.querySelector('.autocomplete-item.selected');
    if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
    }
}

function getCategoryIcon(category) {
    const icons = {
        finance: '💰',
        operations: '⚙️',
        service: '🛎️',
    };
    return icons[category] || '📄';
}

function hideAutocomplete() {
    autocompleteState.active = false;
    autocompleteState.startPos = -1;
    autocompleteState.query = '';
    autocompleteState.items = [];
    els.wikiAutocomplete.classList.add('hidden');
}

function handleAutocompleteKeydown(e) {
    if (!autocompleteState.active) return;

    const { items, selectedIndex } = autocompleteState;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            autocompleteState.selectedIndex = (selectedIndex + 1) % items.length;
            renderAutocomplete();
            break;

        case 'ArrowUp':
            e.preventDefault();
            autocompleteState.selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            renderAutocomplete();
            break;

        case 'Enter':
        case 'Tab':
            e.preventDefault();
            selectAutocompleteItem(selectedIndex);
            break;

        case 'Escape':
            e.preventDefault();
            hideAutocomplete();
            break;
    }
}

function selectAutocompleteItem(index) {
    const item = autocompleteState.items[index];
    if (!item) return;

    const textarea = els.editor;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Replace [[query with [[category/slug]]
    const before = text.substring(0, autocompleteState.startPos);
    const after = text.substring(cursorPos);

    const linkText = `${item.category}/${item.slug}`;
    const newText = before + '[[' + linkText + ']]' + after;

    textarea.value = newText;

    // Set cursor after the inserted link
    const newCursorPos = before.length + linkText.length + 4; // [[ + link + ]]
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    hideAutocomplete();

    // Update preview if visible
    if (currentMode !== 'edit') updatePreview();

    // Focus back on editor
    textarea.focus();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== GLOBAL FUNCTIONS ====================

window.toggleCategory = toggleCategory;
window.openPage = openPage;
window.closeModal = closeModal;
window.closeCategoryModal = closeCategoryModal;
window.selectAutocompleteItem = selectAutocompleteItem;
window.selectSuggestion = (suggestion) => {
    els.searchInput.value = suggestion;
    els.searchSuggestions.classList.add('hidden');
    performSearch(suggestion);
};

// ==================== START ====================

// Configure marked.js
marked.setOptions({
    highlight: function(code, lang) {
        if (hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return code;
    },
    breaks: true,
    gfm: true,
});

init();
