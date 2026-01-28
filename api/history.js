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
    const { pairId, endpoint, limit = '50', offset = '0' } = req.query;

    if (!pairId) {
      return res.status(400).json({ error: 'Missing pairId' });
    }

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    // Get messages for this pair
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Get display names for all senders
    const endpoints = [...new Set(messages.map(m => m.sender_endpoint).filter(Boolean))];

    let displayNames = {};
    if (endpoints.length > 0) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('endpoint, display_name')
        .in('endpoint', endpoints);

      if (prefs) {
        for (const p of prefs) {
          displayNames[p.endpoint] = p.display_name;
        }
      }
    }

    // Enrich messages with sender names and whether it's from current user
    const enrichedMessages = messages.map(msg => ({
      id: msg.id,
      type: msg.message_type,
      emotion: msg.emotion,
      imageUrl: msg.image_url,
      senderName: displayNames[msg.sender_endpoint] || null,
      isMine: endpoint ? msg.sender_endpoint === endpoint : false,
      createdAt: msg.created_at
    }));

    return res.status(200).json({
      messages: enrichedMessages,
      hasMore: messages.length === limitNum
    });
  } catch (err) {
    console.error('Error fetching history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
