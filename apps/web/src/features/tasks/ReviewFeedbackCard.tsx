import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Paperclip,
  RotateCcw,
  Send,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Clock,
  FileCheck,
} from 'lucide-react';
import type { TaskReview } from '@taskapp/shared-types';
import { useTaskReviews, useResubmitReview } from './hooks';

const MARKED_READ_STORAGE_KEY = 'task_reviews_marked_read';

function getPersistedMarkedRead(): Set<string> {
  try {
    const raw = localStorage.getItem(MARKED_READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistMarkedRead(set: Set<string>) {
  try {
    localStorage.setItem(MARKED_READ_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

interface ReviewFeedbackCardProps {
  taskId: string;
  isAssignee: boolean;
  isManagerOrAdmin: boolean;
  isInReviewStatus?: boolean;
  onRequestReview?: () => void;
  onMarkAsRead?: () => void;
}

export function ReviewFeedbackCard({
  taskId,
  isAssignee,
  isManagerOrAdmin,
  isInReviewStatus,
  onRequestReview,
  onMarkAsRead,
}: ReviewFeedbackCardProps) {
  const { data: reviews, isLoading } = useTaskReviews(taskId);
  const resubmitReview = useResubmitReview(taskId);

  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitNote, setResubmitNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Track "Mark as Read" acknowledgments in localStorage
  const [markedRead, setMarkedRead] = useState<Set<string>>(() => getPersistedMarkedRead());

  if (isLoading) {
    return null;
  }

  const hasReviews = Boolean(reviews && reviews.length > 0);
  const latestReview = hasReviews ? reviews![0] : null;
  const isChangesRequested = latestReview?.decision === 'changes_requested';
  const isActive = latestReview?.status === 'active';
  const pastReviews = hasReviews ? reviews!.slice(1) : [];
  const isMarkedRead = latestReview ? markedRead.has(latestReview.id) : false;

  async function handleMarkAsRead(reviewId: string) {
    const next = new Set(markedRead);
    next.add(reviewId);
    setMarkedRead(next);
    persistMarkedRead(next);
    if (onMarkAsRead) {
      await onMarkAsRead();
    }
  }

  // If task is currently in review, show an "awaiting review" banner
  if (isInReviewStatus) {
    return (
      <div className="neu-card !p-4 border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center gap-3">
        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/60 p-2 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              Awaiting Manager Review
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              In Review
            </span>
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
            {isAssignee
              ? 'Your task has been submitted for review. Your manager has been notified and will provide feedback or approval shortly.'
              : 'Employee has submitted this task for review. Use the review panel above to approve or request changes.'}
          </p>
        </div>
      </div>
    );
  }

  // If no reviews yet, show the permanent Review Box with prompt whether user wants manager review
  if (!hasReviews) {
    return (
      <div className="neu-card !p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/60 p-2.5 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-900/50 shadow-inner">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Manager Review &amp; Feedback
                </h3>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  No reviews yet
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                No manager review has been conducted yet for this task.
              </p>
            </div>
          </div>

          {/* Action button if assignee wants review */}
          {isAssignee && onRequestReview && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRequestReview}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Submit for Manager Review
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400">
            {isAssignee
              ? 'Would you like your manager to review this task upon completion? You can submit it for review once your work is ready.'
              : 'This task does not have any review records yet. Once submitted, manager feedback and attachments will appear here.'}
          </span>
          {isAssignee && onRequestReview && (
            <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
              Optional: Click "Submit for Manager Review" when ready
            </span>
          )}
        </div>
      </div>
    );
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    await resubmitReview.mutateAsync(resubmitNote.trim() || undefined);
    setResubmitNote('');
    setResubmitModalOpen(false);
  }

  return (
    <div className="space-y-3">
      {/* Primary Review Feedback Box */}
      {isChangesRequested && isActive && latestReview ? (
        <div
          className={
            isMarkedRead
              ? 'neu-card !p-5 transition-all border border-slate-200 dark:border-slate-800'
              : 'rounded-xl border border-amber-400/90 dark:border-amber-600/90 bg-amber-50/90 dark:bg-amber-950/60 p-5 shadow-sm transition-all'
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={
                  isMarkedRead
                    ? 'rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-200 dark:border-emerald-800'
                    : 'rounded-xl bg-amber-100 dark:bg-amber-900/80 p-2.5 text-amber-700 dark:text-amber-300 shrink-0 shadow-inner'
                }
              >
                {isMarkedRead ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      isMarkedRead
                        ? 'inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                        : 'inline-flex items-center gap-1.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200'
                    }
                  >
                    {isMarkedRead ? 'Feedback Acknowledged • In Progress' : 'Changes Requested'}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    by{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {latestReview.reviewer?.full_name ?? 'Reviewer'}
                    </strong>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-500">
                    • {new Date(latestReview.created_at).toLocaleString()}
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isMarkedRead ? 'Reviewer Feedback (Changes In Progress)' : 'Reviewer Feedback & Action Required'}
                </h3>
              </div>
            </div>

            {/* Mark as Read button */}
            {!isMarkedRead ? (
              <button
                type="button"
                onClick={() => handleMarkAsRead(latestReview.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors shrink-0 shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                Mark as Read
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Marked as Read
              </span>
            )}
          </div>

          {/* Feedback Body Well */}
          <div
            className={
              isMarkedRead
                ? 'mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-4 shadow-sm'
                : 'mt-4 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm'
            }
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Review Comments:
            </p>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
              {latestReview.feedback}
            </div>
          </div>

          {/* Reference Files Attached by Reviewer */}
          {latestReview.attachments && latestReview.attachments.length > 0 && (
            <div
              className={
                isMarkedRead
                  ? 'mt-4 pt-3 border-t border-slate-200 dark:border-slate-800'
                  : 'mt-4 pt-3 border-t border-amber-200/70 dark:border-amber-800/60'
              }
            >
              <div className="flex items-center gap-2 mb-2.5">
                <Paperclip className={isMarkedRead ? 'w-4 h-4 text-slate-600 dark:text-slate-400' : 'w-4 h-4 text-amber-700 dark:text-amber-400'} />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Reference Files Attached by Reviewer ({latestReview.attachments.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {latestReview.attachments.map((att) => {
                  const isImage = att.mime_type.startsWith('image/');
                  return (
                    <div
                      key={att.id}
                      className="group flex flex-col justify-between neu-card p-3 hover:border-brand-500/50 dark:hover:border-brand-500/50 transition-all shadow-sm rounded-xl"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="rounded-md p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {isImage ? (
                            <ImageIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                            title={att.file_name}
                          >
                            {att.file_name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatBytes(att.size_bytes)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {isImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(att.download_url ?? null)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Preview
                          </button>
                        )}
                        <a
                          href={att.download_url}
                          download={att.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manager acknowledged badge */}
          {isManagerOrAdmin && isMarkedRead && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-white/60 dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              Feedback acknowledged — awaiting employee action.
            </div>
          )}

          {/* Employee single resubmit action at bottom — no duplicate */}
          {isAssignee && !isInReviewStatus && (
            <div
              className={
                isMarkedRead
                  ? 'mt-4 flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800'
                  : 'mt-4 flex items-center justify-between gap-3 pt-3 border-t border-amber-200/70 dark:border-amber-800/60'
              }
            >
              <p
                className={
                  isMarkedRead
                    ? 'text-xs text-slate-600 dark:text-slate-400'
                    : 'text-xs text-amber-900/90 dark:text-amber-200/90'
                }
              >
                Once you have addressed the feedback above, resubmit this task to your manager for another review.
              </p>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(true)}
                disabled={resubmitReview.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Resubmit for Review
              </button>
            </div>
          )}
        </div>
      ) : latestReview?.decision === 'approved' ? (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                    Review Approved
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    by {latestReview.reviewer?.full_name ?? 'Manager'} •{' '}
                    {new Date(latestReview.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {latestReview.feedback && latestReview.feedback !== 'Approved' && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 italic">
                    &ldquo;{latestReview.feedback}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Review History Toggle (if multiple review cycles exist) */}
      {pastReviews.length > 0 && (
        <div className="neu-card !p-0 overflow-hidden shadow-sm rounded-2xl">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Previous Review History ({pastReviews.length} cycle{pastReviews.length > 1 ? 's' : ''})
            </span>
            {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {historyOpen && (
            <div className=" border-t border-slate-100 dark:border-slate-800 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
              {pastReviews.map((rev) => (
                <div key={rev.id} className="pt-2.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {rev.reviewer?.full_name ?? 'Reviewer'} (
                      <span className={rev.decision === 'approved' ? 'text-emerald-600' : 'text-amber-600'}>
                        {rev.decision === 'approved' ? 'Approved' : 'Changes Requested'}
                      </span>
                      )
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {rev.feedback}
                  </p>

                  {rev.attachments && rev.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rev.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.download_url}
                          download={a.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Paperclip className="w-2.5 h-2.5" />
                          {a.file_name} ({formatBytes(a.size_bytes)})
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resubmit Modal */}
      {resubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl neu-card shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-brand-600" />
                Resubmit Task for Review
              </h3>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                This will transition the task back to <strong>In Review</strong> and notify your
                manager and reviewers that the changes have been made.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Note on Changes Completed (optional):
                </label>
                <textarea
                  value={resubmitNote}
                  onChange={(e) => setResubmitNote(e.target.value)}
                  placeholder="Explain what changes were updated, files adjusted, or additional notes for the reviewer…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResubmitModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resubmitReview.isPending}
                  className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resubmitReview.isPending ? 'Submitting…' : 'Resubmit Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-slate-800/80 p-1.5 text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Reference Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
