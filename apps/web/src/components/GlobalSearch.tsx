import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { apiClient } from '../lib/api-client/client';

interface SearchResult {
  id: string;
  title: string;
  status?: { label: string; color: string | null };
  department?: { name: string };
}

/**
 * Global search — always visible search bar in the header with neumorphic styling,
 * responsive text cursor, clear button, and floating results dropdown.
 */
export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setCursor(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.tasks.list({ q: val.trim(), limit: '8' } as any);
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setResults(items as SearchResult[]);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      pick(results[cursor].id);
    }
  }

  function pick(id: string) {
    navigate(`/tasks/${id}`);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearSearch() {
    setQuery('');
    setOpen(false);
    setResults([]);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Search Input Bar - Always visible */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-xs"
        style={{
          width: '16rem',
          minWidth: '13rem',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="w-4 h-4 shrink-0 pointer-events-none text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim() && results.length > 0) setOpen(true); }}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="flex-1 min-w-0 text-sm outline-none border-none bg-transparent"
          style={{
            color: 'var(--text-primary)',
            caretColor: '#2563EB',
            padding: '2px 0',
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearSearch(); }}
            className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 pointer-events-none select-none text-slate-400 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600/40"
          >
            ⌘K
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div
          className="absolute top-full right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl animate-pop-in"
          style={{
            width: '22rem',
          }}
        >
          {loading && (
            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-faint)' }}>Searching…</p>
          )}
          {!loading && results.length === 0 && query && (
            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-faint)' }}>No tasks found for "{query}".</p>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => pick(r.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors"
              style={{
                background: i === cursor ? 'rgba(37,99,235,0.08)' : 'transparent',
                color: i === cursor ? '#2563EB' : 'var(--text-muted)',
                borderBottom: i < results.length - 1 ? '1px solid var(--neu-dark)' : 'none',
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug break-words">{r.title}</p>
                {r.department && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{r.department.name}</p>
                )}
              </div>
              {r.status && (
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-2"
                  style={{ borderColor: r.status.color ?? '#94a3b8' }}
                >
                  {r.status.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
