import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/** Floating suggestion dropdown that Tiptap's mention extension renders via a tippy.js portal. */
export const MentionList = forwardRef<MentionListRef, SuggestionProps>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  function selectItem(index: number) {
    const item = items[index] as { id: string; full_name: string } | undefined;
    if (item) command({ id: item.id, label: item.full_name });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: SuggestionKeyDownProps): boolean {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selected);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="mention-list z-50 w-52 neu-card !p-0 overflow-hidden shadow-lg">
      {(items as { id: string; full_name: string }[]).map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(i)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            i === selected
              ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950'
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
            {item.full_name.split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
          </span>
          <span className="truncate">{item.full_name}</span>
        </button>
      ))}
    </div>
  );
});
