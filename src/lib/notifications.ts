import { supabase } from './supabase';

async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  link: string
) {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title,
        body: message,
        url: link || '/portal/overview',
      },
    });

    if (error) {
      console.error('Failed to send push notification', error);
    }
  } catch (error) {
    console.error('Failed to send push notification', error);
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'task' | 'announcement' | 'approval' | 'project' = 'task',
  link: string = ''
) {
  if (!userId) return;

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      link,
    });

  if (error) {
    console.error('Failed to create notification', error);
    return;
  }

  await sendPushNotification(userId, title, message, link);
}

export async function deleteTaskNotifications(taskId: string) {
  if (!taskId) return false;

  const { error: rpcError } = await supabase.rpc('delete_task_notifications', {
    target_task_id: taskId,
  });

  if (rpcError) {
    console.error('Failed to delete task notifications through RPC', rpcError);

    const taskLinks = [
      `/portal/tasks?task=${taskId}`,
      `/portal/tasks?taskId=${taskId}`,
    ];

    const { error: exactDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'task')
      .in('link', taskLinks);

    if (exactDeleteError) {
      console.error('Failed to delete exact task notifications', exactDeleteError);
    }

    const { error: legacyDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'task')
      .ilike('link', `%${taskId}%`);

    if (legacyDeleteError) {
      console.error('Failed to delete legacy task notifications', legacyDeleteError);
    }

    const fallbackSucceeded = !exactDeleteError && !legacyDeleteError;

    if (fallbackSucceeded && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gravium:task-notifications-deleted', {
          detail: { taskId },
        })
      );
    }

    return fallbackSucceeded;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('gravium:task-notifications-deleted', {
        detail: { taskId },
      })
    );
  }

  return true;
}
