/**
 * Simple MCP client to test the wiki server
 * Spawns the server and calls tools directly
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ToolResult = { content: Array<{ type: string; text: string }> };

function getText(result: unknown): string {
  return (result as ToolResult).content[0].text;
}

async function main() {
  // Clean up old database
  import('fs').then(fs => {
    try { fs.unlinkSync(path.join(__dirname, '..', 'wiki.db')); } catch {}
  });

  // Connect to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '..', 'dist', 'server.js')],
  });

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('✅ Connected to Wiki MCP Server\n');

  // List available tools
  console.log('=== Available Tools ===');
  const tools = await client.listTools();
  for (const tool of tools.tools) {
    console.log(`  🔧 ${tool.name}: ${tool.description?.substring(0, 60)}...`);
  }
  console.log();

  // Test: List categories
  console.log('=== Test: list_categories ===');
  const categories = await client.callTool({ name: 'list_categories', arguments: {} });
  console.log(getText(categories));
  console.log();

  // Test: Create a page
  console.log('=== Test: create_page (finance/demo-budget) ===');
  const created = await client.callTool({
    name: 'create_page',
    arguments: {
      category: 'finance',
      slug: 'demo-budget',
      title: 'Demo Budget',
      content: '# Demo Budget\n\nThis links to [[operations/demo-procurement]] and [[service/demo-onboarding]].',
    },
  });
  console.log(getText(created));
  console.log();

  // Test: Create another page
  console.log('=== Test: create_page (operations/demo-procurement) ===');
  const created2 = await client.callTool({
    name: 'create_page',
    arguments: {
      category: 'operations',
      slug: 'demo-procurement',
      title: 'Demo Procurement',
      content: '# Demo Procurement\n\nSee [[finance/demo-budget]] for budget details.',
    },
  });
  console.log(getText(created2));
  console.log();

  // Test: Create a third page
  console.log('=== Test: create_page (service/demo-onboarding) ===');
  const created3 = await client.callTool({
    name: 'create_page',
    arguments: {
      category: 'service',
      slug: 'demo-onboarding',
      title: 'Demo Onboarding',
      content: '# Demo Onboarding\n\nDepends on [[operations/demo-procurement]] and [[finance/demo-budget]].',
    },
  });
  console.log(getText(created3));
  console.log();

  // Test: List all pages
  console.log('=== Test: list_pages ===');
  const pages = await client.callTool({ name: 'list_pages', arguments: {} });
  console.log(getText(pages));
  console.log();

  // Test: Search
  console.log('=== Test: search_pages ===');
  const search = await client.callTool({
    name: 'search_pages',
    arguments: { query: 'budget' },
  });
  console.log(getText(search));
  console.log();

  // Test: Get linked pages
  console.log('=== Test: get_linked_pages ===');
  const links = await client.callTool({
    name: 'get_linked_pages',
    arguments: { category: 'finance', slug: 'demo-budget' },
  });
  console.log(getText(links));
  console.log();

  // Test: Get graph
  console.log('=== Test: get_graph ===');
  const graph = await client.callTool({ name: 'get_graph', arguments: {} });
  console.log(getText(graph));
  console.log();

  // Test: Get a page
  console.log('=== Test: get_page ===');
  const page = await client.callTool({
    name: 'get_page',
    arguments: { category: 'operations', slug: 'demo-procurement' },
  });
  console.log(getText(page));
  console.log();

  // Test: Templates (create → list → create a page from it → delete)
  console.log('=== Test: create_template (demo-report, default for finance) ===');
  const tpl = await client.callTool({
    name: 'create_template',
    arguments: {
      id: 'demo-report',
      name: 'Demo report',
      description: 'Created by the MCP client test',
      category: 'finance',
      default: true,
      body: '# {{title}}\n\n- Category: {{category}}\n- Date: {{date}}\n\n## Summary\n\n## Figures\n',
    },
  });
  console.log(getText(tpl));
  console.log();

  console.log('=== Test: list_templates ===');
  const tpls = await client.callTool({ name: 'list_templates', arguments: {} });
  const templateIds = (JSON.parse(getText(tpls)) as Array<{ id: string }>).map(t => t.id);
  console.log(`  ${templateIds.length} templates: ${templateIds.join(', ')}`);
  if (!templateIds.includes('demo-report')) throw new Error('demo-report missing from list_templates');
  console.log();

  console.log('=== Test: create_page from template (finance/demo-report-page) ===');
  const fromTpl = await client.callTool({
    name: 'create_page',
    arguments: { category: 'finance', slug: 'demo-report-page', title: 'Demo Report Page', template: 'demo-report' },
  });
  const fromTplText = getText(fromTpl);
  console.log(fromTplText.split('\n').slice(0, 2).join('\n'));
  if (!fromTplText.includes('# Demo Report Page') || fromTplText.includes('{{title}}')) {
    throw new Error('Template placeholders were not rendered');
  }
  console.log('  ✅ placeholders rendered');
  console.log();

  console.log('=== Test: delete_template / delete_page (cleanup) ===');
  console.log(getText(await client.callTool({ name: 'delete_template', arguments: { id: 'demo-report' } })));
  console.log(getText(await client.callTool({ name: 'delete_page', arguments: { category: 'finance', slug: 'demo-report-page' } })));
  console.log();

  // Test: List resources
  console.log('=== Test: list_resources ===');
  const resources = await client.listResources();
  console.log(`Found ${resources.resources.length} resources:`);
  for (const r of resources.resources) {
    console.log(`  📄 ${r.uri} — ${r.name}`);
  }
  console.log();

  // Cleanup
  await client.close();
  console.log('✅ All MCP tests passed!');
}

main().catch(console.error);
