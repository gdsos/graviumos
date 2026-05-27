import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Calendar, Check, ChevronDown, LayoutGrid, List, Search, User, X } from 'lucide-react';
import type { Task, Subtask, Profile } from '../../lib/supabase';

type TaskStatus =
  | 'Not Started'
  | 'Ongoing'
  | 'Overdue'
  | 'Completed';

type ViewMode = 'kanban' | 'list';

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
  filterPrefix?: ReactNode;
  onCardClick: (task: TaskWithDetails) => void;
}

const STATUSES: TaskStatus[] = [
  'Not Started',
  'Ongoing',
  'Overdue',
  'Completed',
];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'border-border bg-muted text-muted-foreground',
  Ongoing: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Overdue: 'border-destructive/20 bg-destructive/10 text-destructive',
  Completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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
  if (!iso) return '-';

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

function getAssigneeLabel(member?: Profile): string {
  return member?.full_name || member?.email || 'Unnamed Member';
}

function getTaskAssigneeLabel(task: TaskWithDetails): string {
  return task.assignee?.full_name || task.assignee?.email || 'Unassigned';
}

function ProgressBar({ value }: { value: number }) {
  const color =
    value === 100
      ? '#16a34a'
      : value >= 75
      ? '#0284c7'
      : '#f97316';

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
    >
      {status}
    </span>
  );
}

function AssigneeFilter({
  value,
  onChange,
  members,
}: {
  value: string;
  onChange: (value: string) => void;
  members: Profile[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedMember = members.find(member => member.id === value);
  const selectedLabel = selectedMember ? getAssigneeLabel(selectedMember) : 'All Members';

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return members;

    return members.filter(member => {
      const name = getAssigneeLabel(member).toLowerCase();
      const email = (member.email || '').toLowerCase();

      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  }, [members, query]);

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
        <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="hidden items-center gap-2 border-b border-border px-3 py-2 sm:flex">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search member"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange('');
                setOpen(false);
                setQuery('');
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                value === '' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span>All Members</span>
              {value === '' && <Check size={14} />}
            </button>

            {filteredMembers.map(member => {
              const isSelected = member.id === value;

              return (
                <button
                  key={member.id}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    onChange(member.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{getAssigneeLabel(member)}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No member found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewModeDropdown({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);

  const options: {
    value: ViewMode;
    label: string;
    icon: typeof LayoutGrid;
  }[] = [
    {
      value: 'kanban',
      label: 'Kanban',
      icon: LayoutGrid,
    },
    {
      value: 'list',
      label: 'List',
      icon: List,
    },
  ];

  const selected = options.find(option => option.value === value) || options[0];
  const SelectedIcon = selected.icon;

  return (
    <div
      className="relative w-full lg:w-auto"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none lg:w-[132px]"
        aria-label="Select task view"
      >
        <span className="inline-flex items-center gap-2">
          <SelectedIcon size={16} />
          <span>{selected.label}</span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-full min-w-[132px] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {options.map(option => {
            const Icon = option.icon;
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
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={16} />
                  {option.label}
                </span>

                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
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
      className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-muted-foreground/35 hover:bg-muted/20 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {task.title}
        </p>

        <StatusPill status={task.effectiveStatus} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <User size={14} />
        <span>{getTaskAssigneeLabel(task)}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Calendar
          size={14}
          className={
            deadlineOverdue
              ? 'text-destructive'
              : 'text-muted-foreground'
          }
        />

        <span
          className={
            deadlineOverdue
              ? 'font-medium text-destructive'
              : 'text-muted-foreground'
          }
        >
          {formatDeadline(task.deadline)}
        </span>
      </div>

      {task.effectiveStatus === 'Completed' &&
        task.completed_at && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
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

          <div className="flex items-center justify-between text-xs text-muted-foreground">
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

function TaskListItem({
  task,
  onClick,
}: {
  task: TaskWithDetails;
  onClick: () => void;
}) {
  const hasSubtasks = task.subtasks.length > 0;
  const progress = hasSubtasks ? calcProgress(task.subtasks) : 0;
  const deadlineOverdue = task.status !== 'Completed' && isOverdue(task.deadline);

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-muted-foreground/35 hover:bg-muted/20 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {task.title}
          </p>
          <StatusPill status={task.effectiveStatus} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User size={14} />
            {getTaskAssigneeLabel(task)}
          </span>

          <span
            className={`inline-flex items-center gap-1.5 ${
              deadlineOverdue ? 'text-destructive' : ''
            }`}
          >
            <Calendar size={14} />
            {formatDeadline(task.deadline)}
          </span>

          {hasSubtasks && (
            <span>{task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length} subtasks</span>
          )}
        </div>

        {hasSubtasks && (
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {hasSubtasks && (
          <span className="text-xs font-semibold text-muted-foreground">
            {progress}%
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          View
        </span>
      </div>
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
    <div className="flex min-w-[280px] w-[280px] shrink-0 flex-col rounded-2xl border border-border bg-card/70 lg:min-w-0 lg:w-auto lg:flex-1">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <p className="text-sm font-semibold text-foreground">
          {status}
        </p>

        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex min-h-[190px] flex-col gap-3 p-3">
        {tasks.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border bg-background/40">
            <p className="text-xs text-muted-foreground">
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
  filterPrefix,
  onCardClick,
}: TasksBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  useEffect(() => {
    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches;

    if (isSmallScreen) {
      setViewMode('list');
    }
  }, []);

  const filteredTasks = filterAssignee
    ? tasks.filter(t => t.assigned_to === filterAssignee)
    : tasks;

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
    <div className="flex flex-col gap-6">
      <div className="relative rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Filters
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {filterPrefix}

            <AssigneeFilter
              value={filterAssignee}
              onChange={setFilterAssignee}
              members={deptMembers}
            />

            {filterAssignee && (
              <button
                type="button"
                onClick={() => setFilterAssignee('')}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        <ViewModeDropdown
          value={viewMode}
          onChange={setViewMode}
        />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Loading tasks...
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="w-full overflow-x-auto pb-4 pr-4 lg:overflow-visible lg:pr-0">
          <div className="flex w-max min-w-full gap-4 lg:w-full">
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
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.length === 0 ? (
            <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
              No tasks found
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskListItem
                key={task.id}
                task={task}
                onClick={() => onCardClick(task)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
