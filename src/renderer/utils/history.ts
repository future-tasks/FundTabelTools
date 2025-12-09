// src/renderer/utils/history.ts —— 完美兼容 Vite + Electron
// 完全不用 import path！直接用 preload 暴露的路径

declare global {
  interface Window {
    electronAPI: {
      getUserDataPath: () => string;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, data: string) => Promise<void>;
      fileExists: (path: string) => Promise<boolean>;
    };
  }
}

const getHistoryFilePath = async (): Promise<string> => {
  try {
    if (window.electronAPI?.getUserDataPath) {
      const userDataPath = await window.electronAPI.getUserDataPath();
      return `${userDataPath}/calc-history.json`;
    }
  } catch (error) {
    console.error("获取用户数据路径失败:", error);
  }
  // 开发环境降级
  return "calc-history.json";
};

export interface HistoryItem {
  time: string;
  fileName: string;
  sheetName: string;
  result: number;
}

// 触发历史记录更新事件的函数
const triggerHistoryUpdate = () => {
  window.dispatchEvent(new CustomEvent("historyUpdated"));
};

export const loadHistory = async (): Promise<HistoryItem[]> => {
  try {
    const historyFilePath = await getHistoryFilePath();
    const exists = await window.electronAPI.fileExists(historyFilePath);
    if (exists) {
      const data = await window.electronAPI.readFile(historyFilePath);
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("读取历史失败", e);
  }

  return [];
};

export const addHistory = async (item: Omit<HistoryItem, "time">) => {
  const history = await loadHistory();
  history.unshift({
    ...item,
    // 确保sheetName不为undefined
    sheetName: item.sheetName || "未命名工作表",
    time: new Date()
      .toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-"),
  });
  if (history.length > 200) history.pop();
  const historyFilePath = await getHistoryFilePath();
  await window.electronAPI.writeFile(
    historyFilePath,
    JSON.stringify(history, null, 2)
  );
  // 触发历史记录更新事件
  triggerHistoryUpdate();
};

export const clearHistory = async () => {
  const historyFilePath = await getHistoryFilePath();
  await window.electronAPI.writeFile(historyFilePath, "[]");

  // 触发历史记录更新事件
  triggerHistoryUpdate();
};
