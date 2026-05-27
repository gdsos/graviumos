import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Task, type Subtask, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import TaskDetailModal from "../../components/tasks/TaskDetailModal";
import TasksBoard from "../../components/tasks/TasksBoard";
import { Calendar, Plus, Check, ChevronDown } from 'lucide-react';

// ——— Types ————————————————————————————————————————————————————————————————————

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface TaskWithDetails extends Task {
  assignee?: Profile;
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
    <div className="flex flex-col gap-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

// ——— Constants ————————————————————————————————————————————————————————————————

const STATUSES: TaskStatus[] = ['Not Started', 'Ongoing', 'Overdue', 'Completed'];

// ——— Helpers ——————————————————————————————————————————————————————————————————

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

// ——— Sub-components ———————————————————————————————————————————————————————————

// ——— Main Component ———————————————————————————————————————————————————————————


function TaskScopeFilter({
  value,
  onChange,
}: {
  value: 'all' | 'assigned';
  onChange: (value: 'all' | 'assigned') => void;
}) {
  const [open, setOpen] = useState(false);

  const options: {
    value: 'all' | 'assigned';
    label: string;
  }[] = [
    {
      value: 'all',
      label: 'All Tasks',
    },
    {
      value: 'assigned',
      label: 'My Tasks',
    },
  ];

  const selected = options.find(option => option.value === value) || options[0];

  return (
    <div
      className="relative min-w-0 flex-1 sm:min-w-[220px]"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {options.map(option => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyTasks() {
  const { profile, departments, isDeptHead, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'assigned'>('all');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Task creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const deadlineDateRef = useRef<HTMLInputElement>(null);

  const [detailTask, setDetailTask] = useState<TaskWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Subtask management state

  // ——— Fetch profiles —————————————————————————————————————————————————————
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, department_ids, is_active, role')
      .eq('is_active', true);
    setAllProfiles((data as Profile[]) || []);
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setProjects(data);
    }
  }, []);

  // ——— Fetch tasks ————————————————————————————————————————————————————————

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

    // Fetch assignee profiles so Portal task rows do not show assigned tasks as Unassigned.
    const assigneeIds = [
      ...new Set(
        (tasksData as Task[])
          .map(task => task.assigned_to)
          .filter(Boolean) as string[]
      ),
    ];

    let assigneeMap: Record<string, Profile> = {};

    if (assigneeIds.length > 0) {
      const { data: assigneeData } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_ids, is_active, role')
        .in('id', assigneeIds);

      if (assigneeData) {
        for (const assignee of assigneeData as Profile[]) {
          assigneeMap[assignee.id] = assignee;
        }
      }
    }

    const enriched: TaskWithDetails[] = (tasksData as Task[]).map(t => {
      const subtasks = subtaskMap[t.id] || [];
      return {
        ...t,
        assignee: t.assigned_to ? assigneeMap[t.assigned_to] : undefined,
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
    fetchProjects();
  }, [fetchTasks, fetchProfiles, fetchProjects]);

  // ——— Create task —————————————————————————————————————————————————————————

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

    const { data, error: err } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();

    setCreating(false);

    if (err) {
      setCreateError(err.message);
      return;
    }

    if (data) {

      const createdTask = data as Task;

      const deptMap: Record<string, string> = {};

      for (const department of departments) {
        deptMap[department.id] = department.name;
      }

      const optimisticTask: TaskWithDetails = {
        ...createdTask,
        subtasks: [],
        effectiveStatus: calcEffectiveStatus(createdTask),
        overdueByDays: calcOverdueDays(createdTask),
        deptName: createdTask.department_id ? deptMap[createdTask.department_id] : undefined,
      };

      setTasks(prev => [
        optimisticTask,
        ...prev.filter(task => task.id !== optimisticTask.id),
      ]);

      setFilterAssignee('');

      if (createdTask.assigned_to === profile?.id) {
        setActiveTab('assigned');
      } else {
        setActiveTab('all');
      }
    }

    setShowCreateModal(false);
    setCreateForm(EMPTY_FORM);

    window.setTimeout(() => {
      void fetchTasks();
    }, 750);
  };

  // ——— Subtask operations ————————————————————————————————————————————————————

  // ——— Open detail —————————————————————————————————————————————————————————

  const openDetail = (task: TaskWithDetails) => {
    setDetailTask(task);
    setShowDetailModal(true);
  };

  const handleTaskDeleted = (taskId: string) => {
  setTasks(prev =>
    prev.filter(t => t.id !== taskId)
  );

  if (detailTask?.id === taskId) {
    setDetailTask(null);
    setShowDetailModal(false);
  }
};

  const handleTaskUpdated = (
    updatedTask: TaskWithDetails
  ) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === updatedTask.id
          ? {
              ...task,
              ...updatedTask,
            }
          : task
      )
    );

    setDetailTask(updatedTask);
  };

  // Sync detail task when tasks list updates
  useEffect(() => {
    if (detailTask && showDetailModal) {
      const refreshed = tasks.find(t => t.id === detailTask.id);
      if (refreshed) {
        setDetailTask(refreshed);
      }
    }
  }, [tasks, detailTask, showDetailModal]);


  // ——— Save status / progress ———————————————————————————————————————————————

  // ——— Filter tasks by tab for department heads ————————————————————————————

  const isDeptHeadOnly = isDeptHead() && !isAdmin();
  const filteredTasks = isDeptHeadOnly && activeTab === 'assigned'
    ? tasks.filter(t => t.assigned_to === profile?.id)
    : tasks;

  // ——— Grouped tasks ————————————————————————————————————————————————————————

  const totalTasks = filteredTasks.length;

  // ——— Render ———————————————————————————————————————————————————————————————

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10">
      {/* Header */}
      <div className="mb-8 border-b border-border pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              Gravium OS
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {isDeptHeadOnly ? 'Tasks' : 'My Tasks'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {isDeptHeadOnly
                ? activeTab === 'assigned'
                  ? `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you.`
                  : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} in your department.`
                : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you.`}
            </p>
          </div>

          {isDeptHeadOnly && (
            <button
              onClick={openCreateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              Add Task
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            Error loading tasks
          </p>
          <p className="mt-1 text-sm text-destructive/85">
            {error}
          </p>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-muted-foreground">
            Loading your tasks…
          </p>
        </div>
      ) : (
          <TasksBoard
            tasks={filteredTasks}
            loading={loading}
            filterAssignee={filterAssignee}
            setFilterAssignee={setFilterAssignee}
            deptMembers={allProfiles}
            filterPrefix={
              isDeptHeadOnly ? (
                <TaskScopeFilter
                  value={activeTab}
                  onChange={setActiveTab}
                />
              ) : undefined
            }
            onCardClick={openDetail}
          />
      )}

      {/* —— Create Task Modal (for dept heads) —————————————————————————————— */}
      {isDeptHead() && !isAdmin() && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
              <h2 className="text-lg font-bold">Add Task</h2>
            </div>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-4 p-6">

              {createError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="mt-1 text-sm text-destructive/85">{createError}</p>
                </div>
              )}

              {/* Title */}
              <FormField label="Title *">
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={e =>
                    setCreateForm(f => ({ ...f, title: e.target.value }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  placeholder="Task title"
                />
              </FormField>

              {/* Description */}
              <FormField label="Description">
                <textarea
                  value={createForm.description}
                  onChange={e =>
                    setCreateForm(f => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                  placeholder="Optional description"
                />
              </FormField>

              {/* Department + Assignee */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Department">
                  <select
                    value={createForm.department_id}
                    onChange={e =>
                      setCreateForm(f => ({
                        ...f,
                        department_id: e.target.value,
                        assigned_to: '',
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border border-border bg-muted text-foreground"
                    disabled
                  >
                    <option value="">— Select —</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Assign To">
                  <select
                    value={createForm.assigned_to}
                    onChange={e =>
                      setCreateForm(f => ({
                        ...f,
                        assigned_to: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Unassigned</option>
                    {allProfiles
                      .filter(
                        p =>
                          p.department_ids?.includes(createForm.department_id) &&
                          p.is_active
                      )
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </option>
                      ))}
                  </select>
                </FormField>
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <FormField label="Project">
                  <select
                    value={createForm.project_id}
                    onChange={e =>
                      setCreateForm(f => ({
                        ...f,
                        project_id: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">— No Project —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {/* Deadline + Status */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Deadline Date">
                  <div className="relative">
                    <input
                      ref={deadlineDateRef}
                      type="date"
                      value={createForm.deadline_date}
                      onChange={e =>
                        setCreateForm(f => ({
                          ...f,
                          deadline_date: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => deadlineDateRef.current?.showPicker()}
                    >
                      <Calendar size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                </FormField>

                <FormField label="Status">
                  <select
                    value={createForm.status}
                    onChange={e =>
                      setCreateForm(f => ({
                        ...f,
                        status: e.target.value as TaskStatus,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    {STATUSES.filter(s => s !== 'Overdue').map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TaskDetailModal
        task={detailTask}
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailTask(null);
        }}
        departments={departments}
        canManage={isDeptHead() && !isAdmin()}
        onRefresh={fetchTasks}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}



