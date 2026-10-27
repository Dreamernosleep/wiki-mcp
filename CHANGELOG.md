# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open source release
- MCP server with 11 tools
- REST API with full CRUD
- Web UI with editor, preview, and split view
- Smart search with Meilisearch (typo-tolerant)
- SQLite fallback for search
- File-based storage (Markdown with frontmatter)
- File watcher for auto-sync
- Wiki-style links `[[page]]` with autocomplete
- Dynamic categories (create custom folders)
- Clickable links in preview
- Docker Compose setup
- Dual MCP transport (stdio + Streamable HTTP)

### Added
- Page templates: markdown files in `content/_templates/` with `name`, `description`, optional `category` and `default` frontmatter and `{{title}}` / `{{category}}` / `{{date}}` placeholders. Four starters are written on first start (Customer profile, Procedure, Meeting notes, Decision record). REST: `/api/templates` CRUD and `POST /api/pages` accepts a `template` id. MCP: `list_templates`, `get_template`, `create_template`, `update_template`, `delete_template`, and `create_page` accepts `template` (falls back to the category default when `content` is omitted). Web UI: Templates section in the sidebar (open, edit, save and delete templates like pages, plus a New template button), Template picker in the New page dialog (the category's default is preselected) and a "Save as template" action on any open page
- `customers` category seeded on install (alongside finance, operations, service)
- `npm run setup`: guided installer that checks Node and Docker, creates `.env`, generates the Meilisearch password, asks for ports, starts the stack and prints the URLs and MCP config (`--yes` for non-interactive, `--no-start` to configure only)

### Changed
- Web UI rebuilt with Vite, React, Tailwind CSS and shadcn/ui in a black-and-white CRM style with a light/dark toggle; all colours live in `ui/src/styles/brand.css` (see `ui/BRANDING.md`)
- Search box: the suggestions dropdown is gone; results already appear live under the box as you type, so it only repeated them
- Web UI now calls the API through a relative `/api` path; the nginx container proxies it to the API using the `API_URL` env var (previously hardcoded to `localhost:3000`)
- Saving a page from the UI no longer sends the frontmatter block as page content
- Visual editor: pages open in a WYSIWYG editor (Tiptap) with a formatting toolbar that reads and writes Markdown; `[[page]]` shortcodes stay as text and are highlighted, and typing `[[` opens the same page picker as the Markdown editor. The previous source editor remains available as "Markdown" mode (source + live preview), plus a read-only "Preview" mode. The frontmatter block is no longer shown in the editor
- New page dialog: only category, title and file name are asked; the slug (file name) is generated from the title and shown read-only with an Edit button for custom slugs. The new page opens straight in the visual editor with the title as its heading and the cursor ready to type

### Fixed
- File sync no longer fails with `FOREIGN KEY constraint failed` on a fresh database when pages link to each other; pages are now inserted with their frontmatter ID directly, and one bad file no longer aborts the whole sync
- Errors in async REST routes are now answered with a 500 instead of crashing the server process (Express 4 unhandled rejection)
- SQLite FTS5 fallback search no longer throws on queries containing FTS syntax characters such as `:` or `*`
- Page slugs are now validated server-side (`[a-z0-9-]+`), closing a path traversal that could write files outside `content/`; `getPagePath` additionally refuses any path that escapes the content directory
- Meilisearch is now connected before the startup sync, so pages already on disk are indexed and searchable immediately after boot

## [1.0.0] - 2026-10-27

### Added
- Initial release
- Core wiki functionality
- MCP integration
- Web UI
- Docker support
