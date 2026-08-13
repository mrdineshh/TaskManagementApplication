import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './queryClient';
import { Shell } from './Shell';
import { RequireAuth } from './RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { useBootstrapSession } from '../features/auth/useBootstrapSession';
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
import { TimelinePage } from '../pages/tasks/TimelinePage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { AdminLayout } from '../pages/admin/AdminLayout';
import { AdminHomePage } from '../pages/admin/AdminHomePage';
import { DepartmentsAdminPage } from '../pages/admin/DepartmentsAdminPage';
import { RolesAdminPage } from '../pages/admin/RolesAdminPage';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage';
import { CustomFieldsAdminPage } from '../pages/admin/CustomFieldsAdminPage';
import { WorkflowsAdminPage } from '../pages/admin/WorkflowsAdminPage';
import { PrioritiesAdminPage } from '../pages/admin/PrioritiesAdminPage';
import { IntegrationsAdminPage } from '../pages/admin/IntegrationsAdminPage';
import { OrgSettingsAdminPage } from '../pages/admin/OrgSettingsAdminPage';
import { HolidayCalendarsAdminPage } from '../pages/admin/HolidayCalendarsAdminPage';

function AppRoutes() {
  const ready = useBootstrapSession();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<MyTasksPage />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="tasks/board" element={<KanbanBoardPage />} />
          <Route path="tasks/timeline" element={<TimelinePage />} />
          <Route path="team" element={<TeamDashboardPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/builder" element={<ReportBuilderPage />} />
          <Route path="reports/:id" element={<ReportViewerPage />} />
          <Route path="reports/:id/edit" element={<ReportBuilderPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="departments" element={<DepartmentsAdminPage />} />
            <Route path="roles" element={<RolesAdminPage />} />
            <Route path="users" element={<UsersAdminPage />} />
            <Route path="custom-fields" element={<CustomFieldsAdminPage />} />
            <Route path="workflows" element={<WorkflowsAdminPage />} />
            <Route path="priorities" element={<PrioritiesAdminPage />} />
            <Route path="integrations" element={<IntegrationsAdminPage />} />
            <Route path="sla" element={<SLAAdminPage />} />
            <Route path="holiday-calendars" element={<HolidayCalendarsAdminPage />} />
            <Route path="settings" element={<OrgSettingsAdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
