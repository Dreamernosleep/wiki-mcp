import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion, findSuggestionMatch, type SuggestionProps } from '@tiptap/suggestion';

import type { Page } from '@/lib/api';
import { searchWikiLinkItems, type AutocompleteItem } from '@/hooks/use-wiki-autocomplete';
import { WikiLinkList, type WikiLinkListProps, type WikiLinkListRef } from '@/components/wiki-link-list';

export interface WikiLinkSuggestionOptions {
  /** Called on every query so the list follows the latest page list */
  getPages: () => Page[];
}

/**
 * Typing `[[` in the visual editor opens a page picker. Picking a page inserts
 * the plain `[[category/slug]]` shortcode as text, exactly like the Markdown
 * editor does.
 */
export const WikiLinkSuggestion = Extension.create<WikiLinkSuggestionOptions>({
  name: 'wikiLinkSuggestion',

  addOptions() {
    return { getPages: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<AutocompleteItem, AutocompleteItem>({
        editor: this.editor,
        pluginKey: new PluginKey('wikiLinkSuggestion'),
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null, // `[[` may follow any character, not only a space
        debounce: 150,
        // Close once the link is finished (`]]` typed or inserted)
        findSuggestionMatch: (config) => {
          const match = findSuggestionMatch(config);
          return match && !match.query.includes(']]') ? match : null;
        },
        items: ({ query }) => searchWikiLinkItems(query, this.options.getPages()),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, { type: 'text', text: `[[${props.path}]]` })
            .run();
        },
        render: () => {
          let component: ReactRenderer<WikiLinkListRef, WikiLinkListProps> | null = null;
          let unmount: (() => void) | undefined;

          const toListProps = (p: SuggestionProps<AutocompleteItem, AutocompleteItem>): WikiLinkListProps => ({
            items: p.items,
            query: p.query,
            loading: p.loading,
            command: p.command,
          });

          return {
            onStart: (props) => {
              component = new ReactRenderer(WikiLinkList, { props: toListProps(props), editor: props.editor });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => component?.updateProps(toListProps(props)),
            onKeyDown: ({ event }) => component?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
