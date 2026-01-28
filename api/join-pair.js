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
    const { pairCode } = req.body;

    if (!pairCode || pairCode.length !== 6) {
      return res.status(400).json({ error: 'Invalid pair code' });
    }

    // Find pair by code
    const { data: pair, error } = await supabase
      .from('pairs')
      .select('id, pair_code')
      .eq('pair_code', pairCode)
      .single();

    if (error || !pair) {
      return res.status(404).json({ error: 'Pair code not found' });
    }

    return res.status(200).json({
      pairId: pair.id,
      pairCode: pair.pair_code
    });
  } catch (err) {
    console.error('Error joining pair:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
