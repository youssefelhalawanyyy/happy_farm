import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/context/AuthContext";
import { App } from "@/app/App";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import { toastConfig } from "@/lib/toast";
import "@/app/globals.css";
import "react-toastify/dist/ReactToastify.css";

declare global {
  interface Window {
    __MAZRA3TY_BOOT_GUARD__?: number;
  }
}

const RootWrapper = import.meta.env.DEV ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <RootWrapper>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ToastContainer {...toastConfig} />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </RootWrapper>
);

if (typeof window.__MAZRA3TY_BOOT_GUARD__ === "number") {
  window.clearTimeout(window.__MAZRA3TY_BOOT_GUARD__);
  delete window.__MAZRA3TY_BOOT_GUARD__;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (import.meta.env.DEV) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.error("Failed to clear development service workers:", error);
        });
      return;
    }

    void navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((error) => {
      console.error("Failed to register service worker:", error);
    });
  });
}
