import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Task, type Subtask, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PButton, PHeading, PInlineNotification, PModal, PTag, PText, PIcon } from '@/components/ui/porsche';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface TaskWithDetails extends Task {
  subtasks: Subtask[];
  effectiveStatus: TaskStatus;
  overdueByDays?: number;
  deptName?: string;
}

interface TaskFormState {
  title: string;
  description: string;
  assigned_to: string;
  department_id: string;
  deadline_date: string;
  status: TaskStatus;
  project_id: string;
}

const EMPTY_FORM: TaskFormState = {
  title: '',
  description: '',
  assigned_to: '',
  department_id: '',
  deadline_date: '',
  status: 'Not Started',
  project_id: '',
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5"
        style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

const STATUSES: TaskStatus[] = ['Not Started', 'Ongoing', 'Overdue', 'Completed'];

const STATUS_TAG_VARIANT: Record<TaskStatus, Parameters<typeof PTag>[0]['variant']> = {
  'Not Started': 'secondary',
  Ongoing: 'info',
  Overdue: 'error',
  Completed: 'success',
};

const STATUS_COLUMN_BG: Record<TaskStatus, string> = {
  'Not Started': 'bg-surface',
  Ongoing: 'bg-info-soft/30',
  Overdue: 'bg-error-soft/30',
  Completed: 'bg-success-soft/30',
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) return 'Overdue';
  return task.status;
}

function calcOverdueDays(task: Task): number | undefined {
  if (task.status !== 'Completed' || !task.deadline || !task.completed_at) return undefined;
  const diff = Math.floor(
    (new Date(task.completed_at).getTime() - new Date(task.deadline).getTime()) / 86400000
  );
  return diff > 0 ? diff : undefined;
}

function calcProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;
  return Math.round((subtasks.filter(s => s.is_completed).length / subtasks.length) * 100);
}

function formatDeadline(iso: string | null): string {
  if (!iso) return 'â€”';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? '#2e7d32' : value >= 75 ? '#0288d1' : '#ed6c02';
  return (
    <div className="w-full bg-contrast-low/30 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${value}%`,
          background: color,
        }}
      />
    </div>
  );
}

interface TaskCardProps {
  task: TaskWithDetails;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const hasSubtasks = task.subtasks.length > 0;
  const progress = hasSubtasks ? calcProgress(task.subtasks) : task.progress;
  const deadlineOverdue = task.status !== 'Completed' && isOverdue(task.deadline);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-canvas rounded-xl border-2 border-contrast-low hover:border-primary focus:outline-none focus:border-primary transition-colors p-4 flex flex-col gap-3"
    >
      <PText size="small" weight="semi-bold" className="line-clamp-2" style={{ fontFamily: FONT }}>
        {task.title}
      </PText>

      <div className="flex flex-wrap items-center gap-1.5">
        <PTag variant={STATUS_TAG_VARIANT[task.effectiveStatus]} compact>
          {task.effectiveStatus === 'Completed' && task.overdueByDays
            ? `Completed (Overdue by ${task.overdueByDays}d)`
            : task.effectiveStatus}
        </PTag>
        {task.deptName && (
          <PTag color="background-surface" compact>
            {task.deptName}
          </PTag>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <PIcon
          name="calendar"
          size="x-small"
          color={deadlineOverdue ? 'notification-error' : 'contrast-medium'}
        />
        <PText
          size="x-small"
          color={deadlineOverdue ? 'notification-error' : 'contrast-medium'}
          style={{ fontFamily: FONT }}
        >
          {formatDeadline(task.deadline)}
        </PText>
      </div>

      {/* Completed on */}
      {task.effectiveStatus === 'Completed' && task.completed_at && (
        <div className="flex items-center gap-1.5">
          <PIcon name="check" size="x-small" color="notification-success" />
          <PText size="x-small" color="notification-success" style={{ fontFamily: FONT }}>
            Completed on {formatDeadline(task.completed_at)}
          </PText>
        </div>
      )}

      {/* Progress */}
      <div className="flex flex-col gap-1">
        <ProgressBar value={progress} />
        <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
          {hasSubtasks
            ? `${task.subtasks.filter(s => s.is_completed).length}/${task.subtasks.length} subtasks Â· ${progress}%`
            : `${progress}%`}
        </PText>
      </div>
    </button>
  );
}

// â”€â”€â”€ Kanban Column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithDetails[];
  onCardClick: (task: TaskWithDetails) => void;
}

function KanbanColumn({ status, tasks, onCardClick }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col gap-3 min-w-[240px] flex-1 rounded-2xl p-3 ${STATUS_COLUMN_BG[status]}`}>
      <div className="flex items-center justify-between pb-2 border-b-2 border-contrast-low">
        <PText
          size="x-small"
          weight="semi-bold"
          color="contrast-high"
          className="uppercase tracking-wider"
          style={{ fontFamily: FONT }}
        >
          {status}
        </PText>
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-contrast-low/40 text-xs font-semibold text-contrast-high">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-contrast-low/50">
            <PText size="x-small" color="contrast-low" style={{ fontFamily: FONT }}>
              No tasks
            </PText>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onCardClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MyTasks() {
  const { profile, departments, isDeptHead, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'assigned'>('all');

  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Task creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const deadlineDateRef = useRef<HTMLInputElement>(null);

  const [detailTask, setDetailTask] = useState<TaskWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Update form state inside detail modal
  const [updateStatus, setUpdateStatus] = useState<TaskStatus>('Not Started');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Subtask management state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // â”€â”€â”€ Fetch profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, department_ids, is_active, role')
      .eq('is_active', true);
    setAllProfiles((data as Profile[]) || []);
  }, []);

  // â”€â”€â”€ Fetch tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const fetchTasks = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');

    let tasksData, tasksErr;

    // For department heads (but not super admins): show department tasks
    const isDeptHeadOnly = isDeptHead() && !isAdmin();
    if (isDeptHeadOnly) {
      // Show all tasks under the department head's department
      const { data, error: err } = await supabase
        .from('tasks')
        .select('*')
        .eq('department_id', profile.department_ids?.[0] || '')
        .order('created_at', { ascending: false });
      tasksData = data;
      tasksErr = err;
    } else {
      // For regular employees: show only assigned tasks
      const { data, error: err } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false });
      tasksData = data;
      tasksErr = err;
    }

    if (tasksErr || !tasksData) {
      setError(tasksErr?.message || 'Failed to load tasks');
      setLoading(false);
      return;
    }

    // Fetch subtasks
    const taskIds = (tasksData as Task[]).map(t => t.id);
    let subtaskMap: Record<string, Subtask[]> = {};
    if (taskIds.length > 0) {
      const { data: subtasksData } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', taskIds);
      if (subtasksData) {
        for (const sub of subtasksData as Subtask[]) {
          if (!subtaskMap[sub.task_id]) subtaskMap[sub.task_id] = [];
          subtaskMap[sub.task_id].push(sub);
        }
      }
    }

    // Build dept name map
    const deptMap: Record<string, string> = {};
    for (const d of departments) deptMap[d.id] = d.name;

    const enriched: TaskWithDetails[] = (tasksData as Task[]).map(t => {
      const subtasks = subtaskMap[t.id] || [];
      return {
        ...t,
        subtasks,
        effectiveStatus: calcEffectiveStatus(t),
        overdueByDays: calcOverdueDays(t),
        deptName: t.department_id ? deptMap[t.department_id] : undefined,
      };
    });

    setTasks(enriched);
    setLoading(false);
  }, [profile, departments]);

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, [fetchTasks, fetchProfiles]);

  // â”€â”€â”€ Create task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openCreateModal = () => {
    if (profile?.department_ids?.[0]) {
      setCreateForm({
        ...EMPTY_FORM,
        department_id: profile.department_ids[0],
      });
    }
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setCreateError('Title is required.');
      return;
    }
    setCreating(true);
    setCreateError('');

    const deadline = createForm.deadline_date
      ? new Date(createForm.deadline_date).toISOString()
      : null;

    const payload = {
      title: createForm.title.trim(),
      description: createForm.description.trim(),
      assigned_to: createForm.assigned_to || null,
      department_id: createForm.department_id || null,
      deadline,
      status: createForm.status,
      project_id: createForm.project_id || null,
      created_by: profile?.id,
      progress: 0,
      completed_at: null,
    };

    const { error: err } = await supabase.from('tasks').insert(payload);
    setCreating(false);

    if (err) {
      setCreateError(err.message);
      return;
    }

    setShowCreateModal(false);
    setCreateForm(EMPTY_FORM);
    fetchTasks();
  };

  // â”€â”€â”€ Subtask operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!detailTask) return;
    const newVal = !subtask.is_completed;
    await supabase.from('subtasks').update({ is_completed: newVal }).eq('id', subtask.id);

    const updatedSubtasks = detailTask.subtasks.map(s =>
      s.id === subtask.id ? { ...s, is_completed: newVal } : s
    );
    const newProgress = calcProgress(updatedSubtasks);

    let newStatus: TaskStatus = detailTask.status;
    if (newProgress === 100) newStatus = 'Completed';
    else if (newProgress > 0 && newStatus === 'Not Started') newStatus = 'Ongoing';

    const updatePayload: Partial<Task> = {
      progress: newProgress,
      updated_at: new Date().toISOString(),
    };
    if (newStatus !== detailTask.status) {
      updatePayload.status = newStatus;
      updatePayload.completed_at =
        newStatus === 'Completed' ? new Date().toISOString() : null;
    }

    await supabase.from('tasks').update(updatePayload).eq('id', detailTask.id);

    setDetailTask(prev => {
      if (!prev) return prev;
      const updated: TaskWithDetails = {
        ...prev,
        subtasks: updatedSubtasks,
        progress: newProgress,
        status: newStatus,
        effectiveStatus: calcEffectiveStatus({ ...prev, status: newStatus }),
        overdueByDays: calcOverdueDays({ ...prev, status: newStatus }),
        completed_at: (updatePayload.completed_at as string | null) ?? prev.completed_at,
      };
      return updated;
    });
    setUpdateProgress(newProgress);
    setUpdateStatus(newStatus);
    fetchTasks();
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !detailTask) return;
    setAddingSubtask(true);

    const { error: err } = await supabase.from('subtasks').insert({
      task_id: detailTask.id,
      title: newSubtaskTitle.trim(),
      is_completed: false,
    });

    setAddingSubtask(false);
    if (!err) {
      setNewSubtaskTitle('');
      fetchTasks();
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm('Delete this subtask?')) return;
    await supabase.from('subtasks').delete().eq('id', subtaskId);
    fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task and all its subtasks?')) return;
    await supabase.from('subtasks').delete().eq('task_id', id);
    await supabase.from('tasks').delete().eq('id', id);
    setShowDetailModal(false);
    fetchTasks();
  };

  // â”€â”€â”€ Open detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openDetail = (task: TaskWithDetails) => {
    setDetailTask(task);
    setUpdateStatus(task.status);
    setUpdateProgress(
      task.subtasks.length > 0 ? calcProgress(task.subtasks) : task.progress
    );
    setSaveError('');
    setSaveSuccess(false);
    setShowDetailModal(true);
  };

  // Sync detail task when tasks list updates
  useEffect(() => {
    if (detailTask && showDetailModal) {
      const refreshed = tasks.find(t => t.id === detailTask.id);
      if (refreshed) {
        setDetailTask(refreshed);
        setUpdateProgress(
          refreshed.subtasks.length > 0
            ? calcProgress(refreshed.subtasks)
            : refreshed.progress
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);


  // â”€â”€â”€ Save status / progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const recalculateKpi = async (userId: string) => {
    const { data: userTasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('assigned_to', userId);

    if (!userTasks || userTasks.length === 0) return;

    const completed = userTasks.filter(t => t.status === 'Completed').length;
    const total = userTasks.length;
    const newScore = Math.round((completed / total) * 10 * 10) / 10; // 0-10, one decimal

    await supabase
      .from('profiles')
      .update({ kpi_score: newScore, updated_at: new Date().toISOString() })
      .eq('id', userId);
  };

  const handleSaveUpdate = async () => {
    if (!detailTask) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    const now = new Date().toISOString();
    const payload: Partial<Task> = {
      status: updateStatus,
      progress: detailTask.subtasks.length > 0 ? calcProgress(detailTask.subtasks) : updateProgress,
      updated_at: now,
    };
    if (updateStatus === 'Completed' && detailTask.status !== 'Completed') {
      payload.completed_at = now;
    } else if (updateStatus !== 'Completed') {
      payload.completed_at = null;
    }

    const { error: err } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', detailTask.id);

    setSaving(false);
    if (err) {
      setSaveError(err.message);
    } else {
      setSaveSuccess(true);
      if (updateStatus === 'Completed' && profile?.id) {
        recalculateKpi(profile.id);
      }
      fetchTasks();
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // â”€â”€â”€ Filter tasks by tab for department heads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const isDeptHeadOnly = isDeptHead() && !isAdmin();
  const filteredTasks = isDeptHeadOnly && activeTab === 'assigned'
    ? tasks.filter(t => t.assigned_to === profile?.id)
    : tasks;

  // â”€â”€â”€ Grouped tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const grouped = filteredTasks.reduce<Record<TaskStatus, TaskWithDetails[]>>(
    (acc, t) => {
      acc[t.effectiveStatus].push(t);
      return acc;
    },
    { 'Not Started': [], Ongoing: [], Overdue: [], Completed: [] }
  );

  const totalTasks = filteredTasks.length;

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="max-w-full" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">
            {isDeptHeadOnly ? 'Tasks' : 'My Tasks'}
          </PHeading>
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>
            {isDeptHeadOnly
              ? activeTab === 'assigned'
                ? `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you`
                : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} in your department`
              : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you`}
          </PText>
        </div>
        {isDeptHeadOnly && (
          <PButton onClick={openCreateModal}>
            Add New Tasks
          </PButton>
        )}
      </div>

      {/* Tabs for department heads */}
      {isDeptHeadOnly && (
        <div className="flex gap-6 mb-6 border-b border-contrast-low pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-0 py-3 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-contrast-medium hover:text-primary'
            }`}
            style={{ fontFamily: FONT }}
          >
            All Tasks
          </button>
          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-0 py-3 font-medium text-sm transition-colors ${
              activeTab === 'assigned'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-contrast-medium hover:text-primary'
            }`}
            style={{ fontFamily: FONT }}
          >
            My Tasks
          </button>
        </div>
      )}

      {error && (
        <PInlineNotification
          heading="Error loading tasks"
          description={error}
          state="error"
          dismissButton={false}
          className="mb-4"
        />
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>
            Loading your tasksâ€¦
          </PText>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={grouped[status]}
              onCardClick={openDetail}
            />
          ))}
        </div>
      )}

      {/* â”€â”€ Task Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {detailTask && (
        <PModal
          open={showDetailModal}
          onDismiss={() => setShowDetailModal(false)}
          aria={{ 'aria-label': 'Task detail' }}
          style={{ '--p-modal-width': 'clamp(320px, 55vw, 720px)' } as React.CSSProperties}
        >
          <PHeading slot="header" size="large" tag="h2">
            {detailTask.title}
          </PHeading>

          <div className="flex flex-col gap-5">
            {/* Status + overdue tag */}
            <div className="flex flex-wrap items-center gap-2">
              <PTag variant={STATUS_TAG_VARIANT[detailTask.effectiveStatus]}>
                {detailTask.effectiveStatus === 'Completed' && detailTask.overdueByDays
                  ? `Completed (Overdue by ${detailTask.overdueByDays} day${detailTask.overdueByDays === 1 ? '' : 's'})`
                  : detailTask.effectiveStatus}
              </PTag>
              {detailTask.deptName && (
                <PTag color="background-surface">{detailTask.deptName}</PTag>
              )}
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>
                  Deadline
                </PText>
                <div className="flex items-center gap-1.5">
                  <PIcon
                    name="calendar"
                    size="x-small"
                    color={
                      detailTask.status !== 'Completed' && isOverdue(detailTask.deadline)
                        ? 'notification-error'
                        : 'primary'
                    }
                  />
                  <PText
                    size="small"
                    color={
                      detailTask.status !== 'Completed' && isOverdue(detailTask.deadline)
                        ? 'notification-error'
                        : 'primary'
                    }
                    style={{ fontFamily: FONT }}
                  >
                    {formatDeadline(detailTask.deadline)}
                  </PText>
                </div>
              </div>
              {detailTask.completed_at && (
                <div className="flex flex-col gap-1">
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>
                    Completed At
                  </PText>
                  <PText size="small" style={{ fontFamily: FONT }}>
                    {formatDeadline(detailTask.completed_at)}
                  </PText>
                </div>
              )}
            </div>

            {/* Description */}
            {detailTask.description && (
              <div className="flex flex-col gap-1.5">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>
                  Description
                </PText>
                <div className="bg-canvas rounded-lg border border-contrast-low px-3 py-2.5">
                  <PText size="small" color="contrast-high" style={{ fontFamily: FONT }}>
                    {detailTask.description}
                  </PText>
                </div>
              </div>
            )}

            {/* Progress section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>
                  Progress
                </PText>
                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                  {detailTask.subtasks.length > 0
                    ? calcProgress(detailTask.subtasks)
                    : updateProgress}%
                </PText>
              </div>
              <ProgressBar
                value={
                  detailTask.subtasks.length > 0
                    ? calcProgress(detailTask.subtasks)
                    : updateProgress
                }
              />
              {/* Manual progress slider â€” only when no subtasks */}
              {detailTask.subtasks.length === 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <label
                    htmlFor="progress-slider"
                    className="block text-xs font-medium text-contrast-high"
                    style={{ fontFamily: FONT }}
                  >
                    Adjust Progress
                  </label>
                  <input
                    id="progress-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={updateProgress}
                    onChange={e => setUpdateProgress(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between">
                    <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>0%</PText>
                    <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>100%</PText>
                  </div>
                </div>
              )}
              {detailTask.subtasks.length > 0 && (
                <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                  {detailTask.subtasks.filter(s => s.is_completed).length} of {detailTask.subtasks.length} subtasks completed
                </PText>
              )}
            </div>

            {/* Status selector */}
            <div className="flex flex-col gap-1.5">
              <label
                className="block text-xs font-medium text-contrast-high"
                style={{ fontFamily: FONT }}
              >
                Update Status
              </label>
              <select
                value={updateStatus}
                onChange={e => setUpdateStatus(e.target.value as TaskStatus)}
                className="form-input"
              >
                {STATUSES.filter(s => s !== 'Overdue').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Save feedback */}
            {saveError && (
              <PInlineNotification
                heading="Save failed"
                description={saveError}
                state="error"
                dismissButton={false}
              />
            )}
            {saveSuccess && (
              <PInlineNotification
                heading="Saved"
                description="Task progress and status updated successfully."
                state="success"
                dismissButton={false}
              />
            )}

            {/* Divider */}
            <div className="border-t border-contrast-low" />

            {/* Subtasks */}
            <div className="flex flex-col gap-3">
              <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>
                Subtasks
              </PText>

              {detailTask.subtasks.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <PIcon name="list" size="x-small" color="contrast-low" />
                  <PText size="x-small" color="contrast-low" style={{ fontFamily: FONT }}>
                    No subtasks â€” use the progress slider above
                  </PText>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {detailTask.subtasks.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-canvas border border-contrast-low hover:border-contrast-medium transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={sub.is_completed}
                        onChange={() => handleToggleSubtask(sub)}
                        className="w-4 h-4 rounded accent-primary flex-shrink-0 cursor-pointer"
                      />
                      <PText
                        size="small"
                        color={sub.is_completed ? 'contrast-medium' : 'primary'}
                        className={sub.is_completed ? 'line-through flex-1' : 'flex-1'}
                        style={{ fontFamily: FONT }}
                      >
                        {sub.title}
                      </PText>
                      {sub.is_completed && (
                        <PIcon name="check" size="x-small" color="notification-success" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div slot="footer" className="flex items-center justify-end gap-3">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setShowDetailModal(false)}
            >
              Close
            </PButton>
            <PButton
              type="button"
              icon="check"
              loading={saving}
              onClick={handleSaveUpdate}
            >
              Save Progress
            </PButton>
          </div>
        </PModal>
      )}

      {/* â”€â”€ Create Task Modal (for dept heads) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isDeptHead() && !isAdmin() && (
        <PModal
          open={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          aria={{ 'aria-label': 'Add task' }}
          style={{ '--p-modal-width': 'clamp(320px, 50vw, 680px)' } as React.CSSProperties}
        >
          <PHeading slot="header" size="large" tag="h2">
            Add Task
          </PHeading>

          <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            {createError && (
              <PInlineNotification heading="Error" description={createError} state="error" dismissButton={false} />
            )}

            <FormField label="Title *">
              <input
                type="text"
                required
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                className="form-input"
                placeholder="Task title"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="form-input resize-none"
                placeholder="Optional description"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Department">
                <select
                  value={createForm.department_id}
                  onChange={e => setCreateForm(f => ({ ...f, department_id: e.target.value, assigned_to: '' }))}
                  className="form-input"
                  disabled={true}
                >
                  <option value="">â€” Select â€”</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Assign To">
                <select
                  value={createForm.assigned_to}
                  onChange={e => setCreateForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Unassigned</option>
                  {(createForm.department_id
                    ? allProfiles.filter(p => p.department_ids?.includes(createForm.department_id) && p.is_active)
                    : allProfiles.filter(p => p.is_active)
                  ).map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Deadline Date">
                <div className="relative">
                  <input
                    ref={deadlineDateRef}
                    type="date"
                    value={createForm.deadline_date}
                    onChange={e => setCreateForm(f => ({ ...f, deadline_date: e.target.value }))}
                    className="form-input pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => deadlineDateRef.current?.showPicker()}
                    tabIndex={-1}
                    aria-label="Pick date"
                  >
                    <PIcon name="calendar" size="x-small" color="contrast-medium" />
                  </button>
                </div>
              </FormField>

              <FormField label="Status">
                <select
                  value={createForm.status}
                  onChange={e => setCreateForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                  className="form-input"
                >
                  {STATUSES.filter(s => s !== 'Overdue').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="flex gap-3 justify-end pt-2" slot="footer">
              <PButton type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </PButton>
              <PButton type="submit" loading={creating}>
                Create Task
              </PButton>
            </div>
          </form>
        </PModal>
      )}

      {/* â”€â”€ Task Detail Modal (for dept heads to manage tasks) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isDeptHead() && !isAdmin() && detailTask && (
        <PModal
          open={showDetailModal}
          onDismiss={() => setShowDetailModal(false)}
          aria={{ 'aria-label': 'Task detail' }}
          style={{ '--p-modal-width': 'clamp(320px, 55vw, 720px)' } as React.CSSProperties}
        >
          <PHeading slot="header" size="large" tag="h2" className="pr-4">
            {detailTask.title}
          </PHeading>

          <div className="flex flex-col gap-5">
            {/* Status + Tags row */}
            <div className="flex flex-wrap items-center gap-2">
              <PTag variant={STATUS_TAG_VARIANT[detailTask.effectiveStatus]}>
                {detailTask.effectiveStatus === 'Completed' && detailTask.overdueByDays
                  ? `Completed (Overdue by ${detailTask.overdueByDays} days)`
                  : detailTask.effectiveStatus}
              </PTag>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Assigned To</PText>
                <PText size="small">{detailTask.title}</PText>
              </div>
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Deadline</PText>
                <PText size="small" color={detailTask.status !== 'Completed' && isOverdue(detailTask.deadline) ? 'notification-error' : 'primary'}>
                  {formatDeadline(detailTask.deadline)}
                </PText>
              </div>
            </div>

            {/* Description */}
            {detailTask.description && (
              <div className="flex flex-col gap-1.5">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Description</PText>
                <div className="bg-canvas rounded-lg border border-contrast-low px-3 py-2.5">
                  <PText size="small" color="contrast-high">{detailTask.description}</PText>
                </div>
              </div>
            )}

            {/* Progress */}
            {detailTask.subtasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Progress</PText>
                  <PText size="x-small" weight="semi-bold">
                    {calcProgress(detailTask.subtasks)}%
                  </PText>
                </div>
                <ProgressBar value={calcProgress(detailTask.subtasks)} />
                <PText size="x-small" color="contrast-medium">
                  {detailTask.subtasks.filter(s => s.is_completed).length} of {detailTask.subtasks.length} subtasks completed
                </PText>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-contrast-low" />

            {/* Subtasks section */}
            <div className="flex flex-col gap-3">
              <PText size="small" weight="semi-bold">Subtasks</PText>

              {detailTask.subtasks.length === 0 && (
                <div className="flex items-center gap-2 py-3">
                  <PIcon name="list" size="x-small" color="contrast-low" />
                  <PText size="x-small" color="contrast-low">No subtasks yet</PText>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {detailTask.subtasks.map(sub => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-canvas border border-contrast-low hover:border-contrast-medium transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={sub.is_completed}
                      onChange={() => handleToggleSubtask(sub)}
                      className="w-4 h-4 rounded accent-primary flex-shrink-0 cursor-pointer"
                    />
                    <PText
                      size="small"
                      color={sub.is_completed ? 'contrast-medium' : 'primary'}
                      className={`flex-1 ${sub.is_completed ? 'line-through' : ''}`}
                    >
                      {sub.title}
                    </PText>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-soft transition-all"
                      aria-label="Delete subtask"
                    >
                      <PIcon name="delete" size="x-small" color="notification-error" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add subtask input */}
              <form onSubmit={handleAddSubtask} className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask..."
                  className="form-input flex-1"
                />
                <PButton type="submit" loading={addingSubtask} variant="secondary">
                  Add
                </PButton>
              </form>
            </div>

            {/* Status update section */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-contrast-high" style={{ fontFamily: FONT }}>
                Update Status
              </label>
              <select
                value={updateStatus}
                onChange={e => setUpdateStatus(e.target.value as TaskStatus)}
                className="form-input"
              >
                {STATUSES.filter(s => s !== 'Overdue').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Error/Success messages */}
            {saveError && (
              <PInlineNotification
                heading="Save failed"
                description={saveError}
                state="error"
                dismissButton={false}
              />
            )}
            {saveSuccess && (
              <PInlineNotification
                heading="Saved"
                description="Task updated successfully."
                state="success"
                dismissButton={false}
              />
            )}
          </div>

          {/* Footer */}
          <div slot="footer" className="flex items-center justify-between gap-3">
            <PButton
              type="button"
              variant="secondary"
              icon="delete"
              onClick={() => handleDeleteTask(detailTask.id)}
            >
              Delete Task
            </PButton>
            <div className="flex gap-3">
              <PButton
                type="button"
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </PButton>
              <PButton
                type="button"
                onClick={handleSaveUpdate}
                loading={saving}
              >
                Save Progress
              </PButton>
            </div>
          </div>
        </PModal>
      )}
    </div>
  );
}



