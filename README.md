# HeartBeat

A lightweight PWA that lets couples send instant "thinking of you" notifications to each other with a single tap.

Built with vanilla JavaScript — no frameworks, no complexity. Just pure, fast, romantic vibes.

## Features

**Core**
- Pair two devices with a 6-digit code
- Send emotion taps: Love, Wave, Kiss, Fire
- Real-time connection status
- Works on iOS, Android, and desktop

**Customization**
- Custom display names in notifications ("kusum sent you ❤️")
- Shared background image (both partners see the same)
- Send photos to your partner
- Message history with timestamps

**PWA**
- Add to Home Screen for native app feel
- Offline support with service worker
- Push notifications (even when app is closed)
- Notifications appear on paired smartwatches

## Tech Stack

- **Frontend**: Vanilla JS, CSS, HTML (no build step)
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Storage**: Vercel Blob (images)
- **Push**: Web Push API with VAPID

## Vibecoded with Claude

This entire app was vibecoded in a single session with [Claude Code](https://claude.ai/code) (Opus 4.5). From initial concept to full implementation — database schema, API endpoints, frontend UI, service worker, and all customization features — built through conversation.

The codebase intentionally stays simple:
- ~400 lines of JavaScript
- ~350 lines of CSS
- No React, no Next.js, no webpack
- Just files that do what they say

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Run `supabase-schema.sql` in the SQL Editor
3. Copy your Project URL and `anon` key from Settings > API

### 2. Generate VAPID Keys

```bash
npm install
npm run vapid-keys
```

Save both public and private keys.

### 3. Create Vercel Blob Store

1. Go to your Vercel dashboard > Storage
2. Create a new Blob store
3. Copy the `BLOB_READ_WRITE_TOKEN`

### 4. Deploy to Vercel

**Option A: One-click deploy**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eklekmek07/heartbeat)

**Option B: Via CLI**

```bash
npm i -g vercel
vercel login
vercel --prod
```

Add these environment variables in Vercel:

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | From step 2 |
| `VAPID_PRIVATE_KEY` | From step 2 |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `BLOB_READ_WRITE_TOKEN` | From step 3 |

### 5. Local Development

```bash
cp .env.example .env.local
# Fill in your values
npm run dev
```

## Usage

### Connect with Your Partner

**Device 1:**
1. Open the app URL
2. Add to Home Screen (for notifications)
3. Tap "Create New Pair"
4. Share the 6-digit code

**Device 2:**
1. Open the same URL
2. Add to Home Screen
3. Tap "Join with Code"
4. Enter the code
5. Allow notifications

### Sending Messages

| Button | Notification |
|--------|--------------|
| ❤️ Love | "Sending you love! 💕" |
| 👋 Wave | "Hey you! 👋" |
| 😘 Kiss | "Sending kisses! 💋" |
| 🔥 Fire | "Thinking of you! 🔥" |
| 📷 Photo | Opens camera/gallery |

### Personalization

Go to **Settings** to:
- Set your display name (shows in partner's notifications)
- Upload a shared background image
- Reset pairing

## Project Structure

```
/api                     Vercel serverless functions
  ├── create-pair.js     Generate pair code
  ├── join-pair.js       Join existing pair
  ├── subscribe.js       Save push subscription
  ├── send-tap.js        Send emotion notification
  ├── send-image.js      Send photo notification
  ├── preferences.js     Get/update user preferences
  ├── upload-image.js    Upload to Vercel Blob
  ├── history.js         Get message history
  ├── pair-status.js     Check connection status
  └── vapid-key.js       Get public VAPID key

/lib                     Shared utilities
  ├── supabase.js        Supabase client
  └── webpush.js         Web Push helper

/public                  Static frontend
  ├── index.html         Single page app
  ├── scripts.js         All app logic
  ├── styles.css         All styles
  ├── sw.js              Service worker
  └── assets/            Icons and images
```

## Troubleshooting

**Notifications not working on iOS**
- Must be added to Home Screen
- Open from Home Screen icon (not Safari)
- Check Settings > Notifications > HeartBeat

**Partner shows "not connected"**
- Both need notification permissions granted
- Try "Reset Pairing" on both devices and reconnect

**Background image not showing**
- Check that `BLOB_READ_WRITE_TOKEN` is set in Vercel
- Image uploads require the Vercel Blob store

## License

MIT

## Credits

- Vibecoded with [Claude Code](https://claude.ai/code) by Anthropic
- Original PWA push concept inspired by [pwa-push-example](https://github.com/nicola-nicolo/pwa-push-example)
