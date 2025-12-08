import React, { useState } from "react";
import { Layout, Tabs, theme, message, Typography, Divider, Tag } from "antd";
import FilePool from "./components/FilePool";
import RuleBuilder from "./components/RuleBuilder";
import { ExcelFileData } from "./utils/xlsxParser";
import { createRoot } from "react-dom/client";
import emptyIcon from "../assets/empty.svg";
import ResultPanel from "./components/ResultPanel";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

interface CalcTab {
  key: string;
  label: string;
  fileId: string;
  result: number;
}

const App: React.FC = () => {
  const [files, setFiles] = useState<Map<string, ExcelFileData>>(new Map());
  const [activeTabs, setActiveTabs] = useState<CalcTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");

  const {
    token: { colorBgContainer, colorPrimary },
  } = theme.useToken();

  const handleFilesLoaded = (newFiles: ExcelFileData[]) => {
    const map = new Map(files);
    newFiles.forEach((f) => map.set(f.id, f));
    setFiles(map);
    message.success(`成功加载 ${newFiles.length} 个文件`);
  };

  const handleRemoveFile = (fileId: string) => {
    const map = new Map(files);
    map.delete(fileId);
    setFiles(map);

    const remainingTabs = activeTabs.filter((t) => t.fileId !== fileId);
    setActiveTabs(remainingTabs);
    if (activeKey === fileId && remainingTabs.length > 0) {
      setActiveKey(remainingTabs[0].key);
    }
  };

  const handleClearAllFiles = () => {
    setFiles(new Map());
    setActiveTabs([]);
    setActiveKey("");
  };

  const openFileTab = (file: ExcelFileData) => {
    const existing = activeTabs.find((t) => t.fileId === file.id);
    if (existing) {
      setActiveKey(existing.key);
      return;
    }

    const newTab: CalcTab = {
      key: file.id,
      label: file.name,
      fileId: file.id,
      result: 0,
    };

    setActiveTabs([...activeTabs, newTab]);
    setActiveKey(file.id);
  };

  const onTabChange = (key: string) => setActiveKey(key);

  const onTabEdit = (targetKey: any, action: "add" | "remove") => {
    if (action === "remove") {
      let newActiveKey = activeKey;
      const newTabs = activeTabs.filter((t) => t.key !== targetKey);
      if (activeKey === targetKey && newTabs.length > 0) {
        newActiveKey = newTabs[newTabs.length - 1].key;
      }
      setActiveTabs(newTabs);
      setActiveKey(newActiveKey);
    }
  };

  const updateTabResult = (fileId: string, result: number) => {
    setActiveTabs((tabs) =>
      tabs.map((t) => (t.fileId === fileId ? { ...t, result } : t))
    );
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        style={{
          color: "white",
          fontSize: 22,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          fontWeight: "bold",
        }}
      >
        指指点点
      </Header>

      <Layout>
        <Sider
          width="30%"
          style={{ background: colorBgContainer, padding: "12px 8px" }}
        >
          <FilePool
            files={Array.from(files.values())}
            onFilesLoaded={handleFilesLoaded}
            onRemoveFile={handleRemoveFile}
            onFileClick={openFileTab}
            onClearAll={handleClearAllFiles}
          />
        </Sider>

        <Content
          style={{
            background: colorBgContainer,
            padding: 12,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeTabs.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "#aaa",
              }}
            >
              <div>
                <img src={emptyIcon} alt="empty" />
              </div>
              <Title level={3} type="secondary">
                从左侧文件列表点击开始计算
              </Title>
              <Text type="secondary">
                支持多文件并行计算 + 高级筛选 + 自定义值
              </Text>
            </div>
          ) : (
            <Tabs
              type="editable-card"
              hideAdd
              activeKey={activeKey}
              onChange={onTabChange}
              onEdit={onTabEdit}
              tabBarGutter={8}
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
              items={activeTabs.map((tab) => {
                const file = files.get(tab.fileId);
                const result = tab.result;

                return {
                  key: tab.key,
                  label: (
                    <span>
                      <Text ellipsis={{ tooltip: file?.name }}>
                        {file?.name || "加载中..."}
                      </Text>
                      {result !== 0 && (
                        <Tag color="green" style={{ marginLeft: 8 }}>
                          {result.toLocaleString()}
                        </Tag>
                      )}
                    </span>
                  ),
                  children: (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* 规则构建区 */}
                      <div
                        style={{
                          flex: 1,
                          padding: "16px 24px",
                          overflow: "auto",
                        }}
                      >
                        {file && (
                          <RuleBuilder
                            filesData={files}
                            currentFileId={file.id}
                            onCalculate={(res) => updateTabResult(file.id, res)}
                          />
                        )}
                      </div>

                      {/* 超大结果展示区（固定在底部） */}
                      <Divider style={{ margin: "16px 0" }} />
                      {/* 结果展示区 */}
                      <ResultPanel result={result} />
                    </div>
                  ),
                };
              })}
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

const root = createRoot(document.body);
root.render(<App />);
