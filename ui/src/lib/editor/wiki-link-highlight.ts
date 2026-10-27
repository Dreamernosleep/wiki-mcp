import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

const WIKI_LINK = /\[\[[^\]\n]+\]\]/g;

function buildDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    // Skip code: `[[x]]` inside code is literal, not a link
    if (node.marks.some((m) => m.type.name === 'code')) return;
    for (const match of node.text.matchAll(WIKI_LINK)) {
      const from = pos + (match.index ?? 0);
      decorations.push(Decoration.inline(from, from + match[0].length, { class: 'wiki-link', title: 'Wiki link' }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Styles `[[category/slug]]` text as a link chip in the visual editor without
 * changing the document, so the shortcode is written to the file untouched.
 */
export const WikiLinkHighlight = Extension.create({
  name: 'wikiLinkHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiLinkHighlight'),
        state: {
          init: (_config, state) => buildDecorations(state.doc),
          apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
