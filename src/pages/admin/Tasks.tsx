import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  supabase,
  type Task,
  type Subtask,
  type Profile,
  type Department,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { DateInput } from '../../components/common/DateInput';
import { Plus, Check, ChevronDown, Search } from 'lucide-react';
import TaskDetailModal from '../../components/tasks/TaskDetailModal';
import TasksBoard from '../../components/tasks/TasksBoard';
import { createNotification } from '../../lib/notifications';
import {
  calcEffectiveStatus,
  calcOverdueDays,
} from '../../lib/taskUtils';
import type React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus =
  | 'Not Started'
  | 'Ongoing'
  | 'Overdue'
  | 'Completed';

interface TaskWithDetails extends Task {
  assignee?: Profile;
  subtasks: Subtask[];
  effectiveStatus: TaskStatus;
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

const STATUSES: TaskStatus[] = [
  'Not Started',
  'Ongoing',
  'Completed',
];

// ─── Components ───────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">
        {label}
      </label>

      {children}
    </div>
  );
}

// ─── Form State ───────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────



interface TaskOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function TaskFormDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
}: {
  value: string;
  options: TaskOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const selectedLabel = selected?.label || placeholder;

  return (
    <div
      className={`relative ${open ? "z-[120]" : "z-0"}`}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute bottom-full left-0 z-[200] mb-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
          {options.map(option => {
            const isSelected = option.value === value;

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                disabled={option.disabled}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DepartmentFilterOption {
  name: string;
  count: number;
  index: number;
}

function DepartmentFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: DepartmentFilterOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(option => option.name === value);
  const selectedLabel = selected?.name || 'Select Department';

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(query.trim().toLowerCase())
  );

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
        onClick={() => {
          setOpen(current => !current);
          setQuery('');
        }}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="hidden items-center gap-2 border-b border-border px-3 py-2 sm:flex">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search department"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.map(option => {
              const isSelected = option.name === value;

              return (
                <button
                  key={option.name}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    onChange(option.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{option.name}</span>

                  <span className="flex items-center gap-2">
                    {option.count > 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {option.count}
                      </span>
                    )}

                    {isSelected && <Check size={14} />}
                  </span>
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No department found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const location = useLocation();

  const {
    profile,
    departments,
    isAdmin,
    isDeptHead,
  } = useAuth();

  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<
    { id: string; name: string }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error] = useState('');

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [filterAssignee, setFilterAssignee] = useState('');

  const [showTaskModal, setShowTaskModal] = useState(false);

  const [editingTask, setEditingTask] =
    useState<TaskWithDetails | null>(null);

  const [selectedTask, setSelectedTask] =
    useState<TaskWithDetails | null>(null);

  const [form, setForm] =
    useState<TaskFormState>(EMPTY_FORM);

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const canManage = isAdmin() || isDeptHead();

  const activeDeptName = DEPT_NAMES[activeTabIndex];

  const activeDept: Department | undefined =
    departments.find(
      d => d.name === activeDeptName
    );

  const deptMembers = activeDept
    ? allProfiles.filter(
        p =>
          p.department_ids?.includes(activeDept.id) &&
          p.is_active
      )
    : [];

  // ─── Fetch Projects ────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setProjects(data);
    }
  }, []);

  // ─── Fetch Profiles ────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, department_ids, is_active, role'
      )
      .eq('is_active', true);

    setAllProfiles((data as Profile[]) || []);
  }, []);

  // ─── Fetch Tasks ───────────────────────────────────────────────────────────

  const fetchTasks = useCallback(
    async (showLoader = false) => {
      try {
        if (!profile?.id) {
          return;
        }

        if (showLoader) {
          setLoading(true);
        }

        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user?.id) {
          return;
        }

        // TASKS
        const { data: tasksData, error: tasksErr } =
          await supabase
            .from('tasks')
            .select('*')
            .order('created_at', {
              ascending: false,
            });

        if (tasksErr) {
          return;
        }

        const safeTasks = (tasksData || []).filter(Boolean);

        const taskIds = safeTasks.map(
          (t: Task) => t.id
        );

        // SUBTASKS
        let subtaskMap: Record<
          string,
          Subtask[]
        > = {};

        if (taskIds.length > 0) {
          const { data: subtasksData } =
            await supabase
              .from('subtasks')
              .select('*')
              .in('task_id', taskIds);

          if (subtasksData) {
            for (const sub of subtasksData as Subtask[]) {
              if (!subtaskMap[sub.task_id]) {
                subtaskMap[sub.task_id] = [];
              }

              subtaskMap[sub.task_id].push(sub);
            }
          }
        }

        // ASSIGNEES
        const assigneeIds = [
          ...new Set(
            safeTasks
              .map((t: Task) => t.assigned_to)
              .filter(Boolean) as string[]
          ),
        ];

        let assigneeMap: Record<
          string,
          Profile
        > = {};

        if (assigneeIds.length > 0) {
          const { data: profData } =
            await supabase
              .from('profiles')
              .select(
                'id, full_name, email, department_ids, is_active, role'
              )
              .in('id', assigneeIds);

          if (profData) {
            for (const p of profData as Profile[]) {
              assigneeMap[p.id] = p;
            }
          }
        }

        // ENRICH TASKS
        const enriched: TaskWithDetails[] =
          safeTasks.map((t: Task) => {
            const subtasks = Array.isArray(
              subtaskMap[t.id]
            )
              ? subtaskMap[t.id]
              : [];

            return {
              ...t,
              subtasks,
              assignee: t.assigned_to
                ? assigneeMap[t.assigned_to]
                : undefined,
              effectiveStatus:
                calcEffectiveStatus(t),
              overdueByDays:
                calcOverdueDays(t),
            };
          });

        setTasks(enriched);

      } catch (error) {
        console.error(
          'Failed to fetch tasks:',
          error
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedTask]
  );

  // ─── Initial Load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTasks(true);
    fetchProfiles();
    fetchProjects();
  }, [
    fetchTasks,
    fetchProfiles,
    fetchProjects,
  ]);

  // ─── Handle Query Param Task ───────────────────────────────────────────────

  useEffect(() => {

    if (!profile) return;

    if (loading) return;

    if (!Array.isArray(tasks)) return;

    const params = new URLSearchParams(location.search);

    const taskId = params.get('task');

    // FIX: properly close modal
    if (!taskId) {
      return;
    }

    const foundTask = tasks.find(
      t => t?.id === taskId
    );

    if (!foundTask) {

      setSelectedTask(null);

      window.history.replaceState(
        {},
        '',
        '/admin/tasks'
      );

      return;
    }

    const deptIndex = DEPT_NAMES.findIndex(name => {
      const dept = departments.find(
        d => d.name === name
      );

      return dept?.id === foundTask.department_id;
    });

    if (deptIndex >= 0) {
      setActiveTabIndex(deptIndex);
    }

    setSelectedTask(foundTask);

  }, [
    location.search,
    tasks,
    loading,
    profile,
    departments
  ]);

  // ─── Default Dept Tab ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile || departments.length === 0) {
      return;
    }

    if (isAdmin()) return;

    const firstAccessible =
      DEPT_NAMES.findIndex(name => {
        const dept = departments.find(
          d => d.name === name
        );

        return (
          dept &&
          profile.department_ids?.includes(
            dept.id
          )
        );
      });

    if (firstAccessible >= 0) {
      setActiveTabIndex(firstAccessible);
    }
  }, [
    profile,
    departments,
    isAdmin,
  ]);

  // ─── Filter Tasks By Department ────────────────────────────────────────────

  const tabTasks = (
    deptId?: string
  ): TaskWithDetails[] => {
    if (!deptId || !profile) return [];

    // ADMIN
    if (isAdmin()) {
      return tasks.filter(
        t => t.department_id === deptId
      );
    }

    // DEPT HEAD
    if (isDeptHead()) {
      if (
        !profile.department_ids?.includes(
          deptId
        )
      ) {
        return [];
      }

      return tasks.filter(
        t => t.department_id === deptId
      );
    }

    // EMPLOYEE
    return tasks.filter(
      t =>
        t.department_id === deptId &&
        t.assigned_to === profile.id
    );
  };

  // ─── Create Modal ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingTask(null);

    const isOnlyDeptHead =
      !isAdmin() && isDeptHead();

    const defaultDeptId = isOnlyDeptHead
      ? profile?.department_ids?.[0] ||
        activeDept?.id ||
        ''
      : activeDept?.id || '';

    setForm({
      ...EMPTY_FORM,
      department_id: defaultDeptId,
    });

    setFormError('');
    setShowTaskModal(true);
  };

  // ─── Save Task ─────────────────────────────────────────────────────────────

  const handleSaveTask = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const deadline = form.deadline_date
        ? new Date(
            form.deadline_date
          ).toISOString()
        : null;

      const completedAt =
        form.status === 'Completed'
          ? editingTask?.completed_at ||
            new Date().toISOString()
          : null;

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim(),
        assigned_to:
          form.assigned_to || null,
        department_id:
          form.department_id || null,
        deadline,
        status: form.status,
        project_id:
          form.project_id || null,
        updated_at:
          new Date().toISOString(),
        completed_at: completedAt,
      };

      let err = null;

      // UPDATE
      if (editingTask) {
        const { error: updateError } =
          await supabase
            .from('tasks')
            .update(payload)
            .eq('id', editingTask.id);

        err = updateError;

        if (!updateError && form.assigned_to) {
          let notifTitle = 'Task Updated';

          let notifMessage = `"${form.title}" was updated`;

          if (
            form.status === 'Completed'
          ) {
            notifTitle =
              'Task Completed';

            notifMessage = `"${form.title}" was marked completed`;
          }

          await createNotification(
            form.assigned_to,
            notifTitle,
            notifMessage,
            'task',
            `/portal/tasks?task=${editingTask.id}`
          );
        }
      }

      // CREATE
      else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from('tasks')
          .insert({
            ...payload,
            created_by: profile?.id,
            progress: 0,
            completed_at: null,
          })
          .select()
          .single();

        err = insertError;

        if (!insertError && data) {

          const createdTask = data as Task;

          const createdDeptIndex = DEPT_NAMES.findIndex(name => {
            const dept = departments.find(d => d.name === name);

            return dept?.id === createdTask.department_id;
          });

          if (createdDeptIndex >= 0) {
            setActiveTabIndex(createdDeptIndex);
          }

          setFilterAssignee('');

          const assignee = createdTask.assigned_to
            ? allProfiles.find(profile => profile.id === createdTask.assigned_to)
            : undefined;

          const optimisticTask: TaskWithDetails = {
            ...createdTask,
            assignee,
            subtasks: [],
            effectiveStatus: calcEffectiveStatus(createdTask),
            overdueByDays: calcOverdueDays(createdTask),
          };

          setTasks(prev => [
            optimisticTask,
            ...prev.filter(task => task.id !== optimisticTask.id),
          ]);
        }

        if (
          !insertError &&
          data &&
          form.assigned_to
        ) {
          await createNotification(
            form.assigned_to,
            'New Task Assigned',
            `You were assigned: ${form.title}`,
            'task',
            `/portal/tasks?task=${data.id}`
          );
        }
      }

      if (err) {
        setFormError(err.message);
        return;
      }

      setShowTaskModal(false);
      setForm(EMPTY_FORM);

      // Keep the optimistic task visible after creation.
      // A background refetch can hide the new row when Supabase/RLS filters have not caught up yet.
    } catch (error) {
      console.error(error);

      setFormError(
        'Failed to save task.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Task ───────────────────────────────────────────────────────────

  const handleTaskDeleted = (
    taskId: string
  ) => {
    setSelectedTask(null);

    setTasks(prev =>
      prev.filter(
        t => t && t.id !== taskId
      )
    );

    window.history.replaceState(
      {},
      '',
      '/admin/tasks'
    );

    fetchTasks();
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

    setSelectedTask(updatedTask);
  };

  // ─── Active Tasks ──────────────────────────────────────────────────────────

  const activeDeptTasks = (
    tabTasks(activeDept?.id) || []
  ).filter(task => {
    if (!filterAssignee) return true;

    return (
      task.assigned_to === filterAssignee
    );
  });

  // ─── Render ────────────────────────────────────────────────────────────────


  const departmentFilterOptions = DEPT_NAMES.reduce<DepartmentFilterOption[]>(
    (items, deptName, index) => {
      const dept =
        departments.find(
          d => d.name === deptName
        );

      if (
        !isAdmin() &&
        dept &&
        !profile?.department_ids?.includes(
          dept.id
        )
      ) {
        return items;
      }

      items.push({
        name: deptName,
        index,
        count: dept ? tabTasks(dept.id).length : 0,
      });

      return items;
    },
    []
  );

  const handleDepartmentFilterChange = (deptName: string) => {
    const nextIndex = Array.from<string>(DEPT_NAMES).indexOf(deptName);

    if (nextIndex < 0) return;

    setActiveTabIndex(nextIndex);
    setFilterAssignee('');
  };

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
              Tasks
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Manage department tasks across your organisation.
            </p>
          </div>

          {canManage && (
            <Button
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium"
            >
              <Plus size={16} />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Error */}

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            Error
          </p>

          <p className="mt-1 text-sm text-destructive/85">
            {error}
          </p>
        </div>
      )}

      {/* Department Switcher */}

      <div className="mb-6 hidden overflow-x-auto rounded-2xl border border-border bg-card/60 p-2 md:block">
        <div className="flex min-w-max gap-2">
          {DEPT_NAMES.map(
            (deptName, idx) => {
              const dept =
                departments.find(
                  d => d.name === deptName
                );

              if (
                !isAdmin() &&
                dept &&
                !profile?.department_ids?.includes(
                  dept.id
                )
              ) {
                return null;
              }

              let deptTaskCount = 0;

              if (dept) {
                deptTaskCount =
                  tabTasks(dept.id).length;
              }

              const isActive = idx === activeTabIndex;

              return (
                <button
                  key={deptName}
                  onClick={() => {
                    setActiveTabIndex(
                      idx
                    );

                    setFilterAssignee(
                      ''
                    );
                  }}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{deptName}</span>

                  {deptTaskCount > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive
                          ? 'bg-primary-foreground/15 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {deptTaskCount}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Board */}

      {DEPT_NAMES[activeTabIndex] && (
        <TasksBoard
          tasks={activeDeptTasks}
          loading={loading}
          filterAssignee={
            filterAssignee
          }
          setFilterAssignee={
            setFilterAssignee
          }
          deptMembers={deptMembers}
          filterPrefix={
            <div className="min-w-0 flex-1 sm:min-w-[220px] md:hidden">
              <DepartmentFilter
                value={activeDeptName}
                options={departmentFilterOptions}
                onChange={handleDepartmentFilterChange}
              />
            </div>
          }
          onCardClick={setSelectedTask}
        />
      )}

      {/* Modal */}

      {showTaskModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Task Setup
              </p>

              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h2>
            </div>

            <form
              onSubmit={handleSaveTask}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-5">
                  {formError && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                      <p className="text-sm font-medium text-destructive">
                        Error
                      </p>

                      <p className="mt-1 text-sm text-destructive/85">
                        {formError}
                      </p>
                    </div>
                  )}

                  <FormField label="Title *">
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder="Task title"
                    />
                  </FormField>

                  <FormField label="Description">
                    <textarea
                      value={form.description}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                      className="min-h-28 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
                      placeholder="Optional description"
                    />
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Department">
                      <TaskFormDropdown
                        value={form.department_id}
                        placeholder="Select department"
                        disabled={!isAdmin() && isDeptHead()}
                        onChange={value =>
                          setForm(current => ({
                            ...current,
                            department_id: value,
                            assigned_to: '',
                          }))
                        }
                        options={[
                          { value: '', label: 'Select Department' },
                          ...departments.map(department => ({
                            value: department.id,
                            label: department.name,
                          })),
                        ]}
                      />
                    </FormField>

                    <FormField label="Assign To">
                      <TaskFormDropdown
                        value={form.assigned_to}
                        placeholder="Unassigned"
                        onChange={value =>
                          setForm(current => ({
                            ...current,
                            assigned_to: value,
                          }))
                        }
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...(form.department_id
                            ? allProfiles.filter(
                                profile =>
                                  profile.department_ids?.includes(form.department_id) &&
                                  profile.is_active
                              )
                            : allProfiles.filter(profile => profile.is_active)
                          ).map(profile => ({
                            value: profile.id,
                            label: profile.full_name || profile.email || 'Unnamed Member',
                          })),
                        ]}
                      />
                    </FormField>
                  </div>

                  {projects.length > 0 && (
                    <FormField label="Project">
                      <TaskFormDropdown
                        value={form.project_id}
                        placeholder="No Project"
                        onChange={value =>
                          setForm(current => ({
                            ...current,
                            project_id: value,
                          }))
                        }
                        options={[
                          { value: '', label: 'No Project' },
                          ...projects.map(project => ({
                            value: project.id,
                            label: project.name,
                          })),
                        ]}
                      />
                    </FormField>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Deadline Date">
                      <DateInput
                        value={form.deadline_date}
                        onChange={value =>
                          setForm(current => ({
                            ...current,
                            deadline_date: value,
                          }))
                        }
                        placeholder="Select deadline"
                        placement="up"
                      />
                    </FormField>

                    <FormField label="Status">
                      <TaskFormDropdown
                        value={form.status}
                        onChange={value =>
                          setForm(current => ({
                            ...current,
                            status: value as TaskStatus,
                          }))
                        }
                        options={STATUSES.map(status => ({
                          value: status,
                          label: status,
                        }))}
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTaskModal(false)}
                    className="h-10 rounded-xl"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl"
                  >
                    {saving
                      ? 'Saving...'
                      : editingTask
                        ? 'Save Changes'
                        : 'Create Task'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}

      <TaskDetailModal
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => {
          setSelectedTask(null);

          window.history.replaceState(
            {},
            '',
            '/admin/tasks'
          );
        }}
        departments={departments}
        canManage={canManage}
        onRefresh={fetchTasks}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}