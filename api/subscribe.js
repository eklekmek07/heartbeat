import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] subscribe: START`, {
    method: req.method,
    bodyKeys: req.body ? Object.keys(req.body) : null
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] subscribe: CORS preflight`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[${requestId}] subscribe: Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { subscription, pairId } = req.body;
    console.log(`[${requestId}] subscribe: pairId=${pairId}, hasSubscription=${!!subscription}`);

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      console.log(`[${requestId}] subscribe: Invalid subscription data`, {
        hasSubscription: !!subscription,
        hasEndpoint: !!subscription?.endpoint,
        hasKeys: !!subscription?.keys
      });
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    if (!pairId) {
      console.log(`[${requestId}] subscribe: Missing pair ID`);
      return res.status(400).json({ error: 'Missing pair ID' });
    }

    // Verify pair exists
    console.log(`[${requestId}] subscribe: Verifying pair exists...`);
    const { data: pair, error: pairError } = await supabase
      .from('pairs')
      .select('id')
      .eq('id', pairId)
      .single();

    console.log(`[${requestId}] subscribe: Pair verification`, {
      found: !!pair,
      error: pairError ? { message: pairError.message, code: pairError.code } : null
    });

    if (pairError || !pair) {
      console.log(`[${requestId}] subscribe: Pair not found`);
      return res.status(404).json({ error: 'Pair not found' });
    }

    // Upsert subscription (update if endpoint exists, insert if new)
    console.log(`[${requestId}] subscribe: Upserting subscription...`, {
      endpoint: subscription.endpoint.substring(0, 50) + '...'
    });

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
      console.error(`[${requestId}] subscribe: Supabase upsert error:`, {
        message: error.message,
        code: error.code,
        details: error.details
      });
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    console.log(`[${requestId}] subscribe: SUCCESS`);
    return res.status(200).json({ message: 'Subscription saved successfully' });
  } catch (err) {
    console.error(`[${requestId}] subscribe: EXCEPTION`, {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
