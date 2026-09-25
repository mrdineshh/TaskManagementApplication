import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackTo?: string;
  className?: string;
  label?: string;
}

/**
 * Universal accessible Back Button.
 * Visible on every page except the root starting page ('/').
 * Navigates back in history when available, or falls back to the parent hierarchy.
 * Supports keyboard shortcut: Alt + ArrowLeft.
 *
 * NOTE: All hooks are called unconditionally at the top level to adhere strictly
 * to the Rules of Hooks (preventing React error #300 / #310).
 */
export function BackButton({ fallbackTo, className = '', label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const segments = location.pathname.split('/').filter(Boolean);
  const isRootPage = location.pathname === '/' || segments.length === 0;
  const isVisible = !isRootPage || Boolean(fallbackTo);

  function handleBack() {
    // If user has in-app history navigation steps, go back in history
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
    } else if (fallbackTo) {
      navigate(fallbackTo);
    } else {
      // Hierarchical parent path fallback (e.g. /tasks/123 -> /tasks, /tasks -> /, /admin/users -> /admin, /admin -> /)
      const parentPath = segments.length > 1 ? '/' + segments.slice(0, -1).join('/') : '/';
      navigate(parentPath);
    }
  }

  useEffect(() => {
    if (!isVisible) return;
    function handleKeyDown(e: KeyboardEvent) {
      // Alt + ArrowLeft = standard browser back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      title="Go back (Alt + ←)"
      aria-label="Go back to previous page"
      className={`inline-flex items-center gap-1.5 btn-neu !py-1.5 !px-3 !text-xs !font-semibold shrink-0 ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
