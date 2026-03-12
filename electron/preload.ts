import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion")
});

declare global {
  interface Window {
    desktop?: {
      getVersion: () => Promise<string>;
    };
  }
}
