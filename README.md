# Mazra3ty Platform

Production-grade Mazra3ty Poultry Farm Management Platform for broiler operations.

## Stack
- Frontend: React + Vite + TypeScript
- UI: TailwindCSS + ShadCN-style component system
- Charts: Recharts
- Data tables: TanStack Table
- Notifications: React Toastify
- State: Zustand
- Backend: Firebase Auth + Firestore + Storage + Functions + FCM
- Desktop: Electron (macOS + Windows)
- Hosting: Netlify

## Included Modules
- Secure Login (Firebase Auth)
- Role-based access (`admin`, `manager`, `worker`)
- Dashboard with operational KPIs and charts
- Batch management
- Feed management + FCR
- Mortality tracking + threshold alerts
- Environment monitoring (ESP32 ingest endpoint)
- Market price monitoring (scheduled Cloud Function every 10 minutes)
- Sales management
- Finance manager
- Quotation generator + PDF export
- Inventory + low stock alerting
- Worker + task management
- Alerts & notifications (FCM)
- Reports + Excel/PDF export
- Desktop downloads page

## Firebase Config
The app is preconfigured with:

```ts
const firebaseConfig = {
  apiKey: "AIzaSyDOsEQu4eRx7OdFL8W3WSC1GfZlZltemYc",
  authDomain: "booking-page-hertsu.firebaseapp.com",
  projectId: "booking-page-hertsu",
  storageBucket: "booking-page-hertsu.firebasestorage.app",
  messagingSenderId: "158935779593",
  appId: "1:158935779593:web:f504a2426ea6eb15a7abd8"
};
```

## Local Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Electron
```bash
npm run build:electron
npm run dev:desktop
npm run build:desktop:mac
npm run build:desktop:win
```

## Firebase Functions
```bash
cd functions
npm install
npm run build
```

Deploy (from repo root):
```bash
firebase deploy --only functions,firestore:rules,storage
```

## Market Price Auto-Sync
Cloud Function `scheduledMarketPriceSync` runs every 10 minutes.

Set a provider endpoint returning this JSON shape:

```json
{
  "feedPricePerTon": 16500,
  "dayOldChickPrice": 23,
  "liveBroilerPricePerKg": 92,
  "cornPricePerTon": 13000,
  "soybeanMealPricePerTon": 30000
}
```

Set runtime secret/env var in Firebase Functions:

```bash
firebase functions:secrets:set MARKET_PRICE_PROVIDER_URL
```

Use a value like:

`https://your-egypt-market-api/snapshot`

## ESP32 Integration
Use `docs/ESP32_HTTP_EXAMPLE.ino`.

Function endpoint:
- `https://us-central1-booking-page-hertsu.cloudfunctions.net/ingestEnvironmentReading`

Use `x-api-key` header if `ESP32_API_KEY` is configured.

## Netlify Deployment
See `docs/NETLIFY_DEPLOY.md`.

## Desktop Download Links
Set these in Netlify env vars:
- `VITE_DOWNLOAD_MAC_URL`
- `VITE_DOWNLOAD_WIN_URL`

The app exposes these links in `/downloads`.
