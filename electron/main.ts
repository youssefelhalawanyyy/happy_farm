import path from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const preloadPath = path.join(__dirname, "preload.js");

const createMainWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: "Mazra3ty Platform",
    show: false,
    backgroundColor: "#070d1d",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await win.loadFile(path.join(__dirname, "../dist/index.html"));
};

app.whenReady().then(async () => {
  nativeTheme.themeSource = "dark";

  ipcMain.handle("app:getVersion", () => app.getVersion());

  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
