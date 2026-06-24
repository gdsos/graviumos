import { supabase } from './supabase';

export const PROJECT_WORK_PACKAGE_QC_STATUSES = [
  'pending',
  'needs_rework',
  'passed',
  'accepted_exception',
] as const;

export type ProjectWorkPackageQcStatus =
  (typeof PROJECT_WORK_PACKAGE_QC_STATUSES)[number];

export interface ProjectWorkPackageQcRecord {
  id: string;
  project_id: string;
  timeline_id: string | null;
  work_package_id: string;
  work_package_title: string;
  vendor_id: string | null;
  vendor_name: string | null;
  status: ProjectWorkPackageQcStatus;
  remarks: string | null;
  rework_notes: string | null;
  accepted_exception_reason: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
  passed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertProjectWorkPackageQcInput {
  projectId: string;
  timelineId?: string | null;
  workPackageId: string;
  workPackageTitle: string;
  vendorId?: string | null;
  vendorName?: string | null;
  status?: ProjectWorkPackageQcStatus;
  remarks?: string | null;
  reworkNotes?: string | null;
  acceptedExceptionReason?: string | null;
  inspectedBy?: string | null;
}

function normalizeQcStatus(
  status: ProjectWorkPackageQcStatus | undefined
): ProjectWorkPackageQcStatus {
  return status && PROJECT_WORK_PACKAGE_QC_STATUSES.includes(status)
    ? status
    : 'pending';
}

function getPassedAt(status: ProjectWorkPackageQcStatus) {
  return status === 'passed' || status === 'accepted_exception'
    ? new Date().toISOString()
    : null;
}

export async function listProjectWorkPackageQc(projectId: string) {
  const { data, error } = await supabase
    .from('project_work_package_qc')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []) as ProjectWorkPackageQcRecord[];
}

export async function upsertProjectWorkPackageQc(
  input: UpsertProjectWorkPackageQcInput
) {
  const status = normalizeQcStatus(input.status);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('project_work_package_qc')
    .upsert(
      {
        project_id: input.projectId,
        timeline_id: input.timelineId ?? null,
        work_package_id: input.workPackageId,
        work_package_title: input.workPackageTitle,
        vendor_id: input.vendorId ?? null,
        vendor_name: input.vendorName ?? null,
        status,
        remarks: input.remarks ?? null,
        rework_notes: input.reworkNotes ?? null,
        accepted_exception_reason: input.acceptedExceptionReason ?? null,
        inspected_by: input.inspectedBy ?? null,
        inspected_at: status === 'pending' ? null : now,
        passed_at: getPassedAt(status),
      },
      {
        onConflict: 'project_id,work_package_id',
      }
    )
    .select('*')
    .single();

  if (error) throw error;

  return data as ProjectWorkPackageQcRecord;
}

export async function deleteProjectWorkPackageQc(projectId: string) {
  const { error } = await supabase
    .from('project_work_package_qc')
    .delete()
    .eq('project_id', projectId);

  if (error) throw error;
}

export function isWorkPackageQcPayable(
  qcRecord: ProjectWorkPackageQcRecord | null | undefined
) {
  return (
    qcRecord?.status === 'passed' ||
    qcRecord?.status === 'accepted_exception'
  );
}

export function getWorkPackageQcStatusLabel(
  status: ProjectWorkPackageQcStatus | null | undefined
) {
  switch (status) {
    case 'passed':
      return 'QC Passed';
    case 'needs_rework':
      return 'Needs Rework';
    case 'accepted_exception':
      return 'Accepted Exception';
    default:
      return 'QC Pending';
  }
}
