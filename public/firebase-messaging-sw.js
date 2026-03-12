/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDOsEQu4eRx7OdFL8W3WSC1GfZlZltemYc",
  authDomain: "booking-page-hertsu.firebaseapp.com",
  projectId: "booking-page-hertsu",
  storageBucket: "booking-page-hertsu.firebasestorage.app",
  messagingSenderId: "158935779593",
  appId: "1:158935779593:web:f504a2426ea6eb15a7abd8"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || "Farm Alert", {
    body: payload.notification?.body || "Notification from Happy Farm",
    icon: "/mazra3ty-logo.png"
  });
});
