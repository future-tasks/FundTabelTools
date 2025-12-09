import React, { useEffect, useState } from "react";
import {
  Statistic,
  Card,
  Typography,
  theme,
  Button,
  message,
  Flex,
  Space,
  Input,
} from "antd";
import { CopyOutlined, EditOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface ResultPanelProps {
  result: number;
  initialResultName?: string;
  onNameChange?: (name: string) => void;
}

const ResultPanel: React.FC<ResultPanelProps> = ({
  result,
  initialResultName,
  onNameChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(initialResultName || "");
  const {
    token: { colorPrimary },
  } = theme.useToken();

  // 当外部传入的name变化时，更新编辑状态的name
  useEffect(() => {
    if (initialResultName !== undefined) {
      setEditName(initialResultName);
    }
  }, [initialResultName]);

  const handleCopy = () => {
    if (result !== 0) {
      // 格式化结果为带有两位小数的字符串
      const formattedResult = result.toFixed(2);
      // 复制到剪贴板
      navigator.clipboard
        .writeText(formattedResult)
        .then(() => {
          message.success("结果已复制到剪贴板");
        })
        .catch(() => {
          message.error("复制失败，请手动复制");
        });
    }
  };

  return (
    <div style={{ padding: "0 24px 24px" }}>
      <Card
        styles={{
          body: { padding: 32, textAlign: "center" },
        }}
      >
        <Space>
          <Statistic
            title={
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {isEditing ? (
                  <Space>
                    <Input
                      size="large"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onPressEnter={() => {
                        onNameChange?.(editName);
                        setIsEditing(false);
                      }}
                      onBlur={() => {
                        onNameChange?.(editName);
                        setIsEditing(false);
                      }}
                      placeholder="输入自定义名称"
                      maxLength={50}
                      autoFocus
                    />
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        onNameChange?.(editName);
                        setIsEditing(false);
                      }}
                    >
                      确定
                    </Button>
                  </Space>
                ) : (
                  <Space>
                    <Title level={3} style={{ margin: 0, color: "#666" }}>
                      {editName ? editName : "计算结果"}
                    </Title>
                    <EditOutlined
                      onClick={() => setIsEditing(true)}
                      style={{ cursor: "pointer" }}
                    />
                  </Space>
                )}
              </div>
            }
            value={result}
            precision={2}
            styles={{
              content: {
                fontSize: 48,
                color: result >= 0 ? colorPrimary : "#cf1322",
                fontWeight: "bold",
              },
            }}
            // suffix={
            //   result !== 0 && (
            //     <span style={{ fontSize: 24, color: "#aaa" }}> 元</span>
            //   )
            // }
          />
          {result !== 0 && <CopyOutlined onClick={handleCopy} />}
        </Space>
        <div>
          {result === 0 && (
            <Text type="secondary" style={{ fontSize: 18 }}>
              点击「计算结果」按钮开始计算
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ResultPanel;
