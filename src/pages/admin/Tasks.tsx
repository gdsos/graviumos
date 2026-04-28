import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
  PModal,
  PInlineNotification,
  PTabs,
  PTabsItem,
} from '@porsche-design-system/components-react';
import { supabase, type Task, type Subtask, type Profile, type Department } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface TaskWithDetails extends Task {
  assignee?: Profile;
  subtasks: Subtask[];
  /** effective status after applying overdue logic */
  effectiveStatus: TaskStatus;
  /** days overdue when completed late */
  overdueByDays?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPT_NAMES = [
  'Marketing & Sales',
  'Designing & Execution',
  'Ops. & Quality Control',
  'Procurement & Logistics',
  'Finance',
] as const;

const STATUSES: TaskStatus[] = ['Not Started', 'Ongoing', 'Overdue', 'Completed'];

const STATUS_TAG_VARIANT: Record<TaskStatus, Parameters<typeof PTag>[0]['variant']> = {
  'Not Started': 'secondary',
  Ongoing: 'info',
  Overdue: 'error',
  Completed: 'success',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) return 'Overdue';
  return task.status;
}

function calcOverdueDays(task: Task): number | undefined {
  if (task.status !== 'Completed' || !task.deadline || !task.completed_at) return undefined;
  const deadline = new Date(task.deadline);
  const completed = new Date(task.completed_at);
  const diff = Math.floor((completed.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : undefined;
}

function calcProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;
  return Math.round((subtasks.filter(s => s.is_completed).length / subtasks.length) * 100);
}

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5"
        
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
}

function ProgressBar({ value }: ProgressBarProps) {
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

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskWithDetails;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const hasSubtasks = task.subtasks.length > 0;
  const progress = hasSubtasks ? calcProgress(task.subtasks) : 0;
  const deadlineOverdue = task.status !== 'Completed' && isOverdue(task.deadline);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-canvas rounded-xl border-2 border-contrast-low hover:border-primary focus:outline-none focus:border-primary transition-colors p-4 flex flex-col gap-3"
    >
      {/* Title */}
      <PText size="small" weight="semi-bold" className="line-clamp-2">
        {task.title}
      </PText>

      {/* Status tag + overdue badge */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PTag variant={STATUS_TAG_VARIANT[task.effectiveStatus]} compact>
          {task.effectiveStatus === 'Completed' && task.overdueByDays
            ? `Completed (Overdue by ${task.overdueByDays}d)`
            : task.effectiveStatus}
        </PTag>
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-1.5">
        <PIcon name="user" size="x-small" color="contrast-medium" />
        <PText size="x-small" color="contrast-medium">
          {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
        </PText>
      </div>

      {/* Deadline */}
      <div className="flex items-center gap-1.5">
        <PIcon name="calendar" size="x-small" color={deadlineOverdue ? 'notification-error' : 'contrast-medium'} />
        <PText
          size="x-small"
          color={deadlineOverdue ? 'notification-error' : 'contrast-medium'}
        >
          {formatDeadline(task.deadline)}
        </PText>
        {deadlineOverdue && (
          <PTag variant="error" compact>Overdue</PTag>
        )}
      </div>

      {/* Completed on */}
      {task.effectiveStatus === 'Completed' && task.completed_at && (
        <div className="flex items-center gap-1.5">
          <PIcon name="check" size="x-small" color="notification-success" />
          <PText size="x-small" color="notification-success">
            Completed on {formatDeadline(task.completed_at)}
          </PText>
        </div>
      )}

      {/* Progress bar (only when subtasks exist) */}
      {hasSubtasks && (
        <div className="flex flex-col gap-1">
          <ProgressBar value={progress} />
          <PText size="xx-small" color="contrast-medium">
            {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length} subtasks · {progress}%
          </PText>
        </div>
      )}
    </button>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithDetails[];
  onCardClick: (task: TaskWithDetails) => void;
}

function KanbanColumn({ status, tasks, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-3 min-w-[240px] flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-contrast-low">
        <PText size="x-small" weight="semi-bold" color="contrast-high" className="uppercase tracking-wider">
          {status}
        </PText>
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-contrast-low/40 text-xs font-semibold text-contrast-high">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-contrast-low/50">
            <PText size="x-small" color="contrast-low">No tasks</PText>
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

// ─── Main Component ───────────────────────────────────────────────────────────

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

export default function Tasks() {
  const { profile, departments, isAdmin, isDeptHead } = useAuth();

  // ── data state ──────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');

  // ── tab & filter state ──────────────────────────────────────────────────────
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [filterAssignee, setFilterAssignee] = useState('');

  // ── task modal state ─────────────────────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const deadlineDateRef = useRef<HTMLInputElement>(null);

  // ── detail modal state ───────────────────────────────────────────────────────
  const [detailTask, setDetailTask] = useState<TaskWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // ── derived ──────────────────────────────────────────────────────────────────
  const canManage = isAdmin() || isDeptHead();

  const activeDeptName = DEPT_NAMES[activeTabIndex];
  const activeDept: Department | undefined = departments.find(
    d => d.name === activeDeptName
  );

  // Members of the active department (for filter dropdown & form)
  const deptMembers = activeDept
    ? allProfiles.filter(p => p.department_ids?.includes(activeDept.id) && p.is_active)
    : [];

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, department_ids, is_active, role')
      .eq('is_active', true);
    setAllProfiles((data as Profile[]) || []);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data: tasksData, error: tasksErr } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (tasksErr || !tasksData) {
      setLoading(false);
      return;
    }

    // Fetch all subtasks in one query
    const taskIds = tasksData.map((t: Task) => t.id);
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

    // Fetch assignee profiles
    const assigneeIds = [...new Set(tasksData.map((t: Task) => t.assigned_to).filter(Boolean) as string[])];
    let assigneeMap: Record<string, Profile> = {};
    if (assigneeIds.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_ids, is_active, role')
        .in('id', assigneeIds);
      if (profData) {
        for (const p of profData as Profile[]) {
          assigneeMap[p.id] = p;
        }
      }
    }

    const enriched: TaskWithDetails[] = tasksData.map((t: Task) => {
      const subtasks = subtaskMap[t.id] || [];
      return {
        ...t,
        subtasks,
        assignee: t.assigned_to ? assigneeMap[t.assigned_to] : undefined,
        effectiveStatus: calcEffectiveStatus(t),
        overdueByDays: calcOverdueDays(t),
      };
    });

    setTasks(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, [fetchTasks, fetchProfiles]);

  // ─── Filtered tasks per tab ────────────────────────────────────────────────

  const tabTasks = (deptId?: string): TaskWithDetails[] => {
    if (!deptId) return [];
    let filtered = tasks.filter(t => t.department_id === deptId);
    if (filterAssignee) filtered = filtered.filter(t => t.assigned_to === filterAssignee);
    return filtered;
  };

  const groupByStatus = (taskList: TaskWithDetails[]): Record<TaskStatus, TaskWithDetails[]> => {
    const groups: Record<TaskStatus, TaskWithDetails[]> = {
      'Not Started': [],
      Ongoing: [],
      Overdue: [],
      Completed: [],
    };
    for (const t of taskList) {
      groups[t.effectiveStatus].push(t);
    }
    return groups;
  };

  // ─── Task CRUD ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingTask(null);
    // For dept heads, default to their own department and lock it
    const isOnlyDeptHead = !isAdmin() && isDeptHead();
    const defaultDeptId = isOnlyDeptHead
      ? (profile?.department_ids?.[0] || activeDept?.id || '')
      : (activeDept?.id || '');
    setForm({
      ...EMPTY_FORM,
      department_id: defaultDeptId,
    });
    setFormError('');
    setShowTaskModal(true);
  };

  const openEdit = (task: TaskWithDetails) => {
    setEditingTask(task);
    let deadline_date = '';
    if (task.deadline) {
      const d = new Date(task.deadline);
      deadline_date = d.toISOString().slice(0, 10);
    }
    setForm({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      department_id: task.department_id || '',
      deadline_date,
      status: task.status,
      project_id: task.project_id || '',
    });
    setFormError('');
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    setSaving(true);
    setFormError('');

    const deadline = form.deadline_date
      ? new Date(form.deadline_date).toISOString()
      : null;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assigned_to: form.assigned_to || null,
      department_id: form.department_id || null,
      deadline,
      status: form.status,
      project_id: form.project_id || null,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (editingTask) {
      const { error: e } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      err = e;
    } else {
      const { error: e } = await supabase.from('tasks').insert({
        ...payload,
        created_by: profile?.id,
        progress: 0,
        completed_at: null,
      });
      err = e;
    }

    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setShowTaskModal(false);
    fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task and all its subtasks?')) return;
    await supabase.from('subtasks').delete().eq('task_id', id);
    await supabase.from('tasks').delete().eq('id', id);
    setShowDetailModal(false);
    fetchTasks();
  };

  // ─── Subtask operations ────────────────────────────────────────────────────

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

  const handleToggleSubtask = async (taskId: string, subtask: Subtask) => {
    const newVal = !subtask.is_completed;
    await supabase.from('subtasks').update({ is_completed: newVal }).eq('id', subtask.id);

    // Recalculate progress and potentially update status on the task
    const updatedSubtasks = (detailTask?.subtasks || []).map(s =>
      s.id === subtask.id ? { ...s, is_completed: newVal } : s
    );
    const newProgress = calcProgress(updatedSubtasks);

    // Determine new status
    let newStatus: TaskStatus = detailTask!.status;
    if (newProgress === 100) newStatus = 'Completed';
    else if (newProgress > 0 && newStatus === 'Not Started') newStatus = 'Ongoing';

    const updatePayload: Partial<Task> = {
      progress: newProgress,
      updated_at: new Date().toISOString(),
    };
    if (newStatus !== detailTask!.status) {
      updatePayload.status = newStatus;
      if (newStatus === 'Completed') updatePayload.completed_at = new Date().toISOString();
      else updatePayload.completed_at = null;
    }

    await supabase.from('tasks').update(updatePayload).eq('id', taskId);

    if (newStatus === 'Completed' && detailTask?.assigned_to) {
      recalculateKpi(detailTask.assigned_to);
    }

    // Update local detail task state
    setDetailTask(prev => {
      if (!prev) return prev;
      const newSubtasks = prev.subtasks.map(s =>
        s.id === subtask.id ? { ...s, is_completed: newVal } : s
      );
      const updated: TaskWithDetails = {
        ...prev,
        subtasks: newSubtasks,
        progress: newProgress,
        status: newStatus,
        effectiveStatus: calcEffectiveStatus({ ...prev, status: newStatus, progress: newProgress }),
        overdueByDays: calcOverdueDays({ ...prev, status: newStatus }),
        completed_at: updatePayload.completed_at ?? prev.completed_at,
      };
      return updated;
    });

    fetchTasks();
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !detailTask) return;
    setAddingSubtask(true);
    const { data } = await supabase
      .from('subtasks')
      .insert({ task_id: detailTask.id, title: newSubtaskTitle.trim(), is_completed: false })
      .select()
      .single();
    setAddingSubtask(false);
    if (data) {
      setDetailTask(prev => {
        if (!prev) return prev;
        const newSubtasks = [...prev.subtasks, data as Subtask];
        return { ...prev, subtasks: newSubtasks };
      });
      setNewSubtaskTitle('');
      fetchTasks();
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!detailTask) return;
    await supabase.from('subtasks').delete().eq('id', subtaskId);
    const newSubtasks = detailTask.subtasks.filter(s => s.id !== subtaskId);
    const newProgress = calcProgress(newSubtasks);
    await supabase.from('tasks').update({ progress: newProgress, updated_at: new Date().toISOString() }).eq('id', detailTask.id);
    setDetailTask(prev => prev ? { ...prev, subtasks: newSubtasks, progress: newProgress } : prev);
    fetchTasks();
  };

  // ─── Open detail modal ─────────────────────────────────────────────────────

  const openDetail = (task: TaskWithDetails) => {
    setDetailTask(task);
    setNewSubtaskTitle('');
    setShowDetailModal(true);
  };

  // Sync detail task when tasks list updates
  useEffect(() => {
    if (detailTask && showDetailModal) {
      const refreshed = tasks.find(t => t.id === detailTask.id);
      if (refreshed) setDetailTask(refreshed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const activeDeptTasks = tabTasks(activeDept?.id);
  const grouped = groupByStatus(activeDeptTasks);

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Tasks</PHeading>
          <PText color="contrast-medium">Manage department tasks across your organisation</PText>
        </div>
        {canManage && (
          <PButton icon="add" onClick={openCreate}>Add Task</PButton>
        )}
      </div>

      {error && (
        <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} className="mb-4" />
      )}

      {/* Department Tabs */}
      <PTabs
        activeTabIndex={activeTabIndex}
        onUpdate={e => { setActiveTabIndex(e.detail.activeTabIndex); setFilterAssignee(''); }}
        size="medium"
        weight="semi-bold"
      >
        {DEPT_NAMES.map((deptName, idx) => {
          const dept = departments.find(d => d.name === deptName);
          const deptTaskCount = dept ? tasks.filter(t => t.department_id === dept.id).length : 0;

          return (
            <PTabsItem key={deptName} label={`${deptName}${deptTaskCount > 0 ? ` (${deptTaskCount})` : ''}`}>
              {/* Filter bar */}
              {idx === activeTabIndex && (
                <div className="mt-5 mb-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <PText size="x-small" color="contrast-medium" weight="semi-bold">
                      Filter by assignee:
                    </PText>
                    <select
                      value={filterAssignee}
                      onChange={e => setFilterAssignee(e.target.value)}
                      className="form-input w-auto min-w-[180px]"
                    >
                      <option value="">All Members</option>
                      {deptMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                      ))}
                    </select>
                    {filterAssignee && (
                      <button
                        type="button"
                        onClick={() => setFilterAssignee('')}
                        className="flex items-center gap-1 text-xs text-contrast-medium hover:text-primary transition-colors"
                      >
                        <PIcon name="close" size="x-small" color="inherit" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Kanban board */}
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <PText color="contrast-medium">Loading tasks...</PText>
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
            </PTabsItem>
          );
        })}
      </PTabs>

      {/* ── Add / Edit Task Modal ──────────────────────────────────────────── */}
      <PModal
        open={showTaskModal}
        onDismiss={() => setShowTaskModal(false)}
        aria={{ 'aria-label': editingTask ? 'Edit task' : 'Add task' }}
        style={{ '--p-modal-width': 'clamp(320px, 50vw, 680px)' } as React.CSSProperties}
      >
        <PHeading slot="header" size="large" tag="h2">
          {editingTask ? 'Edit Task' : 'Add Task'}
        </PHeading>

        <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          {formError && (
            <PInlineNotification heading="Error" description={formError} state="error" dismissButton={false} />
          )}

          <FormField label="Title *">
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="form-input"
              placeholder="Task title"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="form-input resize-none"
              placeholder="Optional description"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department">
              <select
                value={form.department_id}
                onChange={e => setForm(f => ({ ...f, department_id: e.target.value, assigned_to: '' }))}
                className="form-input"
                disabled={!isAdmin() && isDeptHead()}
              >
                <option value="">— Select —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Assign To">
              <select
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="form-input"
              >
                <option value="">Unassigned</option>
                {(form.department_id
                  ? allProfiles.filter(p => p.department_ids?.includes(form.department_id) && p.is_active)
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
                  value={form.deadline_date}
                  onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))}
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
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                className="form-input"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          <div className="flex gap-3 justify-end pt-2" slot="footer">
            <PButton type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>
              Cancel
            </PButton>
            <PButton type="submit" loading={saving}>
              {editingTask ? 'Save Changes' : 'Create Task'}
            </PButton>
          </div>
        </form>
      </PModal>

      {/* ── Task Detail Modal ──────────────────────────────────────────────── */}
      {detailTask && (
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
              {detailTask.effectiveStatus === 'Completed' && detailTask.overdueByDays && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--p-color-notification-warning-soft)', color: 'var(--p-color-notification-warning)' }}
                >
                  Overdue by {detailTask.overdueByDays} {detailTask.overdueByDays === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Assigned To</PText>
                <div className="flex items-center gap-2">
                  <PIcon name="user" size="x-small" color="contrast-high" />
                  <PText size="small">{detailTask.assignee?.full_name || detailTask.assignee?.email || 'Unassigned'}</PText>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Department</PText>
                <PText size="small">
                  {departments.find(d => d.id === detailTask.department_id)?.name || '—'}
                </PText>
              </div>
              <div className="flex flex-col gap-1">
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Deadline</PText>
                <div className="flex items-center gap-1.5">
                  <PText
                    size="small"
                    color={detailTask.status !== 'Completed' && isOverdue(detailTask.deadline) ? 'notification-error' : 'primary'}
                  >
                    {formatDeadline(detailTask.deadline)}
                  </PText>
                  {detailTask.status !== 'Completed' && isOverdue(detailTask.deadline) && (
                    <PTag variant="error" compact>Overdue</PTag>
                  )}
                </div>
              </div>
              {detailTask.completed_at && (
                <div className="flex flex-col gap-1">
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider">Completed At</PText>
                  <PText size="small">{formatDeadline(detailTask.completed_at)}</PText>
                </div>
              )}
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
                      onChange={() => handleToggleSubtask(detailTask.id, sub)}
                      className="w-4 h-4 rounded accent-primary flex-shrink-0 cursor-pointer"
                    />
                    <PText
                      size="small"
                      color={sub.is_completed ? 'contrast-medium' : 'primary'}
                      className={`flex-1 ${sub.is_completed ? 'line-through' : ''}`}
                    >
                      {sub.title}
                    </PText>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-soft transition-all"
                        aria-label="Delete subtask"
                      >
                        <PIcon name="delete" size="x-small" color="notification-error" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add subtask input (admin/dept head only) */}
              {canManage && (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                    placeholder="Add a subtask…"
                    className="form-input flex-1"
                  />
                  <PButton
                    type="button"
                    icon="add"
                    variant="secondary"
                    loading={addingSubtask}
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                  >
                    Add
                  </PButton>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div slot="footer" className="flex items-center justify-between gap-3">
            <div>
              {canManage && (
                <PButton
                  type="button"
                  variant="secondary"
                  icon="delete"
                  onClick={() => handleDeleteTask(detailTask.id)}
                >
                  Delete
                </PButton>
              )}
            </div>
            <div className="flex gap-2">
              <PButton type="button" variant="secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </PButton>
              {canManage && (
                <PButton
                  type="button"
                  icon="edit"
                  onClick={() => {
                    setShowDetailModal(false);
                    openEdit(detailTask);
                  }}
                >
                  Edit Task
                </PButton>
              )}
            </div>
          </div>
        </PModal>
      )}
    </div>
  );
}
