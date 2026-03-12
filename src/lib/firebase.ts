import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDOsEQu4eRx7OdFL8W3WSC1GfZlZltemYc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "booking-page-hertsu.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "booking-page-hertsu",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "booking-page-hertsu.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "158935779593",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:158935779593:web:f504a2426ea6eb15a7abd8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const resolveFirestore = () => {
  try {
    return getFirestore(app);
  } catch (primaryError) {
    console.error("Primary Firestore initialization failed. Retrying with explicit initialization.", primaryError);
    return initializeFirestore(app, {});
  }
};

export const db = resolveFirestore();
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

export const getFirebaseMessaging = async () => {
  const supported = await isMessagingSupported();
  if (!supported) {
    return null;
  }

  return getMessaging(app);
};

export default app;
