import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Task, type Subtask, type Profile, type Department } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { User, Calendar, Check, Plus, X } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';
import type React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

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

const STATUSES: Exclude<TaskStatus, 'Overdue'>[] = ['Not Started', 'Ongoing', 'Completed'];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'bg-slate-100 text-slate-900',
  Ongoing: 'bg-blue-100 text-blue-900',
  Overdue: 'bg-red-100 text-red-900',
  Completed: 'bg-green-100 text-green-900',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) return 'Overdue';
  return task.status as TaskStatus;
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
      <label className="block text-xs font-medium text-slate-900 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? '#16a34a' : value >= 75 ? '#0284c7' : '#f97316';
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
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

function TaskCard({ task, onClick }: { task: TaskWithDetails; onClick: () => void }) {
  const hasSubtasks = task.subtasks.length > 0;
  const progress = hasSubtasks ? calcProgress(task.subtasks) : 0;
  const deadlineOverdue = task.status !== 'Completed' && isOverdue(task.deadline);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border-2 border-slate-200 hover:border-slate-900 focus:outline-none focus:border-slate-900 transition-colors p-4 flex flex-col gap-3"
    >
      <p className="font-medium text-sm line-clamp-2">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[task.effectiveStatus]}`}>
          {task.effectiveStatus === 'Completed' && task.overdueByDays
            ? `Completed (Overdue by ${task.overdueByDays}d)`
            : task.effectiveStatus}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <User size={14} className="text-slate-600" />
        <p className="text-xs text-slate-600">
          {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <Calendar size={14} className={deadlineOverdue ? 'text-red-600' : 'text-slate-600'} />
        <p className="text-xs" style={{ color: deadlineOverdue ? '#dc2626' : '#475569' }}>
          {formatDeadline(task.deadline)}
        </p>
        {deadlineOverdue && (
          <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-900">Overdue</span>
        )}
      </div>

      {task.effectiveStatus === 'Completed' && task.completed_at && (
        <div className="flex items-center gap-1.5">
          <Check size={14} className="text-green-600" />
          <p className="text-xs text-green-700">Completed on {formatDeadline(task.completed_at)}</p>
        </div>
      )}

      {hasSubtasks && (
        <div className="flex flex-col gap-1">
          <ProgressBar value={progress} />
          <p className="text-xs text-slate-600">
            {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length} subtasks · {progress}%
          </p>
        </div>
      )}
    </button>
  );
}

function KanbanColumn({ status, tasks, onCardClick }: { status: TaskStatus; tasks: TaskWithDetails[]; onCardClick: (task: TaskWithDetails) => void }) {
  return (
    <div className="flex flex-col gap-3 min-w-[240px] flex-1">
      <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200">
        <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{status}</p>
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-xs font-semibold text-slate-900">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-slate-300">
            <p className="text-xs text-slate-400">No tasks</p>
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

  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [filterAssignee, setFilterAssignee] = useState('');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const deadlineDateRef = useRef<HTMLInputElement>(null);

  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);

  const canManage = isAdmin() || isDeptHead();
  const activeDeptName = DEPT_NAMES[activeTabIndex];
  const activeDept: Department | undefined = departments.find(d => d.name === activeDeptName);
  const deptMembers = activeDept
    ? allProfiles.filter(p => p.department_ids?.includes(activeDept.id) && p.is_active)
    : [];

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setProjects(data);
    }
  }, []);

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
    fetchProjects();
  }, [fetchTasks, fetchProfiles, fetchProjects]);

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

  const openCreate = () => {
    setEditingTask(null);
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

  const activeDeptTasks = tabTasks(activeDept?.id);
  const grouped = groupByStatus(activeDeptTasks);

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Tasks</h1>
          <p className="text-xs text-slate-600">Manage department tasks across your organisation</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> Add Task
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-900">Error</p>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      )}

      {/* Department Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-6">
          {DEPT_NAMES.map((deptName, idx) => {
            const dept = departments.find(d => d.name === deptName);
            const deptTaskCount = dept ? tasks.filter(t => t.department_id === dept.id).length : 0;

            return (
              <button
                key={deptName}
                onClick={() => { setActiveTabIndex(idx); setFilterAssignee(''); }}
                className={`py-3 px-1 font-medium text-sm transition-colors border-b-2 ${
                  idx === activeTabIndex
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {deptName}{deptTaskCount > 0 ? ` (${deptTaskCount})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content for active tab */}
      {DEPT_NAMES[activeTabIndex] && (
        <div>
          {/* Filter bar */}
          <div className="mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs font-semibold text-slate-900">
                Filter by assignee:
              </p>
              <select
                value={filterAssignee}
                onChange={e => setFilterAssignee(e.target.value)}
                className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Kanban board */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-slate-600">Loading tasks...</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUSES.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={grouped[status]}
                  onCardClick={setSelectedTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h2>
            </div>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-4 p-6">
              {formError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-800 mt-1">{formError}</p>
                </div>
              )}

              <FormField label="Title *">
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                  placeholder="Task title"
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors resize-none"
                  placeholder="Optional description"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Department">
                  <select
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value, assigned_to: '' }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
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

              {projects.length > 0 && (
                <FormField label="Project">
                  <select
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    <option value="">— No Project —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Deadline Date">
                  <div className="relative">
                    <input
                      ref={deadlineDateRef}
                      type="date"
                      value={form.deadline_date}
                      onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors pr-9"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => deadlineDateRef.current?.showPicker()}
                      tabIndex={-1}
                      aria-label="Pick date"
                    >
                      <Calendar size={14} className="text-slate-600" />
                    </button>
                  </div>
                </FormField>

                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowTaskModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <TaskDetailModal
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        departments={departments}
        canManage={canManage}
        onRefresh={fetchTasks}
      />
    </div>
  );
}
