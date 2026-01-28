import webPush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing VAPID environment variables');
}

webPush.setVapidDetails(
  'mailto:heartbeat@example.com',
  vapidPublicKey,
  vapidPrivateKey
);

export function sendNotification(subscription, payload) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };

  return webPush.sendNotification(pushSubscription, JSON.stringify(payload));
}

export { webPush };
