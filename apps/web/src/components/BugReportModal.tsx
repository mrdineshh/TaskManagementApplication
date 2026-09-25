import { useRef, useState } from 'react';
import { X, Bug, Send, ImageIcon, Trash2, Activity } from 'lucide-react';
import { useSubmitBugReport } from '../features/tasks/hooks';

interface BugReportModalProps {
  onClose: () => void;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitBugReport = useSubmitBugReport();

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Only images are supported (JPEG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setImageError('Image is too large. Please upload an image under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1]; // strip "data:image/...;base64,"
      setScreenshotBase64(base64 ?? null);
      setScreenshotPreview(dataUrl);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setScreenshotName('');
    setImageError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 10) return;
    const pageUrl = window.location.href;
    await submitBugReport.mutateAsync({
      description: description.trim(),
      pageUrl,
      screenshotBase64: screenshotBase64 ?? undefined,
    });
    setDescription('');
    removeImage();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md neu-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* Pulse logo icon */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-sm shadow-brand-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Report a Bug</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Help us improve Pulse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Describe the issue <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What went wrong? What did you expect to happen? Include any steps to reproduce the issue…"
              required
              minLength={10}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              Your current page URL will be automatically included.
            </p>
          </div>

          {/* Screenshot upload — optional */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Screenshot <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
            </label>

            {screenshotPreview ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="w-full max-h-40 object-contain bg-slate-50 dark:bg-slate-950"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{screenshotName}</span>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="text-[11px] text-red-600 dark:text-red-400 hover:underline shrink-0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 py-4 text-xs text-slate-500 dark:text-slate-400 hover:border-brand-400 dark:hover:border-brand-600 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                <span>Click to upload a screenshot</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">JPEG, PNG, WebP, GIF · max 2MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={handleImageSelected}
            />

            {imageError && (
              <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{imageError}</p>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitBugReport.isPending || description.trim().length < 10}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitBugReport.isPending ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
