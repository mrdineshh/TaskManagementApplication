import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client/client';
import type { ReportConfig, ReportExportFormat, SavedReport } from '@taskapp/shared-types';

export function useReportMetrics() {
  return useQuery({ queryKey: ['report-metrics'], queryFn: () => apiClient.reportMetrics.list() });
}

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: () => apiClient.reports.list() });
}

export function useReport(id?: string) {
  return useQuery({ queryKey: ['reports', id], queryFn: () => apiClient.reports.get(id!), enabled: !!id });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; config: ReportConfig; visibility?: SavedReport['visibility']; shared_with_role_ids?: string[] }) =>
      apiClient.reports.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ name: string; config: ReportConfig; visibility: SavedReport['visibility']; shared_with_role_ids: string[] }>;
    }) => apiClient.reports.update(id, data),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['reports', vars.id] });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.reports.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function usePreviewReport() {
  return useMutation({ mutationFn: (config: ReportConfig) => apiClient.reports.preview(config) });
}

export function useRunReport(id?: string) {
  return useQuery({ queryKey: ['reports', id, 'run'], queryFn: () => apiClient.reports.run(id!), enabled: !!id });
}

export function useExportSavedReport() {
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: ReportExportFormat }) => apiClient.reports.exportSaved(id, format),
  });
}

export function useExportPreview() {
  return useMutation({
    mutationFn: ({ config, format }: { config: ReportConfig; format: ReportExportFormat }) => apiClient.reports.exportPreview(config, format),
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useReportSchedules(reportId?: string) {
  return useQuery({
    queryKey: ['report-schedules', reportId],
    queryFn: () => apiClient.reportSchedules.list(reportId!),
    enabled: !!reportId,
  });
}

export function useCreateReportSchedule(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.reportSchedules.create(reportId, data as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-schedules', reportId] }),
  });
}

export function useUpdateReportSchedule(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: string; data: Record<string, unknown> }) =>
      apiClient.reportSchedules.update(reportId, scheduleId, data as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-schedules', reportId] }),
  });
}

export function useDeleteReportSchedule(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) => apiClient.reportSchedules.remove(reportId, scheduleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-schedules', reportId] }),
  });
}
