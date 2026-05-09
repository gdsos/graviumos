import { User, Calendar, Check, X } from 'lucide-react';
import type { Task, Subtask, Profile } from '../../lib/supabase';

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

interface TasksBoardProps {
  tasks: TaskWithDetails[];
  loading?: boolean;
  filterAssignee: string;
  setFilterAssignee: (value: string) => void;
  deptMembers: Profile[];
  onCardClick: (task: TaskWithDetails) => void;
}

const STATUSES: TaskStatus[] = [
  'Not Started',
  'Ongoing',
  'Overdue',
  'Completed',
];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'bg-slate-100 text-slate-900',
  Ongoing: 'bg-blue-100 text-blue-900',
  Overdue: 'bg-red-100 text-red-900',
  Completed: 'bg-green-100 text-green-900',
};

function calcProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;

  return Math.round(
    (subtasks.filter(s => s.is_completed).length /
      subtasks.length) *
      100
  );
}

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;

  return new Date(deadline).getTime() < Date.now();
}

function ProgressBar({ value }: { value: number }) {
  const color =
    value === 100
      ? '#16a34a'
      : value >= 75
      ? '#0284c7'
      : '#f97316';

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

function TaskCard({
  task,
  onClick,
}: {
  task: TaskWithDetails;
  onClick: () => void;
}) {
  const hasSubtasks = task.subtasks.length > 0;

  const progress = hasSubtasks
    ? calcProgress(task.subtasks)
    : 0;

  const deadlineOverdue =
    task.status !== 'Completed' &&
    isOverdue(task.deadline);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-sm line-clamp-2 text-slate-900">
          {task.title}
        </p>

        <span
          className={`text-[11px] font-semibold px-2 py-1 rounded whitespace-nowrap ${STATUS_COLORS[task.effectiveStatus]}`}
        >
          {task.effectiveStatus}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <User size={14} />
        <span>
          {task.assignee?.full_name ||
            task.assignee?.email ||
            'Unassigned'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Calendar
          size={14}
          className={
            deadlineOverdue
              ? 'text-red-600'
              : 'text-slate-600'
          }
        />

        <span
          className={
            deadlineOverdue
              ? 'text-red-600 font-medium'
              : 'text-slate-600'
          }
        >
          {formatDeadline(task.deadline)}
        </span>
      </div>

      {task.effectiveStatus === 'Completed' &&
        task.completed_at && (
          <div className="flex items-center gap-2 text-xs text-green-700">
            <Check size={14} />
            <span>
              Completed on{' '}
              {formatDeadline(task.completed_at)}
            </span>
          </div>
        )}

      {hasSubtasks && (
        <div className="flex flex-col gap-1">
          <ProgressBar value={progress} />

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              {
                task.subtasks.filter(
                  s => s.is_completed
                ).length
              }
              /{task.subtasks.length} subtasks
            </span>

            <span>{progress}%</span>
          </div>
        </div>
      )}
    </button>
  );
}

function KanbanColumn({
  status,
  tasks,
  onCardClick,
}: {
  status: TaskStatus;
  tasks: TaskWithDetails[];
  onCardClick: (task: TaskWithDetails) => void;
}) {
  return (
    <div className="min-w-[300px] w-[300px] flex-shrink-0 flex flex-col bg-slate-50 rounded-2xl border border-slate-200">
      <div className="sticky top-0 z-10 bg-slate-50 rounded-t-2xl border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">
          {status}
        </p>

        <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 border border-dashed border-slate-300 rounded-xl">
            <p className="text-xs text-slate-400">
              No tasks
            </p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function TasksBoard({
    tasks,
    loading,
    filterAssignee,
    setFilterAssignee,
    deptMembers,
    onCardClick,
}: TasksBoardProps) {

    // ✅ STEP 1: FILTER FIRST (THIS IS THE FIX YOU MISSED)
    const filteredTasks = filterAssignee
        ? tasks.filter(t => t.assigned_to === filterAssignee)
        : tasks;

    // ✅ STEP 2: GROUP FILTERED TASKS
    const grouped: Record<TaskStatus, TaskWithDetails[]> = {
        'Not Started': [],
        Ongoing: [],
        Overdue: [],
        Completed: [],
    };

    filteredTasks.forEach(task => {
        grouped[task.effectiveStatus].push(task);
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-900">
          Filter by assignee:
        </p>

        <select
          value={filterAssignee}
          onChange={e =>
            setFilterAssignee(e.target.value)
          }
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-slate-900"
        >
          <option value="">All Members</option>

          {deptMembers.map(member => (
            <option key={member.id} value={member.id}>
              {member.full_name || member.email}
            </option>
          ))}
        </select>

        {filterAssignee && (
          <button
            type="button"
            onClick={() => setFilterAssignee('')}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-slate-600">
            Loading tasks...
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={grouped[status]}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}