import { supabase } from '../lib/supabase.js';

function generatePairCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    let pairCode;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique pair code
    while (attempts < maxAttempts) {
      pairCode = generatePairCode();

      // Check if code already exists
      const { data: existing } = await supabase
        .from('pairs')
        .select('id')
        .eq('pair_code', pairCode)
        .single();

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: 'Could not generate unique code' });
    }

    // Create pair record
    const { data, error } = await supabase
      .from('pairs')
      .insert({ pair_code: pairCode })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to create pair' });
    }

    return res.status(200).json({
      pairId: data.id,
      pairCode: data.pair_code
    });
  } catch (err) {
    console.error('Error creating pair:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
