import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { queryClient } from './queryClient';
import { Shell } from './Shell';
import { RequireAuth } from './RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { useBootstrapSession } from '../features/auth/useBootstrapSession';
import { OnboardingModal, shouldShowOnboarding } from '../components/OnboardingModal';
import { DepartmentPickerModal, shouldShowDepartmentPicker } from '../components/DepartmentPickerModal';
import { useSessionStore } from '../lib/auth/session-store';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MyTasksPage } from '../pages/dashboard/MyTasksPage';
import { TeamDashboardPage } from '../pages/dashboard/TeamDashboardPage';
import { TaskListPage } from '../pages/tasks/TaskListPage';
import { TaskDetailPage } from '../pages/tasks/TaskDetailPage';
import { KanbanBoardPage } from '../pages/tasks/KanbanBoardPage';
import { SLAAdminPage } from '../pages/admin/SLAAdminPage';
import { ReportsListPage } from '../pages/reports/ReportsListPage';
import { ReportBuilderPage } from '../pages/reports/ReportBuilderPage';
import { ReportViewerPage } from '../pages/reports/ReportViewerPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AdminLayout } from '../pages/admin/AdminLayout';
import { AdminHomePage } from '../pages/admin/AdminHomePage';
import { DepartmentsAdminPage } from '../pages/admin/DepartmentsAdminPage';
import { RolesAdminPage } from '../pages/admin/RolesAdminPage';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage';
import { WorkflowsAdminPage } from '../pages/admin/WorkflowsAdminPage';
import { PrioritiesAdminPage } from '../pages/admin/PrioritiesAdminPage';
import { IntegrationsAdminPage } from '../pages/admin/IntegrationsAdminPage';
import { ScorecardWeightsAdminPage } from '../pages/admin/ScorecardWeightsAdminPage';
import { ScorecardPage } from '../pages/scorecard/ScorecardPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { TimelinePage } from '../pages/tasks/TimelinePage';
import { EmployeeTimesheetPage } from '../pages/tasks/EmployeeTimesheetPage';
import { EmployeeDetailPage } from '../pages/tasks/EmployeeDetailPage';
import { AdminBugReportsPage } from '../pages/admin/AdminBugReportsPage';

function AppRoutes() {
  useBootstrapSession();
  const bootstrapped = useSessionStore((s) => s.bootstrapped);
  const currentUser = useSessionStore((s) => s.currentUser);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  // Once a user is logged in, check if they need to pick their department
  // (new employees who have never confirmed which team they belong to).
  // Admins are excluded since they have org-wide access — no single department applies.
  useEffect(() => {
    if (currentUser && Array.isArray(currentUser.roles) && !currentUser.roles.some((r) => r.name === 'Admin')) {
      setShowDeptPicker(shouldShowDepartmentPicker(currentUser.id));
    }
  }, [currentUser?.id]);

  // Only check once the session is bootstrapped and a user is logged in.
  useEffect(() => {
    if (currentUser) setShowOnboarding(shouldShowOnboarding());
  }, [currentUser?.id]);

  // When the onboarding modal fires the storage event (dismiss), hide it.
  useEffect(() => {
    function onStorage() { setShowOnboarding(shouldShowOnboarding()); }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 dark:text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<MyTasksPage />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/board" element={<KanbanBoardPage />} />
          <Route path="tasks/timeline" element={<TimelinePage />} />
          <Route path="tasks/timesheet/employees" element={<EmployeeTimesheetPage />} />
          <Route path="tasks/timesheet/employees/:userId" element={<EmployeeDetailPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="team" element={<TeamDashboardPage />} />
          <Route path="scorecard" element={<ScorecardPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/builder" element={<ReportBuilderPage />} />
          <Route path="reports/:id" element={<ReportViewerPage />} />
          <Route path="reports/:id/edit" element={<ReportBuilderPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="departments" element={<DepartmentsAdminPage />} />
            <Route path="roles" element={<RolesAdminPage />} />
            <Route path="users" element={<UsersAdminPage />} />
            <Route path="custom-fields" element={<Navigate to="/admin/priorities" replace />} />
            <Route path="workflows" element={<WorkflowsAdminPage />} />
            <Route path="priorities" element={<PrioritiesAdminPage />} />
            <Route path="integrations" element={<IntegrationsAdminPage />} />
            <Route path="sla" element={<SLAAdminPage />} />
            <Route path="scorecard-weights" element={<ScorecardWeightsAdminPage />} />
            <Route path="bug-reports" element={<AdminBugReportsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {/* Department picker MUST be shown before the feature tour — it's non-skippable */}
    {showDeptPicker && !showOnboarding && (
      <DepartmentPickerModal
        onDone={() => {
          setShowDeptPicker(false);
          // After dept confirmed, check if the feature tour should show.
          if (currentUser) setShowOnboarding(shouldShowOnboarding());
        }}
      />
    )}
    {showOnboarding && <OnboardingModal />}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
