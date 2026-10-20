'use client';
import React, {useState, useMemo, useRef, useEffect, useCallback} from 'react';
import Link from 'next/link';

export type SpreadsheetDataType = 'text' | 'code' | 'phone' | 'number' | 'money' | 'date' | 'status' | 'boolean';

export interface SpreadsheetColumn<T = Record<string, unknown>> {
 key: string;
 label: string;
 type?: SpreadsheetDataType;
 width?: number;
 minWidth?: number;
 align?: 'left' | 'center' | 'right';
 sticky?: boolean;
 sortable?: boolean;
 filterable?: boolean;
 groupable?: boolean;
 editable?: boolean | ((row: T) => boolean);
 editorType?: 'text' | 'number' | 'date' | 'select' | 'boolean';
 editorOptions?: {value: string; label: string}[];
 unitGroup?: string; // e.g. 'VND', 'BASE_QTY', etc. - prevents summing incompatible units
 summable?: boolean;
 /** Extract raw string/number value for sorting, filtering, copying, editing, and summing */
 getValue?: (row: T) => string | number | boolean | null | undefined;
 /** Custom cell renderer */
 renderCell?: (row: T, context: {isSelected: boolean; isActive: boolean; dirtyValue: unknown; openDrawer: () => void}) => React.ReactNode;
 /** Validate a new cell value before commit */
 validate?: (value: string, row: T) => string | null;
}

export interface DatasetSummaryItem {
 label: string;
 value: string;
 unit?: string;
 tone?: 'default' | 'accent' | 'positive' | 'warning' | 'danger';
}

export interface SheetTab {
 key: string;
 label: string;
 count?: number | string;
 badgeTone?: 'default' | 'warning' | 'danger' | 'positive';
}

export interface CrmSpreadsheetProps<T> {
 sheetKey: string;
 title?: string;
 subtitle?: string;
 columns: SpreadsheetColumn<T>[];
 rows: T[];
 getRowKey: (row: T, index: number) => string;
 getRowVersion?: (row: T) => number;
 /** Optional tabs for switching related sheets in the same module */
 tabs?: SheetTab[];
 activeTab?: string;
 onTabChange?: (tabKey: string) => void;
 /** Optional right-side drawer renderer when a row is inspected */
 renderDrawer?: (row: T, close: () => void) => React.ReactNode;
 drawerTitle?: (row: T) => string;
 drawerFullPageHref?: (row: T) => string;
 /** Optional initial inspected row key */
 initialInspectedKey?: string | null;
 /** Optional dataset-wide totals from backend query (distinguished from current page sum) */
 datasetTotals?: DatasetSummaryItem[];
 totalDatasetCount?: number;
 /** Optional batch save endpoint or callback for inline cell editing & Excel paste */
 batchSaveEndpoint?: '/api/crm/spreadsheet/partner-cells' | '/api/crm/spreadsheet/catalog-cells';
 onBatchSaveCustom?: (patches: {id: string; version: number; changes: Record<string, unknown>}[], preview: boolean) => Promise<{
  preview: boolean;
  total: number;
  validCount: number;
  errorCount: number;
  results: {id: string; ok: boolean; error?: string; nextVersion?: number}[];
 }>;
 /** Optional toolbar extra actions (e.g. + Thêm mới, Xuất file, Thao tác hàng loạt) */
 toolbarActions?: React.ReactNode;
 /** Optional bulk action bar when rows are checked */
 renderBulkActions?: (selectedRows: T[], clearSelection: () => void) => React.ReactNode;
 /** Optional default density */
 defaultDensity?: 'compact' | 'comfortable';
 /** Optional controlled column keys/widths for compatibility with server-saved partner preferences */
 controlledVisibleKeys?: string[];
 controlledColumnWidths?: Record<string, number>;
 emptyMessage?: string;
 searchPlaceholder?: string;
 hideToolbar?: boolean;
 hideFooterSums?: boolean;
}

interface CellPos {
 rowIdx: number;
 colIdx: number;
}

interface SortSpec {
 key: string;
 dir: 'asc' | 'desc';
}

interface ColumnFilterValue {
 text?: string;
 min?: string;
 max?: string;
 from?: string;
 to?: string;
 mode?: 'ALL' | 'BLANK' | 'NOT_BLANK';
}

interface SavedLocalView {
 id: string;
 name: string;
 shared: boolean;
 visibleKeys: string[];
 widths: Record<string, number>;
 density: 'compact' | 'comfortable';
 sorts: SortSpec[];
 groupBy: string;
}

function formatNum(n: number, isMoney = false): string {
 if (!Number.isFinite(n)) return '0';
 const formatted = new Intl.NumberFormat('vi-VN', {maximumFractionDigits: isMoney ? 0 : 2}).format(n);
 return isMoney ? `${formatted} ₫` : formatted;
}

function parseNumeric(val: unknown): number | null {
 if (val === null || val === undefined || val === '') return null;
 if (typeof val === 'number') return Number.isFinite(val) ? val : null;
 const cleaned = String(val).replace(/[^\d.-]/g, '');
 if (!cleaned || cleaned === '-' || cleaned === '.') return null;
 const num = Number(cleaned);
 return Number.isFinite(num) ? num : null;
}

export function CrmSpreadsheet<T>({
 sheetKey,
 title,
 subtitle,
 columns,
 rows,
 getRowKey,
 getRowVersion,
 tabs,
 activeTab,
 onTabChange,
 renderDrawer,
 drawerTitle,
 drawerFullPageHref,
 initialInspectedKey = null,
 datasetTotals,
 totalDatasetCount,
 batchSaveEndpoint,
 onBatchSaveCustom,
 toolbarActions,
 renderBulkActions,
 defaultDensity = 'compact',
 controlledVisibleKeys,
 controlledColumnWidths,
 emptyMessage = 'Không có bản ghi nào khớp điều kiện lọc hiện tại.',
 searchPlaceholder = 'Tìm nhanh trên bảng (Mã, tên, SĐT, SKU, trạng thái...) — Phím tắt /',
 hideToolbar = false,
 hideFooterSums = false,
}: CrmSpreadsheetProps<T>) {
 const storageKey = `cohamy_crm_sheet_v1_${sheetKey}`;

 // Column order, visibility, widths, density
 const [colOrder, setColOrder] = useState<string[]>(() => {
  const defaultOrder = columns.map(c => c.key);
  if (controlledVisibleKeys && controlledVisibleKeys.length > 0) {
   const rest = defaultOrder.filter(k => !controlledVisibleKeys.includes(k));
   return [...controlledVisibleKeys, ...rest];
  }
  return defaultOrder;
 });
 const [visibleKeys, setVisibleKeys] = useState<string[]>(() => controlledVisibleKeys ?? columns.map(c => c.key));
 const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
  const initial: Record<string, number> = {};
  for (const c of columns) {
   initial[c.key] = controlledColumnWidths?.[c.key] ?? c.width ?? (c.type === 'money' || c.type === 'number' ? 128 : c.type === 'code' ? 148 : 180);
  }
  return initial;
 });
 const [density, setDensity] = useState<'compact' | 'comfortable'>(defaultDensity);
 const [quickSearch, setQuickSearch] = useState('');
 const [showFilterRow, setShowFilterRow] = useState(false);
 const [colFilters, setColFilters] = useState<Record<string, ColumnFilterValue>>({});
 const [sorts, setSorts] = useState<SortSpec[]>([]);
 const [groupBy, setGroupBy] = useState<string>('');
 const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
 const [savedViews, setSavedViews] = useState<SavedLocalView[]>([]);
 const [newViewName, setNewViewName] = useState('');
 const [newViewShared, setNewViewShared] = useState(false);
 const [showColManager, setShowColManager] = useState(false);

 const persistPrefs = useCallback(
  (next: {
   colOrder?: string[];
   visibleKeys?: string[];
   colWidths?: Record<string, number>;
   density?: 'compact' | 'comfortable';
   savedViews?: SavedLocalView[];
  }) => {
   try {
    const current = {
     colOrder: next.colOrder ?? colOrder,
     visibleKeys: next.visibleKeys ?? visibleKeys,
     colWidths: next.colWidths ?? colWidths,
     density: next.density ?? density,
     savedViews: next.savedViews ?? savedViews,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(current));
   } catch {
    // ignore
   }
  },
  [storageKey, colOrder, visibleKeys, colWidths, density, savedViews]
 );

 // Ordered visible columns
 const activeColumns = useMemo(() => {
  const byKey = new Map(columns.map(c => [c.key, c]));
  const ordered: SpreadsheetColumn<T>[] = [];
  for (const k of colOrder) {
   if (visibleKeys.includes(k) && byKey.has(k)) {
    ordered.push(byKey.get(k)!);
   }
  }
  for (const c of columns) {
   if (visibleKeys.includes(c.key) && !ordered.some(o => o.key === c.key)) {
    ordered.push(c);
   }
  }
  return ordered.length ? ordered : columns.slice(0, 1);
 }, [columns, colOrder, visibleKeys]);

 // Sticky left offsets for pinned columns
 const stickyOffsets = useMemo(() => {
  const offsets: Record<string, number> = {};
  let left = 36; // after checkbox column (36px)
  for (const col of activeColumns) {
   if (col.sticky) {
    offsets[col.key] = left;
    left += colWidths[col.key] ?? col.width ?? 160;
   }
  }
  return offsets;
 }, [activeColumns, colWidths]);

 // Dirty cells & Undo/Redo stack
 const [dirtyMap, setDirtyMap] = useState<Record<string, Record<string, string>>>({});
 const [undoStack, setUndoStack] = useState<Record<string, Record<string, string>>[]>([]);
 const [redoStack, setRedoStack] = useState<Record<string, Record<string, string>>[]>([]);
 const [cellErrors, setCellErrors] = useState<Record<string, Record<string, string>>>({});
 const [rowVersions, setRowVersions] = useState<Record<string, number>>({});
 const [saveStatus, setSaveStatus] = useState<'IDLE' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE');
 const [saveMessage, setSaveMessage] = useState('');

 // Paste Preview Modal State
 const [pastePreview, setPastePreview] = useState<{
  open: boolean;
  items: {
   rowKey: string;
   rowLabel: string;
   colKey: string;
   colLabel: string;
   before: string;
   after: string;
   valid: boolean;
   error: string | null;
  }[];
  checkingServer: boolean;
 } | null>(null);

 const dirtyRowCount = Object.keys(dirtyMap).length;

 // Warn before leaving when dirty
 useEffect(() => {
  if (dirtyRowCount === 0) return;
  const handler = (e: BeforeUnloadEvent) => {
   e.preventDefault();
   e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
 }, [dirtyRowCount]);

 // Helper to read raw cell value
 const readCellRaw = useCallback(
  (row: T, col: SpreadsheetColumn<T>, rKey?: string): string => {
   const key = rKey ?? getRowKey(row, 0);
   if (dirtyMap[key] && col.key in dirtyMap[key]) {
    return dirtyMap[key][col.key];
   }
   if (col.getValue) {
    const v = col.getValue(row);
    return v === null || v === undefined ? '' : String(v);
   }
   const raw = (row as Record<string, unknown>)[col.key];
   if (raw === null || raw === undefined) return '';
   if (typeof raw === 'boolean') return raw ? 'Đang hoạt động' : 'Ngừng';
   return String(raw);
  },
  [dirtyMap, getRowKey]
 );

 // Filter & sort rows
 const processedRows = useMemo(() => {
  const q = quickSearch.trim().toLowerCase();
  let list = rows.filter((row, idx) => {
   const rKey = getRowKey(row, idx);
   if (q) {
    const matchAny = columns.some(col => readCellRaw(row, col, rKey).toLowerCase().includes(q));
    if (!matchAny) return false;
   }
   for (const col of columns) {
    const f = colFilters[col.key];
    if (!f) continue;
    const raw = readCellRaw(row, col, rKey).trim();
    if (f.mode === 'BLANK' && raw !== '') return false;
    if (f.mode === 'NOT_BLANK' && raw === '') return false;
    if (f.text && !raw.toLowerCase().includes(f.text.trim().toLowerCase())) return false;
    if (f.min !== undefined && f.min !== '') {
     const num = parseNumeric(raw);
     const minNum = parseNumeric(f.min);
     if (minNum !== null && (num === null || num < minNum)) return false;
    }
    if (f.max !== undefined && f.max !== '') {
     const num = parseNumeric(raw);
     const maxNum = parseNumeric(f.max);
     if (maxNum !== null && (num === null || num > maxNum)) return false;
    }
    if (f.from && raw.slice(0, 10) < f.from) return false;
    if (f.to && raw.slice(0, 10) > f.to) return false;
   }
   return true;
  });

  if (sorts.length > 0) {
   const colMap = new Map(columns.map(c => [c.key, c]));
   list = [...list].sort((a, b) => {
    for (const s of sorts) {
     const col = colMap.get(s.key);
     if (!col) continue;
     const va = readCellRaw(a, col);
     const vb = readCellRaw(b, col);
     let cmp = 0;
     if (col.type === 'number' || col.type === 'money') {
      const na = parseNumeric(va) ?? -Infinity;
      const nb = parseNumeric(vb) ?? -Infinity;
      cmp = na === nb ? 0 : na < nb ? -1 : 1;
     } else {
      cmp = va.localeCompare(vb, 'vi', {numeric: true, sensitivity: 'base'});
     }
     if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
   });
  }
  return list;
 }, [rows, columns, quickSearch, colFilters, sorts, getRowKey, readCellRaw]);

 // Selection state: active cell, range end cell, checked row keys
 const [activeCell, setActiveCell] = useState<CellPos | null>(null);
 const [rangeEndCell, setRangeEndCell] = useState<CellPos | null>(null);
 const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
 const [editingCell, setEditingCell] = useState<CellPos | null>(null);
 const [editingValue, setEditingValue] = useState<string>('');
 const [inspectedKey, setInspectedKey] = useState<string | null>(initialInspectedKey);

 const viewportRef = useRef<HTMLDivElement | null>(null);
 const searchInputRef = useRef<HTMLInputElement | null>(null);

 // Normalized 2D cell range
 const selectionBounds = useMemo(() => {
  if (!activeCell) return null;
  const end = rangeEndCell ?? activeCell;
  return {
   r1: Math.min(activeCell.rowIdx, end.rowIdx),
   r2: Math.max(activeCell.rowIdx, end.rowIdx),
   c1: Math.min(activeCell.colIdx, end.colIdx),
   c2: Math.max(activeCell.colIdx, end.colIdx),
  };
 }, [activeCell, rangeEndCell]);

 const isCellEditable = useCallback((row: T, col: SpreadsheetColumn<T>) => {
  if (!col.editable) return false;
  return typeof col.editable === 'function' ? col.editable(row) : col.editable;
 }, []);

 // Apply a cell edit into dirtyMap with undo support
 const applyCellChanges = useCallback(
  (patches: {rowKey: string; colKey: string; value: string; row: T; col: SpreadsheetColumn<T>}[]) => {
   if (!patches.length) return;
   setUndoStack(prev => [...prev.slice(-30), dirtyMap]);
   setRedoStack([]);
   const nextDirty: Record<string, Record<string, string>> = {...dirtyMap};
   const nextErrors: Record<string, Record<string, string>> = {...cellErrors};

   for (const p of patches) {
    const err = p.col.validate ? p.col.validate(p.value, p.row) : null;
    nextDirty[p.rowKey] = {...(nextDirty[p.rowKey] ?? {}), [p.colKey]: p.value};
    if (err) {
     nextErrors[p.rowKey] = {...(nextErrors[p.rowKey] ?? {}), [p.colKey]: err};
    } else if (nextErrors[p.rowKey]) {
     const copy = {...nextErrors[p.rowKey]};
     delete copy[p.colKey];
     if (Object.keys(copy).length === 0) delete nextErrors[p.rowKey];
     else nextErrors[p.rowKey] = copy;
    }
   }
   setDirtyMap(nextDirty);
   setCellErrors(nextErrors);
   setSaveStatus('DIRTY');
   setSaveMessage('Có thay đổi chưa lưu trên bảng tính.');
  },
  [dirtyMap, cellErrors]
 );

 const startEditing = useCallback(
  (pos: CellPos) => {
   const row = processedRows[pos.rowIdx];
   const col = activeColumns[pos.colIdx];
   if (!row || !col || !isCellEditable(row, col)) return;
   const rKey = getRowKey(row, pos.rowIdx);
   setEditingCell(pos);
   setEditingValue(readCellRaw(row, col, rKey));
  },
  [processedRows, activeColumns, isCellEditable, getRowKey, readCellRaw]
 );

 const commitEditing = useCallback(() => {
  if (!editingCell) return;
  const row = processedRows[editingCell.rowIdx];
  const col = activeColumns[editingCell.colIdx];
  if (row && col && isCellEditable(row, col)) {
   const rKey = getRowKey(row, editingCell.rowIdx);
   const currentVal = readCellRaw(row, col, rKey);
   if (editingValue !== currentVal) {
    applyCellChanges([{rowKey: rKey, colKey: col.key, value: editingValue, row, col}]);
   }
  }
  setEditingCell(null);
 }, [editingCell, processedRows, activeColumns, isCellEditable, getRowKey, readCellRaw, editingValue, applyCellChanges]);

 const handleUndo = useCallback(() => {
  if (undoStack.length === 0) return;
  const prev = undoStack[undoStack.length - 1];
  setRedoStack(r => [...r, dirtyMap]);
  setUndoStack(u => u.slice(0, -1));
  setDirtyMap(prev);
  setSaveStatus(Object.keys(prev).length > 0 ? 'DIRTY' : 'IDLE');
 }, [undoStack, dirtyMap]);

 const handleRedo = useCallback(() => {
  if (redoStack.length === 0) return;
  const next = redoStack[redoStack.length - 1];
  setUndoStack(u => [...u, dirtyMap]);
  setRedoStack(r => r.slice(0, -1));
  setDirtyMap(next);
  setSaveStatus(Object.keys(next).length > 0 ? 'DIRTY' : 'IDLE');
 }, [redoStack, dirtyMap]);

 // Copy selection to clipboard as TSV (Excel-compatible)
 const copySelectionToClipboard = useCallback(async () => {
  let tsv = '';
  if (selectionBounds) {
   const lines: string[] = [];
   for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
    const row = processedRows[r];
    if (!row) continue;
    const rKey = getRowKey(row, r);
    const cells: string[] = [];
    for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
     const col = activeColumns[c];
     if (!col) continue;
     cells.push(readCellRaw(row, col, rKey).replace(/[\t\r\n]+/g, ' '));
    }
    lines.push(cells.join('\t'));
   }
   tsv = lines.join('\n');
  } else if (checkedKeys.size > 0) {
   const header = activeColumns.map(c => c.label).join('\t');
   const lines = [header];
   processedRows.forEach((row, idx) => {
    const rKey = getRowKey(row, idx);
    if (!checkedKeys.has(rKey)) return;
    lines.push(activeColumns.map(col => readCellRaw(row, col, rKey).replace(/[\t\r\n]+/g, ' ')).join('\t'));
   });
   tsv = lines.join('\n');
  }
  if (!tsv) return;
  try {
   await navigator.clipboard.writeText(tsv);
   setSaveMessage('Đã sao chép vùng chọn (định dạng bảng tính Excel TSV).');
  } catch {
   // ignore
  }
 }, [selectionBounds, checkedKeys, processedRows, activeColumns, getRowKey, readCellRaw]);

 // Parse pasted TSV text into preview modal without writing immediately
 const handlePasteText = useCallback(
  (rawText: string) => {
   if (!rawText || !activeCell) return;
   const rawRows = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''));
   if (rawRows.length === 0) return;

   const items: NonNullable<typeof pastePreview>['items'] = [];
   for (let rOffset = 0; rOffset < rawRows.length; rOffset++) {
    const targetRowIdx = activeCell.rowIdx + rOffset;
    const row = processedRows[targetRowIdx];
    if (!row) continue;
    const rKey = getRowKey(row, targetRowIdx);
    const firstColVal = readCellRaw(row, activeColumns[0], rKey) || `#${targetRowIdx + 1}`;
    const cols = rawRows[rOffset].split('\t');

    for (let cOffset = 0; cOffset < cols.length; cOffset++) {
     const targetColIdx = activeCell.colIdx + cOffset;
     const col = activeColumns[targetColIdx];
     if (!col) continue;
     const pastedVal = cols[cOffset].trim();
     const beforeVal = readCellRaw(row, col, rKey);
     const editable = isCellEditable(row, col);
     let error: string | null = null;
     if (!editable) {
      error = 'Cột chỉ đọc hoặc bạn không có quyền sửa trường này.';
     } else if (col.validate) {
      error = col.validate(pastedVal, row);
     } else if ((col.type === 'number' || col.type === 'money') && pastedVal !== '' && parseNumeric(pastedVal) === null) {
      error = 'Giá trị phải là chữ số hợp lệ.';
     } else if (col.type === 'date' && pastedVal !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(pastedVal)) {
      error = 'Ngày phải có định dạng YYYY-MM-DD.';
     }
     items.push({
      rowKey: rKey,
      rowLabel: firstColVal,
      colKey: col.key,
      colLabel: col.label,
      before: beforeVal,
      after: pastedVal,
      valid: error === null,
      error,
     });
    }
   }

   if (items.length > 0) {
    setPastePreview({open: true, items, checkingServer: false});
   }
  },
  [activeCell, processedRows, activeColumns, getRowKey, readCellRaw, isCellEditable]
 );

 const applyPastePreviewToSheet = useCallback(() => {
  if (!pastePreview) return;
  const validPatches: {rowKey: string; colKey: string; value: string; row: T; col: SpreadsheetColumn<T>}[] = [];
  const rowByKey = new Map<string, T>();
  processedRows.forEach((r, idx) => rowByKey.set(getRowKey(r, idx), r));
  const colByKey = new Map(columns.map(c => [c.key, c]));

  for (const item of pastePreview.items) {
   if (!item.valid) continue;
   const row = rowByKey.get(item.rowKey);
   const col = colByKey.get(item.colKey);
   if (row && col) {
    validPatches.push({rowKey: item.rowKey, colKey: item.colKey, value: item.after, row, col});
   }
  }
  applyCellChanges(validPatches);
  setPastePreview(null);
 }, [pastePreview, processedRows, columns, getRowKey, applyCellChanges]);

 // Save all dirty cells to backend API
 const saveDirtyCells = useCallback(
  async (previewOnly = false) => {
   if (dirtyRowCount === 0) return;
   if (!batchSaveEndpoint && !onBatchSaveCustom) return;

   // Check client validation errors first
   const hasClientError = Object.keys(cellErrors).length > 0;
   if (hasClientError && !previewOnly) {
    setSaveStatus('ERROR');
    setSaveMessage('Vui lòng sửa các ô báo lỗi đỏ trước khi lưu.');
    return;
   }

   const rowByKey = new Map<string, T>();
   rows.forEach((r, i) => rowByKey.set(getRowKey(r, i), r));

   const patches: {id: string; version: number; changes: Record<string, unknown>}[] = [];
   for (const [rKey, changesObj] of Object.entries(dirtyMap)) {
    const row = rowByKey.get(rKey);
    if (!row) continue;
    const ver = rowVersions[rKey] ?? (getRowVersion ? getRowVersion(row) : Number((row as Record<string, unknown>).version ?? 1));
    const typedChanges: Record<string, unknown> = {};
    for (const [colKey, strVal] of Object.entries(changesObj)) {
     const col = columns.find(c => c.key === colKey);
     if (col?.editorType === 'boolean' || col?.type === 'boolean') {
      typedChanges[colKey] = strVal === 'true' || strVal === '1' || strVal.toLowerCase() === 'đang hoạt động';
     } else if (colKey === 'units_per_case') {
      typedChanges[colKey] = strVal === '' ? null : Number(strVal);
     } else {
      typedChanges[colKey] = strVal;
     }
    }
    patches.push({id: rKey, version: ver, changes: typedChanges});
   }

   setSaveStatus('SAVING');
   setSaveMessage(previewOnly ? 'Đang kiểm tra dữ liệu và xung đột phiên bản...' : 'Đang ghi các thay đổi...');

   try {
    let data: {
     preview: boolean;
     total: number;
     validCount: number;
     errorCount: number;
     results: {id: string; ok: boolean; error?: string; nextVersion?: number}[];
    };
    if (onBatchSaveCustom) {
     data = await onBatchSaveCustom(patches, previewOnly);
    } else {
     const res = await fetch(batchSaveEndpoint!, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
       preview: previewOnly,
       rows: patches,
       reason: 'Cập nhật trực tiếp trên bảng tính CRM Cohamy',
      }),
     });
     if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {error?: string};
      throw new Error(errBody.error ?? 'SAVE_FAILED');
     }
     data = await res.json();
    }

    const nextErrs: Record<string, Record<string, string>> = {...cellErrors};
    const nextDirty: Record<string, Record<string, string>> = {...dirtyMap};
    const nextVers: Record<string, number> = {...rowVersions};

    for (const item of data.results) {
     if (!item.ok) {
      const colsChanged = Object.keys(dirtyMap[item.id] ?? {});
      const firstCol = colsChanged[0] ?? activeColumns[0]?.key ?? 'name';
      nextErrs[item.id] = {...(nextErrs[item.id] ?? {}), [firstCol]: item.error ?? 'Lỗi khi lưu dòng này'};
     } else if (!previewOnly) {
      delete nextDirty[item.id];
      delete nextErrs[item.id];
      if (item.nextVersion) nextVers[item.id] = item.nextVersion;
     }
    }

    setCellErrors(nextErrs);
    setRowVersions(nextVers);

    if (previewOnly) {
     setSaveStatus(data.errorCount > 0 ? 'ERROR' : 'DIRTY');
     setSaveMessage(
      data.errorCount > 0
       ? `Kiểm tra trước khi lưu: ${data.validCount} dòng hợp lệ, ${data.errorCount} dòng báo lỗi.`
       : `Kiểm tra hợp lệ toàn bộ ${data.validCount} dòng. Bấm "Lưu thay đổi" để ghi sổ.`
     );
    } else {
     setDirtyMap(nextDirty);
     if (data.errorCount > 0) {
      setSaveStatus('ERROR');
      setSaveMessage(`Đã lưu ${data.validCount} dòng; còn ${data.errorCount} dòng lỗi được giữ nguyên để bạn sửa.`);
     } else {
      setSaveStatus('SAVED');
      setSaveMessage(`Đã lưu thành công ${data.validCount} dòng.`);
     }
    }
   } catch (e) {
    setSaveStatus('ERROR');
    setSaveMessage(`Không thể lưu (${e instanceof Error ? e.message : 'Lỗi kết nối'}). Dữ liệu vừa nhập vẫn được giữ nguyên.`);
   }
  },
  [dirtyRowCount, batchSaveEndpoint, onBatchSaveCustom, cellErrors, rows, getRowKey, dirtyMap, rowVersions, getRowVersion, columns, activeColumns]
 );

 // Keyboard handler on the spreadsheet viewport
 const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  if (editingCell) {
   if (e.key === 'Escape') {
    e.preventDefault();
    setEditingCell(null);
   } else if (e.key === 'Enter') {
    e.preventDefault();
    commitEditing();
    if (activeCell && activeCell.rowIdx + 1 < processedRows.length) {
     const next = {rowIdx: activeCell.rowIdx + 1, colIdx: activeCell.colIdx};
     setActiveCell(next);
     setRangeEndCell(next);
    }
   } else if (e.key === 'Tab') {
    e.preventDefault();
    commitEditing();
    if (activeCell) {
     const delta = e.shiftKey ? -1 : 1;
     const nextCol = Math.max(0, Math.min(activeColumns.length - 1, activeCell.colIdx + delta));
     const next = {rowIdx: activeCell.rowIdx, colIdx: nextCol};
     setActiveCell(next);
     setRangeEndCell(next);
    }
   }
   return;
  }

  // Undo / Redo / Copyshortcuts when not editing an input
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
   e.preventDefault();
   if (e.shiftKey) handleRedo();
   else handleUndo();
   return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
   e.preventDefault();
   handleRedo();
   return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
   if (window.getSelection()?.toString()) return;
   e.preventDefault();
   void copySelectionToClipboard();
   return;
  }

  if (!activeCell) return;
  const maxRow = Math.max(0, processedRows.length - 1);
  const maxCol = Math.max(0, activeColumns.length - 1);

  if (e.key === 'ArrowDown') {
   e.preventDefault();
   const base = e.shiftKey ? (rangeEndCell ?? activeCell) : activeCell;
   const next = {rowIdx: Math.min(maxRow, base.rowIdx + 1), colIdx: base.colIdx};
   if (e.shiftKey) setRangeEndCell(next);
   else {
    setActiveCell(next);
    setRangeEndCell(next);
   }
  } else if (e.key === 'ArrowUp') {
   e.preventDefault();
   const base = e.shiftKey ? (rangeEndCell ?? activeCell) : activeCell;
   const next = {rowIdx: Math.max(0, base.rowIdx - 1), colIdx: base.colIdx};
   if (e.shiftKey) setRangeEndCell(next);
   else {
    setActiveCell(next);
    setRangeEndCell(next);
   }
  } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
   e.preventDefault();
   const base = e.shiftKey && e.key === 'ArrowRight' ? (rangeEndCell ?? activeCell) : activeCell;
   const next = {rowIdx: base.rowIdx, colIdx: Math.min(maxCol, base.colIdx + 1)};
   if (e.shiftKey && e.key === 'ArrowRight') setRangeEndCell(next);
   else {
    setActiveCell(next);
    setRangeEndCell(next);
   }
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
   e.preventDefault();
   const base = e.shiftKey && e.key === 'ArrowLeft' ? (rangeEndCell ?? activeCell) : activeCell;
   const next = {rowIdx: base.rowIdx, colIdx: Math.max(0, base.colIdx - 1)};
   if (e.shiftKey && e.key === 'ArrowLeft') setRangeEndCell(next);
   else {
    setActiveCell(next);
    setRangeEndCell(next);
   }
  } else if (e.key === 'Enter' || e.key === 'F2') {
   const row = processedRows[activeCell.rowIdx];
   const col = activeColumns[activeCell.colIdx];
   if (row && col && isCellEditable(row, col)) {
    e.preventDefault();
    startEditing(activeCell);
   } else if (row && renderDrawer && e.key === 'Enter') {
    e.preventDefault();
    setInspectedKey(getRowKey(row, activeCell.rowIdx));
   }
  } else if (e.key === ' ' && renderDrawer) {
   const row = processedRows[activeCell.rowIdx];
   if (row) {
    e.preventDefault();
    setInspectedKey(getRowKey(row, activeCell.rowIdx));
   }
  }
 };

 // Column drag-resize handler
 const startColResize = (e: React.MouseEvent, colKey: string) => {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startW = colWidths[colKey] ?? 160;
  const onMove = (moveEvent: MouseEvent) => {
   const nextW = Math.max(76, Math.min(640, startW + (moveEvent.clientX - startX)));
   setColWidths(prev => {
    const updated = {...prev, [colKey]: nextW};
    persistPrefs({colWidths: updated});
    return updated;
   });
  };
  const onUp = () => {
   window.removeEventListener('mousemove', onMove);
   window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
 };

 // Toggle sort on column header click
 const toggleSort = (colKey: string, multi: boolean) => {
  setSorts(prev => {
   const existingIdx = prev.findIndex(s => s.key === colKey);
   if (!multi) {
    if (existingIdx === -1) return [{key: colKey, dir: 'asc'}];
    if (prev[existingIdx].dir === 'asc') return [{key: colKey, dir: 'desc'}];
    return [];
   }
   const copy = [...prev];
   if (existingIdx === -1) {
    copy.push({key: colKey, dir: 'asc'});
   } else if (copy[existingIdx].dir === 'asc') {
    copy[existingIdx] = {key: colKey, dir: 'desc'};
   } else {
    copy.splice(existingIdx, 1);
   }
   return copy;
  });
 };

 // Compute Selection Stats & Visible Table Stats for Footer Summary Bar
 const selectionStats = useMemo(() => {
  if (!selectionBounds) return null;
  const cellCount = (selectionBounds.r2 - selectionBounds.r1 + 1) * (selectionBounds.c2 - selectionBounds.c1 + 1);
  const nums: number[] = [];
  const unitGroups = new Set<string>();
  let isMoney = false;

  for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
   const row = processedRows[r];
   if (!row) continue;
   const rKey = getRowKey(row, r);
   for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
    const col = activeColumns[c];
    if (!col) continue;
    if (col.type === 'money' || col.type === 'number' || col.summable) {
     const n = parseNumeric(readCellRaw(row, col, rKey));
     if (n !== null) {
      nums.push(n);
      unitGroups.add(col.unitGroup ?? (col.type === 'money' ? 'VND' : col.key));
      if (col.type === 'money') isMoney = true;
     }
    }
   }
  }

  if (nums.length === 0) return {cellCount, hasNumeric: false as const};
  const compatible = unitGroups.size === 1;
  const sum = nums.reduce((a, b) => a + b, 0);
  const avg = sum / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return {
   cellCount,
   hasNumeric: true as const,
   numericCount: nums.length,
   compatible,
   isMoney,
   sum,
   avg,
   min,
   max,
  };
 }, [selectionBounds, processedRows, activeColumns, getRowKey, readCellRaw]);

 // Visible Page / Filtered Table Sums for Summable Columns
 const pageColumnSums = useMemo(() => {
  const sums: {key: string; label: string; sum: number; isMoney: boolean}[] = [];
  for (const col of activeColumns) {
   if (col.summable || col.type === 'money' || col.type === 'number') {
    let total = 0;
    let count = 0;
    processedRows.forEach((row, idx) => {
     const n = parseNumeric(readCellRaw(row, col, getRowKey(row, idx)));
     if (n !== null) {
      total += n;
      count++;
     }
    });
    if (count > 0) {
     sums.push({key: col.key, label: col.label, sum: total, isMoney: col.type === 'money'});
    }
   }
  }
  return sums.slice(0, 6);
 }, [activeColumns, processedRows, getRowKey, readCellRaw]);

 // Grouped rows when groupBy is active
 const groupedData = useMemo(() => {
  if (!groupBy) return null;
  const groupCol = columns.find(c => c.key === groupBy);
  if (!groupCol) return null;
  const groups = new Map<string, {row: T; flatIdx: number}[]>();
  processedRows.forEach((row, flatIdx) => {
   const gVal = readCellRaw(row, groupCol, getRowKey(row, flatIdx)).trim() || '(Chưa phân nhóm)';
   const arr = groups.get(gVal) ?? [];
   arr.push({row, flatIdx});
   groups.set(gVal, arr);
  });
  return {groupCol, entries: [...groups.entries()]};
 }, [groupBy, columns, processedRows, getRowKey, readCellRaw]);

 // Selected rows array
 const selectedRows = useMemo(
  () => processedRows.filter((r, idx) => checkedKeys.has(getRowKey(r, idx))),
  [processedRows, checkedKeys, getRowKey]
 );

 // Currently inspected row for the right-side detail drawer
 const inspectedRow = useMemo(() => {
  if (!inspectedKey) return null;
  return rows.find((r, idx) => getRowKey(r, idx) === inspectedKey) ?? null;
 }, [inspectedKey, rows, getRowKey]);

 const saveCurrentView = () => {
  const trimmed = newViewName.trim();
  if (!trimmed) return;
  const view: SavedLocalView = {
   id: `${Date.now()}`,
   name: trimmed,
   shared: newViewShared,
   visibleKeys,
   widths: colWidths,
   density,
   sorts,
   groupBy,
  };
  const next = [...savedViews, view];
  setSavedViews(next);
  persistPrefs({savedViews: next});
  setNewViewName('');
 };

 const applySavedView = (v: SavedLocalView) => {
  setVisibleKeys(v.visibleKeys);
  setColWidths(v.widths);
  setDensity(v.density);
  setSorts(v.sorts);
  setGroupBy(v.groupBy);
  persistPrefs({visibleKeys: v.visibleKeys, colWidths: v.widths, density: v.density});
 };

 return (
  <div className={`crm-spreadsheet-shell density-${density}`}>
   {/* Sheet Tabs & Saved Views Strip */}
   {title || subtitle || savedViews.length > 0 || (hideToolbar && tabs && tabs.length > 0) ? (
    <div className="crm-sheet-header-bar">
     {(title || subtitle) && (
      <div className="crm-sheet-title-group">
       {title && <h2 className="crm-sheet-title">{title}</h2>}
       {subtitle && <span className="crm-sheet-subtitle">{subtitle}</span>}
      </div>
     )}

     {(title || subtitle || hideToolbar) && tabs && tabs.length > 0 && (
      <div className="crm-sheet-tabs" role="tablist" aria-label="Các trang bảng tính">
       {tabs.map(t => (
        <button
         key={t.key}
         type="button"
         role="tab"
         aria-selected={activeTab === t.key}
         className={`crm-sheet-tab ${activeTab === t.key ? 'active' : ''}`}
         onClick={() => onTabChange?.(t.key)}
        >
         <span>{t.label}</span>
         {t.count !== undefined && <span className={`crm-sheet-tab-badge tone-${t.badgeTone ?? 'default'}`}>{t.count}</span>}
        </button>
       ))}
      </div>
     )}

     {savedViews.length > 0 && (
      <div className="crm-saved-views-strip" aria-label="View bảng tính đã lưu">
       {savedViews.map(v => (
        <button
         key={v.id}
         type="button"
         className="crm-saved-view-chip"
         onClick={() => applySavedView(v)}
         title={v.shared ? 'View chia sẻ theo quyền' : 'View cá nhân của bạn'}
        >
         <span>{v.shared ? '🌐' : '📌'} {v.name}</span>
        </button>
       ))}
      </div>
     )}
    </div>
   ) : null}

   {/* Unified Spreadsheet Command Toolbar */}
   {!hideToolbar && (
    <div className="crm-sheet-toolbar">
     <div className="crm-sheet-toolbar-left">
      <div className="crm-sheet-search-box">
       <input
        ref={searchInputRef}
        type="search"
        value={quickSearch}
        onChange={e => setQuickSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Tìm nhanh trên bảng tính"
        className="crm-sheet-search-input"
       />
       {quickSearch && (
        <button type="button" className="crm-sheet-clear-btn" onClick={() => setQuickSearch('')} title="Xóa tìm nhanh">
         ✕
        </button>
       )}
      </div>

      <button
       type="button"
       className={`crm-sheet-tool-btn ${showFilterRow ? 'active' : ''}`}
       onClick={() => setShowFilterRow(v => !v)}
       aria-expanded={showFilterRow}
      >
       Lọc cột {Object.keys(colFilters).length > 0 ? `(${Object.keys(colFilters).length})` : ''}
      </button>

      {columns.some(c => c.groupable !== false) && (
       <label className="crm-sheet-inline-select">
        <span>Nhóm:</span>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} aria-label="Nhóm hàng theo cột">
         <option value="">Không nhóm</option>
         {columns
          .filter(c => c.groupable !== false && c.type !== 'money' && c.type !== 'number')
          .map(c => (
           <option key={c.key} value={c.key}>
            {c.label}
           </option>
          ))}
        </select>
       </label>
      )}

      <div className="crm-sheet-density-switch" role="group" aria-label="Mật độ dòng bảng tính">
       <button
        type="button"
        className={`crm-sheet-tool-btn ${density === 'compact' ? 'active' : ''}`}
        onClick={() => {
         setDensity('compact');
         persistPrefs({density: 'compact'});
        }}
        title="Chế độ gọn (32px/dòng)"
       >
        Gọn
       </button>
       <button
        type="button"
        className={`crm-sheet-tool-btn ${density === 'comfortable' ? 'active' : ''}`}
        onClick={() => {
         setDensity('comfortable');
         persistPrefs({density: 'comfortable'});
        }}
        title="Chế độ thoải mái (38px/dòng)"
       >
        Thoải mái
       </button>
      </div>

      <button
       type="button"
       className={`crm-sheet-tool-btn ${showColManager ? 'active' : ''}`}
       onClick={() => setShowColManager(v => !v)}
       aria-expanded={showColManager}
      >
       Cột & View ({activeColumns.length}/{columns.length})
      </button>

      <button type="button" className="crm-sheet-tool-btn" onClick={() => void copySelectionToClipboard()} title="Sao chép vùng ô hoặc dòng đang chọn sang Excel (Ctrl+C)">
       Sao chép TSV
      </button>
     </div>

     <div className="crm-sheet-toolbar-right">
      {/* Dirty state & Undo/Redo controls */}
      {(dirtyRowCount > 0 || saveStatus !== 'IDLE') && (
       <div className={`crm-sheet-save-bar status-${saveStatus.toLowerCase()}`}>
        <span className="crm-sheet-save-badge">
         {saveStatus === 'DIRTY' && `● Đã sửa ${dirtyRowCount} dòng (Chưa lưu)`}
         {saveStatus === 'SAVING' && '⏳ Đang lưu...'}
         {saveStatus === 'SAVED' && '✓ Đã lưu'}
         {saveStatus === 'ERROR' && '⚠ Có lỗi cần kiểm tra'}
        </span>
        {undoStack.length > 0 && (
         <button type="button" className="crm-sheet-tool-btn" onClick={handleUndo} title="Hoàn tác thay đổi chưa lưu (Ctrl+Z)">
          Hoàn tác
         </button>
        )}
        {redoStack.length > 0 && (
         <button type="button" className="crm-sheet-tool-btn" onClick={handleRedo} title="Làm lại (Ctrl+Y)">
          Làm lại
         </button>
        )}
        {dirtyRowCount > 0 && (batchSaveEndpoint || onBatchSaveCustom) && (
         <>
          <button type="button" className="crm-sheet-tool-btn" onClick={() => void saveDirtyCells(true)}>
           Kiểm tra lỗi
          </button>
          <button type="button" className="btn primary crm-sheet-save-btn" onClick={() => void saveDirtyCells(false)}>
           Lưu thay đổi ({dirtyRowCount})
          </button>
         </>
        )}
       </div>
      )}
      {!title && !subtitle && tabs && tabs.length > 0 && (
       <div className="crm-sheet-tabs" role="tablist" aria-label="Các trang bảng tính">
        {tabs.map(t => (
         <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeTab === t.key}
          className={`crm-sheet-tab ${activeTab === t.key ? 'active' : ''}`}
          onClick={() => onTabChange?.(t.key)}
         >
          <span>{t.label}</span>
          {t.count !== undefined && <span className={`crm-sheet-tab-badge tone-${t.badgeTone ?? 'default'}`}>{t.count}</span>}
         </button>
        ))}
       </div>
      )}
      {toolbarActions}
     </div>
    </div>
   )}

   {saveMessage && (
    <div className={`crm-sheet-Banner status-${saveStatus.toLowerCase()}`} role="status">
     <span>{saveMessage}</span>
     <button type="button" className="crm-sheet-clear-btn" onClick={() => setSaveMessage('')}>
      ✕
     </button>
    </div>
   )}

   {/* Bulk Selection Bar when rows are checked */}
   {selectedRows.length > 0 && (
    <div className="crm-sheet-bulk-bar">
     <strong>Đang chọn {selectedRows.length} dòng</strong>
     <button type="button" className="crm-sheet-tool-btn" onClick={() => void copySelectionToClipboard()}>
      Sao chép {selectedRows.length} dòng sang Excel
     </button>
     <button type="button" className="crm-sheet-tool-btn" onClick={() => setCheckedKeys(new Set())}>
      Bỏ chọn
     </button>
     {renderBulkActions?.(selectedRows, () => setCheckedKeys(new Set()))}
    </div>
   )}

   {/* Column Manager & View Saver Popover Panel */}
   {showColManager && (
    <div className="crm-sheet-col-manager">
     <div className="crm-sheet-col-manager-grid">
      {colOrder.map((key, idx) => {
       const col = columns.find(c => c.key === key);
       if (!col) return null;
       const checked = visibleKeys.includes(key);
       return (
        <div key={key} className="crm-sheet-col-item">
         <label className="crm-sheet-col-check">
          <input
           type="checkbox"
           checked={checked}
           disabled={checked && visibleKeys.length <= 1}
           onChange={e => {
            const next = e.target.checked ? [...visibleKeys, key] : visibleKeys.filter(k => k !== key);
            setVisibleKeys(next);
            persistPrefs({visibleKeys: next});
           }}
          />
          <span>{col.label}</span>
         </label>
         <div className="crm-sheet-col-controls">
          <input
           type="number"
           min={76}
           max={640}
           value={colWidths[key] ?? col.width ?? 160}
           aria-label={`Độ rộng cột ${col.label}`}
           onChange={e => {
            const w = Math.max(76, Math.min(640, Number(e.target.value) || 140));
            const next = {...colWidths, [key]: w};
            setColWidths(next);
            persistPrefs({colWidths: next});
           }}
          />
          <button
           type="button"
           disabled={idx === 0}
           onClick={() => {
            const next = [...colOrder];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            setColOrder(next);
            persistPrefs({colOrder: next});
           }}
           title="Đưa cột lên trước"
          >
           ↑
          </button>
          <button
           type="button"
           disabled={idx === colOrder.length - 1}
           onClick={() => {
            const next = [...colOrder];
            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
            setColOrder(next);
            persistPrefs({colOrder: next});
           }}
           title="Đưa cột ra sau"
          >
           ↓
          </button>
         </div>
        </div>
       );
      })}
     </div>
     <div className="crm-sheet-view-saver">
      <input
       type="text"
       value={newViewName}
       onChange={e => setNewViewName(e.target.value)}
       placeholder="Đặt tên View bảng tính (VD: Đối soát nhanh Hà Nội)..."
       aria-label="Tên View bảng tính"
      />
      <label className="crm-sheet-col-check">
       <input type="checkbox" checked={newViewShared} onChange={e => setNewViewShared(e.target.checked)} />
       <span>View chia sẻ theo quyền</span>
      </label>
      <button type="button" className="crm-sheet-tool-btn active" onClick={saveCurrentView}>
       Lưu View hiện tại
      </button>
     </div>
    </div>
   )}

   {/* Main Split Workspace: Left Spreadsheet Viewport + Right Docked Inspector Drawer */}
   <div className={`crm-sheet-workspace ${inspectedRow && renderDrawer ? 'with-drawer' : ''}`}>
    <div
     ref={viewportRef}
     className="crm-table-wrap crm-sheet-viewport"
     tabIndex={0}
     onKeyDown={handleGridKeyDown}
     onPaste={e => {
      if (editingCell) return;
      const text = e.clipboardData?.getData('text/plain');
      if (text && activeCell) {
       e.preventDefault();
       handlePasteText(text);
      }
     }}
     role="region"
     aria-label={title || 'Bảng tính dữ liệu CRM'}
    >
     <table className="data-table crm-spreadsheet-table">
      <colgroup>
       <col style={{width: '36px'}} />
       {activeColumns.map(col => (
        <col key={col.key} style={{width: `${colWidths[col.key] ?? col.width ?? 160}px`}} />
       ))}
       {renderDrawer && <col style={{width: '84px'}} />}
      </colgroup>
      <thead>
       <tr>
        <th className="crm-sheet-th-check crm-sticky-check">
         <input
          type="checkbox"
          aria-label="Chọn tất cả các dòng trên bảng"
          checked={processedRows.length > 0 && processedRows.every((r, idx) => checkedKeys.has(getRowKey(r, idx)))}
          onChange={e => {
           if (e.target.checked) {
            setCheckedKeys(new Set(processedRows.map((r, idx) => getRowKey(r, idx))));
           } else {
            setCheckedKeys(new Set());
           }
          }}
         />
        </th>
        {activeColumns.map(col => {
         const sortIdx = sorts.findIndex(s => s.key === col.key);
         const sortSpec = sortIdx >= 0 ? sorts[sortIdx] : null;
         const isSticky = Boolean(col.sticky);
         const align = col.align ?? (col.type === 'money' || col.type === 'number' ? 'right' : col.type === 'status' ? 'center' : 'left');
         return (
          <th
           key={col.key}
           className={`crm-sheet-th align-${align} ${isSticky ? 'crm-sticky-col' : ''}`}
           style={isSticky ? {left: `${stickyOffsets[col.key] ?? 36}px`} : undefined}
          >
           <div className="crm-sheet-th-inner">
            <button
             type="button"
             className="crm-sheet-th-sort-btn"
             onClick={e => col.sortable !== false && toggleSort(col.key, e.shiftKey)}
             title="Bấm để sắp xếp; giữ Shift + Bấm để sắp xếp nhiều cột"
            >
             <span>{col.label}</span>
             {sortSpec && (
              <span className="crm-sheet-sort-indicator">
               {sortSpec.dir === 'asc' ? '▲' : '▼'}
               {sorts.length > 1 ? sortIdx + 1 : ''}
              </span>
             )}
            </button>
            <span
             className="crm-col-resizer"
             onMouseDown={e => startColResize(e, col.key)}
             title="Kéo để thay đổi độ rộng cột"
            />
           </div>
          </th>
         );
        })}
        {renderDrawer && <th className="crm-sheet-th align-center">Chi tiết</th>}
       </tr>

       {/* Per-Column Typed Filter Row */}
       {showFilterRow && (
        <tr className="crm-sheet-filter-tr">
         <th className="crm-sticky-check">
          {Object.keys(colFilters).length > 0 && (
           <button
            type="button"
            className="crm-sheet-clear-btn"
            onClick={() => setColFilters({})}
            title="Xóa toàn bộ bộ lọc cột"
           >
            ✕
           </button>
          )}
         </th>
         {activeColumns.map(col => {
          const f = colFilters[col.key] ?? {};
          const isSticky = Boolean(col.sticky);
          return (
           <th
            key={col.key}
            className={`crm-sheet-filter-cell ${isSticky ? 'crm-sticky-col' : ''}`}
            style={isSticky ? {left: `${stickyOffsets[col.key] ?? 36}px`} : undefined}
           >
            {col.type === 'number' || col.type === 'money' ? (
             <div className="crm-filter-range">
              <input
               type="text"
               placeholder="Từ..."
               value={f.min ?? ''}
               aria-label={`Lọc tối thiểu ${col.label}`}
               onChange={e => setColFilters(p => ({...p, [col.key]: {...p[col.key], min: e.target.value}}))}
              />
              <input
               type="text"
               placeholder="Đến..."
               value={f.max ?? ''}
               aria-label={`Lọc tối đa ${col.label}`}
               onChange={e => setColFilters(p => ({...p, [col.key]: {...p[col.key], max: e.target.value}}))}
              />
             </div>
            ) : col.type === 'date' ? (
             <div className="crm-filter-range">
              <input
               type="date"
               value={f.from ?? ''}
               aria-label={`Từ ngày ${col.label}`}
               onChange={e => setColFilters(p => ({...p, [col.key]: {...p[col.key], from: e.target.value}}))}
              />
              <input
               type="date"
               value={f.to ?? ''}
               aria-label={`Đến ngày ${col.label}`}
               onChange={e => setColFilters(p => ({...p, [col.key]: {...p[col.key], to: e.target.value}}))}
              />
             </div>
            ) : (
             <input
              type="text"
              placeholder={`Lọc ${col.label}...`}
              value={f.text ?? ''}
              aria-label={`Lọc ${col.label}`}
              onChange={e => setColFilters(p => ({...p, [col.key]: {...p[col.key], text: e.target.value}}))}
             />
            )}
           </th>
          );
         })}
         {renderDrawer && <th />}
        </tr>
       )}
      </thead>

      <tbody>
       {processedRows.length === 0 ? (
        <tr>
         <td colSpan={activeColumns.length + (renderDrawer ? 2 : 1)} className="crm-sheet-empty-cell">
          {emptyMessage}
         </td>
        </tr>
       ) : groupedData ? (
        groupedData.entries.map(([groupLabel, groupItems]) => {
         const isCollapsed = Boolean(collapsedGroups[groupLabel]);
         return (
          <React.Fragment key={groupLabel}>
           <tr className="crm-sheet-group-row">
            <td colSpan={activeColumns.length + (renderDrawer ? 2 : 1)}>
             <button
              type="button"
              className="crm-sheet-group-toggle"
              onClick={() => setCollapsedGroups(p => ({...p, [groupLabel]: !p[groupLabel]}))}
             >
              <span>{isCollapsed ? '▶' : '▼'}</span>
              <strong>
               {groupedData.groupCol.label}: {groupLabel}
              </strong>
              <span className="crm-sheet-group-count">{groupItems.length} dòng</span>
             </button>
            </td>
           </tr>
           {!isCollapsed &&
            groupItems.map(({row, flatIdx}) =>
             renderSpreadsheetRow(
              row,
              flatIdx,
              activeColumns,
              getRowKey,
              checkedKeys,
              setCheckedKeys,
              selectionBounds,
              activeCell,
              setActiveCell,
              setRangeEndCell,
              editingCell,
              editingValue,
              setEditingValue,
              startEditing,
              commitEditing,
              setEditingCell,
              dirtyMap,
              cellErrors,
              stickyOffsets,
              readCellRaw,
              isCellEditable,
              renderDrawer,
              inspectedKey,
              setInspectedKey
             )
            )}
          </React.Fragment>
         );
        })
       ) : (
        processedRows.map((row, flatIdx) =>
         renderSpreadsheetRow(
          row,
          flatIdx,
          activeColumns,
          getRowKey,
          checkedKeys,
          setCheckedKeys,
          selectionBounds,
          activeCell,
          setActiveCell,
          setRangeEndCell,
          editingCell,
          editingValue,
          setEditingValue,
          startEditing,
          commitEditing,
          setEditingCell,
          dirtyMap,
          cellErrors,
          stickyOffsets,
          readCellRaw,
          isCellEditable,
          renderDrawer,
          inspectedKey,
          setInspectedKey
         )
        )
       )}
      </tbody>
     </table>
    </div>

    {/* Right-Side Docked Detail Inspector Drawer (Preserves Scroll, Filter, and Active Cell Context) */}
    {inspectedRow && renderDrawer && (
     <aside className="crm-sheet-drawer" aria-label="Chi tiết bản ghi đang chọn">
      <div className="crm-sheet-drawer-header">
       <div>
        <span className="crm-sheet-drawer-kicker">CHI TIẾT HỒ SƠ / CHỨNG TỪ</span>
        <h3 className="crm-sheet-drawer-title">{drawerTitle ? drawerTitle(inspectedRow) : 'Chi tiết bản ghi'}</h3>
       </div>
       <div className="crm-sheet-drawer-actions">
        {drawerFullPageHref && (
         <Link href={drawerFullPageHref(inspectedRow)} className="crm-sheet-tool-btn">
          Mở trang đầy đủ ↗
         </Link>
        )}
        <button
         type="button"
         className="crm-sheet-tool-btn"
         onClick={() => {
          setInspectedKey(null);
          viewportRef.current?.focus();
         }}
         title="Đóng panel chi tiết (Esc)"
        >
         Đóng ✕
        </button>
       </div>
      </div>
      <div className="crm-sheet-drawer-body">{renderDrawer(inspectedRow, () => setInspectedKey(null))}</div>
     </aside>
    )}
   </div>

   {/* Excel-Style Status & Summary Footer Bar */}
   <div className="crm-sheet-footer" role="status" aria-live="polite">
    <div className="crm-sheet-footer-section">
     <span className="crm-sheet-footer-item">
      <strong>Số dòng:</strong> {processedRows.length}
      {totalDatasetCount !== undefined && totalDatasetCount !== processedRows.length ? ` / ${totalDatasetCount}` : ''}
     </span>
     {checkedKeys.size > 0 && (
      <span className="crm-sheet-footer-item highlight">
       <strong>Đang chọn:</strong> {checkedKeys.size} dòng
      </span>
     )}
     {selectionStats && selectionStats.cellCount > 1 && (
      <span className="crm-sheet-footer-item highlight">
       <strong>Vùng chọn:</strong> {selectionStats.cellCount} ô
       {selectionStats.hasNumeric && selectionStats.compatible && (
        <>
         {' · '}SUM: <strong>{formatNum(selectionStats.sum, selectionStats.isMoney)}</strong>
         {' · '}AVG: {formatNum(selectionStats.avg, selectionStats.isMoney)}
         {' · '}MIN: {formatNum(selectionStats.min, selectionStats.isMoney)}
         {' · '}MAX: {formatNum(selectionStats.max, selectionStats.isMoney)}
        </>
       )}
       {selectionStats.hasNumeric && !selectionStats.compatible && ' · (Khác đơn vị tính - không cộng gộp)'}
      </span>
     )}
    </div>

    {!hideFooterSums && (
     <div className="crm-sheet-footer-section">
      {pageColumnSums.length > 0 && (
       <div className="crm-sheet-footer-sums">
        <span className="crm-sheet-footer-tag">Tổng trang đang hiển thị:</span>
        {pageColumnSums.map(s => (
         <span key={s.key} className="crm-sheet-footer-sum-pill">
          {s.label}: <strong>{formatNum(s.sum, s.isMoney)}</strong>
         </span>
        ))}
       </div>
      )}

      {datasetTotals && datasetTotals.length > 0 && (
       <div className="crm-sheet-footer-sums dataset-totals">
        <span className="crm-sheet-footer-tag accent">Tổng toàn bộ kết quả lọc:</span>
        {datasetTotals.map((dt, idx) => (
         <span key={idx} className={`crm-sheet-footer-sum-pill tone-${dt.tone ?? 'default'}`}>
          {dt.label}: <strong>{dt.value}</strong>
         </span>
        ))}
       </div>
      )}
     </div>
    )}
   </div>

   {/* Excel Paste Validation & Preview Modal */}
   {pastePreview?.open && (
    <div className="crm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Xem trước dữ liệu dán từ Excel">
     <div className="crm-modal-sheet">
      <div className="crm-modal-header">
       <div>
        <h3>Kiểm tra dữ liệu dán từ Excel ({pastePreview.items.length} ô)</h3>
        <p className="muted">
         Hệ thống kiểm tra kiểu dữ liệu, quyền chỉnh sửa và trạng thái bản ghi trước khi áp dụng vào bảng tính.
        </p>
       </div>
       <button type="button" className="crm-sheet-tool-btn" onClick={() => setPastePreview(null)}>
        Hủy ✕
       </button>
      </div>
      <div className="crm-modal-body">
       <table className="data-table crm-spreadsheet-table">
        <thead>
         <tr>
          <th>Bản ghi</th>
          <th>Cột</th>
          <th>Giá trị hiện tại</th>
          <th>Giá trị dán mới</th>
          <th>Trạng thái kiểm tra</th>
         </tr>
        </thead>
        <tbody>
         {pastePreview.items.map((item, idx) => (
          <tr key={idx}>
           <td className="crm-nowrap">{item.rowLabel}</td>
           <td>{item.colLabel}</td>
           <td className="muted">{item.before || '—'}</td>
           <td>
            <strong>{item.after || '—'}</strong>
           </td>
           <td>
            {item.valid ? (
             <span className="status-badge status-ready">Hợp lệ</span>
            ) : (
             <span className="status-badge status-rejected">{item.error}</span>
            )}
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
      <div className="crm-modal-footer">
       <span>
        Hợp lệ: <strong>{pastePreview.items.filter(i => i.valid).length}</strong> ô · Lỗi:{' '}
        <strong>{pastePreview.items.filter(i => !i.valid).length}</strong> ô
       </span>
       <div className="crm-modal-actions">
        <button type="button" className="btn secondary" onClick={() => setPastePreview(null)}>
         Đóng
        </button>
        <button
         type="button"
         className="btn primary"
         disabled={pastePreview.items.every(i => !i.valid)}
         onClick={applyPastePreviewToSheet}
        >
         Đưa {pastePreview.items.filter(i => i.valid).length} ô hợp lệ vào bảng (Chờ lưu)
        </button>
       </div>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}

function renderSpreadsheetRow<T>(
 row: T,
 flatIdx: number,
 activeColumns: SpreadsheetColumn<T>[],
 getRowKey: (row: T, index: number) => string,
 checkedKeys: Set<string>,
 setCheckedKeys: React.Dispatch<React.SetStateAction<Set<string>>>,
 selectionBounds: {r1: number; r2: number; c1: number; c2: number} | null,
 activeCell: CellPos | null,
 setActiveCell: React.Dispatch<React.SetStateAction<CellPos | null>>,
 setRangeEndCell: React.Dispatch<React.SetStateAction<CellPos | null>>,
 editingCell: CellPos | null,
 editingValue: string,
 setEditingValue: React.Dispatch<React.SetStateAction<string>>,
 startEditing: (pos: CellPos) => void,
 commitEditing: () => void,
 setEditingCell: React.Dispatch<React.SetStateAction<CellPos | null>>,
 dirtyMap: Record<string, Record<string, string>>,
 cellErrors: Record<string, Record<string, string>>,
 stickyOffsets: Record<string, number>,
 readCellRaw: (row: T, col: SpreadsheetColumn<T>, rKey?: string) => string,
 isCellEditable: (row: T, col: SpreadsheetColumn<T>) => boolean,
 renderDrawer: ((row: T, close: () => void) => React.ReactNode) | undefined,
 inspectedKey: string | null,
 setInspectedKey: React.Dispatch<React.SetStateAction<string | null>>
) {
 const rKey = getRowKey(row, flatIdx);
 const isRowChecked = checkedKeys.has(rKey);
 const isRowInspected = inspectedKey === rKey;
 const isRowDirty = Boolean(dirtyMap[rKey] && Object.keys(dirtyMap[rKey]).length > 0);

 return (
  <tr
   key={rKey}
   className={`crm-sheet-tr ${isRowChecked ? 'row-checked' : ''} ${isRowInspected ? 'row-inspected' : ''} ${isRowDirty ? 'row-dirty' : ''}`}
  >
   <td className="crm-sheet-td-check crm-sticky-check">
    <input
     type="checkbox"
     checked={isRowChecked}
     aria-label={`Chọn dòng ${flatIdx + 1}`}
     onChange={e => {
      setCheckedKeys(prev => {
       const next = new Set(prev);
       if (e.target.checked) next.add(rKey);
       else next.delete(rKey);
       return next;
      });
     }}
    />
   </td>
   {activeColumns.map((col, colIdx) => {
    const isActive = activeCell?.rowIdx === flatIdx && activeCell?.colIdx === colIdx;
    const isInRange =
     selectionBounds !== null &&
     flatIdx >= selectionBounds.r1 &&
     flatIdx <= selectionBounds.r2 &&
     colIdx >= selectionBounds.c1 &&
     colIdx <= selectionBounds.c2;
    const isEditing = editingCell?.rowIdx === flatIdx && editingCell?.colIdx === colIdx;
    const dirtyVal = dirtyMap[rKey]?.[col.key];
    const cellError = cellErrors[rKey]?.[col.key];
    const editable = isCellEditable(row, col);
    const isSticky = Boolean(col.sticky);
    const align = col.align ?? (col.type === 'money' || col.type === 'number' ? 'right' : col.type === 'status' ? 'center' : 'left');
    const nowrap = col.type === 'code' || col.type === 'phone' || col.type === 'money' || col.type === 'number' || col.type === 'date';
    const rawStr = readCellRaw(row, col, rKey);

    return (
     <td
      key={col.key}
      className={[
       'crm-sheet-td',
       `align-${align}`,
       nowrap ? 'crm-nowrap' : '',
       isSticky ? 'crm-sticky-col' : '',
       isActive ? 'cell-active' : '',
       isInRange ? 'cell-in-range' : '',
       dirtyVal !== undefined ? 'cell-dirty' : '',
       cellError ? 'cell-error' : '',
       editable ? 'cell-editable' : '',
      ]
       .filter(Boolean)
       .join(' ')}
      style={isSticky ? {left: `${stickyOffsets[col.key] ?? 36}px`} : undefined}
      title={cellError ? `Lỗi: ${cellError}` : rawStr.length > 36 ? rawStr : undefined}
      onClick={e => {
       const pos = {rowIdx: flatIdx, colIdx};
       if (e.shiftKey && activeCell) {
        setRangeEndCell(pos);
       } else {
        setActiveCell(pos);
        setRangeEndCell(pos);
       }
      }}
      onDoubleClick={() => {
       if (editable) {
        startEditing({rowIdx: flatIdx, colIdx});
       } else if (renderDrawer) {
        setInspectedKey(rKey);
       }
      }}
     >
      {isEditing ? (
       col.editorType === 'select' && col.editorOptions ? (
        <select
         autoFocus
         className="crm-cell-editor"
         value={editingValue}
         onChange={e => setEditingValue(e.target.value)}
         onBlur={commitEditing}
        >
         {col.editorOptions.map(opt => (
          <option key={opt.value} value={opt.value}>
           {opt.label}
          </option>
         ))}
        </select>
       ) : (
        <input
         autoFocus
         type={col.editorType === 'date' ? 'date' : 'text'}
         className="crm-cell-editor"
         value={editingValue}
         onChange={e => setEditingValue(e.target.value)}
         onBlur={commitEditing}
         onKeyDown={e => {
          if (e.key === 'Escape') {
           e.stopPropagation();
           setEditingCell(null);
          } else if (e.key === 'Enter') {
           e.stopPropagation();
           commitEditing();
          }
         }}
        />
       )
      ) : (
       <div className="crm-cell-content">
        {dirtyVal !== undefined && !col.renderCell
         ? dirtyVal
         : col.renderCell
           ? col.renderCell(row, {
              isSelected: isInRange,
              isActive,
              dirtyValue: dirtyVal,
              openDrawer: () => setInspectedKey(rKey),
             })
           : rawStr || '—'}
        {cellError && <span className="crm-cell-error-tag" title={cellError}>! {cellError}</span>}
       </div>
      )}
     </td>
    );
   })}
   {renderDrawer && (
    <td className="crm-sheet-td align-center crm-nowrap">
     <button
      type="button"
      className={`crm-sheet-inspect-btn ${isRowInspected ? 'active' : ''}`}
      onClick={() => setInspectedKey(isRowInspected ? null : rKey)}
     >
      {isRowInspected ? 'Đang mở' : 'Mở panel'}
     </button>
    </td>
   )}
  </tr>
 );
}
