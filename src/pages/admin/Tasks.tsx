import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Calendar, Plus } from 'lucide-react';
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
      <label className="block text-xs font-medium text-slate-900 mb-1.5">
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

  const deadlineDateRef = useRef<HTMLInputElement>(null);

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
        if (showLoader) {
          setLoading(true);
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
          console.error(tasksErr);
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
        '/portal/tasks'
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

      await fetchTasks();
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
      '/portal/tasks'
    );

    fetchTasks();
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

  return (
    <div className="max-w-full">
      {/* Header */}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            Tasks
          </h1>

          <p className="text-xs text-slate-600">
            Manage department tasks
            across your organisation
          </p>
        </div>

        {canManage && (
          <Button
            onClick={openCreate}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Add Task
          </Button>
        )}
      </div>

      {/* Error */}

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-900">
            Error
          </p>

          <p className="text-sm text-red-800 mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Tabs */}

      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-6 overflow-x-auto">
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
                  className={`py-3 px-1 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                    idx === activeTabIndex
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {deptName}

                  {deptTaskCount > 0
                    ? ` (${deptTaskCount})`
                    : ''}
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
          onCardClick={setSelectedTask}
        />
      )}

      {/* Modal */}

      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingTask
                  ? 'Edit Task'
                  : 'Add Task'}
              </h2>
            </div>

            <form
              onSubmit={handleSaveTask}
              className="flex flex-col gap-4 p-6"
            >
              {formError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-900">
                    Error
                  </p>

                  <p className="text-sm text-red-800 mt-1">
                    {formError}
                  </p>
                </div>
              )}

              {/* Title */}

              <FormField label="Title *">
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      title:
                        e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                  placeholder="Task title"
                />
              </FormField>

              {/* Description */}

              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      description:
                        e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors resize-none"
                  placeholder="Optional description"
                />
              </FormField>

              {/* Department + Assignee */}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Department">
                  <select
                    value={
                      form.department_id
                    }
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        department_id:
                          e.target.value,
                        assigned_to: '',
                      }))
                    }
                    disabled={
                      !isAdmin() &&
                      isDeptHead()
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    <option value="">
                      — Select —
                    </option>

                    {departments.map(d => (
                      <option
                        key={d.id}
                        value={d.id}
                      >
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Assign To">
                  <select
                    value={
                      form.assigned_to
                    }
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        assigned_to:
                          e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {(form.department_id
                      ? allProfiles.filter(
                          p =>
                            p.department_ids?.includes(
                              form.department_id
                            ) &&
                            p.is_active
                        )
                      : allProfiles.filter(
                          p => p.is_active
                        )
                    ).map(p => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.full_name ||
                          p.email}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Project */}

              {projects.length > 0 && (
                <FormField label="Project">
                  <select
                    value={
                      form.project_id
                    }
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        project_id:
                          e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    <option value="">
                      — No Project —
                    </option>

                    {projects.map(p => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {/* Date + Status */}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Deadline Date">
                  <div className="relative">
                    <input
                      ref={
                        deadlineDateRef
                      }
                      type="date"
                      value={
                        form.deadline_date
                      }
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          deadline_date:
                            e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors pr-9"
                    />

                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Pick date"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() =>
                        deadlineDateRef.current?.showPicker()
                      }
                    >
                      <Calendar
                        size={14}
                        className="text-slate-600"
                      />
                    </button>
                  </div>
                </FormField>

                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        status:
                          e.target
                            .value as TaskStatus,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    {STATUSES.map(s => (
                      <option
                        key={s}
                        value={s}
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Actions */}

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setShowTaskModal(
                      false
                    )
                  }
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingTask
                    ? 'Save Changes'
                    : 'Create Task'}
                </Button>
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
            '/portal/tasks'
          );
        }}
        departments={departments}
        canManage={canManage}
        onRefresh={fetchTasks}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}