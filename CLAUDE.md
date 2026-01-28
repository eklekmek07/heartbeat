# HeartBeat - Claude Code Notes

## Important: Service Worker Cache

**Always increment the cache version in `public/sw.js` when making changes:**

```js
const CACHE_NAME = 'heartbeat-vX';  // Increment X on every deploy
```

Without this, browsers will serve stale cached files and changes won't appear.

## Project Structure

- `/api` - Vercel serverless functions
- `/lib` - Shared utilities (Supabase, WebPush)
- `/public` - Static frontend (HTML, CSS, JS, SW)

## Environment Variables

Required in Vercel:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `BLOB_READ_WRITE_TOKEN`

## Database

Run `supabase-schema.sql` in Supabase SQL Editor to set up tables.

## Testing Locally

```bash
cp .env.example .env.local
# Fill in values
npm run dev
```

Note: `vercel dev` may have issues with recursive invocation. Use `npx serve public` for static-only testing.
