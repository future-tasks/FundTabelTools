// src/renderer/components/FilePool.tsx —— 支持同名文件自动重命名版
import React, { useRef } from "react";
import {
  Card,
  Space,
  Badge,
  Typography,
  Button,
  Upload,
  message,
  Grid,
  Popconfirm,
} from "antd";
import {
  ClearOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { parseExcelWithXLSX, ExcelFileData } from "../utils/xlsxParser";

const { useBreakpoint } = Grid;
const { Text } = Typography;

interface FilePoolProps {
  files: ExcelFileData[];
  onFilesLoaded: (files: ExcelFileData[]) => void;
  onRemoveFile: (fileId: string) => void;
  onFileClick: (file: ExcelFileData) => void;
  onClearAll?: () => void;
}

const FilePool: React.FC<FilePoolProps> = ({
  files,
  onFilesLoaded,
  onRemoveFile,
  onFileClick,
  onClearAll,
}) => {
  const screens = useBreakpoint();

  // 清空全部文件函数
  const handleClearAll = () => {
    files.forEach((file) => onRemoveFile(file.id));
    message.success("已清空所有文件");
    if (onClearAll) onClearAll(); // 联动关闭 Tabs
  };

  // 用 ref 收集本次批量上传的文件（防抖）
  const batchFiles = useRef<File[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  // 生成不重复的显示名称：销售数据.xlsx → 销售数据-1.xlsx → 销售数据-2.xlsx
  const generateUniqueName = (originalName: string): string => {
    const existingNames = new Set(files.map((f) => f.name));
    if (!existingNames.has(originalName)) return originalName;

    const ext = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    const baseName = originalName
      .replace(/\s*-\d+$/, "")
      .replace(new RegExp(`${ext}$`), "");

    let index = 1;
    let newName = `${baseName}-${index}${ext}`;
    while (existingNames.has(newName)) {
      index++;
      newName = `${baseName}-${index}${ext}`;
    }
    return newName;
  };

  const uploadProps = {
    multiple: true,
    accept: ".xlsx,.xls",
    showUploadList: false,
    customRequest: ({ onSuccess }: any) => setTimeout(() => onSuccess("ok"), 0),
    onChange: async (info: any) => {
      const { file } = info;
      if (file.status !== "done") return;

      const rawFile = file.originFileObj || file;

      // 防御性判断（防止拖入文件夹、快捷方式等）
      if (!rawFile || !rawFile.name || typeof rawFile.name !== "string") {
        return;
      }

      if (rawFile) batchFiles.current.push(rawFile);

      // 防抖 200ms 批量处理
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (batchFiles.current.length === 0) return;

        const toParse = [...batchFiles.current];
        batchFiles.current = [];

        const parsedFiles: ExcelFileData[] = [];
        let successCount = 0;

        for (const rawFile of toParse) {
          if (!rawFile.name.match(/\.(xlsx|xls)$/i)) {
            message.warning(`${rawFile.name} 不是 Excel 文件，已跳过`);
            continue;
          }

          try {
            const parsed = await parseExcelWithXLSX(rawFile);
            // 关键：自动重命名显示名
            parsed.name = generateUniqueName(parsed.name);
            parsedFiles.push(parsed);
            successCount++;
          } catch (err: any) {
            message.error(`解析失败：${rawFile.name}`);
          }
        }

        if (successCount > 0) {
          onFilesLoaded(parsedFiles);
          // message.success(`成功添加 ${successCount} 个文件（同名自动重命名）`);
        }
      }, 200);
    },

    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      // 移除手动调用onChange的代码，因为Ant Design的Upload组件会自动触发onChange事件
      // 避免文件被处理两次
      // const dropped = Array.from(e.dataTransfer.files) as File[];
      // dropped.forEach((f) => {
      //   if (f.name.match(/\.(xlsx|xls)$/i)) {
      //     batchFiles.current.push(f);
      //   }
      // });
      // // 手动触发一次处理
      // uploadProps.onChange({ file: { status: "done" }, fileList: [] });
    },
  };

  const getColumns = () => {
    if (screens.xxl || screens.xl) return 3;
    if (screens.lg || screens.md) return 2;
    return 1;
  };

  return (
    <div
      style={{
        height: "100%",
        minWidth: 300,
        display: "flex",
        flexDirection: "column",
        padding: 12,
      }}
    >
      {/* 上传区域 */}
      <Upload.Dragger
        {...uploadProps}
        style={{ marginBottom: 16, padding: 32 }}
      >
        <Space orientation="vertical" size="middle" align="center">
          <UploadOutlined style={{ fontSize: 48, color: "#1890ff" }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>
              点击或拖拽文件到此处
            </Text>
            <br />
            <Text type="secondary">支持重复上传，同名文件自动重命名</Text>
          </div>
        </Space>
      </Upload.Dragger>

      {files.length > 0 && (
        <div style={{ paddingTop: 8, textAlign: "right" }}>
          <Popconfirm
            title="确定清空所有文件吗？"
            description="此操作不可恢复，所有相关 Tabs 将关闭"
            onConfirm={handleClearAll}
            okText="确定清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<ClearOutlined />} size="small">
              清空全部文件
            </Button>
          </Popconfirm>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
        {files.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 100, color: "#ccc" }}>
            <FileExcelOutlined style={{ fontSize: 80, marginBottom: 16 }} />
            <br />
            <Text type="secondary" strong>
              暂无文件
            </Text>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              padding: "12px 0",
            }}
          >
            {files.map((file) => (
              <Card
                key={file.id}
                hoverable
                onClick={() => onFileClick(file)}
                style={{
                  borderRadius: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  marginBottom: 12,
                }}
                styles={{ body: { padding: 16 } }}
                actions={[
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(file.id);
                    }}
                  >
                    删除
                  </Button>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        background: "linear-gradient(135deg, #52c41a, #389e0d)",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileExcelOutlined
                        style={{ fontSize: 28, color: "white" }}
                      />
                    </div>
                  }
                  title={
                    <Text strong ellipsis={{ tooltip: file.name }}>
                      {file.name}
                    </Text>
                  }
                  description={
                    <Space orientation="vertical" size={2}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {file.sheets.length} 个工作表
                      </Text>
                      <Space wrap>
                        {file.sheets.slice(0, 3).map((s) => (
                          <Badge
                            key={s.name}
                            count={s.name}
                            style={{ background: "#f0f2f5", color: "#666" }}
                          />
                        ))}
                        {file.sheets.length > 3 && (
                          <Badge
                            count={`+${file.sheets.length - 3}`}
                            style={{ background: "#f0f2f5", color: "#666" }}
                          />
                        )}
                      </Space>
                    </Space>
                  }
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePool;
