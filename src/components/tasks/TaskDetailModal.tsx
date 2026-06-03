import { useEffect, useState } from 'react';
import { supabase, type Task, type Subtask, type Department, type Profile } from '../../lib/supabase';
import { createNotification, deleteTaskNotifications } from '../../lib/notifications';
import { Button } from '../ui/button';
import { DateInput } from '../common/DateInput';
import { Check, CheckCircle2, ChevronDown, Pencil, RotateCcw, User, Trash2, List } from 'lucide-react';
import {
  calcEffectiveStatus,
  calcOverdueDays,
} from '../../lib/taskUtils';

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface TaskWithDetails extends Task {
  assignee?: Profile;
  subtasks: Subtask[];
  effectiveStatus: TaskStatus;
  overdueByDays?: number;
}

interface TaskDetailModalProps {
  task: TaskWithDetails | null;
  open: boolean;
  onClose: () => void;
  departments: Department[];
  canManage: boolean;
  onRefresh: () => void;
  onTaskUpdated?: (task: TaskWithDetails) => void;
  onTaskDeleted?: (taskId: string) => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'Not Started': 'border-border bg-muted text-muted-foreground',
  Ongoing: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Overdue: 'border-destructive/20 bg-destructive/10 text-destructive',
  Completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isOverdue(
  deadline: string | null,
  status?: string
): boolean {
  if (!deadline || status === 'Completed') {
    return false;
  }

  return new Date(deadline).getTime() < Date.now();
}

function calcProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;

  return Math.round(
    (subtasks.filter(s => s.is_completed).length / subtasks.length) * 100
  );
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


function StatusSelect({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: TaskStatus[] = ['Not Started', 'Ongoing'];

  return (
    <div
      className="relative"
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
        <span>{value}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {options.map(option => {
            const isSelected = option === value;

            return (
              <button
                key={option}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span>{option}</span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TaskDetailModal({
  task,
  open,
  onClose,
  departments,
  canManage,
  onRefresh,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const [currentTask, setCurrentTask] = useState<TaskWithDetails | null>(task);
  const [editingTask, setEditingTask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    deadline: string;
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    deadline: '',
    status: 'Not Started',
  });

    useEffect(() => {

        // modal closed
        if (!task) {
            setCurrentTask(null);
            setEditingTask(false);
            return;
        }

        // prevent infinite rerender blinking
        if (
            currentTask &&
            currentTask.id === task.id &&
            currentTask.updated_at === task.updated_at
        ) {
            return;
        }

        setCurrentTask(task);

        setEditingTask(false);

        setEditForm({
            title: task.title || '',
            description: task.description || '',
            deadline: task.deadline
                ? new Date(task.deadline).toISOString().slice(0, 10)
                : '',
            status: task.status || 'Not Started',
        });

    }, [task, currentTask]);

  const handleToggleSubtask = async (
    subtask: Subtask
  ) => {
    if (!currentTask) return;

    const newVal = !subtask.is_completed;

    await supabase
      .from('subtasks')
      .update({ is_completed: newVal })
      .eq('id', subtask.id);

    const updatedSubtasks = currentTask.subtasks.map(s =>
      s.id === subtask.id
        ? { ...s, is_completed: newVal }
        : s
    );

    const updatedTask = {
      ...currentTask,
      subtasks: updatedSubtasks,
    };

    setCurrentTask({
      ...updatedTask,
      effectiveStatus: calcEffectiveStatus(updatedTask),
      overdueByDays: calcOverdueDays(updatedTask),
    });

    onRefresh();
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !currentTask) return;

    setAddingSubtask(true);

    const { data } = await supabase
      .from('subtasks')
      .insert({
        task_id: currentTask.id,
        title: newSubtaskTitle.trim(),
        is_completed: false,
      })
      .select()
      .single();

    setAddingSubtask(false);

    if (data) {
      const updatedTask = {
        ...currentTask,
        subtasks: [
          ...currentTask.subtasks,
          data as Subtask,
        ],
      };

      setCurrentTask({
        ...updatedTask,
        effectiveStatus: calcEffectiveStatus(updatedTask),
        overdueByDays: calcOverdueDays(updatedTask),
      });

      setNewSubtaskTitle('');
    }

    onRefresh();
  };

  const handleDeleteSubtask = async (
    subtaskId: string
  ) => {
    if (!currentTask) return;

    await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtaskId);

    const updatedTask = {
      ...currentTask,
      subtasks: currentTask.subtasks.filter(
        s => s.id !== subtaskId
      ),
    };

    setCurrentTask({
      ...updatedTask,
      effectiveStatus: calcEffectiveStatus(updatedTask),
      overdueByDays: calcOverdueDays(updatedTask),
    });

    onRefresh();
  };

  const handleSaveTask = async () => {
    if (!currentTask) return;

    const updatedDeadline = editForm.deadline
      ? new Date(editForm.deadline).toISOString()
      : null;

    const completedAt =
      editForm.status === 'Completed'
        ? currentTask.completed_at || new Date().toISOString()
        : null;

    const { error } = await supabase
      .from('tasks')
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        deadline: updatedDeadline,
        status: editForm.status,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentTask.id);

    if (!error) {
      // CREATE NOTIFICATION
      if (currentTask.assigned_to) {
        await createNotification(
          currentTask.assigned_to,
          editForm.status === 'Completed'
            ? 'Task Completed'
            : 'Task Updated',
          editForm.status === 'Completed'
            ? `Task "${editForm.title}" was marked completed`
            : `Task "${editForm.title}" was updated`,
          'task',
          `/portal/tasks?taskId=${currentTask.id}`
        );
      }

      const updatedTask: TaskWithDetails = {
        ...currentTask,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        deadline: updatedDeadline,
        status: editForm.status,
        completed_at: completedAt,
      };

      const enrichedUpdatedTask: TaskWithDetails = {
        ...updatedTask,
        effectiveStatus: calcEffectiveStatus(updatedTask),
        overdueByDays: calcOverdueDays(updatedTask),
      };

      setCurrentTask(enrichedUpdatedTask);
      onTaskUpdated?.(enrichedUpdatedTask);

      setEditingTask(false);
    }
  };

  const handleToggleTaskCompletion = async () => {
    if (!currentTask) return;

    const nextIsCompleted = currentTask.status !== 'Completed';
    const nextStatus: TaskStatus = nextIsCompleted ? 'Completed' : 'Ongoing';
    const nextCompletedAt = nextIsCompleted ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: nextCompletedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentTask.id);

    if (error) {
      console.error(error);
      return;
    }

    if (currentTask.assigned_to) {
      await createNotification(
        currentTask.assigned_to,
        nextIsCompleted ? 'Task Completed' : 'Task Reopened',
        nextIsCompleted
          ? `Task "${currentTask.title}" was marked completed`
          : `Task "${currentTask.title}" was reopened`,
        'task',
        `/portal/tasks?taskId=${currentTask.id}`
      );
    }

    const updatedTask: TaskWithDetails = {
      ...currentTask,
      status: nextStatus,
      completed_at: nextCompletedAt,
      updated_at: new Date().toISOString(),
    };

    const enrichedUpdatedTask: TaskWithDetails = {
      ...updatedTask,
      effectiveStatus: calcEffectiveStatus(updatedTask),
      overdueByDays: calcOverdueDays(updatedTask),
    };

    setCurrentTask(enrichedUpdatedTask);
    setEditForm(form => ({
      ...form,
      status: nextStatus,
    }));
    onTaskUpdated?.(enrichedUpdatedTask);
    onRefresh();
  };

  const handleDeleteTask = async () => {
    if (!currentTask?.id) return;

    const taskId = currentTask.id;

    try {
      setDeleting(true);

      // delete subtasks
      const { error: subtaskError } = await supabase
        .from('subtasks')
        .delete()
        .eq('task_id', taskId);

      if (subtaskError) {
        console.error(subtaskError);
      }

      // delete notifications linked to task
      await deleteTaskNotifications(taskId);

      // delete task
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (taskError) {
        console.error(taskError);
        return;
      }

      // remove modal immediately
      onClose();

      // remove selected task immediately
      onTaskDeleted?.(taskId);

      // refresh AFTER UI cleanup
      setTimeout(() => {
        onRefresh();
      }, 0);

    } catch (error) {
      console.error('Delete task failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const canToggleCompletion = Boolean(currentTask?.id) && (canManage || Boolean(currentTask?.assigned_to));

  if (!open || !currentTask) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Task Details
              </p>

              {editingTask ? (
                <input
                  type="text"
                  value={editForm.title}
                  onChange={event =>
                    setEditForm(form => ({
                      ...form,
                      title: event.target.value,
                    }))
                  }
                  className="form-input h-11 text-lg font-semibold"
                  placeholder="Task title"
                />
              ) : (
                <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {currentTask.title}
                </h2>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingTask(current => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={editingTask ? 'Cancel editing' : 'Edit task'}
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    disabled={deleting}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
                    aria-label="Delete task"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}


            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 pb-6 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Assigned To
              </p>

              <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
                <User size={15} className="text-muted-foreground" />
                <span>
                  {currentTask.assignee?.full_name ||
                    currentTask.assignee?.email ||
                    'Unassigned'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Department
              </p>

              <p className="mt-3 text-sm text-foreground">
                {departments.find(
                  department => department.id === currentTask.department_id
                )?.name || '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </p>

              <div className="mt-3">
                {editingTask ? (
                  <StatusSelect
                    value={editForm.status}
                    onChange={value =>
                      setEditForm(form => ({
                        ...form,
                        status: value,
                      }))
                    }
                  />
                ) : (
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLORS[currentTask.effectiveStatus]}`}
                  >
                    {currentTask.effectiveStatus === 'Completed' &&
                    currentTask.overdueByDays
                      ? `Completed - Overdue by ${currentTask.overdueByDays} days`
                      : currentTask.effectiveStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Deadline
              </p>

              <div className="mt-3">
                {editingTask ? (
                  <DateInput
                    value={editForm.deadline}
                    onChange={value =>
                      setEditForm(form => ({
                        ...form,
                        deadline: value,
                      }))
                    }
                    placeholder="Select deadline"
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={
                        currentTask.status !== 'Completed' &&
                        isOverdue(currentTask.deadline, currentTask.status)
                          ? 'font-medium text-destructive'
                          : 'text-foreground'
                      }
                    >
                      {formatDeadline(currentTask.deadline)}
                    </span>

                    {currentTask.status !== 'Completed' &&
                      isOverdue(currentTask.deadline, currentTask.status) && (
                        <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                          Overdue
                        </span>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Description
            </p>

            <div className="mt-3">
              {editingTask ? (
                <textarea
                  value={editForm.description}
                  onChange={event =>
                    setEditForm(form => ({
                      ...form,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="form-textarea min-h-28 w-full resize-none"
                  placeholder="Add task notes or context"
                />
              ) : (
                <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  {currentTask.description || 'No description provided'}
                </p>
              )}
            </div>
          </div>

          {currentTask.subtasks.length > 0 && (
            <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Progress
                </p>

                <p className="text-xs font-semibold text-foreground">
                  {calcProgress(currentTask.subtasks)}%
                </p>
              </div>

              <ProgressBar value={calcProgress(currentTask.subtasks)} />

              <p className="mt-3 text-xs text-muted-foreground">
                {currentTask.subtasks.filter(subtask => subtask.is_completed).length} of{' '}
                {currentTask.subtasks.length} subtasks completed
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Subtasks
              </p>
            </div>

            {currentTask.subtasks.length === 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-5">
                <List size={15} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No subtasks yet
                </p>
              </div>
            )}

            {currentTask.subtasks.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {currentTask.subtasks.map(subtask => (
                  <div
                    key={subtask.id}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:border-muted-foreground/30"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.is_completed}
                      onChange={() => handleToggleSubtask(subtask)}
                      disabled={!canManage}
                      className="h-4 w-4 accent-primary"
                    />

                    <p
                      className={`flex-1 text-sm ${
                        subtask.is_completed
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      {subtask.title}
                    </p>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Delete subtask"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={event => setNewSubtaskTitle(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add a subtask..."
                  className="form-input flex-1"
                />

                <Button
                  type="button"
                  disabled={!newSubtaskTitle.trim() || addingSubtask}
                  onClick={handleAddSubtask}
                  className="h-10 rounded-xl px-5"
                >
                  {addingSubtask ? 'Adding...' : 'Add'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {editingTask ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingTask(false);
                    setEditForm({
                      title: currentTask.title || '',
                      description: currentTask.description || '',
                      deadline: currentTask.deadline
                        ? new Date(currentTask.deadline).toISOString().slice(0, 10)
                        : '',
                      status: currentTask.status || 'Not Started',
                    });
                  }}
                  className="h-10 rounded-xl"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveTask}
                  className="h-10 rounded-xl"
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                {canToggleCompletion && (
                  <Button
                    type="button"
                    onClick={handleToggleTaskCompletion}
                    className="h-10 rounded-xl"
                    variant={currentTask.status === 'Completed' ? 'outline' : 'default'}
                  >
                    {currentTask.status === 'Completed' ? (
                      <>
                        <RotateCcw size={16} />
                        Unmark Completed
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Mark Completed
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-10 rounded-xl"
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
