import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bug, Calendar, Globe, User, ChevronDown, ChevronUp, Activity, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '../../lib/api-client/client';

function timeAgo(iso?: string | null): string {
  if (!iso) return 'recently';
  const time = new Date(iso).getTime();
  if (isNaN(time)) return 'recently';
  const ms = Date.now() - time;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

interface BugReportEntry {
  id: string;
  description: string;
  pageUrl?: string | null;
  page_url?: string | null;
  screenshotBase64?: string | null;
  screenshot_base64?: string | null;
  createdAt?: string;
  created_at?: string;
  reporter?: {
    id?: string;
    fullName?: string;
    full_name?: string;
    email?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
  } | null;
}

function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

function ReporterAvatar({ name, url }: { name?: string | null; url?: string | null }) {
  if (url) {
    return <img src={url} alt={name ?? 'User'} className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/60 text-xs font-bold text-brand-700 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-800/40">
      {getInitials(name)}
    </span>
  );
}

function BugReportCard({ report }: { report: BugReportEntry }) {
  const [expanded, setExpanded] = useState(false);

  const reporterName = report.reporter?.fullName ?? report.reporter?.full_name ?? 'Anonymous User';
  const reporterEmail = report.reporter?.email ?? '—';
  const reporterAvatar = report.reporter?.avatarUrl ?? report.reporter?.avatar_url ?? null;
  const screenshotBase64 = report.screenshotBase64 ?? report.screenshot_base64 ?? null;
  const pageUrl = report.pageUrl ?? report.page_url ?? null;
  const createdAt = report.createdAt ?? report.created_at ?? '';
  const description = report.description ?? '';
  const hasScreenshot = Boolean(screenshotBase64);

  return (
    <div className="neu-card !p-0 overflow-hidden shadow-sm rounded-2xl transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <ReporterAvatar name={reporterName} url={reporterAvatar} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reporterName}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{reporterEmail}</span>
              {hasScreenshot && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <ImageIcon className="w-3 h-3" /> Screenshot
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {createdAt ? new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                <span className="text-slate-300 dark:text-slate-600">·</span>
                {timeAgo(createdAt)}
              </span>
              {pageUrl && (
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline truncate max-w-xs"
                  title={pageUrl}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  {pageUrl.replace(/^https?:\/\/[^/]+/, '') || pageUrl}
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3.5">
          <p
            className={`text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed ${
              !expanded && description.length > 220 ? 'line-clamp-3' : ''
            }`}
          >
            {description || 'No description provided.'}
          </p>
          {description.length > 220 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show more</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Screenshot attached */}
      {hasScreenshot && screenshotBase64 && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <ImageIcon className="w-3 h-3 text-brand-600 dark:text-brand-400" />
            Attached Screenshot (Click to open full view)
          </p>
          <img
            src={`data:image/jpeg;base64,${screenshotBase64}`}
            alt="Bug report screenshot"
            className="rounded-lg border border-slate-200 dark:border-slate-700 max-h-72 w-auto max-w-full object-contain cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
            onClick={() => {
              const win = window.open();
              if (win) {
                win.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Bug Report Screenshot</title>
                      <style>
                        body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
                        img { max-width: 100%; max-height: 95vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                      </style>
                    </head>
                    <body>
                      <img src="data:image/jpeg;base64,${screenshotBase64}" alt="Screenshot" />
                    </body>
                  </html>
                `);
              }
            }}
            title="Click to view full size"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Admin-only page to review bug reports submitted by users.
 * Shows all reports in reverse chronological order with reporter info, description, and optional screenshot.
 * Route: /admin/bug-reports
 */
export function AdminBugReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'bug-reports'],
    queryFn: async () => {
      const res = await apiClient.bugReports.list();
      return Array.isArray(res) ? (res as BugReportEntry[]) : [];
    },
    refetchInterval: 60_000,
  });

  const reports = (data ?? []) as BugReportEntry[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/30">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              Bug Reports
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review and inspect issues submitted by users across the application.
            </p>
          </div>
        </div>

        {!isLoading && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
              <Bug className="w-3 h-3" />
              {reports.length} {reports.length === 1 ? 'report' : 'reports'}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">Loading bug reports…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-center">
          <Bug className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Failed to load bug reports</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center p-6">
          <Bug className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No bug reports submitted yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
            When users submit issues using the "Report Bug" modal, their feedback and screenshots will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <BugReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
