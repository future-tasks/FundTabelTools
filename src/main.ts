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
let mainWindow: BrowserWindow | null = null;
// 解决打包后路径问题
const __filename = fileURLToPath(import.meta.url);
const __dirname2 = dirname(__filename);

// 声明 app.isQuitting 属性
declare global {
  namespace NodeJS {
    interface Global {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      app: any;
    }
  }
}

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
    const iconPath = path.join(process.cwd(), "public", "icons", iconExt);
    return iconPath;
  } else {
    // 生产环境
    if (process.platform === "darwin") {
      // macOS 打包后，图标可能在多个位置，需要尝试不同的路径
      const possiblePaths = [
        path.join(process.resourcesPath, "icon.icns"),
        path.join(process.resourcesPath, "icons", "icon.icns"),
        path.join(app.getAppPath(), "..", "icon.icns"),
        path.join(process.resourcesPath, "..", "icon.icns"),
      ];
      for (const iconPath of possiblePaths) {
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
      }
      console.warn("未找到图标文件，使用默认路径:", possiblePaths[0]);
      return possiblePaths[0];
    } else if (process.platform === "win32") {
      return path.join(process.resourcesPath, "icon.ico");
    } else {
      return path.join(process.resourcesPath, "icon.png");
    }
  }
}

const createWindow = () => {
  // 如果窗口已存在，直接显示
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  // Create the browser window.
  const windowOptions = {
    icon: getIconPath(),
    width: 1350,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname2, "preload.js"),
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

  mainWindow = new BrowserWindow(windowOptions);

  // 生产环境完全隐藏菜单栏
  if (app.isPackaged) {
    mainWindow.setMenuBarVisibility(false);
  }

  mainWindow.on("close", (event) => {
    const isQuitting = (app as any).isQuitting;
    if (!isQuitting) {
      // 自定义标志，防止右键退出时被拦截
      event.preventDefault();
      mainWindow!.hide(); // 隐藏窗口
    } else {
      // 真正退出时，销毁窗口
      mainWindow = null;
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow!.show());

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname2, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
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
        trayIconPath = path.join(process.resourcesPath, "icon.ico");
      }
    } else if (process.platform === "darwin") {
      // macOS平台特殊处理 - 优先使用 PNG，如果失败再尝试 ICNS
      if (!app.isPackaged) {
        // 开发环境 - 优先尝试 PNG
        const pngPath = path.join(process.cwd(), "public", "icons", "icon.png");
        const icnsPath = path.join(process.cwd(), "public", "icons", "icon.icns");
        trayIconPath = fs.existsSync(pngPath) ? pngPath : icnsPath;
      } else {
        // 生产环境 - macOS托盘图标，尝试多个可能的路径，优先 PNG
        const basePaths = [
          process.resourcesPath,
          path.join(process.resourcesPath, "icons"),
          path.dirname(app.getAppPath()),
        ];
        
        const possiblePaths: string[] = [];
        // 先添加 PNG 路径
        basePaths.forEach(base => {
          possiblePaths.push(path.join(base, "icon.png"));
        });
        // 再添加 ICNS 路径
        basePaths.forEach(base => {
          possiblePaths.push(path.join(base, "icon.icns"));
        });
        
        trayIconPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];
      }
    } else {
      // 其他平台使用通用路径
      trayIconPath = getIconPath();
    }

    // 确保使用绝对路径
    const absoluteTrayIconPath = path.isAbsolute(trayIconPath) 
      ? trayIconPath 
      : path.resolve(trayIconPath);
    
    // 验证图标文件是否存在
    if (!fs.existsSync(absoluteTrayIconPath)) {
      console.error("托盘图标文件不存在:", absoluteTrayIconPath);
      // 如果是 macOS 且 ICNS 失败，尝试 PNG
      if (process.platform === "darwin" && absoluteTrayIconPath.endsWith(".icns")) {
        const pngFallback = absoluteTrayIconPath.replace(/\.icns$/, ".png");
        if (fs.existsSync(pngFallback)) {
          const absolutePngPath = path.resolve(pngFallback);
          loadTrayIcon(absolutePngPath);
          return;
        }
      }
      throw new Error(`图标文件不存在: ${absoluteTrayIconPath}`);
    }

    loadTrayIcon(absoluteTrayIconPath);
  } catch (error) {
    console.error("创建托盘图标失败:", error);
    // 如果失败，使用默认图标作为后备方案
    tray = new Tray(nativeImage.createEmpty());
  }
}

// 辅助函数：加载托盘图标
function loadTrayIcon(iconPath: string): void {
  try {
    // 创建托盘图标，Windows平台不需要额外调整大小，系统会自动处理
    // 尝试多种方式加载图标
    let icon = nativeImage.createFromPath(iconPath);
    
    // 如果直接加载失败，尝试从文件系统读取为 Buffer
    if (icon.isEmpty()) {
      try {
        const iconBuffer = fs.readFileSync(iconPath);
        icon = nativeImage.createFromBuffer(iconBuffer);
      } catch (bufferError) {
        if (bufferError instanceof Error) {
          console.error("错误详情:", bufferError.message);
        }
      }
    }
    
    // 如果还是失败且是 ICNS，尝试 PNG
    if (icon.isEmpty() && iconPath.endsWith(".icns")) {
      const pngPath = iconPath.replace(/\.icns$/, ".png");
      if (fs.existsSync(pngPath)) {
        icon = nativeImage.createFromPath(pngPath);
        if (icon.isEmpty()) {
          try {
            const pngBuffer = fs.readFileSync(pngPath);
            icon = nativeImage.createFromBuffer(pngBuffer);
          } catch (e) {
            console.error("PNG 后备也加载失败:", e);
          }
        }
      }
    }
    
    if (icon.isEmpty()) {
      console.error("所有方式都无法加载图标文件");
      console.error("文件路径:", iconPath);
      console.error("文件存在:", fs.existsSync(iconPath));
      try {
        const stats = fs.statSync(iconPath);
        console.error("文件大小:", stats.size, "字节");
        console.error("文件权限:", stats.mode.toString(8));
      } catch (statError) {
        console.error("无法读取文件信息:", statError);
      }
      throw new Error(`无法加载图标: ${iconPath}`);
    }

    // Windows平台下，确保图标尺寸适合托盘
    if (process.platform === "win32") {
      // 尝试创建32x32大小的图标，这是Windows托盘的最佳尺寸
      tray = new Tray(icon.resize({ width: 32, height: 32 }));
    } else {
      // macOS 使用 22x22 或 16x16，系统会自动调整
      tray = new Tray(icon.resize({ width: 22, height: 22 }));
    }
  } catch (error) {
    console.error("loadTrayIcon 内部错误:", error);
    throw error; // 重新抛出错误，让外层 catch 处理
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
        // 设置标志，允许真正关闭
        (app as any).isQuitting = true;
        // 关闭所有窗口
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((win) => {
          win.destroy();
        });
        // 清理托盘
        if (tray) {
          tray.destroy();
          tray = null;
        }
        // 在 macOS 上，使用 exit 而不是 quit 来确保真正退出
        if (process.platform === "darwin") {
          app.exit(0);
        } else {
          app.quit();
        }
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

// 添加 before-quit 事件处理（在 ready 之前注册，只注册一次）
app.on("before-quit", (event) => {
  (app as any).isQuitting = true;
});

// 设置 macOS Dock 图标的辅助函数
function setDockIcon() {
  if (process.platform !== "darwin") return;
  
  let dockIconPath: string | null = null;
  
  if (!app.isPackaged) {
    // 开发环境 - 优先使用 PNG
    const pngPath = path.join(process.cwd(), "public", "icons", "icon.png");
    const icnsPath = path.join(process.cwd(), "public", "icons", "icon.icns");
    dockIconPath = fs.existsSync(pngPath) ? pngPath : icnsPath;
  } else {
    // 生产环境 - 尝试多个可能的路径
    const appPath = app.getAppPath();
    const execPath = process.execPath;
    const resourcesPath = process.resourcesPath;
    
    const possiblePaths = [
      // 标准资源路径
      path.join(resourcesPath, "icon.icns"),
      path.join(resourcesPath, "icons", "icon.icns"),
      // 从 appPath 查找
      path.join(appPath, "..", "icon.icns"),
      path.join(appPath, "..", "..", "Resources", "icon.icns"),
      // 从 execPath 查找（.app/Contents/MacOS/executable）
      path.join(execPath, "..", "..", "Resources", "icon.icns"),
      path.join(execPath, "..", "..", "Resources", "icons", "icon.icns"),
      // 其他可能的位置
      path.join(process.resourcesPath, "..", "icon.icns"),
    ];
    
    for (const iconPath of possiblePaths) {
      if (fs.existsSync(iconPath)) {
        dockIconPath = iconPath;
        break;
      }
    }
    
    if (!dockIconPath) {
      console.error("未找到图标文件，尝试的路径:");
      possiblePaths.forEach(p => console.error("  -", p));
      return;
    }
  }
  
  // 验证文件存在
  if (!fs.existsSync(dockIconPath)) {
    console.error("图标文件不存在:", dockIconPath);
    return;
  }
  
  // 加载图标 - 尝试多种方式，优先使用 PNG
  try {
    // 如果是 ICNS，先尝试 PNG
    let dockIconPathToUse = dockIconPath;
    if (dockIconPath.endsWith(".icns")) {
      const pngPath = dockIconPath.replace(/\.icns$/, ".png");
      if (fs.existsSync(pngPath)) {
        dockIconPathToUse = pngPath;
      }
    }
    
    let dockIcon = nativeImage.createFromPath(dockIconPathToUse);
    
    // 如果直接加载失败，尝试从文件系统读取为 Buffer
    if (dockIcon.isEmpty()) {
      try {
        const iconBuffer = fs.readFileSync(dockIconPathToUse);
        dockIcon = nativeImage.createFromBuffer(iconBuffer);
      } catch (bufferError) {
        console.error("Buffer 方式加载 Dock 图标失败:", bufferError);
      }
    }
    
    // 如果还是失败且是 ICNS，尝试 PNG 后备
    if (dockIcon.isEmpty() && dockIconPathToUse.endsWith(".icns")) {
      const pngPath = dockIconPathToUse.replace(/\.icns$/, ".png");
      if (fs.existsSync(pngPath)) {
        dockIcon = nativeImage.createFromPath(pngPath);
        if (dockIcon.isEmpty()) {
          try {
            const pngBuffer = fs.readFileSync(pngPath);
            dockIcon = nativeImage.createFromBuffer(pngBuffer);
          } catch (e) {
            console.error("PNG 后备也加载失败:", e);
          }
        } else {
          console.log("PNG 后备加载成功");
        }
      }
    }
    
    // 如果原始路径是 ICNS 但 PNG 后备成功，更新路径显示
    if (!dockIcon.isEmpty() && dockIconPathToUse !== dockIconPath) {
      console.log("使用 PNG 替代 ICNS 设置 Dock 图标");
    }
    
    if (dockIcon.isEmpty()) {
      console.error("Dock 图标加载失败，文件为空");
      console.error("尝试的路径:", dockIconPathToUse);
      console.error("文件存在:", fs.existsSync(dockIconPathToUse));
      // 尝试读取文件信息
      try {
        const stats = fs.statSync(dockIconPathToUse);
        console.error("文件大小:", stats.size, "字节");
        console.error("文件权限:", stats.mode.toString(8));
      } catch (statError) {
        console.error("无法读取文件信息:", statError);
      }
      return;
    }
    
    // 设置 Dock 图标
    app.dock.setIcon(dockIcon);
  } catch (error) {
    console.error("设置 Dock 图标时出错:", error);
    if (error instanceof Error) {
      console.error("错误详情:", error.message);
      console.error("错误堆栈:", error.stack);
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  // 初始化 isQuitting 标志
  (app as any).isQuitting = false;
  
  // macOS 上设置 Dock 图标
  setDockIcon();
  
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
  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) {
    createWindow();
  } else {
    // 如果有窗口存在但被隐藏，显示它
    windows.forEach((win) => {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
