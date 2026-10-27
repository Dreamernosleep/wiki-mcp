/**
 * Page templates: markdown files in content/_templates/<id>.md whose
 * frontmatter describes the template. A template may belong to a category and
 * be that category's default (preselected for new pages). Templates without a
 * category are general purpose.
 *
 * Placeholders in the body: {{title}}, {{category}}, {{date}}.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getContentDir, ID_PATTERN, ID_RULE } from './files.js';

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Category this template belongs to; null = general purpose */
  category: string | null;
  /** Preselected when creating a page in `category` */
  default: boolean;
  /** Markdown body with placeholders */
  body: string;
}

export interface TemplateMeta {
  name: string;
  description?: string;
  category?: string | null;
  default?: boolean;
}

export class TemplateError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 409) {
    super(message);
  }
}

export function getTemplatesDir(): string {
  return path.join(getContentDir(), '_templates');
}

function templatePath(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new TemplateError(`Invalid template ID "${id}": must be ${ID_RULE}`, 400);
  }
  return path.join(getTemplatesDir(), `${id}.md`);
}

function readTemplateFile(filePath: string): Template | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
  const data = parsed.data as Partial<TemplateMeta>;
  const id = path.basename(filePath, '.md');
  return {
    id,
    name: typeof data.name === 'string' && data.name ? data.name : id,
    description: typeof data.description === 'string' ? data.description : '',
    category: typeof data.category === 'string' && data.category ? data.category : null,
    default: data.default === true,
    body: parsed.content.replace(/^\s*\n/, '').trimEnd() + '\n',
  };
}

function writeTemplateFile(template: Template): void {
  const frontmatter: Record<string, unknown> = { name: template.name };
  if (template.description) frontmatter.description = template.description;
  if (template.category) frontmatter.category = template.category;
  if (template.default) frontmatter.default = true;
  fs.mkdirSync(getTemplatesDir(), { recursive: true });
  fs.writeFileSync(templatePath(template.id), matter.stringify(template.body, frontmatter), 'utf-8');
}

export function listTemplates(): Template[] {
  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) return [];
  const templates: Template[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    try {
      const t = readTemplateFile(path.join(dir, entry.name));
      if (t) templates.push(t);
    } catch (error) {
      console.error(`⚠️  Skipping unreadable template ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export function getTemplate(id: string): Template | null {
  return readTemplateFile(templatePath(id));
}

/** The default template for a category, if any */
export function getDefaultTemplate(category: string): Template | null {
  return listTemplates().find(t => t.category === category && t.default) ?? null;
}

/** Fill in {{title}}, {{category}} and {{date}} */
export function renderTemplate(body: string, vars: { title: string; category: string; date?: string }): string {
  const date = vars.date ?? new Date().toISOString().split('T')[0];
  return body.replace(/\{\{\s*(title|category|date)\s*\}\}/g, (_m, key: 'title' | 'category' | 'date') =>
    key === 'date' ? date : vars[key]
  );
}

/** A template body never carries page frontmatter (e.g. when copied from a page) */
function cleanBody(body: string): string {
  return matter(body).content.replace(/^\s*\n/, '').trimEnd() + '\n';
}

function validateMeta(meta: { category: string | null; default: boolean }): void {
  if (meta.category && !ID_PATTERN.test(meta.category)) {
    throw new TemplateError(`Invalid category "${meta.category}": must be ${ID_RULE}`, 400);
  }
  if (meta.default && !meta.category) {
    throw new TemplateError('A default template must belong to a category', 400);
  }
}

/** Only one default per category: un-default the others */
function clearOtherDefaults(category: string, keepId: string): void {
  for (const other of listTemplates()) {
    if (other.id !== keepId && other.category === category && other.default) {
      writeTemplateFile({ ...other, default: false });
    }
  }
}

export function createTemplate(id: string, meta: TemplateMeta, body: string): Template {
  const filePath = templatePath(id);
  if (fs.existsSync(filePath)) {
    throw new TemplateError(`Template "${id}" already exists`, 409);
  }
  if (!meta.name?.trim()) {
    throw new TemplateError('Template name is required', 400);
  }
  const template: Template = {
    id,
    name: meta.name.trim(),
    description: meta.description?.trim() ?? '',
    category: meta.category || null,
    default: meta.default === true,
    body: cleanBody(body),
  };
  validateMeta(template);
  if (template.default && template.category) clearOtherDefaults(template.category, id);
  writeTemplateFile(template);
  return template;
}

export function updateTemplate(
  id: string,
  changes: Partial<TemplateMeta> & { body?: string }
): Template {
  const existing = getTemplate(id);
  if (!existing) {
    throw new TemplateError(`Template "${id}" not found`, 404);
  }
  const template: Template = {
    ...existing,
    name: changes.name !== undefined ? changes.name.trim() || existing.name : existing.name,
    description: changes.description !== undefined ? changes.description.trim() : existing.description,
    category: changes.category !== undefined ? changes.category || null : existing.category,
    default: changes.default !== undefined ? changes.default === true : existing.default,
    body: changes.body !== undefined ? cleanBody(changes.body) : existing.body,
  };
  validateMeta(template);
  if (template.default && template.category) clearOtherDefaults(template.category, id);
  writeTemplateFile(template);
  return template;
}

export function deleteTemplate(id: string): boolean {
  const filePath = templatePath(id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

// ==================== STARTER TEMPLATES ====================

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'customer-profile',
    name: 'Customer profile',
    description: 'One page per customer account',
    category: 'customers',
    default: true,
    body: `# {{title}}

## Overview
- Industry:
- Website:
- Customer since:

## Contacts
| Name | Role | Email |
| --- | --- | --- |
|  |  |  |

## Status
- Stage:
- Owner:
- Next step:

## Notes
`,
  },
  {
    id: 'procedure',
    name: 'Procedure',
    description: 'Step-by-step instructions for a recurring task',
    category: 'operations',
    default: true,
    body: `# {{title}}

## Purpose
Why this procedure exists and when to use it.

## Before you start
- Access or tools needed:
- Related pages:

## Steps
1.
2.
3.

## Done when
What the result looks like when the procedure is complete.
`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, decisions and action items for a meeting',
    category: null,
    default: false,
    body: `# {{title}}

- Date: {{date}}
- Attendees:

## Agenda
-

## Notes

## Decisions
-

## Action items
- [ ]
`,
  },
  {
    id: 'decision-record',
    name: 'Decision record',
    description: 'Why a decision was made, with the options considered',
    category: null,
    default: false,
    body: `# {{title}}

- Date: {{date}}
- Status: proposed

## Context
What situation led to this decision.

## Options considered
1.
2.

## Decision
What was decided and why.

## Consequences
What changes as a result.
`,
  },
];

/**
 * Write the starter templates on first run. Checks the folder, not each file,
 * so deleting a starter is respected.
 */
export function seedDefaultTemplates(): boolean {
  const dir = getTemplatesDir();
  if (fs.existsSync(dir)) return false;
  fs.mkdirSync(dir, { recursive: true });
  for (const template of DEFAULT_TEMPLATES) {
    writeTemplateFile(template);
  }
  console.error(`📋 Created ${DEFAULT_TEMPLATES.length} starter templates in ${dir}`);
  return true;
}
