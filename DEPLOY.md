# Punjab Foods — Deployment Notes

## Vercel Deployment

This app is already deployed at https://punjabuk.vercel.app/

To ensure Supabase sync works on Vercel, set these environment variables in your Vercel dashboard (Project Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://vqnnlorukpzsftfisjrm.supabase.co
VITE_SUPABASE_ANON_KEY=<your Supabase anon/publishable key, from Project Settings -> API>
```

## Sync Mode

- When both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present → **Live sync ON** (all CRUD operations hit Supabase)
- When missing → **Offline mode** (mock data in memory)

## Re-deploy

```bash
vercel --prod
```

Or push to GitHub; Vercel auto-deploys from the `main` branch.