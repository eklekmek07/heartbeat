import { supabase } from '../lib/supabase.js';

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

  try {
    const pairId = req.query.pairId;

    if (!pairId) {
      return res.status(400).json({ error: 'Missing pair ID' });
    }

    // Get pair info
    const { data: pair, error: pairError } = await supabase
      .from('pairs')
      .select('id, pair_code')
      .eq('id', pairId)
      .single();

    if (pairError || !pair) {
      return res.status(404).json({ error: 'Pair not found' });
    }

    // Count subscriptions for this pair
    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('pair_id', pairId);

    if (countError) {
      console.error('Supabase error:', countError);
      return res.status(500).json({ error: 'Failed to check status' });
    }

    return res.status(200).json({
      pairCode: pair.pair_code,
      deviceCount: count || 0,
      partnerConnected: (count || 0) >= 2
    });
  } catch (err) {
    console.error('Error checking pair status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
