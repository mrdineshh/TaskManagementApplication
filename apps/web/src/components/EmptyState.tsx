import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  linkAction?: { label: string; href: string };
}

/** Neumorphic illustrated empty state with raised icon well and gradient CTA. */
export function EmptyState({ icon, title, subtitle, action, linkAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && (
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl animate-float"
          style={{ background: "var(--neu-bg)", boxShadow: "6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)" }}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      {subtitle && (
        <p className="mt-1.5 max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      )}
      {(action || linkAction) && (
        <div className="mt-6 flex items-center gap-3">
          {action && (
            <button onClick={action.onClick} className="btn-primary">
              {action.label}
            </button>
          )}
          {linkAction && (
            <Link to={linkAction.href} className="btn-neu text-sm">
              {linkAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
