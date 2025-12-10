import * as XLSX from "xlsx";
import { message } from "antd";

export interface ExcelFileData {
  id: string;
  name: string;
  sheets: {
    name: string;
    data: any[][]; // 二维数组，data[row][col]
    json: any[]; // 对象数组（可选）
  }[];
}

// 渲染进程直接解析（支持拖拽 + 选择文件）
export const parseExcelWithXLSX = (file: File): Promise<ExcelFileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, {
          type: "array",
          cellText: true,
          cellDates: true,
        });

        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];

          // 转为二维数组（最快方式）
          const data = XLSX.utils.sheet_to_json<any>(worksheet, {
            header: 1, // 以数组形式返回
            defval: null, // 空值用 null
          }) as any[][];

          // 同时生成 json 对象数组（首行作为表头）
          const json = XLSX.utils.sheet_to_json(worksheet, {
            defval: null,
          });

          return { name: sheetName, data, json };
        });

        resolve({
          id: fileId,
          name: file.name,
          sheets,
        });
      } catch (err: any) {
        message.error(`解析失败：${file.name} - ${err.message}`);
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
};

export interface CellRef {
  type: "cell" | "row" | "column" | "custom";
  sheetName: string;
  fileId: string;
  fileName: string;
  ref: string;
  startRow?: number;
  endRow?: number;
  value?: number;
  logic?: "AND" | "OR"; // 与上一个规则的逻辑关系
}

interface ExcludeRule {
  fileId: string;
  sheetName: string;
  excludeColumn: string;
  excludeKeyword: string;
  excludeMode: "exclude" | "include";
  conditionLogic?: "AND" | "OR"; // 与下一个条件的逻辑关系
}

interface RuleWithIndex extends ExcludeRule {
  ruleIndex?: number;
  conditionIndex?: number; // 在同一规则中的条件序号
}

export const evaluateCellRefs = (
  refs: CellRef[],
  filesData: Map<string, ExcelFileData>,
  excludes: ExcludeRule[] = []
): number => {
  let total = 0;

  // 为每个工作表维护两个状态：
  // 1. originalData - 原始数据（用于 OR 规则）
  // 2. andChainData - AND 链的累积处理结果
  const originalSheets = new Map<string, any[][]>();
  const andChainSheets = new Map<string, any[][]>();
  
  // 初始化：为每个使用到的工作表创建数据副本
  refs.forEach((ref) => {
    if (ref.type === "custom") return;
    
    const fileData = filesData.get(ref.fileId);
    if (!fileData) return;
    
    const sheet = fileData.sheets.find((s) => s.name === ref.sheetName);
    if (!sheet || !sheet.data.length) return;
    
    const sheetKey = `${ref.fileId}|${ref.sheetName}`;
    if (!originalSheets.has(sheetKey)) {
      originalSheets.set(sheetKey, [...sheet.data]);
      andChainSheets.set(sheetKey, [...sheet.data]);
    }
  });

  // 逐层处理每个规则
  refs.forEach((ref, index) => {
    if (ref.type === "custom") {
      total += ref.value || 0;
      return;
    }

    const fileData = filesData.get(ref.fileId);
    if (!fileData) return;

    const sheet = fileData.sheets.find((s) => s.name === ref.sheetName);
    if (!sheet || !sheet.data.length) return;

    const sheetKey = `${ref.fileId}|${ref.sheetName}`;
    const logic = ref.logic || "AND"; // 默认 AND
    
    // 获取当前规则的排除条件
    const currentRuleExcludes = (excludes as RuleWithIndex[]).filter(
      (e) => e.fileId === ref.fileId && 
             e.sheetName === ref.sheetName &&
             e.ruleIndex === index
    );
    
    let currentData: any[][];
    
    // 根据逻辑关系选择数据源
    if (index === 0 || logic === "OR") {
      // 第一个规则或 OR 规则：从原始数据开始
      currentData = [...(originalSheets.get(sheetKey) || sheet.data)];
      
      // 应用当前规则的筛选条件
      if (currentRuleExcludes.length > 0) {
        currentData = filterRowsByExcludesWithLogic(currentData, currentRuleExcludes);
      }
      
      // OR 规则处理后，重置 AND 链为当前结果
      andChainSheets.set(sheetKey, currentData);
    } else {
      // AND 规则：从上一个 AND 链的结果继续处理
      currentData = [...(andChainSheets.get(sheetKey) || sheet.data)];
      
      // 应用当前规则的筛选条件（逐层累积）
      if (currentRuleExcludes.length > 0) {
        currentData = filterRowsByExcludesWithLogic(currentData, currentRuleExcludes);
      }
      
      // 更新 AND 链的结果
      andChainSheets.set(sheetKey, currentData);
    }

    // 基于当前数据计算
    if (ref.type === "cell" && ref.ref.match(/^[A-Z]+\d+$/i)) {
      const { row, col } = XLSX.utils.decode_cell(ref.ref.toUpperCase());
      total += parseNumber(currentData[row]?.[col]);
    } else if (ref.type === "row" && /^\d+$/.test(ref.ref)) {
      const rowIdx = parseInt(ref.ref) - 1;
      currentData[rowIdx]?.forEach((v) => (total += parseNumber(v)));
    } else if (ref.type === "column" && ref.ref.match(/^[A-Z]+$/i)) {
      const colIdx = XLSX.utils.decode_col(ref.ref.toUpperCase());
      const start = (ref.startRow ?? 1) - 1;
      let end = ref.endRow ? ref.endRow - 1 : findLastNonEmptyRow(currentData, colIdx);

      for (let r = start; r <= end; r++) {
        total += parseNumber(currentData[r]?.[colIdx]);
      }
    }
  });

  return total;
};

// 排除/筛选行（支持 AND/OR 逻辑组合）
const filterRowsByExcludesWithLogic = (
  data: any[][],
  excludes: RuleWithIndex[]
): any[][] => {
  if (excludes.length === 0) return data;

  // 按规则索引分组，每个规则的条件在组内按 AND/OR 处理
  const groupedByRule = new Map<number, RuleWithIndex[]>();
  excludes.forEach((ex) => {
    const ruleIdx = ex.ruleIndex ?? 0;
    if (!groupedByRule.has(ruleIdx)) {
      groupedByRule.set(ruleIdx, []);
    }
    groupedByRule.get(ruleIdx)!.push(ex);
  });

  // 逐规则累积过滤
  let filtered = [...data];
  const sortedRuleIndices = Array.from(groupedByRule.keys()).sort((a, b) => a - b);

  sortedRuleIndices.forEach((ruleIdx) => {
    const conditions = groupedByRule.get(ruleIdx)!;
    filtered = applyConditionsToRows(filtered, conditions);
  });

  return filtered;
};

// 对一组条件应用 AND/OR 逻辑
const applyConditionsToRows = (
  data: any[][],
  conditions: RuleWithIndex[]
): any[][] => {
  if (conditions.length === 0) return data;

  return data.filter((row) => {
    // 计算每个条件的结果
    const results = conditions.map((cond) => {
      const colIdx = XLSX.utils.decode_col(cond.excludeColumn.toUpperCase());
      const cellVal = String(row[colIdx] ?? "").toLowerCase();
      const keyword = cond.excludeKeyword.toLowerCase();
      const matches = cellVal.includes(keyword);
      
      // exclude 模式：匹配则排除（返回 false），不匹配则保留（返回 true）
      // include 模式：匹配则保留（返回 true），不匹配则排除（返回 false）
      return cond.excludeMode === "include" ? matches : !matches;
    });

    // 根据逻辑关系计算最终结果
    let finalResult = results[0];
    for (let i = 1; i < results.length; i++) {
      const logic = conditions[i - 1].conditionLogic || "AND";
      if (logic === "AND") {
        finalResult = finalResult && results[i];
      } else {
        finalResult = finalResult || results[i];
      }
    }

    return finalResult;
  });
};

// 找列最后非空行
const findLastNonEmptyRow = (data: any[][], colIdx: number): number => {
  for (let r = data.length - 1; r >= 0; r--) {
    if (data[r]?.[colIdx] != null && data[r][colIdx] !== "") return r;
  }
  return data.length - 1; // 如果全空，默认到最后
};

const parseNumber = (val: any): number => {
  if (typeof val === "number") return val;
  const num = parseFloat(String(val || "0").replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? 0 : num;
};
