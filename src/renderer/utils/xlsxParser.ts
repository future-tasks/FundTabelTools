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
}

interface ExcludeRule {
  fileId: string;
  sheetName: string;
  excludeColumn: string;
  excludeKeyword: string;
  excludeMode: "exclude" | "include";
}

interface RuleWithIndex extends ExcludeRule {
  ruleIndex?: number;
}

export const evaluateCellRefs = (
  refs: CellRef[],
  filesData: Map<string, ExcelFileData>,
  excludes: ExcludeRule[] = []
): number => {
  let total = 0;

  // 创建工作表数据的副本用于逐层处理
  const processedSheets = new Map<string, any[][]>();
  
  // 初始化：为每个使用到的工作表创建数据副本
  refs.forEach((ref) => {
    if (ref.type === "custom") return;
    
    const fileData = filesData.get(ref.fileId);
    if (!fileData) return;
    
    const sheet = fileData.sheets.find((s) => s.name === ref.sheetName);
    if (!sheet || !sheet.data.length) return;
    
    const sheetKey = `${ref.fileId}|${ref.sheetName}`;
    if (!processedSheets.has(sheetKey)) {
      processedSheets.set(sheetKey, [...sheet.data]);
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
    let currentData = processedSheets.get(sheetKey);
    if (!currentData) return;

    // 应用当前规则以及之前所有规则的排除条件（累积效果）
    const cumulativeExcludes = (excludes as RuleWithIndex[]).filter(
      (e) => e.fileId === ref.fileId && 
             e.sheetName === ref.sheetName &&
             (e.ruleIndex === undefined || e.ruleIndex <= index)
    );
    
    if (cumulativeExcludes.length > 0) {
      // 从原始数据开始应用累积的排除条件
      const originalSheet = fileData.sheets.find((s) => s.name === ref.sheetName);
      if (originalSheet) {
        currentData = [...originalSheet.data];
        currentData = filterRowsByExcludes(currentData, cumulativeExcludes);
        // 更新处理后的数据，供后续规则使用
        processedSheets.set(sheetKey, currentData);
      }
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

// 排除/筛选行
const filterRowsByExcludes = (
  data: any[][],
  excludes: ExcludeRule[]
): any[][] => {
  let filtered = [...data];

  excludes.forEach((ex) => {
    const colIdx = XLSX.utils.decode_col(ex.excludeColumn.toUpperCase());
    const keyword = ex.excludeKeyword.toLowerCase();

    filtered = filtered.filter((row) => {
      const cellVal = String(row[colIdx] ?? "").toLowerCase();
      const matches = cellVal.includes(keyword);
      return ex.excludeMode === "include" ? matches : !matches;
    });
  });

  return filtered;
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
