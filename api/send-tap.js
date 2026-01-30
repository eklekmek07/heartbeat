import { supabase } from '../lib/supabase.js';
import { sendNotification } from '../lib/webpush.js';

// Natural, loving Turkish messages
const EMOTIONS = {
  love: {
    emoji: '❤️',
    messages: [
      'Canım benim, seni seviyorum 💕',
      'Aklımdasın, hep aklımdasın',
      'Seni öyle çok seviyorum ki...',
      'Birtanem benim ❤️',
      'Kalbim senin için atıyor'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  wave: {
    emoji: '👋',
    messages: [
      'Aklıma düştün, selam verdim 👋',
      'Napıyon sen? Özledim',
      'Hey, bir dakika seni düşündüm',
      'Canım nasılsın?',
      'Senden haber bekliyorum 💭'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  kiss: {
    emoji: '😘',
    messages: [
      'Gözlerinden öpüyorum 💋',
      'Öpücük gönderdim, yakala!',
      'Dudaklarını özledim 😘',
      'Yanağından öpüyorum canım',
      'Sana bir öpücük daha 💋'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  hug: {
    emoji: '🤗',
    messages: [
      'Sarılasım geldi sana 🤗',
      'Keşke yanımda olsan, sarılsam',
      'Sıkı sıkı sarılıyorum',
      'Kokunu özledim, sarılmak istiyorum',
      'Kucağıma gel 💕'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  fire: {
    emoji: '🔥',
    messages: [
      'Aklımdan çıkmıyorsun 🔥',
      'Seni çok istiyorum',
      'Deliler gibi özledim',
      'Sensiz yapamıyorum',
      'Yanıyorum sensiz 🔥'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  sparkle: {
    emoji: '✨',
    messages: [
      'Hayatımın anlamısın ✨',
      'Seninle her şey daha güzel',
      'Gözüm başka güzel görmüyor',
      'Sen benim her şeyimsin',
      'Dünyalar güzeli benim ✨'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  bunny: {
    emoji: '🐰',
    messages: [
      'Tavşanın seni seviyor 🐰',
      'Şapşik şeyim benim',
      'Tatlı şeyim, seni düşündüm',
      'Ponçiğim benim 🐰',
      'Minik tavşanından öpücükler'
    ],
    icon: '/assets/icons/icon-192x192.png'
  },
  moon: {
    emoji: '🌙',
    messages: [
      'Tatlı rüyalar balım 🌙',
      'İyi geceler hayatım, rüyama gir',
      'Uyumadan öpeyim seni',
      'Gecen güzel olsun canım',
      'Yarın görüşürüz, iyi uyu 🌙'
    ],
    icon: '/assets/icons/icon-192x192.png'
  }
};

function getRandomMessage(emotion) {
  const messages = EMOTIONS[emotion].messages;
  return messages[Math.floor(Math.random() * messages.length)];
}

export default async function handler(req, res) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] send-tap: START`, {
    method: req.method,
    body: req.body ? { pairId: req.body.pairId, emotion: req.body.emotion, hasSenderEndpoint: !!req.body.senderEndpoint } : null
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] send-tap: CORS preflight`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log(`[${requestId}] send-tap: Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { pairId, emotion, senderEndpoint } = req.body;
    console.log(`[${requestId}] send-tap: Processing`, { pairId, emotion });

    if (!pairId) {
      console.log(`[${requestId}] send-tap: Missing pair ID`);
      return res.status(400).json({ error: 'Missing pair ID' });
    }

    if (!emotion || !EMOTIONS[emotion]) {
      console.log(`[${requestId}] send-tap: Invalid emotion: ${emotion}`);
      return res.status(400).json({ error: 'Invalid emotion type' });
    }

    // Get sender's display name
    let senderName = 'Sevgilin';
    if (senderEndpoint) {
      console.log(`[${requestId}] send-tap: Fetching sender display name...`);
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('display_name')
        .eq('endpoint', senderEndpoint)
        .single();

      if (prefs?.display_name) {
        senderName = prefs.display_name;
        console.log(`[${requestId}] send-tap: Sender name: ${senderName}`);
      }
    }

    // Save message to history
    console.log(`[${requestId}] send-tap: Saving to history...`);
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        pair_id: pairId,
        sender_endpoint: senderEndpoint || '',
        message_type: 'emotion',
        emotion: emotion
      });

    if (msgError) {
      console.error(`[${requestId}] send-tap: Error saving message:`, msgError);
    } else {
      console.log(`[${requestId}] send-tap: Message saved to history`);
    }

    // Get all subscriptions for this pair except the sender
    console.log(`[${requestId}] send-tap: Fetching partner subscriptions...`);
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('pair_id', pairId)
      .neq('endpoint', senderEndpoint);

    console.log(`[${requestId}] send-tap: Found ${subscriptions?.length || 0} subscriptions`);

    if (error) {
      console.error(`[${requestId}] send-tap: Supabase error:`, error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[${requestId}] send-tap: No partner subscriptions found`);
      return res.status(200).json({
        message: 'Sevgilin henüz bağlı değil',
        sent: 0
      });
    }

    const emotionData = EMOTIONS[emotion];
    const randomMessage = getRandomMessage(emotion);
    const payload = {
      title: `${senderName} sana ${emotionData.emoji} gönderdi`,
      body: randomMessage,
      icon: emotionData.icon,
      data: {
        type: 'emotion',
        emotion: emotion
      }
    };
    console.log(`[${requestId}] send-tap: Payload prepared`, { title: payload.title });

    let successCount = 0;
    let failedEndpoints = [];

    // Send to all partner devices
    for (const sub of subscriptions) {
      try {
        console.log(`[${requestId}] send-tap: Sending to endpoint ${sub.endpoint.substring(0, 50)}...`);
        await sendNotification(sub, payload);
        successCount++;
        console.log(`[${requestId}] send-tap: Push sent successfully`);
      } catch (err) {
        console.error(`[${requestId}] send-tap: Push failed`, {
          endpoint: sub.endpoint.substring(0, 50),
          statusCode: err.statusCode,
          message: err.message
        });

        // Remove invalid subscriptions (404 or 410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up invalid subscriptions
    if (failedEndpoints.length > 0) {
      console.log(`[${requestId}] send-tap: Cleaning up ${failedEndpoints.length} invalid subscriptions`);
      await supabase
        .from('subscriptions')
        .delete()
        .in('endpoint', failedEndpoints);
    }

    const response = {
      message: successCount > 0 ? 'Gönderildi!' : 'Sevgilin çevrimdışı olabilir',
      sent: successCount
    };
    console.log(`[${requestId}] send-tap: SUCCESS`, response);
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[${requestId}] send-tap: EXCEPTION`, {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
