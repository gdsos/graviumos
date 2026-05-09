import { useEffect, useState } from 'react';
import { supabase, type Task, type Subtask, type Department } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Pencil, User, Trash2, List } from 'lucide-react';
type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface TaskWithDetails extends Task {
    assignee?: {
        id?: string;
        full_name?: string | null;
        email?: string | null;
    };
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
}

const STATUS_COLORS: Record<TaskStatus, string> = {
    'Not Started': 'bg-slate-100 text-slate-900',
    Ongoing: 'bg-blue-100 text-blue-900',
    Overdue: 'bg-red-100 text-red-900',
    Completed: 'bg-green-100 text-green-900',
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

export default function TaskDetailModal({
    task,
    open,
    onClose,
    departments,
    canManage,
    onRefresh,
}: TaskDetailModalProps) {

    const [currentTask, setCurrentTask] = useState<TaskWithDetails | null>(task);
    const [editingTask, setEditingTask] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [addingSubtask, setAddingSubtask] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        deadline: '',
        status: 'Not Started',
    });

    useEffect(() => {
        setCurrentTask(task);

        setEditingTask(false);

        if (task) {
            setEditForm({
                title: task.title || '',
                description: task.description || '',
                deadline: task.deadline
                    ? new Date(task.deadline).toISOString().slice(0, 10)
                    : '',
                status: task.status || 'Not Started',
            });
        }
    }, [task]);

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

        setCurrentTask({
            ...currentTask,
            subtasks: updatedSubtasks,
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
            setCurrentTask({
                ...currentTask,
                subtasks: [
                    ...currentTask.subtasks,
                    data as Subtask,
                ],
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

        setCurrentTask({
            ...currentTask,
            subtasks: currentTask.subtasks.filter(
                s => s.id !== subtaskId
            ),
        });

        onRefresh();
    };

    const handleSaveTask = async () => {
        if (!currentTask) return;

        const { error } = await supabase
            .from('tasks')
            .update({
                title: editForm.title.trim(),
                description: editForm.description.trim(),
                deadline: editForm.deadline
                    ? new Date(editForm.deadline).toISOString()
                    : null,
                status: editForm.status,
            })
            .eq('id', currentTask.id);

        if (!error) {
            setCurrentTask({
                ...currentTask,
                title: editForm.title,
                description: editForm.description,
                deadline: editForm.deadline,
                status: editForm.status as any,
            });

            setEditingTask(false);

            onRefresh();
        }
    };

    const handleDeleteTask = async () => {
        if (!currentTask) return;

        await supabase
            .from('subtasks')
            .delete()
            .eq('task_id', currentTask.id);

        await supabase
            .from('tasks')
            .delete()
            .eq('id', currentTask.id);

        onRefresh();

        onClose();
    };

    if (!open || !currentTask) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">

                    <div className="flex-1">
                        {editingTask ? (
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={e =>
                                    setEditForm(f => ({
                                        ...f,
                                        title: e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                            />
                        ) : (
                            <h2 className="text-lg font-bold">
                                {currentTask.title}
                            </h2>
                        )}
                    </div>

                    {canManage && (
                        <>
                            <button
                                type="button"
                                onClick={() => setEditingTask(!editingTask)}
                                className="p-2 rounded hover:bg-slate-100"
                            >
                                <Pencil size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteTask}
                                className="p-2 rounded hover:bg-red-100"
                            >
                                <Trash2 size={16} className="text-red-600" />
                            </button>
                        </>
                    )}
                </div>

                <div className="p-6 flex flex-col gap-5">
                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Assigned To */}
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                                Assigned To
                            </p>

                            <div className="flex items-center gap-2">
                                <User size={14} className="text-slate-700" />

                                <p className="text-sm">
                                    {currentTask.assignee?.full_name ||
                                        currentTask.assignee?.email ||
                                        'Unassigned'}
                                </p>
                            </div>
                        </div>

                        {/* Department */}
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                                Department
                            </p>

                            <p className="text-sm">
                                {departments.find(
                                    d => d.id === currentTask.department_id
                                )?.name || '—'}
                            </p>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                                Status
                            </p>

                            {editingTask ? (
                                <select
                                    value={editForm.status}
                                    onChange={e =>
                                        setEditForm(f => ({
                                            ...f,
                                            status: e.target.value,
                                        }))
                                    }
                                    className="px-3 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                                >
                                    <option value="Not Started">Not Started</option>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            ) : (
                                <span
                                    className={`w-fit text-xs font-semibold px-3 py-1 rounded ${STATUS_COLORS[currentTask.effectiveStatus]}`}
                                >
                                    {currentTask.effectiveStatus === 'Completed' &&
                                        currentTask.overdueByDays
                                        ? `Completed (Overdue by ${currentTask.overdueByDays} days)`
                                        : currentTask.effectiveStatus}
                                </span>
                            )}
                        </div>

                        {/* Deadline */}
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                                Deadline
                            </p>

                            {editingTask ? (
                                <input
                                    type="date"
                                    value={editForm.deadline}
                                    onChange={e =>
                                        setEditForm(f => ({
                                            ...f,
                                            deadline: e.target.value,
                                        }))
                                    }
                                    className="px-3 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                                />
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <p
                                        className="text-sm"
                                        style={{
                                            color:
                                                currentTask.status !== 'Completed' &&
                                                    isOverdue(
                                                        currentTask.deadline,
                                                        currentTask.status
                                                    )
                                                    ? '#dc2626'
                                                    : '#1e293b',
                                        }}
                                    >
                                        {formatDeadline(currentTask.deadline)}
                                    </p>

                                    {currentTask.status !== 'Completed' &&
                                        isOverdue(
                                            currentTask.deadline,
                                            currentTask.status
                                        ) && (
                                            <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-900">
                                                Overdue
                                            </span>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                        <div className="flex flex-col gap-1.5">
                            <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">Description</p>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5">
                                {editingTask ? (
                                    <textarea
                                        value={editForm.description}
                                        onChange={e =>
                                            setEditForm(f => ({
                                                ...f,
                                                description: e.target.value,
                                            }))
                                        }
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900 resize-none"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-800">
                                        {currentTask.description}
                                    </p>
                                )}
                            </div>
                        </div>

                    {/* Progress */}
                    {currentTask.subtasks.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-slate-900 uppercase tracking-wider">Progress</p>
                                <p className="text-xs font-semibold">
                                    {calcProgress(currentTask.subtasks)}%
                                </p>
                            </div>
                            <ProgressBar value={calcProgress(currentTask.subtasks)} />
                            <p className="text-xs text-slate-600">
                                {currentTask.subtasks.filter(s => s.is_completed).length} of {currentTask.subtasks.length} subtasks completed
                            </p>
                        </div>
                    )}

                    <div className="border-t border-slate-200" />

                    {/* Subtasks section */}
                    <div className="flex flex-col gap-3">
                        <p className="text-sm font-semibold">Subtasks</p>

                        {currentTask.subtasks.length === 0 && (
                            <div className="flex items-center gap-2 py-3">
                                <List size={14} className="text-slate-400" />
                                <p className="text-xs text-slate-400">No subtasks yet</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            {currentTask.subtasks.map(sub => (
                                <div
                                    key={sub.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors group"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sub.is_completed}
                                        onChange={() => handleToggleSubtask(sub)}
                                        disabled={!canManage}
                                    />
                                    <p
                                        className={`flex-1 text-sm ${sub.is_completed ? 'line-through text-slate-600' : 'text-slate-900'}`}
                                    >
                                        {sub.title}
                                    </p>
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSubtask(sub.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 transition-all"
                                            aria-label="Delete subtask"
                                        >
                                            <Trash2 size={14} className="text-red-600" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add subtask input */}
                        {canManage && (
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="text"
                                    value={newSubtaskTitle}
                                    onChange={e => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                                    placeholder="Add a subtask…"
                                    className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                                />
                                <Button
                                    type="button"
                                    disabled={!newSubtaskTitle.trim() || addingSubtask}
                                    onClick={handleAddSubtask}
                                >
                                    {addingSubtask ? 'Adding...' : 'Add'}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-2">

                        {editingTask && (
                            <Button
                                type="button"
                                onClick={handleSaveTask}
                            >
                                Save Changes
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}