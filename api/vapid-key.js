export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return res.status(500).json({ error: 'VAPID key not configured' });
  }

  return res.status(200).json({ vapidPublicKey });
}
