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

### Changed
- Web UI rebuilt with Vite, React, Tailwind CSS and shadcn/ui in a black-and-white CRM style with a light/dark toggle; all colours live in `ui/src/styles/brand.css` (see `ui/BRANDING.md`)
- Web UI now calls the API through a relative `/api` path; the nginx container proxies it to the API using the `API_URL` env var (previously hardcoded to `localhost:3000`)
- Saving a page from the UI no longer sends the frontmatter block as page content

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
