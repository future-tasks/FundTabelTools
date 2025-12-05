import React from "react";
import { Button, Upload, message, Tree, Space, Popconfirm } from "antd";
import type { UploadProps } from "antd";
import {
  InboxOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { parseExcelToJson, ExcelFileData } from "../utils/excelParser";

const { Dragger } = Upload;

interface FilePoolProps {
  files: ExcelFileData[];
  onFilesLoaded: (files: ExcelFileData[]) => void;
  onRemoveFile: (fileId: string) => void;
}

const FilePool: React.FC<FilePoolProps> = ({
  files,
  onFilesLoaded,
  onRemoveFile,
}) => {
  const handleUpload: UploadProps["customRequest"] = async (options) => {
    const { file } = options;
    try {
      const parsed = await parseExcelToJson((file as any).path);
      onFilesLoaded([parsed]);
    } catch (err) {
      message.error(`解析失败：${(file as any).name}`);
    }
  };

  const handleSelectFiles = async () => {
    if (!window.electronAPI?.openFileDialog) {
      message.error("主进程通信未就绪，请稍后重试");
      return;
    }

    // 获取文件路径
    const filePaths: string[] = await window.electronAPI.openFileDialog();
    if (filePaths.length === 0) return;

    // 读取Excel文件内容
    for (const path of filePaths) {
      try {
        const data = await window.electronAPI.readExcel(path);
        console.log("data：", data);
        // const parsed = await parseExcelToJson((file as any).path);
        // onFilesLoaded([parsed]);
      } catch (err) {
        message.error(`解析失败：${path.split(/[\\/]/).pop()}`);
      }
    }
  };

  const treeData = files.map((f) => ({
    title: (
      <Space>
        <span>{f.name}</span>
        <Popconfirm
          title="确定删除此文件？"
          onConfirm={() => onRemoveFile(f.id)}
          okText="删除"
          cancelText="取消"
        >
          <DeleteOutlined style={{ color: "red", cursor: "pointer" }} />
        </Popconfirm>
      </Space>
    ),
    key: f.id,
    children: f.sheets.map((s) => ({
      title: s.name,
      key: `${f.id}-${s.name}`,
      isLeaf: true,
    })),
  }));

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <Button
          type="primary"
          size="large"
          icon={<UploadOutlined />}
          onClick={handleSelectFiles}
        >
          选择 Excel 文件
        </Button>
        <div style={{ marginTop: 8, color: "#888", fontSize: 12 }}>
          支持多选、批量上传
        </div>
      </div>

      {/* <Dragger
        multiple
        customRequest={handleUpload}
        showUploadList={false}
        accept=".xlsx,.xls"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域</p>
      </Dragger> */}

      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        {treeData.length > 0 && (
          <Tree defaultExpandAll treeData={treeData} showLine />
        )}
      </div>
    </Space>
  );
};

export default FilePool;
