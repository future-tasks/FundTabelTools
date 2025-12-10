import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import fs from "node:fs";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray: Tray | null = null;
// 解决打包后路径问题
const __filename = fileURLToPath(import.meta.url);
const __dirname2 = dirname(__filename);

// 获取正确的图标路径
function getIconPath() {
  const isDev = !app.isPackaged;
  // 开发环境
  if (isDev) {
    // 开发环境 - 从原始位置获取图标
    const iconExt =
      process.platform === "win32"
        ? "icon.ico"
        : process.platform === "darwin"
          ? "icon.icns"
          : "icon.png";
    return path.join(process.cwd(), "public", "icons", iconExt);
  } else {
    const iconExt =
      process.platform === "win32"
        ? "icon.ico"
        : process.platform === "darwin"
          ? "icon.icns"
          : "icon.png";
    return path.join(process.resourcesPath, iconExt);
  }
}

const createWindow = () => {
  // Create the browser window.
  const windowOptions = {
    icon: getIconPath(),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  };

  // Windows平台特殊处理任务栏图标
  if (process.platform === "win32") {
    // Windows需要直接设置图标路径，而不是通过nativeImage对象
    if (app.isPackaged) {
      // 生产环境
      windowOptions.icon = path.join(process.resourcesPath, "icon.ico");
    } else {
      // 开发环境
      windowOptions.icon = path.join(
        process.cwd(),
        "public",
        "icons",
        "icon.ico"
      );
    }
  } else {
    // 其他平台使用getIconPath
    windowOptions.icon = getIconPath();
  }

  const mainWindow = new BrowserWindow(windowOptions);

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      // 自定义标志，防止右键退出时被拦截
      event.preventDefault();
      mainWindow.hide(); // 隐藏窗口
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // 只在开发环境打开开发者工具，生产环境自动关闭
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

function createTray() {
  try {
    // 为托盘图标使用专门的处理逻辑
    let trayIconPath;

    if (process.platform === "win32") {
      // Windows平台特殊处理
      if (!app.isPackaged) {
        // 开发环境
        trayIconPath = path.join(process.cwd(), "public", "icons", "icon.ico");
      } else {
        // 生产环境 - Windows托盘图标
        trayIconPath = path.join(process.resourcesPath, "icons", "icon.ico");
      }
    } else {
      // 其他平台使用通用路径
      trayIconPath = getIconPath();
    }

    // 创建托盘图标，Windows平台不需要额外调整大小，系统会自动处理
    const icon = nativeImage.createFromPath(trayIconPath);

    // Windows平台下，确保图标尺寸适合托盘
    if (process.platform === "win32") {
      // 尝试创建32x32大小的图标，这是Windows托盘的最佳尺寸
      tray = new Tray(icon.resize({ width: 32, height: 32 }));
    } else {
      tray = new Tray(icon.resize({ width: 16, height: 16 }));
    }
  } catch (error) {
    console.error("创建托盘图标失败:", error);
    // 如果失败，使用默认图标作为后备方案
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出应用",
      click: () => {
        app.isQuitting = true; // 设置标志，允许真正关闭
        app.quit();
      },
    },
  ]);

  tray.setToolTip("指指点点 - 让统计更简单");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isVisible()) win.focus();
      else win.show();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();
  createTray();
});

// 打开文件对话框
ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    // 支持单选和多选文件
    properties: ["openFile", "multiSelections"],
    // 限制只能选择Excel文件
    filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
  });
  // 如果用户取消选择文件，返回空数组
  if (canceled) return [];
  // 返回用户选择的文件路径数组
  return filePaths;
});

// 读取文件内容
ipcMain.handle("file:readFile", async (event, filePath) =>
  fs.promises.readFile(filePath, "utf-8")
);

// 写入文件内容
ipcMain.handle(
  "file:writeFile",
  async (event, filePath: string, data: string) =>
    fs.promises.writeFile(filePath, data)
);

// 检查文件是否存在
ipcMain.handle("file:fileExists", async (event, filePath: string) =>
  fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false)
);

// 提供用户数据路径
ipcMain.handle("app:getUserDataPath", () => {
  return app.getPath("userData");
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  // if (process.platform !== "darwin") {
  //   app.quit();
  // }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
