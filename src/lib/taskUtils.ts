import type { Task } from './supabase';

export type TaskStatus =
  | 'Not Started'
  | 'Ongoing'
  | 'Overdue'
  | 'Completed';

export function calcEffectiveStatus(task: Task): TaskStatus {
    if (task.status === 'Completed') {
        return 'Completed';
    }

    if (task.deadline) {
        const deadline = new Date(task.deadline);

        if (deadline.getTime() < Date.now()) {
            return 'Overdue';
        }
    }

    return task.status as TaskStatus;
}

export function calcOverdueDays(task: Task): number | undefined {
    if (
        task.status !== 'Completed' ||
        !task.deadline ||
        !task.completed_at
    ) {
        return undefined;
    }

    const deadline = new Date(task.deadline);
    const completed = new Date(task.completed_at);

    const diff = Math.floor(
        (completed.getTime() - deadline.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return diff > 0 ? diff : undefined;
}