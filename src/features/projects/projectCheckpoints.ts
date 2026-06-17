import {
  supabase,
  type ProjectCheckpoint,
  type ProjectCheckpointKey,
  type ProjectCheckpointStatus,
} from '../../lib/supabase';

export type ProjectCheckpointTemplate = {
  checkpoint_key: ProjectCheckpointKey;
  title: string;
  sort_order: number;
  is_required: boolean;
  defaultStatus: ProjectCheckpointStatus;
  defaultChecklist: Array<{
    id: string;
    label: string;
    is_completed: boolean;
  }>;
};

export const PROJECT_CHECKPOINT_TEMPLATES: ProjectCheckpointTemplate[] = [
  {
    checkpoint_key: 'initial_site_visit',
    title: 'Initial Site Visit',
    sort_order: 1,
    is_required: true,
    defaultStatus: 'available',
    defaultChecklist: [
      {
        id: 'site-measurements',
        label: 'Site measurements recorded',
        is_completed: false,
      },
      {
        id: 'site-images',
        label: 'Site images captured',
        is_completed: false,
      },
      {
        id: 'client-requirements',
        label: 'Client requirements documented',
        is_completed: false,
      },
      {
        id: 'custom-requirements',
        label: 'Custom requirements noted',
        is_completed: false,
      },
    ],
  },
  {
    checkpoint_key: 'design_phase',
    title: 'Design Phase',
    sort_order: 2,
    is_required: true,
    defaultStatus: 'locked',
    defaultChecklist: [
      {
        id: 'design-approval',
        label: 'Design approval completed',
        is_completed: false,
      },
      {
        id: 'design-estimate',
        label: 'Design estimate completed or bypassed',
        is_completed: false,
      },
    ],
  },
  {
    checkpoint_key: 'execution',
    title: 'Execution',
    sort_order: 3,
    is_required: true,
    defaultStatus: 'locked',
    defaultChecklist: [
      {
        id: 'cost-estimate-ready',
        label: 'Cost estimate created or approved',
        is_completed: false,
      },
      {
        id: 'timeline-ready',
        label: 'Timeline created and confirmed',
        is_completed: false,
      },
    ],
  },
  {
    checkpoint_key: 'quality_control',
    title: 'Quality Control',
    sort_order: 4,
    is_required: true,
    defaultStatus: 'locked',
    defaultChecklist: [
      {
        id: 'work-package-qc',
        label: 'Work-package QC checklist completed',
        is_completed: false,
      },
      {
        id: 'handover-readiness',
        label: 'Handover readiness verified',
        is_completed: false,
      },
    ],
  },
  {
    checkpoint_key: 'handover',
    title: 'Handover Done',
    sort_order: 5,
    is_required: true,
    defaultStatus: 'locked',
    defaultChecklist: [
      {
        id: 'client-handover',
        label: 'Client handover completed',
        is_completed: false,
      },
      {
        id: 'final-documents',
        label: 'Final documents shared',
        is_completed: false,
      },
    ],
  },
];

export function sortProjectCheckpoints(checkpoints: ProjectCheckpoint[]) {
  return [...checkpoints].sort((a, b) => a.sort_order - b.sort_order);
}

export function getCheckpointTemplate(checkpointKey: ProjectCheckpointKey) {
  return PROJECT_CHECKPOINT_TEMPLATES.find(
    template => template.checkpoint_key === checkpointKey
  );
}

export async function ensureProjectCheckpoints(
  projectId: string,
  createdBy?: string | null
) {
  const payload = PROJECT_CHECKPOINT_TEMPLATES.map(template => ({
    project_id: projectId,
    checkpoint_key: template.checkpoint_key,
    title: template.title,
    status: template.defaultStatus,
    sort_order: template.sort_order,
    is_required: template.is_required,
    checklist: template.defaultChecklist,
    created_by: createdBy ?? null,
  }));

  const { data, error } = await supabase
    .from('project_checkpoints')
    .upsert(payload, { onConflict: 'project_id,checkpoint_key' })
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return sortProjectCheckpoints((data || []) as ProjectCheckpoint[]);
}

export async function fetchProjectCheckpoints(projectId: string) {
  const { data, error } = await supabase
    .from('project_checkpoints')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const checkpoints = sortProjectCheckpoints((data || []) as ProjectCheckpoint[]);

  if (checkpoints.length === PROJECT_CHECKPOINT_TEMPLATES.length) {
    return checkpoints;
  }

  return ensureProjectCheckpoints(projectId);
}

export async function fetchProjectCheckpointsByProjectIds(projectIds: string[]) {
  const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));

  if (uniqueProjectIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('project_checkpoints')
    .select('*')
    .in('project_id', uniqueProjectIds)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const checkpointsByProjectId: Record<string, ProjectCheckpoint[]> = {};

  ((data || []) as ProjectCheckpoint[]).forEach(checkpoint => {
    if (!checkpointsByProjectId[checkpoint.project_id]) {
      checkpointsByProjectId[checkpoint.project_id] = [];
    }

    checkpointsByProjectId[checkpoint.project_id].push(checkpoint);
  });

  return Object.fromEntries(
    Object.entries(checkpointsByProjectId).map(([projectId, checkpoints]) => [
      projectId,
      sortProjectCheckpoints(checkpoints),
    ])
  );
}

export async function updateProjectCheckpoint(
  checkpointId: string,
  updates: Partial<
    Pick<
      ProjectCheckpoint,
      | 'status'
      | 'notes'
      | 'checklist'
      | 'attachments'
      | 'metadata'
      | 'completed_at'
      | 'completed_by'
    >
  >
) {
  const { data, error } = await supabase
    .from('project_checkpoints')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkpointId)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  return data as ProjectCheckpoint | null;
}

export async function completeProjectCheckpoint(
  checkpoint: ProjectCheckpoint,
  completedBy?: string | null
) {
  return updateProjectCheckpoint(checkpoint.id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: completedBy ?? null,
  });
}

export function getNextUnlockedCheckpointStatus(
  checkpoints: ProjectCheckpoint[],
  checkpointKey: ProjectCheckpointKey
): ProjectCheckpointStatus {
  const sortedCheckpoints = sortProjectCheckpoints(checkpoints);
  const index = sortedCheckpoints.findIndex(
    checkpoint => checkpoint.checkpoint_key === checkpointKey
  );

  if (index <= 0) return 'available';

  const previousCheckpoint = sortedCheckpoints[index - 1];

  return previousCheckpoint?.status === 'completed' ||
    previousCheckpoint?.status === 'skipped'
    ? 'available'
    : 'locked';
}
