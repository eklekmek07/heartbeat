import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

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
    const { pairId, imageData, type } = req.body;

    if (!pairId || !imageData) {
      return res.status(400).json({ error: 'Missing pairId or imageData' });
    }

    // Validate type
    const validTypes = ['background', 'message'];
    const imageType = validTypes.includes(type) ? type : 'message';

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ error: 'Invalid image data format' });
    }

    const extension = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
    const base64Data = base64Match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename with timestamp
    const timestamp = Date.now();
    const folder = imageType === 'background' ? 'backgrounds' : 'messages';
    const filename = `${folder}/${pairId}/${timestamp}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`
    });

    return res.status(200).json({
      url: blob.url,
      success: true
    });
  } catch (err) {
    console.error('Error uploading image:', err);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
}
