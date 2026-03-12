# Netlify Deployment

## 1. Build Settings
- Base directory: (leave empty)
- Build command: `npm run build`
- Publish directory: `dist`

`netlify.toml` already includes SPA redirect:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

## 2. Environment Variables
Set in Netlify Site Settings:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FCM_VAPID_KEY`
- `VITE_ESP32_INGEST_ENDPOINT`
- `VITE_ESP32_API_KEY`
- `VITE_DOWNLOAD_MAC_URL`
- `VITE_DOWNLOAD_WIN_URL`

## 3. Deploy
Push the repository and connect to Netlify.

Or use CLI:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

## 4. Post-Deploy Checks
- Login and role-based routing
- Dashboard realtime data
- Cloud Function callable actions (`createUserAccount`, `manualMarketPriceSync`)
- `/downloads` links
- Push notifications permission flow
