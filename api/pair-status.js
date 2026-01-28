import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] pair-status: START`, {
    method: req.method,
    query: req.query,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] pair-status: CORS preflight`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    console.log(`[${requestId}] pair-status: Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const pairId = req.query.pairId;
    console.log(`[${requestId}] pair-status: pairId=${pairId}`);

    if (!pairId) {
      console.log(`[${requestId}] pair-status: Missing pair ID`);
      return res.status(400).json({ error: 'Missing pair ID' });
    }

    // Get pair info
    console.log(`[${requestId}] pair-status: Fetching pair from Supabase...`);
    const { data: pair, error: pairError } = await supabase
      .from('pairs')
      .select('id, pair_code')
      .eq('id', pairId)
      .single();

    console.log(`[${requestId}] pair-status: Pair query result`, {
      pair: pair ? { id: pair.id, pair_code: pair.pair_code } : null,
      error: pairError ? { message: pairError.message, code: pairError.code } : null
    });

    if (pairError || !pair) {
      console.log(`[${requestId}] pair-status: Pair not found`);
      return res.status(404).json({ error: 'Pair not found' });
    }

    // Count subscriptions for this pair
    console.log(`[${requestId}] pair-status: Counting subscriptions...`);
    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('pair_id', pairId);

    console.log(`[${requestId}] pair-status: Subscription count result`, {
      count,
      error: countError ? { message: countError.message, code: countError.code } : null
    });

    if (countError) {
      console.error(`[${requestId}] pair-status: Supabase count error:`, countError);
      return res.status(500).json({ error: 'Failed to check status' });
    }

    const response = {
      pairCode: pair.pair_code,
      deviceCount: count || 0,
      partnerConnected: (count || 0) >= 2
    };

    console.log(`[${requestId}] pair-status: SUCCESS`, response);
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[${requestId}] pair-status: EXCEPTION`, {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
