// src/renderer/components/ExcelTree.tsx —— 只显示工作表（需求1优化）
import React from "react";
import { TreeSelect } from "antd";
import type { ExcelFileData } from "../utils/xlsxParser";
import { Typography } from "antd";

const { Text } = Typography;

interface ExcelTreeProps {
  filesData: Map<string, ExcelFileData>;
  value?: any;
  onChange?: (value: any) => void;
  placeholder?: string;
  usedSheets?: Set<string>; // 新增：传入已使用的 sheet 标识（fileId|sheetName）
}

const ExcelTree: React.FC<ExcelTreeProps> = ({
  filesData,
  value,
  onChange,
  placeholder,
  usedSheets = new Set(),
}) => {
  const treeData = Array.from(filesData.values()).map((file) => ({
    title: (
      <Text ellipsis={true} style={{ width: 150 }} title={file.name}>
        {file.name}
      </Text>
    ),
    value: file.id,
    selectable: false, // 禁用选文件，只选 sheet
    children: file.sheets.map((sheet) => {
      const key = `${file.id}|${sheet.name}`;
      const isUsed = usedSheets.has(key);
      return {
        title: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
            }}
          >
            {isUsed && (
              <span style={{ color: "#52c41a", fontSize: 14 }}>✓</span>
            )}
            <Text ellipsis={true} style={{ width: 100 }} title={sheet.name}>
              {sheet.name}
            </Text>
          </div>
        ),
        value: `${file.id}|${sheet.name}`,
      };
    }),
  }));

  return (
    <TreeSelect
      style={{ width: 220 }}
      treeData={treeData}
      placeholder={placeholder || "选择工作表"}
      treeDefaultExpandAll
      value={value}
      onChange={onChange}
    />
  );
};

export default ExcelTree;
