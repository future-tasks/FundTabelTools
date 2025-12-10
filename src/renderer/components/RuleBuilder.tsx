// src/renderer/components/RuleBuilder.tsx —— 终极美观层级版
import React, { useEffect, useState } from "react";
import {
  Button,
  Select,
  Input,
  Space,
  Card,
  Tag,
  message,
  Switch,
  InputNumber,
  Collapse,
  Form,
  Popconfirm,
  ConfigProvider,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  FilterOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import ExcelTree from "./ExcelTree";
import { evaluateCellRefs } from "../utils/xlsxParser";
import type { ExcelFileData } from "../utils/xlsxParser";
import { createStyles } from "antd-style";

const { Panel } = Collapse;
const { Option } = Select;

const useStyle = createStyles(({ prefixCls, css }) => ({
  linearGradientButton: css`
    &.${prefixCls}-btn-primary:not([disabled]):not(
        .${prefixCls}-btn-dangerous
      ) {
      > span {
        position: relative;
      }

      &::before {
        content: "";
        background: linear-gradient(135deg, #6253e1, #04befe);
        position: absolute;
        inset: -1px;
        opacity: 1;
        transition: all 0.3s;
        border-radius: inherit;
      }

      &:hover::before {
        opacity: 0;
      }
    }
  `,
}));

interface ExcludeCondition {
  key: string;
  column: string;
  keyword: string;
  mode: "exclude" | "include";
  logic: "AND" | "OR"; // 与下一个条件的逻辑关系
}

interface RuleItem {
  key: string;
  logic: "AND" | "OR";
  fileId: string;
  sheetName: string;
  type: "cell" | "row" | "column" | "custom";
  ref: string;
  startRow?: number;
  endRow?: number;
  value?: number;
  description?: string;
  enableExclude: boolean;
  excludeConditions: ExcludeCondition[];
}

interface RuleBuilderProps {
  filesData: Map<string, ExcelFileData>;
  currentFileId?: string;
  onCalculate: (result: number) => void;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({
  filesData,
  currentFileId,
  onCalculate,
}) => {
  const [rules, setRules] = useState<RuleItem[]>([]);

  const { styles } = useStyle();

  const addRule = () => {
    setRules([
      ...rules,
      {
        key: Date.now().toString(),
        logic: rules.length === 0 ? "AND" : "AND",
        fileId: currentFileId || "",
        sheetName: "",
        type: "cell",
        ref: "",
        enableExclude: false,
        excludeConditions: [],
      },
    ]);
  };

  const removeRule = (key: string) => {
    // 剩余规则
    const remainingRules = rules.filter((r) => r.key !== key);
    setRules(remainingRules);
    // 当删除最后一条规则时，清空计算值
    if (remainingRules.length === 0) {
      onCalculate(0);
    }
  };

  const updateRule = (
    key: string,
    field: keyof RuleItem | `excludeConditions`,
    value: any
  ) => {
    setRules(rules.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  // 计算当前所有规则中已使用的工作表（fileId|sheetName）
  const usedSheets = new Set<string>();
  rules.forEach((rule) => {
    if (rule.fileId && rule.sheetName) {
      usedSheets.add(`${rule.fileId}|${rule.sheetName}`);
    }
  });

  const addExcludeCondition = (ruleKey: string) => {
    setRules(
      rules.map((r) => {
        if (r.key === ruleKey) {
          return {
            ...r,
            excludeConditions: [
              ...r.excludeConditions,
              {
                key: Date.now().toString(),
                column: "",
                keyword: "",
                mode: "exclude",
                logic: "AND", // 默认 AND
              },
            ],
          };
        }
        return r;
      })
    );
  };

  const removeExcludeCondition = (ruleKey: string, condKey: string) => {
    setRules(
      rules.map((r) => {
        if (r.key === ruleKey) {
          return {
            ...r,
            excludeConditions: r.excludeConditions.filter(
              (c) => c.key !== condKey
            ),
          };
        }
        return r;
      })
    );
  };

  const calculate = () => {
    if (rules.length === 0) return message.warning("请至少添加一条规则");

    const refs: any[] = [];
    const excludes: any[] = [];

    // 按顺序处理每个规则，确保逐层处理
    rules.forEach((rule, index) => {
      if (!rule.sheetName) return;

      const ref: any = {
        type: rule.type,
        sheetName: rule.sheetName,
        fileId: rule.fileId,
        fileName: filesData.get(rule.fileId)?.name || "",
        ref: rule.type === "custom" ? "custom" : rule.ref,
        startRow: rule.startRow,
        endRow: rule.endRow,
        value: rule.value,
        logic: index === 0 ? "AND" : rule.logic, // 第一个规则默认 AND，后续使用配置的逻辑
      };

      // 为每个规则的排除条件添加索引，实现真正的逐层处理
      if (rule.enableExclude && rule.excludeConditions.length > 0) {
        rule.excludeConditions.forEach((cond, condIndex) => {
          excludes.push({
            fileId: rule.fileId,
            sheetName: rule.sheetName,
            excludeColumn: cond.column,
            excludeKeyword: cond.keyword,
            excludeMode: cond.mode,
            conditionLogic: cond.logic,
            // 关键：添加规则索引，确保排除条件按顺序累积应用
            ruleIndex: index,
            conditionIndex: condIndex,
          });
        });
      }

      refs.push(ref);
    });

    // 使用逐层处理函数计算结果
    const total = evaluateCellRefs(refs, filesData, excludes);
    onCalculate(total);
    
    // 显示处理过程的详细信息
    const processInfo = rules.map((rule, index) => {
      const hasExcludes = rule.enableExclude && rule.excludeConditions.length > 0;
      const logicLabel = index > 0 ? `[${rule.logic}] ` : '';
      return `${logicLabel}规则${index + 1}: ${hasExcludes ? `含${rule.excludeConditions.length}个筛选条件` : '无筛选'}`;
    }).join(' → ');
    
    message.success(`逐层处理完成！${processInfo} → 结果：${total.toLocaleString()}`);
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ overflow: "auto", width: "100%", maxHeight: "38vh" }}>
        <Space orientation="vertical" style={{ width: "100%" }}>
          {rules.map((rule, index) => (
            <Card
              key={rule.key}
              size="small"
              title={
                <Space>
                  {index > 0 && (
                    <Select
                      value={rule.logic}
                      onChange={(v) => updateRule(rule.key, "logic", v)}
                      size="small"
                    >
                      <Option value="AND">AND</Option>
                      <Option value="OR">OR</Option>
                    </Select>
                  )}
                  <Tag color="blue">主规则 {index + 1}</Tag>
                </Space>
              }
              extra={
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeRule(rule.key)}
                />
              }
            >
              <Space
                orientation="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {/* 主规则区域 */}
                <Space wrap>
                  <ExcelTree
                    filesData={filesData}
                    value={
                      rule.fileId && rule.sheetName
                        ? `${rule.fileId}|${rule.sheetName}`
                        : undefined
                    }
                    onChange={(v) => {
                      const [fileId, sheetName] = (v as string).split("|");
                      updateRule(rule.key, "fileId", fileId);
                      updateRule(rule.key, "sheetName", sheetName);
                    }}
                    placeholder="选择工作表"
                    usedSheets={usedSheets}
                  />

                  <Select
                    value={rule.type}
                    onChange={(v) => updateRule(rule.key, "type", v)}
                    style={{ width: 120 }}
                  >
                    <Option value="cell">单元格</Option>
                    <Option value="row">整行</Option>
                    <Option value="column">整列（范围）</Option>
                    <Option value="custom">自定义值</Option>
                  </Select>

                  {rule.type !== "custom" ? (
                    <Input
                      placeholder={
                        rule.type === "cell"
                          ? "A1"
                          : rule.type === "row"
                            ? "5"
                            : "B"
                      }
                      value={rule.ref}
                      onChange={(e) =>
                        updateRule(rule.key, "ref", e.target.value)
                      }
                      style={{ width: 100 }}
                    />
                  ) : (
                    <Space>
                      <Input
                        placeholder="说明（如：固定费用）"
                        value={rule.description}
                        onChange={(e) =>
                          updateRule(rule.key, "description", e.target.value)
                        }
                      />
                      <InputNumber
                        value={rule.value}
                        onChange={(v) =>
                          updateRule(rule.key, "value", v as number)
                        }
                      />
                    </Space>
                  )}

                  {rule.type === "column" && (
                    <Space>
                      <InputNumber
                        min={1}
                        placeholder="起始行"
                        value={rule.startRow}
                        onChange={(v) =>
                          updateRule(rule.key, "startRow", v as number)
                        }
                      />
                      <span>~</span>
                      <InputNumber
                        min={1}
                        placeholder="结束行（留空=最后）"
                        value={rule.endRow}
                        onChange={(v) =>
                          updateRule(rule.key, "endRow", v as number)
                        }
                      />
                    </Space>
                  )}
                </Space>

                {/* 排除规则折叠面板 */}
                <Collapse ghost activeKey={rule.enableExclude ? "exclude" : ""}>
                  <Panel
                    header={
                      <Space>
                        <Switch
                          checkedChildren="已启用筛选"
                          unCheckedChildren="点击启用筛选/排除"
                          checked={rule.enableExclude}
                          onChange={(v) =>
                            updateRule(rule.key, "enableExclude", v)
                          }
                        />
                        <FilterOutlined
                          style={{
                            color: rule.enableExclude ? "#1890ff" : "#aaa",
                          }}
                        />
                        <span
                          style={{
                            color: rule.enableExclude ? "#1890ff" : "#999",
                          }}
                        >
                          {rule.enableExclude
                            ? `已启用 ${rule.excludeConditions.length} 条筛选条件`
                            : "添加筛选条件（如排除“测试”行）"}
                        </span>
                      </Space>
                    }
                    key="exclude"
                    showArrow={false}
                  >
                    <Space
                      orientation="vertical"
                      style={{ width: "100%", marginTop: 8 }}
                      size="small"
                    >
                      {rule.excludeConditions.map((cond, i) => (
                        <Card
                          key={cond.key}
                          size="small"
                          style={{ background: "#f9f9f9" }}
                        >
                          <Space wrap>
                            <span style={{ fontWeight: 500 }}>{i + 1}.</span>
                            <Select
                              value={cond.mode}
                              onChange={(v) => {
                                setRules(
                                  rules.map((r) => {
                                    if (r.key === rule.key) {
                                      return {
                                        ...r,
                                        excludeConditions:
                                          r.excludeConditions.map((c) =>
                                            c.key === cond.key
                                              ? { ...c, mode: v }
                                              : c
                                          ),
                                      };
                                    }
                                    return r;
                                  })
                                );
                              }}
                              style={{ width: 120 }}
                            >
                              <Option value="exclude">排除包含</Option>
                              <Option value="include">仅保留包含</Option>
                            </Select>
                            <Input
                              placeholder="列（如 A）"
                              value={cond.column}
                              onChange={(e) => {
                                setRules(
                                  rules.map((r) => {
                                    if (r.key === rule.key) {
                                      return {
                                        ...r,
                                        excludeConditions:
                                          r.excludeConditions.map((c) =>
                                            c.key === cond.key
                                              ? {
                                                  ...c,
                                                  column:
                                                    e.target.value.toUpperCase(),
                                                }
                                              : c
                                          ),
                                      };
                                    }
                                    return r;
                                  })
                                );
                              }}
                              style={{ width: 80 }}
                            />
                            <Input
                              placeholder="关键字"
                              value={cond.keyword}
                              onChange={(e) => {
                                setRules(
                                  rules.map((r) => {
                                    if (r.key === rule.key) {
                                      return {
                                        ...r,
                                        excludeConditions:
                                          r.excludeConditions.map((c) =>
                                            c.key === cond.key
                                              ? {
                                                  ...c,
                                                  keyword: e.target.value,
                                                }
                                              : c
                                          ),
                                      };
                                    }
                                    return r;
                                  })
                                );
                              }}
                              style={{ width: 120 }}
                            />
                            {/* 新增：逻辑关系选择器（最后一个条件不显示） */}
                            {i < rule.excludeConditions.length - 1 && (
                              <Select
                                value={cond.logic}
                                onChange={(v) => {
                                  setRules(
                                    rules.map((r) => {
                                      if (r.key === rule.key) {
                                        return {
                                          ...r,
                                          excludeConditions:
                                            r.excludeConditions.map((c) =>
                                              c.key === cond.key
                                                ? { ...c, logic: v }
                                                : c
                                            ),
                                        };
                                      }
                                      return r;
                                    })
                                  );
                                }}
                                style={{ width: 80 }}
                              >
                                <Option value="AND">且</Option>
                                <Option value="OR">或</Option>
                              </Select>
                            )}
                            <Button
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                removeExcludeCondition(rule.key, cond.key)
                              }
                            />
                          </Space>
                        </Card>
                      ))}
                      <Button
                        type="dashed"
                        size="small"
                        block
                        icon={<PlusOutlined />}
                        onClick={() => addExcludeCondition(rule.key)}
                      >
                        添加筛选条件
                      </Button>
                    </Space>
                  </Panel>
                </Collapse>
              </Space>
            </Card>
          ))}
        </Space>
      </div>
      <ConfigProvider
        button={{
          className: styles.linearGradientButton,
        }}
      >
        <Space orientation="vertical" size={20} style={{ width: "100%" }}>
          <Button
            type="dashed"
            onClick={addRule}
            block
            size="large"
            icon={<PlusOutlined />}
          >
            添加新规则
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={calculate}
            block
            disabled={rules.length === 0}
          >
            计算结果
          </Button>
          {/* 新增：重置按钮 */}
          <Popconfirm
            title="确定要清空所有规则吗？"
            description="此操作不可恢复"
            onConfirm={() => {
              setRules([]);
              // 清空计算值
              onCalculate(0);
              message.success("已清空所有规则");
            }}
            okText="确定清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<ClearOutlined />} style={{ flex: 1 }}>
              重置所有规则
            </Button>
          </Popconfirm>
        </Space>
      </ConfigProvider>
    </Space>
  );
};

export default RuleBuilder;
