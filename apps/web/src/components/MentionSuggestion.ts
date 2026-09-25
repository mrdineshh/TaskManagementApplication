import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { MentionList } from './MentionList';

/**
 * Returns a Tiptap suggestion config for the @mention extension.
 * Uses a mutable ref container so the items() closure always reads the **latest**
 * members list — fixes the bug where the editor mounts before useUsers() resolves
 * and captures an empty array forever.
 *
 * Caller pattern: pass a stable ref object updated externally, or re-key the editor
 * when members first load. Both patterns work; this handles the closure case.
 */
export function MentionSuggestion(
  getMembersRef: { current: { id: string; full_name: string }[] },
): Partial<SuggestionOptions> {
  return {
    items({ query }: { query: string }) {
      // Always reads from the mutable ref — never stale
      return getMembersRef.current
        .filter((m) => m.full_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    },

    render() {
      let component: ReactRenderer;
      let popup: TippyInstance[];

      return {
        onStart(props) {
          component = new ReactRenderer(MentionList, { props, editor: props.editor });
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },
        onUpdate(props) {
          component.updateProps(props);
          popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
        },
        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0]?.hide();
            return true;
          }
          return (component.ref as any)?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup[0]?.destroy();
          component.destroy();
        },
      };
    },
  };
}
