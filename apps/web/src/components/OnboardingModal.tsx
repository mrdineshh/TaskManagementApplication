import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ListTodo,
  Kanban,
  Bell,
  Search,
  Rocket,
} from 'lucide-react';

const STEPS = [
  {
    icon: Sparkles,
    iconColor: 'text-blue-600 border-2 border-blue-600 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'Welcome to Pulse',
    body: 'You\'re in. Pulse helps your team manage work across departments with workflows, priorities, and real-time collaboration. Let\'s take a quick tour.',
    cta: 'Get started',
  },
  {
    icon: ListTodo,
    iconColor: 'text-blue-600 border-2 border-blue-600 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'My Tasks — your home base',
    body: 'The "My Tasks" page shows all tasks assigned to you, stat cards for overdue and upcoming work, and recently completed items. It\'s your first stop every day.',
    cta: 'Next',
  },
  {
    icon: Kanban,
    iconColor: 'text-purple-600 border-2 border-purple-600 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'Views: List, Kanban, Timeline',
    body: 'Switch between views to suit your workflow. Use "All Tasks" for power filtering, "Kanban" for status-based drag-and-drop, and "Timeline" for a Gantt-style schedule.',
    cta: 'Next',
  },
  {
    icon: Bell,
    iconColor: 'text-amber-500 border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'Notifications & @mentions',
    body: 'The bell icon shows real-time notifications. In task comments you can type @ to mention a teammate — they\'ll get notified instantly. Visit Settings to tune which events reach which channel.',
    cta: 'Next',
  },
  {
    icon: Search,
    iconColor: 'text-emerald-600 border-2 border-emerald-600 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'Global search',
    body: 'Hit Ctrl + K (or ⌘K on Mac) from anywhere to search tasks by title across all departments you have access to. Arrow-key navigate and press Enter to jump straight to a task.',
    cta: 'Next',
  },
  {
    icon: Rocket,
    iconColor: 'text-red-600 border-2 border-red-600 bg-white dark:bg-slate-900 shadow-2xs',
    title: 'You\'re all set!',
    body: 'That\'s the essentials. If you\'re an Admin, head to the Admin Console to configure departments, roles, workflows, and more. Otherwise, go create your first task!',
    cta: 'Start using Pulse',
  },
];

const LOCAL_STORAGE_KEY = 'onboarding_dismissed';

/** Returns true when the user should see the onboarding modal. */
export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(LOCAL_STORAGE_KEY);
}

export function dismissOnboarding(): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, '1');
}

/**
 * Full-screen onboarding wizard (plan §1.12) — shown on first login.
 * State is tracked in localStorage (key: onboarding_dismissed).
 * After the user completes or skips, the modal is never shown again.
 */
export function OnboardingModal() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  function finish() {
    dismissOnboarding();
    navigate('/');
    // Force a re-render by triggering a storage event (App.tsx listens and hides the modal)
    window.dispatchEvent(new Event('storage'));
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl neu-card !p-0 shadow-2xl">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8">
          {/* Icon illustration */}
          <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${current.iconColor}`}>
            <current.icon className="h-7 w-7" />
          </div>

          {/* Step counter */}
          <p className="mb-1 text-xs font-medium text-slate-400 dark:text-slate-500">
            Step {step + 1} of {STEPS.length}
          </p>

          <h2 className="mb-3 text-xl font-semibold text-slate-900 dark:text-slate-100">{current.title}</h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{current.body}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-8 py-4">
          <button
            onClick={finish}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-3">
            {/* Dot indicators */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-brand-500' : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-500'}`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              {current.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
