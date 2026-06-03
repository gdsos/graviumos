import { supabase } from './supabase';

export type PushSupportStatus =
  | 'supported'
  | 'unsupported'
  | 'blocked'
  | 'not-configured';

function getVapidPublicKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function getPushSupportStatus(): PushSupportStatus {
  if (typeof window === 'undefined') return 'unsupported';

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  if (!getVapidPublicKey()) {
    return 'not-configured';
  }

  if (Notification.permission === 'denied') {
    return 'blocked';
  }

  return 'supported';
}

export async function getExistingPushSubscription() {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function savePushSubscription(userId: string, subscription: PushSubscription) {
  const subscriptionJson = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscriptionJson,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,endpoint',
      }
    );

  if (error) throw error;
}

export async function removePushSubscription(userId: string, subscription: PushSubscription) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);

  if (error) throw error;

  await subscription.unsubscribe();
}

async function removeAllUserPushSubscriptions(userId: string) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

export async function enablePushNotifications(userId: string) {
  const status = getPushSupportStatus();

  if (status !== 'supported') {
    return {
      ok: false,
      status,
    } as const;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return {
      ok: false,
      status: permission === 'denied' ? 'blocked' : 'unsupported',
    } as const;
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();

  // VAPID key rotations can leave the browser with a subscription created
  // using an older applicationServerKey. Always force a fresh subscription
  // when the user enables notifications so the saved endpoint matches the
  // current VAPID public/private key pair.
  await removeAllUserPushSubscriptions(userId);

  if (existingSubscription) {
    await existingSubscription.unsubscribe();
  }

  const vapidPublicKey = getVapidPublicKey();

  if (!vapidPublicKey) {
    return {
      ok: false,
      status: 'not-configured',
    } as const;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await savePushSubscription(userId, subscription);

  return {
    ok: true,
    subscription,
  } as const;
}

export async function disablePushNotifications(userId: string) {
  const subscription = await getExistingPushSubscription();

  await removeAllUserPushSubscriptions(userId);

  if (subscription) {
    await subscription.unsubscribe();
  }

  return true;
}
