# Firebase Setup

## 1. Enable Services
In project `booking-page-hertsu`, enable:
- Authentication (Email/Password)
- Firestore Database
- Cloud Storage
- Cloud Functions
- Cloud Messaging

## 2. Deploy Rules + Functions
From repo root:

```bash
firebase deploy --only firestore:rules,storage,functions
```

## 3. Create Initial Admin
On first login page:
- Fill email/password
- Click `Need first admin? Bootstrap`
- Click `Create First Admin`

## 4. Function Endpoints
- `createUserAccount` (callable, admin only)
- `updateUserAccount` (callable, admin only)
- `generatePasswordResetLink` (callable, admin only)
- `manualMarketPriceSync` (callable, admin only)
- `scheduledMarketPriceSync` (every 10 minutes)
- `ingestEnvironmentReading` (HTTP endpoint for ESP32)
- `pushAlertNotifications` (Firestore trigger)

## 5. FCM Web Push
- Generate Web Push certificate in Firebase console
- Set `VITE_FCM_VAPID_KEY` in environment
- Ensure `public/firebase-messaging-sw.js` is deployed

## 6. Optional Secrets
Set in Firebase Functions (v2):

```bash
firebase functions:secrets:set MARKET_PRICE_PROVIDER_URL
firebase functions:secrets:set ESP32_API_KEY
```
