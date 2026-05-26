import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Task, type Subtask, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import TaskDetailModal from "../../components/tasks/TaskDetailModal";
import TasksBoard from "../../components/tasks/TasksBoard";
import { Calendar, Plus } from 'lucide-react';

// ——— Types ————————————————————————————————————————————————————————————————————

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
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            {isDeptHeadOnly ? 'Tasks' : 'My Tasks'}
          </h1>
          <p className="text-xs text-slate-600">
            {isDeptHeadOnly
              ? activeTab === 'assigned'
                ? `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you`
                : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} in your department`
              : `${totalTasks} task${totalTasks !== 1 ? 's' : ''} assigned to you`}
          </p>
        </div>
        {isDeptHeadOnly && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            Add Task
          </button>
        )}
      </div>

      {/* Tabs for department heads */}
      {isDeptHeadOnly && (
        <div className="mb-6 flex gap-6 border-b border-border pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-0 py-3 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            All Tasks
          </button>
          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-0 py-3 font-medium text-sm transition-colors ${
              activeTab === 'assigned'
                ? 'text-primary border-b-2 border-primary -mb-[2px]'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            My Tasks
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-900">
            Error loading tasks
          </p>
          <p className="text-sm text-red-800 mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-sm text-slate-600">
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
            onCardClick={openDetail}
          />
      )}

      {/* —— Create Task Modal (for dept heads) —————————————————————————————— */}
      {isDeptHead() && !isAdmin() && showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">Add Task</h2>
            </div>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-4 p-6">

              {createError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-800 mt-1">{createError}</p>
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
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
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
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors resize-none"
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-slate-100 text-slate-900"
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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
                      className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => deadlineDateRef.current?.showPicker()}
                    >
                      <Calendar size={14} className="text-slate-600" />
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
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
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}



