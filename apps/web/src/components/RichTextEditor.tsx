import { useRef, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import './rich-text-editor.css';
import { MentionSuggestion } from './MentionSuggestion';

export interface RichTextEditorProps {
  /** Initial HTML or plain text content */
  content?: string;
  /** Called with the raw HTML string on every change */
  onChange?: (html: string) => void;
  /** Called with JSON (Tiptap doc) on every change — use for storing Tiptap-native format */
  onChangeJson?: (json: object) => void;
  placeholder?: string;
  /** If true the editor is a single-line comment box (no block formatting toolbar) */
  compact?: boolean;
  /** Department-scoped member list for @mention autocomplete — updated reactively via ref */
  members?: { id: string; full_name: string }[];
}

/**
 * Tiptap-based rich text editor (plan §1.4).
 * - Bold, italic, strikethrough via keyboard shortcuts / toolbar
 * - Ordered/unordered lists, blockquote
 * - @mention autocomplete (delegates to MentionSuggestion)
 * - Placeholder text
 * - compact mode: single-line comment box without the formatting toolbar
 *
 * The members ref is kept up-to-date via useEffect so @mention always sees the
 * latest user list even if useUsers() resolves after the editor first mounts.
 */
export function RichTextEditor({ content = '', onChange, onChangeJson, placeholder = 'Write something…', compact = false, members = [] }: RichTextEditorProps) {
  // Stable ref updated every render — MentionSuggestion reads from this ref
  // so it always has the freshest members list without remounting the editor.
  const membersRef = useRef<{ id: string; full_name: string }[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        // Pass the stable ref — MentionSuggestion.items() reads membersRef.current live
        suggestion: MentionSuggestion(membersRef),
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML());
      onChangeJson?.(editor.getJSON());
    },
  });

  if (!editor) return null;

  return (
    <div className="rich-text-editor rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-brand-400/60 focus-within:border-brand-400 dark:focus-within:border-brand-600 transition-[box-shadow,border-color]">
      {!compact && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className={`prose dark:prose-invert prose-sm max-w-none px-3 py-2 outline-none focus:outline-none ${compact ? 'min-h-[2.5rem]' : 'min-h-[8rem]'}`}
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btnBase = 'rounded px-1.5 py-0.5 text-xs font-mono transition-colors';
  const active = 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100';
  const inactive = 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';

  function btn(label: string, isActive: boolean, onClick: () => void, title?: string) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title ?? label}
        className={`${btnBase} ${isActive ? active : inactive}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 dark:border-slate-700 px-2 py-1">
      {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold (Ctrl+B)')}
      {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic (Ctrl+I)')}
      {btn('S̶', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough')}
      <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
      {btn('• List', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {btn('1. List', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {btn('" "', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote')}
      <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
      {btn('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      <span className="ml-auto" />
      <button
        type="button"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        className={`${btnBase} ${inactive}`}
        title="Clear formatting"
      >
        Tx
      </button>
    </div>
  );
}
