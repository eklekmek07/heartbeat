import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { subscription, pairId } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    if (!pairId) {
      return res.status(400).json({ error: 'Missing pair ID' });
    }

    // Verify pair exists
    const { data: pair, error: pairError } = await supabase
      .from('pairs')
      .select('id')
      .eq('id', pairId)
      .single();

    if (pairError || !pair) {
      return res.status(404).json({ error: 'Pair not found' });
    }

    // Upsert subscription (update if endpoint exists, insert if new)
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        pair_id: pairId,
        endpoint: subscription.endpoint,
        expiration_time: subscription.expirationTime || null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }, {
        onConflict: 'endpoint'
      });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    return res.status(200).json({ message: 'Subscription saved successfully' });
  } catch (err) {
    console.error('Error saving subscription:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
