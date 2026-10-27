#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

import * as db from './db.js';
import * as files from './files.js';
import * as search from './search.js';
import * as watcher from './watcher.js';

// ==================== CONFIG ====================

const TRANSPORT = process.env.MCP_TRANSPORT || 'stdio'; // 'stdio' or 'http'
const PORT = parseInt(process.env.PORT || '3000', 10);
const CONTENT_PATH = process.env.CONTENT_PATH || path.join(process.cwd(), 'content');
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'wiki.db');

// Ensure directories exist
fs.mkdirSync(CONTENT_PATH, { recursive: true });
fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
for (const cat of ['finance', 'operations', 'service']) {
  fs.mkdirSync(path.join(CONTENT_PATH, cat), { recursive: true });
}

// ==================== INITIALIZATION ====================

// Initialize database
db.initDatabase(DATABASE_PATH);
console.error('✅ Database initialized');

// Initialize Meilisearch (async, non-blocking)
let meilisearchReady = false;
search.initSearch().then((ok) => {
  meilisearchReady = ok;
});

// Full sync from files on startup (async)
async function startupSync() {
  try {
    await watcher.fullSync();
    // Start file watcher after initial sync
    watcher.startWatcher();
  } catch (error) {
    console.error('Startup sync error:', error);
    // Start watcher anyway
    watcher.startWatcher();
  }
}
startupSync();

// ==================== MCP TOOL DEFINITIONS ====================

const tools = [
  {
    name: 'list_categories',
    description: 'List all wiki categories (folders/branches)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_category',
    description: 'Create a new category (folder) in the wiki. Categories organize pages into branches.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Category ID: lowercase letters, numbers, hyphens (e.g., "engineering", "marketing")' },
        name: { type: 'string', description: 'Display name (e.g., "Engineering", "Marketing")' },
        description: { type: 'string', description: 'Brief description of this category' },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'create_page',
    description: 'Create a new page (leaf) in a category. Use wiki-style links like [[slug]] or [[category/slug]] to link to other pages.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID (e.g., finance, operations, service, or any custom category)' },
        slug: { type: 'string', description: 'URL-friendly identifier (e.g., "q4-budget")' },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Markdown content. Use [[slug]] or [[category/slug]] to link to other pages.' },
      },
      required: ['category', 'slug', 'title', 'content'],
    },
  },
  {
    name: 'get_page',
    description: 'Get a page by category and slug',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
        slug: { type: 'string' },
      },
      required: ['category', 'slug'],
    },
  },
  {
    name: 'update_page',
    description: "Update a page's title and/or content",
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
        slug: { type: 'string' },
        title: { type: 'string', description: 'New title (optional)' },
        content: { type: 'string', description: 'New markdown content (optional)' },
      },
      required: ['category', 'slug'],
    },
  },
  {
    name: 'delete_page',
    description: 'Delete a page and all its links',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
        slug: { type: 'string' },
      },
      required: ['category', 'slug'],
    },
  },
  {
    name: 'list_pages',
    description: 'List all pages, optionally filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
      },
    },
  },
  {
    name: 'search_pages',
    description: 'Smart full-text search across all pages with typo tolerance. Returns ranked results with highlighted snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Filter by category (optional)' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_linked_pages',
    description: 'Get all pages linked to/from a page (the graph neighborhood)',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
        slug: { type: 'string' },
      },
      required: ['category', 'slug'],
    },
  },
  {
    name: 'get_graph',
    description: 'Get the full link graph (nodes and edges), optionally filtered by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category ID' },
      },
    },
  },
  {
    name: 'sync_files',
    description: 'Force a full sync from markdown files to database and search index',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ==================== MCP HANDLERS ====================

async function handleToolCall(name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_categories': {
      const categories = db.listCategories();
      return { content: [{ type: 'text', text: JSON.stringify(categories, null, 2) }] };
    }

    case 'create_category': {
      const { id, name, description } = args;
      // Validate id format
      if (!/^[a-z0-9-]+$/.test(id)) {
        return { content: [{ type: 'text', text: `❌ Invalid category ID: must be lowercase letters, numbers, and hyphens only` }], isError: true };
      }
      // Check if exists
      const existing = db.getCategory(id);
      if (existing) {
        return { content: [{ type: 'text', text: `❌ Category "${id}" already exists` }], isError: true };
      }
      const category = db.createCategory(id, name, description || '');
      // Create folder on disk
      files.ensureCategoryDir(id);
      return {
        content: [{
          type: 'text',
          text: `✅ Category created: ${id} (${name})\n📁 Folder: content/${id}/\n\n${JSON.stringify(category, null, 2)}`,
        }],
      };
    }

    case 'create_page': {
      const { category, slug, title, content } = args;
      // Create in DB
      const page = db.createPage(category, slug, title, content);
      // Write to file
      files.writePageFile(category, slug, title, content, page.id, 'agent');
      // Index in Meilisearch
      await search.indexPage({
        id: page.id,
        title: page.title,
        content: page.content,
        category: page.category_id,
        slug: page.slug,
        created_by: page.created_by,
        updated_at: page.updated_at,
      });
      return {
        content: [{
          type: 'text',
          text: `✅ Page created: ${category}/${slug}\n📄 File: content/${category}/${slug}.md\n\n${JSON.stringify(page, null, 2)}`,
        }],
      };
    }

    case 'get_page': {
      const { category, slug } = args;
      const page = db.getPage(category, slug);
      if (!page) {
        return { content: [{ type: 'text', text: `❌ Page not found: ${category}/${slug}` }], isError: true };
      }
      return {
        content: [{
          type: 'text',
          text: `# ${page.title}\n\n**Path:** \`${category}/${slug}\`\n**File:** \`content/${category}/${slug}.md\`\n**Updated:** ${page.updated_at}\n\n---\n\n${page.content}`,
        }],
      };
    }

    case 'update_page': {
      const { category, slug, title, content } = args;
      const existing = db.getPage(category, slug);
      if (!existing) {
        return { content: [{ type: 'text', text: `❌ Page not found: ${category}/${slug}` }], isError: true };
      }
      const page = db.updatePage(category, slug, { title, content });
      if (page) {
        // Update file
        files.writePageFile(category, slug, page.title, page.content, page.id, page.created_by, page.created_at.split(' ')[0]);
        // Update search index
        await search.updatePage({
          id: page.id,
          title: page.title,
          content: page.content,
          category: page.category_id,
          slug: page.slug,
          created_by: page.created_by,
          updated_at: page.updated_at,
        });
      }
      return { content: [{ type: 'text', text: `✅ Page updated: ${category}/${slug}` }] };
    }

    case 'delete_page': {
      const { category, slug } = args;
      const page = db.getPage(category, slug);
      const deleted = db.deletePage(category, slug);
      if (deleted) {
        files.deletePageFile(category, slug);
        if (page) await search.deletePage(page.id);
      }
      return {
        content: [{ type: 'text', text: deleted ? `✅ Page deleted: ${category}/${slug}` : `❌ Page not found: ${category}/${slug}` }],
        isError: !deleted,
      };
    }

    case 'list_pages': {
      const { category } = args;
      const pages = db.listPages(category);
      const summary = pages.map((p) => `- \`${p.category_id}/${p.slug}\` — **${p.title}** (${p.updated_at})`);
      return {
        content: [{
          type: 'text',
          text: `📄 **Pages** ${category ? `in ${category}` : '(all)'} (${pages.length})\n\n${summary.join('\n') || '(no pages yet)'}`,
        }],
      };
    }

    case 'search_pages': {
      const { query, category, limit } = args;
      // Try Meilisearch first
      if (search.isSearchAvailable()) {
        const results = await search.searchPages(query, { category, limit, highlight: true });
        if (results.length > 0 || query.length > 0) {
          const summary = results.map((r, i) => {
            const snippet = r._formatted?.content
              ? r._formatted.content.substring(0, 200)
              : r.content.substring(0, 200);
            return `${i + 1}. **${r.title}** (\`${r.path}\`)\n   ${snippet}...`;
          });
          return {
            content: [{
              type: 'text',
              text: `🔍 **Search results** for "${query}" (${results.length})\n\n${summary.join('\n\n') || '(no results)'}`,
            }],
          };
        }
      }
      // Fallback to SQLite FTS5
      const results = db.searchPages(query);
      const summary = results.map((p) => `- \`${p.category_id}/${p.slug}\` — **${p.title}**`);
      return {
        content: [{
          type: 'text',
          text: `🔍 **Search results** for "${query}" (${results.length}) [SQLite]\n\n${summary.join('\n') || '(no results)'}`,
        }],
      };
    }

    case 'get_linked_pages': {
      const { category, slug } = args;
      const links = db.getLinkedPages(category, slug);
      const outgoing = links.outgoing.map((l) => `- → \`${l.page.category_id}/${l.page.slug}\` (${l.anchor_text})`);
      const incoming = links.incoming.map((l) => `- ← \`${l.page.category_id}/${l.page.slug}\` (${l.anchor_text})`);
      return {
        content: [{
          type: 'text',
          text: `🔗 **Links for** \`${category}/${slug}\`\n\n**Outgoing:**\n${outgoing.join('\n') || '(none)'}\n\n**Incoming:**\n${incoming.join('\n') || '(none)'}`,
        }],
      };
    }

    case 'get_graph': {
      const { category } = args;
      const graph = db.getGraph(category);
      return {
        content: [{
          type: 'text',
          text: `🕸️ **Graph** ${category ? `for ${category}` : '(all)'}\n\n**Nodes (${graph.nodes.length}):**\n${graph.nodes.map(n => `- [${n.category}] ${n.title}`).join('\n') || '(none)'}\n\n**Edges (${graph.edges.length}):**\n${graph.edges.map(e => `- ${e.from} → ${e.to}`).join('\n') || '(none)'}\n\n\`\`\`json\n${JSON.stringify(graph, null, 2)}\n\`\`\``,
        }],
      };
    }

    case 'sync_files': {
      const result = await watcher.fullSync();
      return {
        content: [{
          type: 'text',
          text: `✅ Sync complete: ${result.synced} pages synced, ${result.removed} removed`,
        }],
      };
    }

    default:
      return { content: [{ type: 'text', text: `❌ Unknown tool: ${name}` }], isError: true };
  }
}

// ==================== CREATE MCP SERVER ====================

function createMcpServer(): Server {
  const server = new Server(
    { name: 'wiki-mcp', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleToolCall(request.params.name, request.params.arguments);
    } catch (error) {
      return {
        content: [{ type: 'text', text: `❌ Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const pages = db.listPages();
    return {
      resources: pages.map((p) => ({
        uri: `wiki://${p.category_id}/${p.slug}`,
        name: p.title,
        description: `${p.category_id} — ${p.slug}`,
        mimeType: 'text/markdown',
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const url = new URL(request.params.uri);
    const category = url.host;
    const slug = url.pathname.slice(1);
    const page = db.getPage(category, slug);
    if (!page) throw new Error(`Page not found: ${category}/${slug}`);
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'text/markdown',
        text: `# ${page.title}\n\n${page.content}`,
      }],
    };
  });

  return server;
}

// ==================== HTTP SERVER (REST API + MCP SSE) ====================

function createHttpServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      transport: 'http',
      meilisearch: search.isSearchAvailable(),
      database: 'connected',
    });
  });

  // ==================== REST API ====================

  // List categories
  app.get('/api/categories', (req, res) => {
    res.json(db.listCategories());
  });

  // Create a new category
  app.post('/api/categories', (req, res) => {
    try {
      const { id, name, description } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: 'Missing required fields: id, name' });
      }
      // Validate id format (lowercase, no spaces)
      if (!/^[a-z0-9-]+$/.test(id)) {
        return res.status(400).json({ error: 'Category ID must be lowercase letters, numbers, and hyphens only' });
      }
      // Check if category already exists
      const existing = db.getCategory(id);
      if (existing) {
        return res.status(409).json({ error: `Category "${id}" already exists` });
      }
      const category = db.createCategory(id, name, description || '');
      // Create the folder on disk
      files.ensureCategoryDir(id);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Delete a category (only if empty)
  app.delete('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = db.deleteCategory(id);
      res.json({ deleted });
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  });

  // List pages
  app.get('/api/pages', (req, res) => {
    const category = req.query.category as string | undefined;
    res.json(db.listPages(category));
  });

  // Get a page
  app.get('/api/pages/:category/:slug', (req, res) => {
    const { category, slug } = req.params;
    const page = db.getPage(category, slug);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    // Also return the raw markdown file content
    const filePage = files.readPage(category, slug);
    res.json({ ...page, raw_markdown: filePage ? fs.readFileSync(filePage.filePath, 'utf-8') : null });
  });

  // Create a page
  app.post('/api/pages', async (req, res) => {
    try {
      const { category, slug, title, content } = req.body;
      if (!category || !slug || !title || !content) {
        return res.status(400).json({ error: 'Missing required fields: category, slug, title, content' });
      }
      const page = db.createPage(category, slug, title, content, 'user');
      files.writePageFile(category, slug, title, content, page.id, 'user');
      await search.indexPage({
        id: page.id,
        title: page.title,
        content: page.content,
        category: page.category_id,
        slug: page.slug,
        created_by: page.created_by,
        updated_at: page.updated_at,
      });
      res.status(201).json(page);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Update a page
  app.put('/api/pages/:category/:slug', async (req, res) => {
    try {
      const { category, slug } = req.params;
      const { title, content } = req.body;
      const existing = db.getPage(category, slug);
      if (!existing) return res.status(404).json({ error: 'Page not found' });

      const page = db.updatePage(category, slug, { title, content });
      if (page) {
        files.writePageFile(category, slug, page.title, page.content, page.id, page.created_by, page.created_at.split(' ')[0]);
        await search.updatePage({
          id: page.id,
          title: page.title,
          content: page.content,
          category: page.category_id,
          slug: page.slug,
          created_by: page.created_by,
          updated_at: page.updated_at,
        });
      }
      res.json(page);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Delete a page
  app.delete('/api/pages/:category/:slug', async (req, res) => {
    const { category, slug } = req.params;
    const page = db.getPage(category, slug);
    const deleted = db.deletePage(category, slug);
    if (deleted) {
      files.deletePageFile(category, slug);
      if (page) await search.deletePage(page.id);
    }
    res.json({ deleted });
  });

  // Search
  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    const category = req.query.category as string | undefined;
    const limit = parseInt(req.query.limit as string || '20', 10);
    if (!query) return res.status(400).json({ error: 'Missing query parameter: q' });

    // Try Meilisearch first
    if (search.isSearchAvailable()) {
      const results = await search.searchPages(query, { category, limit, highlight: true });
      return res.json({ results, engine: 'meilisearch' });
    }

    // Fallback to SQLite
    const results = db.searchPages(query);
    res.json({ results, engine: 'sqlite' });
  });

  // Search suggestions (autocomplete)
  app.get('/api/search/suggest', async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) return res.json({ suggestions: [] });
    const suggestions = await search.getSuggestions(query);
    res.json({ suggestions });
  });

  // Graph
  app.get('/api/graph', (req, res) => {
    const category = req.query.category as string | undefined;
    res.json(db.getGraph(category));
  });

  // Linked pages
  app.get('/api/pages/:category/:slug/links', (req, res) => {
    const { category, slug } = req.params;
    res.json(db.getLinkedPages(category, slug));
  });

  // Sync files
  app.post('/api/sync', async (req, res) => {
    const result = await watcher.fullSync();
    res.json(result);
  });

  // Serve raw markdown file
  app.get('/api/raw/:category/:slug', (req, res) => {
    const { category, slug } = req.params;
    const filePath = files.getPagePath(category, slug);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'text/markdown');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  });

  // ==================== MCP STREAMABLE HTTP ENDPOINT ====================

  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Handle all MCP requests (POST for JSON-RPC, GET for SSE stream, DELETE for session close)
  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.error(`🔍 MCP request: ${req.method} sessionId=${sessionId} body=${JSON.stringify(req.body)?.substring(0, 200)}`);
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport for this session
      transport = transports.get(sessionId)!;
    } else if (!sessionId && req.method === 'POST' && req.body && isInitializeRequest(req.body)) {
      // New session - create transport with session ID
      const newSessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });

      const server = createMcpServer();
      await server.connect(transport);

      transports.set(newSessionId, transport);
      console.error(`🔌 MCP client connected: ${newSessionId}`);

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.error(`🔌 MCP client disconnected: ${transport.sessionId}`);
        }
      };
    } else {
      // Invalid request - no session ID and not an initialize request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with the transport
    await transport.handleRequest(req, res, req.body);
  });

  // ==================== START SERVER ====================

  app.listen(PORT, '0.0.0.0', () => {
    console.error(`🌐 Wiki API + MCP server running on http://0.0.0.0:${PORT}`);
    console.error(`   MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
    console.error(`   REST API: http://0.0.0.0:${PORT}/api`);
    console.error(`   Health: http://0.0.0.0:${PORT}/health`);
  });
}

// ==================== START ====================

async function main() {
  if (TRANSPORT === 'http') {
    createHttpServer();
  } else {
    // Stdio mode for local agents (pi, Claude Desktop)
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Wiki MCP Server running on stdio');
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('\n🛑 Shutting down...');
  watcher.stopWatcher();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n🛑 Shutting down...');
  watcher.stopWatcher();
  process.exit(0);
});

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
