import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { loadHistory, HistoryItem } from "../utils/history";

interface HistoryContextType {
  history: HistoryItem[];
  refreshHistory: () => Promise<void>;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({
  children,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const refreshHistory = async () => {
    try {
      const data = await loadHistory();
      setHistory(data);
    } catch (error) {
      console.error("刷新历史记录失败:", error);
      setHistory([]);
    }
  };

  // 监听自定义事件
  useEffect(() => {
    const handleHistoryUpdated = () => {
      refreshHistory();
    };

    window.addEventListener("historyUpdated", handleHistoryUpdated);

    // 初始加载
    refreshHistory();

    return () => {
      window.removeEventListener("historyUpdated", handleHistoryUpdated);
    };
  }, []);

  return (
    <HistoryContext.Provider value={{ history, refreshHistory }}>
      {children}
    </HistoryContext.Provider>
  );
};

// 自定义Hook
export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
};

// 添加TypeScript类型定义
declare global {
  interface WindowEventMap {
    historyUpdated: Event;
  }
}
