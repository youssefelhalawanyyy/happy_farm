import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/constants";

export const enablePushNotifications = async (uid: string): Promise<string | null> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY;
  if (!vapidKey) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return null;
  }

  const token = await getToken(messaging, { vapidKey });
  if (!token) {
    return null;
  }

  await setDoc(
    doc(db, COLLECTIONS.notificationTokens, token),
    {
      token,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return token;
};

export const listenForegroundMessages = async (
  onReceive: (payload: { title?: string; body?: string }) => void
): Promise<(() => void) | null> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  return onMessage(messaging, (payload) => {
    onReceive({
      title: payload.notification?.title,
      body: payload.notification?.body
    });
  });
};
