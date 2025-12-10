// src/renderer/components/HistoryPanel.tsx —— 侧边抽屉版
import React, { useState, useEffect } from "react";
import {
  Card,
  Timeline,
  Button,
  Empty,
  Popconfirm,
  Typography,
  Space,
  Flex,
  Tooltip,
} from "antd";
import {
  ClockCircleOutlined,
  ClearOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { clearHistory } from "../utils/history";
import { useHistory } from "../contexts/HistoryContext";

const { Text, Title } = Typography;

interface HistoryPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ collapsed, onToggle }) => {
  const { history, refreshHistory } = useHistory();
  const [buttonHovered, setButtonHovered] = React.useState(false);

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        overflow: "visible",
        paddingLeft: collapsed ? 0 : 0,
      }}
    >
      {/* 主面板 */}
      <div
        style={{
          opacity: collapsed ? 0 : 1,
          visibility: collapsed ? "hidden" : "visible",
          transition: "all 0.3s ease",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Card
          title={
            <Title level={4} style={{ margin: 0 }}>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              历史记录 ({history.length})
            </Title>
          }
          extra={
            history.length > 0 && (
              <Popconfirm
                placement="bottomRight"
                title="确认清空所有记录？"
                description="此操作不可恢复"
                onConfirm={async () => {
                  await clearHistory();
                  await refreshHistory();
                }}
                okText="清空"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<ClearOutlined />} size="small">
                  清空
                </Button>
              </Popconfirm>
            )
          }
          styles={{
            body: {
              maxHeight: "calc(100vh - 150px)",
              overflow: "auto",
              padding: 16,
            },
          }}
          variant="outlined"
          style={{
            background: "#f9f9f9",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            height: "100%",
          }}
        >
          {history.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">暂无计算记录</Text>}
              style={{ marginTop: 80 }}
            />
          ) : (
            <Timeline style={{ marginTop: 16 }}>
              {history?.map((item, i) => {
                const value = `${item.sheetName}：${item.result}`;
                return (
                  <Timeline.Item key={i} color="green">
                    <div
                      style={{
                        background: "white",
                        padding: "12px 16px",
                        borderRadius: 8,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Text style={{ color: "#888", fontSize: 12 }}>
                        {item.time}
                      </Text>
                      <br />
                      <Flex>
                        <Text
                          strong
                          ellipsis={{ tooltip: item.fileName }}
                          style={{ flex: 2 }}
                        >
                          {item.fileName}
                        </Text>
                        <Text
                          strong
                          ellipsis={{ tooltip: value }}
                          style={{ flex: 1 }}
                        >
                          {value}
                        </Text>
                      </Flex>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          )}
        </Card>
      </div>

      {/* 收起/展开按钮 */}
      <Tooltip
        title={collapsed ? "展开历史记录" : "收起历史记录"}
        placement="left"
      >
        <div
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
          onClick={onToggle}
          style={{
            position: "absolute",
            left: collapsed ? 0 : -18,
            top: "50%",
            transform: buttonHovered
              ? "translateY(-50%) scale(1.05)"
              : "translateY(-50%)",
            zIndex: 1000,
            borderRadius: collapsed ? "0 8px 8px 0" : "8px 0 0 8px",
            boxShadow: buttonHovered
              ? collapsed
                ? "3px 3px 16px rgba(102, 126, 234, 0.5)"
                : "-3px 3px 16px rgba(102, 126, 234, 0.5)"
              : collapsed
                ? "2px 2px 12px rgba(102, 126, 234, 0.3)"
                : "-2px 2px 12px rgba(102, 126, 234, 0.3)",
            transition: "all 0.3s ease",
            height: "64px",
            width: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            cursor: "pointer",
            color: "white",
            fontSize: "14px",
          }}
          title={collapsed ? "展开历史记录" : "收起历史记录"}
        >
          {collapsed ? <LeftOutlined /> : <RightOutlined />}
        </div>
      </Tooltip>
    </div>
  );
};

export default HistoryPanel;
