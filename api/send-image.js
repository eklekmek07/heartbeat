import { supabase } from '../lib/supabase.js';
import { sendNotification } from '../lib/webpush.js';

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
    const { pairId, imageUrl, senderEndpoint } = req.body;

    if (!pairId || !imageUrl) {
      return res.status(400).json({ error: 'Missing pairId or imageUrl' });
    }

    // Get sender's display name
    let senderName = 'Your partner';
    if (senderEndpoint) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('display_name')
        .eq('endpoint', senderEndpoint)
        .single();

      if (prefs?.display_name) {
        senderName = prefs.display_name;
      }
    }

    // Save message to history
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        pair_id: pairId,
        sender_endpoint: senderEndpoint || '',
        message_type: 'image',
        image_url: imageUrl
      });

    if (msgError) {
      console.error('Error saving message:', msgError);
    }

    // Get all subscriptions for this pair except the sender
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('pair_id', pairId)
      .neq('endpoint', senderEndpoint);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        message: 'No partner connected yet',
        sent: 0
      });
    }

    const payload = {
      title: `${senderName} sent you a photo`,
      body: 'Tap to view',
      icon: '/assets/icons/icon-192x192.png',
      image: imageUrl,
      data: {
        type: 'image',
        imageUrl: imageUrl
      }
    };

    let successCount = 0;
    let failedEndpoints = [];

    // Send to all partner devices
    for (const sub of subscriptions) {
      try {
        await sendNotification(sub, payload);
        successCount++;
      } catch (err) {
        console.error('Push failed for endpoint:', sub.endpoint, err.statusCode);

        // Remove invalid subscriptions (404 or 410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      await supabase
        .from('subscriptions')
        .delete()
        .in('endpoint', failedEndpoints);
    }

    return res.status(200).json({
      message: successCount > 0 ? 'Photo sent!' : 'Partner may be offline',
      sent: successCount
    });
  } catch (err) {
    console.error('Error sending image:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
