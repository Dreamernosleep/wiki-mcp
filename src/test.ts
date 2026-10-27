/**
 * Test script - tests the database layer directly
 * Run with: npm test
 */
import path from 'path';
import fs from 'fs';

// Use test paths
const testDir = path.join(process.cwd(), '.test');
fs.mkdirSync(testDir, { recursive: true });
process.env.DATABASE_PATH = path.join(testDir, 'test.db');
process.env.CONTENT_PATH = path.join(testDir, 'content');

// Clean up
for (const dir of ['finance', 'operations', 'service']) {
  fs.mkdirSync(path.join(process.env.CONTENT_PATH, dir), { recursive: true });
}

async function main() {
  console.log('🧪 Testing Wiki MCP\n');

  const db = await import('./db.js');
  const files = await import('./files.js');

  // Initialize
  const database = db.initDatabase(process.env.DATABASE_PATH);
  // Clean slate
  database.exec('DELETE FROM page_links');
  database.exec('DELETE FROM pages');
  console.log('🧹 Cleaned test database\n');

  // 1. List categories
  console.log('=== 1. List Categories ===');
  // The test pages use their own categories (the install seeds companies/contacts/accounts/services)
  for (const [id, name] of [['finance', 'Finance'], ['operations', 'Operations'], ['service', 'Service']]) {
    if (!db.getCategory(id)) db.createCategory(id, name, '');
  }
  const categories = db.listCategories();
  console.log(categories.map(c => `  ${c.id}: ${c.name}`).join('\n'));
  console.log();

  // 2. Create pages (via DB + files)
  console.log('=== 2. Create Pages ===');

  const p1 = db.createPage('finance', 'q4-budget', 'Q4 Budget Planning', `# Q4 Budget Planning

The Q4 budget depends on [[operations/procurement]] timelines and [[service/onboarding]] projections.

## Key Figures
- Revenue target: $2.5M
- OpEx: $1.8M
- See [[finance/expense-policy]] for details`);
  files.writePageFile('finance', 'q4-budget', p1.title, p1.content, p1.id);
  console.log('  ✅ finance/q4-budget');

  const p2 = db.createPage('finance', 'expense-policy', 'Expense Policy', `# Expense Policy

All expenses must be approved per [[operations/procurement]] guidelines.`);
  files.writePageFile('finance', 'expense-policy', p2.title, p2.content, p2.id);
  console.log('  ✅ finance/expense-policy');

  const p3 = db.createPage('operations', 'procurement', 'Procurement Process', `# Procurement Process

The procurement process affects [[finance/q4-budget]] and vendor payments.`);
  files.writePageFile('operations', 'procurement', p3.title, p3.content, p3.id);
  console.log('  ✅ operations/procurement');

  const p4 = db.createPage('operations', 'logistics', 'Logistics & Shipping', `# Logistics & Shipping

Shipping impacts [[service/onboarding]] for new customer deliveries.`);
  files.writePageFile('operations', 'logistics', p4.title, p4.content, p4.id);
  console.log('  ✅ operations/logistics');

  const p5 = db.createPage('service', 'onboarding', 'Customer Onboarding', `# Customer Onboarding

Onboarding timeline depends on [[operations/logistics]] for hardware delivery.
Revenue recognition follows [[finance/q4-budget]] guidelines.`);
  files.writePageFile('service', 'onboarding', p5.title, p5.content, p5.id);
  console.log('  ✅ service/onboarding');

  const p6 = db.createPage('service', 'support-sla', 'Support SLA', `# Support SLA

Our SLA commitments are backed by [[operations/logistics]] escalation paths.`);
  files.writePageFile('service', 'support-sla', p6.title, p6.content, p6.id);
  console.log('  ✅ service/support-sla');
  console.log();

  // 3. List pages
  console.log('=== 3. List Pages ===');
  const allPages = db.listPages();
  console.log(`  Total: ${allPages.length}`);
  for (const p of allPages) {
    console.log(`  📄 ${p.category_id}/${p.slug} — ${p.title}`);
  }
  console.log();

  // 4. Check files were created
  console.log('=== 4. Check Files ===');
  const pageFiles = files.listAllPageFiles();
  console.log(`  Files found: ${pageFiles.length}`);
  for (const f of pageFiles) {
    console.log(`  📁 ${files.getRelativePath(f)}`);
  }
  console.log();

  // 5. Read a file back
  console.log('=== 5. Read File ===');
  const filePage = files.readPage('finance', 'q4-budget');
  if (filePage) {
    console.log(`  Title: ${filePage.frontmatter.title}`);
    console.log(`  Content preview: ${filePage.content.substring(0, 80)}...`);
  }
  console.log();

  // 6. Search
  console.log('=== 6. Search ===');
  const results = db.searchPages('budget');
  console.log(`  "budget": ${results.length} results`);
  for (const r of results) {
    console.log(`    - ${r.category_id}/${r.slug}`);
  }
  console.log();

  // 7. Graph
  console.log('=== 7. Graph ===');
  const graph = db.getGraph();
  console.log(`  Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
  console.log();

  // 8. Update page (file should update too)
  console.log('=== 8. Update Page ===');
  const updated = db.updatePage('finance', 'q4-budget', {
    content: `# Q4 Budget Planning (Updated)

Updated with new info. See [[service/support-sla]].`
  });
  if (updated) {
    files.writePageFile('finance', 'q4-budget', updated.title, updated.content, updated.id, updated.created_by, updated.created_at.split(' ')[0]);
    const fileAfter = files.readPage('finance', 'q4-budget');
    console.log(`  File updated: ${fileAfter?.content.includes('Updated') ? '✅' : '❌'}`);
  }
  console.log();

  // 9. Delete page (file should delete too)
  console.log('=== 9. Delete Page ===');
  const deleted = db.deletePage('service', 'support-sla');
  files.deletePageFile('service', 'support-sla');
  const fileExists = fs.existsSync(files.getPagePath('service', 'support-sla'));
  console.log(`  DB deleted: ${deleted ? '✅' : '❌'}, File deleted: ${!fileExists ? '✅' : '❌'}`);
  console.log();

  // 10. Templates
  console.log('=== 10. Templates ===');
  const templates = await import('./templates.js');
  const check = (label: string, ok: boolean) => {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failures++;
  };

  check('seeded on first run', templates.seedDefaultTemplates() === true);
  check('not re-seeded when folder exists', templates.seedDefaultTemplates() === false);
  const starters = templates.listTemplates();
  check(`7 starter templates (found ${starters.length})`, starters.length === 7);
  check('companies default is company-profile', templates.getDefaultTemplate('companies')?.id === 'company-profile');
  check('contacts/accounts/services have defaults', ['contacts', 'accounts', 'services'].every(c => templates.getDefaultTemplate(c)?.default === true));
  check('finance has no default', templates.getDefaultTemplate('finance') === null);

  const rendered = templates.renderTemplate('# {{title}}\n{{ category }} {{date}}', { title: 'Acme', category: 'companies', date: '2026-01-02' });
  check('placeholders rendered', rendered === '# Acme\ncompanies 2026-01-02');

  check('template files are not pages', files.listAllPageFiles().every(f => !f.includes('_templates')));
  check('parsePath ignores _templates', files.parsePath(path.join(process.env.CONTENT_PATH!, '_templates', 'x.md')) === null);

  const created = templates.createTemplate('finance-report', { name: 'Finance report', category: 'finance', default: true }, '---\ntitle: junk\n---\n# {{title}}\n\n## Numbers\n');
  check('createTemplate strips frontmatter from body', created.body.startsWith('# {{title}}'));
  check('finance default now finance-report', templates.getDefaultTemplate('finance')?.id === 'finance-report');
  try {
    templates.createTemplate('finance-report', { name: 'Dup' }, '# x');
    check('duplicate id refused', false);
  } catch (e) {
    check('duplicate id refused', e instanceof templates.TemplateError && e.status === 409);
  }
  templates.createTemplate('finance-memo', { name: 'Finance memo', category: 'finance', default: true }, '# {{title}}\n');
  check('new default clears the previous one', templates.getTemplate('finance-report')?.default === false);
  const updatedTpl = templates.updateTemplate('finance-memo', { body: '# {{title}}\n\n## Memo\n' });
  check('updateTemplate changes the body', updatedTpl.body.includes('## Memo') && updatedTpl.default === true);
  try {
    templates.createTemplate('bad', { name: 'Bad', default: true }, '# x');
    check('default without category refused', false);
  } catch (e) {
    check('default without category refused', e instanceof templates.TemplateError && e.status === 400);
  }
  check('deleteTemplate', templates.deleteTemplate('finance-memo') && templates.getTemplate('finance-memo') === null);
  console.log();

  // 11. Categories: rename, delete (empty / force)
  console.log('=== 11. Categories ===');
  const renamed = db.updateCategory('finance', { name: 'Money', description: 'Renamed' });
  check('updateCategory renames', renamed?.name === 'Money' && renamed.description === 'Renamed');
  check('updateCategory keeps id', db.getCategory('finance')?.id === 'finance');
  check('updateCategory unknown id', db.updateCategory('nope', { name: 'x' }) === undefined);
  try {
    db.deleteCategory('finance');
    check('delete refused while pages exist', false);
  } catch {
    check('delete refused while pages exist', db.getCategory('finance') !== undefined);
  }
  const forced = db.deleteCategory('finance', true);
  check('force delete removes the category and its pages', forced.deleted && forced.pages.length === 2 && db.listPages('finance').length === 0);
  check('links of deleted pages are gone', db.getLinkedPages('operations', 'procurement').incoming.every(l => l.page.category_id !== 'finance'));
  check('deleteCategoryDir removes the folder', files.deleteCategoryDir('finance') && !fs.existsSync(path.join(process.env.CONTENT_PATH!, 'finance')));
  try {
    files.deleteCategoryDir('_templates');
    check('deleteCategoryDir refuses reserved folders', false);
  } catch {
    check('deleteCategoryDir refuses reserved folders', fs.existsSync(templates.getTemplatesDir()));
  }
  console.log();

  // Cleanup (best effort)
  console.log('=== Cleanup ===');
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('  🧹 Test directory cleaned');
  } catch {
    console.log('  ⚠️  Could not clean test directory (Windows lock)');
  }
  console.log();

  if (failures > 0) {
    console.log(`❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('✅ All tests passed!');
}

let failures = 0;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
