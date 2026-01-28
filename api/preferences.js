import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET: Retrieve preferences
  if (req.method === 'GET') {
    try {
      const { pairId, endpoint } = req.query;

      if (!pairId || !endpoint) {
        return res.status(400).json({ error: 'Missing pairId or endpoint' });
      }

      // Get user preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('user_preferences')
        .select('display_name')
        .eq('endpoint', endpoint)
        .single();

      // Get pair background
      const { data: pair, error: pairError } = await supabase
        .from('pairs')
        .select('background_url')
        .eq('id', pairId)
        .single();

      return res.status(200).json({
        displayName: prefs?.display_name || '',
        backgroundUrl: pair?.background_url || ''
      });
    } catch (err) {
      console.error('Error fetching preferences:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST: Update preferences
  if (req.method === 'POST') {
    try {
      const { pairId, endpoint, displayName, backgroundUrl } = req.body;

      if (!pairId || !endpoint) {
        return res.status(400).json({ error: 'Missing pairId or endpoint' });
      }

      // Update or insert user preferences (display name)
      if (displayName !== undefined) {
        const { error: upsertError } = await supabase
          .from('user_preferences')
          .upsert({
            pair_id: pairId,
            endpoint: endpoint,
            display_name: displayName,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'endpoint'
          });

        if (upsertError) {
          console.error('Error upserting preferences:', upsertError);
          return res.status(500).json({ error: 'Failed to save display name' });
        }
      }

      // Update pair background (shared between both users)
      if (backgroundUrl !== undefined) {
        const { error: bgError } = await supabase
          .from('pairs')
          .update({ background_url: backgroundUrl })
          .eq('id', pairId);

        if (bgError) {
          console.error('Error updating background:', bgError);
          return res.status(500).json({ error: 'Failed to save background' });
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error updating preferences:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
