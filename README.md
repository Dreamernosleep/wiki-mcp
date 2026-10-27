# Wiki MCP 🚀

[![CI](https://github.com/Dreamernosleep/wiki-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Dreamernosleep/wiki-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Dreamernosleep/wiki-mcp?label=release)](https://github.com/Dreamernosleep/wiki-mcp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

> **An open-source company knowledge wiki with AI superpowers.**
> Markdown files + Smart search + MCP server + Web UI + Docker

Wiki MCP is a self-hosted knowledge base that combines the simplicity of **Markdown files** with the power of **AI agents** through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Your wiki is just a folder of `.md` files — git-friendly, portable, and yours forever.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📁 **Markdown Files** | Your wiki is just `.md` files with YAML frontmatter — edit in any editor! |
| 🤖 **MCP Server** | AI agents (Claude, pi, Cursor, etc.) can read, write, and search your wiki |
| 🔍 **Smart Search** | Typo-tolerant search with [Meilisearch](https://www.meilisearch.com/) (fallback: SQLite FTS5) |
| 🌐 **Web UI** | Clean black-and-white UI built with React + [shadcn/ui](https://ui.shadcn.com) — visual (WYSIWYG) editor that saves plain Markdown, Markdown source mode with live preview, light/dark |
| 🔗 **Wiki Links** | `[[page-slug]]` or `[[category/page-slug]]` with autocomplete while typing |
| 📂 **Dynamic Categories** | Create custom folders (categories) on the fly — not just finance/ops/service |
| 🐳 **Docker Ready** | One command to run everything: `docker compose up -d` |
| 👀 **File Watcher** | Edit files in VS Code/Obsidian — changes auto-sync to search index |
| 📊 **Graph View** | See how pages connect with a full link graph |
| 🔄 **Dual Transport** | MCP over stdio (local) or Streamable HTTP (Docker/remote) |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     docker compose up                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Meilisearch │  │  Wiki API   │  │    Web UI       │  │
│  │  (search)   │◄─│  (MCP+REST) │◄─│   (browser)     │  │
│  │  :7700      │  │  :3000      │  │   :80           │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │  Volumes: content/ (markdown), data/ (SQLite)     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↑                              ↑
    🤖 AI Agents (MCP)            👤 Humans (Browser)
    pi, Claude, Cursor...         View & Edit
```

## 🚀 Quick Start

### Option 1: Guided setup (Recommended)

```bash
git clone https://github.com/Dreamernosleep/wiki-mcp.git
cd wiki-mcp
npm run setup
```

The setup script checks for Node 22+ and Docker, creates your `.env`, generates a search-engine
password, asks for the ports (defaults: UI on 80, API on 3000), starts everything with Docker
Compose, and prints the URLs plus an MCP config block to paste into your AI tool. Re-running it is
safe: existing `.env` values are kept. Use `npm run setup -- --yes` for a non-interactive install.

### Option 1b: Plain Docker Compose

```bash
git clone https://github.com/Dreamernosleep/wiki-mcp.git
cd wiki-mcp
cp .env.example .env     # optional: edit ports and MEILISEARCH_KEY
docker compose up -d     # Meilisearch + API + Web UI

# Open http://localhost in your browser!
```

> **About Meilisearch:** it is an open-source search engine that runs as a local container here.
> No account, no external service, no cost. `MEILISEARCH_KEY` is simply a password that locks your
> own instance. If the container is unavailable the wiki falls back to SQLite full-text search.

### Option 2: Local Development

```bash
# Prerequisites: Node.js 22+, Docker (for Meilisearch)

# Install dependencies
npm install

# Start Meilisearch
docker run -d -p 7700:7700 getmeili/meilisearch

# Run the API in development mode (http://localhost:3000)
npm run dev

# In a second terminal, run the web UI (http://localhost:5173, proxies /api to :3000)
cd ui && npm install && npm run dev
```

### Option 3: MCP Only (for AI agents)

```bash
npm install && npm run build

# Run as MCP server (stdio)
MCP_TRANSPORT=stdio node dist/server.js
```

## 🔌 Connect AI Agents

### pi / Claude Desktop (Local)

```json
{
  "mcpServers": {
    "wiki": {
      "command": "node",
      "args": ["/path/to/wiki-mcp/dist/server.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MEILISEARCH_URL": "http://localhost:7700"
      }
    }
  }
}
```

### Claude Code / Cursor / Remote Agents (HTTP)

```json
{
  "mcpServers": {
    "wiki": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## 🛠️ MCP Tools (16)

| Tool | Description |
|------|-------------|
| `list_categories` | List all wiki categories |
| `create_category` | Create a new category (folder) |
| `create_page` | Create a new page (from markdown, or from a template) |
| `get_page` | Get a page by category/slug |
| `update_page` | Update a page's content |
| `delete_page` | Delete a page |
| `list_pages` | List all pages (filter by category) |
| `search_pages` | Smart search (typo-tolerant, ranked) |
| `get_linked_pages` | Get pages linked to/from a page |
| `get_graph` | Get the full link graph |
| `sync_files` | Force sync from markdown files |
| `list_templates` | List page templates |
| `get_template` | Get a template with its markdown body |
| `create_template` | Create a reusable page template |
| `update_template` | Update a template's name, category, default flag or body |
| `delete_template` | Delete a template |

## 🌐 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List categories |
| `POST` | `/api/categories` | Create category |
| `DELETE` | `/api/categories/:id` | Delete empty category |
| `GET` | `/api/pages` | List pages (`?category=finance`) |
| `GET` | `/api/pages/:category/:slug` | Get a page |
| `POST` | `/api/pages` | Create a page (`content`, or `template` id) |
| `PUT` | `/api/pages/:category/:slug` | Update a page |
| `DELETE` | `/api/pages/:category/:slug` | Delete a page |
| `GET` | `/api/search?q=...` | Search pages |
| `GET` | `/api/search/suggest?q=...` | Autocomplete suggestions |
| `GET` | `/api/graph` | Get link graph |
| `GET` | `/api/pages/:cat/:slug/links` | Get linked pages |
| `POST` | `/api/sync` | Force file sync |
| `GET` | `/api/raw/:category/:slug` | Get raw markdown |
| `GET` | `/api/templates` | List page templates |
| `GET` | `/api/templates/:id` | Get a template |
| `POST` | `/api/templates` | Create a template |
| `PUT` | `/api/templates/:id` | Update a template |
| `DELETE` | `/api/templates/:id` | Delete a template |
| `GET` | `/health` | Health check |

## 📁 Project Structure

```
wiki-mcp/
├── .github/                # GitHub Actions, issue templates
├── src/
│   ├── server.ts           # MCP + REST API server
│   ├── db.ts               # SQLite (graph, metadata)
│   ├── files.ts            # Markdown file I/O
│   ├── search.ts           # Meilisearch client
│   ├── watcher.ts          # File watcher (auto-sync)
│   └── sync.ts             # Manual sync script
├── ui/                     # Web UI (Vite + React + shadcn/ui)
│   ├── src/
│   │   ├── App.tsx         # App state and layout
│   │   ├── components/     # Sidebar, editor, preview, dialogs (+ ui/ from shadcn)
│   │   ├── lib/            # API client, markdown rendering
│   │   └── styles/
│   │       ├── brand.css   # ★ All colours, radius, fonts — edit to re-theme
│   │       └── index.css   # Tailwind + token mapping
│   ├── BRANDING.md         # How to change colours / name
│   ├── Dockerfile          # Builds the bundle, serves it with nginx
│   └── nginx.conf.template # Serves the app and proxies /api to the API
├── content/                # Your wiki (markdown files; gitignored, created on first start)
│   ├── _templates/         # Page templates (see below)
│   ├── finance/
│   ├── operations/
│   ├── service/
│   ├── customers/
│   └── engineering/        # Custom categories!
├── data/                   # SQLite database
├── docker-compose.yml      # One-command setup
├── Dockerfile              # Wiki API container
└── README.md
```

## 📝 Markdown Format

Pages are stored as markdown files with YAML frontmatter:

```markdown
---
id: abc123-uuid
category: finance
slug: q4-budget
title: Q4 Budget Planning
created: 2026-10-27
updated: 2026-10-27
created_by: agent
---

# Q4 Budget Planning

The Q4 budget depends on [[operations/procurement]] timelines.

## Key Figures
- Revenue target: $2.5M
```

## 📋 Page Templates

Templates keep pages of the same kind (a customer, a procedure, meeting notes) in the same shape, whether a person creates them in the web UI or an agent creates them over MCP. A template is a markdown file in `content/_templates/`:

```markdown
---
name: Customer profile
description: One page per customer account
category: customers      # optional: the category this template belongs to
default: true            # optional: preselected for new pages in that category
---
# {{title}}

## Overview
- Industry:
- Website:
```

- `{{title}}`, `{{category}}` and `{{date}}` are filled in when a page is created from the template.
- A template with a `category` is offered for that category; without one it is general purpose. Only one template per category can be `default`; setting a new default clears the previous one.
- The install ships four starters: **Customer profile** (default for `customers`), **Procedure** (default for `operations`), **Meeting notes** and **Decision record**. They are written on first start; edit or delete them freely.
- In the web UI, the New page dialog has a Template picker, and any open page can be saved as a template (the page heading becomes `{{title}}`).
- Agents: `list_templates` shows what exists, `create_page` accepts a `template` id (and falls back to the category default when `content` is omitted), and `create_template` / `update_template` / `delete_template` manage them.

## 🔗 Wiki Links

Link pages with `[[slug]]` or `[[category/slug]]`:

```markdown
See [[operations/procurement]] for details.
Or use full path: [[finance/expense-policy]]
```

## 🎨 Theming the Web UI

The UI ships black-and-white with a light/dark toggle. Every colour, the corner radius and the fonts
live in **one file**: [`ui/src/styles/brand.css`](ui/src/styles/brand.css). Change `--primary` there
and every button, active row, focus ring and link follows. See [`ui/BRANDING.md`](ui/BRANDING.md)
for a walkthrough, including how to set a brand colour instead of black.

## 🧪 Development

```bash
# Run tests
npm test

# Test MCP client
npm run test:mcp

# Manual sync (rebuild DB from files)
npm run sync

# Docker commands
npm run docker:build
npm run docker:up
npm run docker:down
npm run docker:logs
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- 🐛 [Report a Bug](.github/ISSUE_TEMPLATE/bug_report.md)
- 💡 [Request a Feature](.github/ISSUE_TEMPLATE/feature_request.md)
- 🔒 [Security Policy](SECURITY.md)
- 📜 [Code of Conduct](CODE_OF_CONDUCT.md)

## 📜 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) — AI agent integration
- [Meilisearch](https://www.meilisearch.com/) — Smart search engine
- [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) — Web UI components
- [Marked.js](https://marked.js.org/) — Markdown rendering
- [Chokidar](https://github.com/paulmillr/chokidar) — File watching
- [node:sqlite](https://nodejs.org/api/sqlite.html) — Database

---

<p align="center">
  Made with ❤️ for the open source community
</p>

<p align="center">
  <a href="https://github.com/Dreamernosleep/wiki-mcp">⭐ Star us on GitHub</a>
</p>
