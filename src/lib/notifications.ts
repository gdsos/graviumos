import { supabase } from './supabase';

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'task' | 'announcement' | 'approval' | 'project' = 'task',
  link: string = ''
) {
  if (!userId) return;

  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      link,
    });
}