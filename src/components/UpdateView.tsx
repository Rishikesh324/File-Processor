import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { type DocumentRecord, type IndexedDocument } from '../types';
import { saveDocumentRecords } from '../utils/dbHelpers';
import { 
  FileEdit, 
  Database, 
  PlusCircle, 
  Trash, 
  Save, 
  AlertCircle,
  CheckCircle2,
  ListFilter,
  FileSpreadsheet,
  FileText,
  FileCode,
  Sparkles,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function UpdateView() {
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [localRecords, setLocalRecords] = useState<DocumentRecord[]>([]);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [fieldSearchInput, setFieldSearchInput] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeMode, setActiveMode] = useState<'update' | 'create'>('update');
  const [matchedRecordIds, setMatchedRecordIds] = useState<Set<string>>(new Set());

  // Dynamic creation tab state variables
  const [createSubTab, setCreateSubTab] = useState<'structure' | 'existing_update' | 'custom'>('structure');
  
  // Spreadsheet 'structure' state
  const [structSheet, setStructSheet] = useState('');
  const [structType, setStructType] = useState<'row' | 'col'>('row');
  const [structRowPosition, setStructRowPosition] = useState<'end' | 'above' | 'below'>('end');
  const [structTargetRow, setStructTargetRow] = useState<string>('');
  const [structRowData, setStructRowData] = useState<Record<string, string>>({});

  const [structColName, setStructColName] = useState('');
  const [structColDefaultVal, setStructColDefaultVal] = useState('');

  // Spreadsheet 'existing_update' state
  const [existingSheet, setExistingSheet] = useState('');
  const [existingRow, setExistingRow] = useState<string>('');
  const [existingCol, setExistingCol] = useState('');
  const [existingCellValue, setExistingCellValue] = useState('');

  // Non-spreadsheet 'structure' state
  const [docStructAction, setDocStructAction] = useState<'end' | 'above' | 'below'>('end');
  const [docStructTarget, setDocStructTarget] = useState<string>('');
  const [docStructContent, setDocStructContent] = useState('');
  const [docPptxSlide, setDocPptxSlide] = useState<number>(1);

  // Non-spreadsheet 'existing_update' state
  const [docExistingId, setDocExistingId] = useState('');
  const [docExistingValue, setDocExistingValue] = useState('');

  // Live monitor the IndexedDB documents list
  const documents = useLiveQuery(() => db.documents.toArray()) || [];

  // When a file is selected, pull its records into local component state
  useEffect(() => {
    setFieldSearchQuery('');
    setFieldSearchInput('');
    setActiveMode('update');

    // Reset all creation-specific parameters
    setCreateSubTab('structure');
    setStructSheet('');
    setStructType('row');
    setStructRowPosition('end');
    setStructTargetRow('');
    setStructRowData({});
    setStructColName('');
    setStructColDefaultVal('');
    setExistingSheet('');
    setExistingRow('');
    setExistingCol('');
    setExistingCellValue('');
    setDocStructAction('end');
    setDocStructTarget('');
    setDocStructContent('');
    setDocPptxSlide(1);
    setDocExistingId('');
    setDocExistingValue('');

    if (!selectedFileId) {
      setLocalRecords([]);
      return;
    }

    const fetchRecords = async () => {
      try {
        const fileRecords = await db.records.where('fileId').equals(selectedFileId).toArray();
        setLocalRecords(fileRecords);
      } catch (err) {
        setStatusMsg({
          type: 'error',
          text: 'We could not fetch the records for this file.'
        });
      }
    };

    fetchRecords();
    setStatusMsg(null);
  }, [selectedFileId]);

  const selectedFileDoc = React.useMemo(() => {
    return documents.find((doc) => doc.id === selectedFileId);
  }, [documents, selectedFileId]);

  const isSpreadsheet = selectedFileDoc?.type === 'xlsx';

  // Extract spreadsheet sheet name and row number from a record's label
  const getRowGroupKey = React.useCallback((rec: DocumentRecord) => {
    const match = rec.label.match(/^(.*) - Row (\d+) - (.*)$/);
    if (match) {
      return `${match[1]} - Row ${match[2]}`;
    }
    return null;
  }, []);

  // Compute available spreadsheets sheet names, row numbers, and column names
  const spreadsheetStructure = React.useMemo(() => {
    if (!isSpreadsheet || localRecords.length === 0) return { sheets: [], columnsBySheet: {}, rowsBySheet: {} };
    const sheets: string[] = [];
    const columnsBySheet: Record<string, string[]> = {};
    const rowsBySheet: Record<string, number[]> = {};

    localRecords.forEach((rec) => {
      const match = rec.label.match(/^(.*) - Row (\d+)(?: - (.*))?$/);
      if (match) {
        const sheetName = match[1];
        const rowNum = parseInt(match[2], 10);
        const colName = match[3] || '';

        if (!sheets.includes(sheetName)) {
          sheets.push(sheetName);
        }
        if (!columnsBySheet[sheetName]) {
          columnsBySheet[sheetName] = [];
        }
        if (colName && !columnsBySheet[sheetName].includes(colName)) {
          columnsBySheet[sheetName].push(colName);
        }
        if (!rowsBySheet[sheetName]) {
          rowsBySheet[sheetName] = [];
        }
        if (!rowsBySheet[sheetName].includes(rowNum)) {
          rowsBySheet[sheetName].push(rowNum);
        }
      }
    });

    // Sort rows numerically
    Object.keys(rowsBySheet).forEach((sheet) => {
      rowsBySheet[sheet].sort((a, b) => a - b);
    });

    return { sheets, columnsBySheet, rowsBySheet };
  }, [localRecords, isSpreadsheet]);

  // Compute docx paragraph numbers
  const wordDocumentStructure = React.useMemo(() => {
    const isDocx = selectedFileDoc?.type === 'docx';
    if (!isDocx || localRecords.length === 0) return { paragraphNumbers: [] };
    const nums: number[] = [];
    localRecords.forEach((rec) => {
      const match = rec.label.match(/^Paragraph (\d+)$/);
      if (match) {
        nums.push(parseInt(match[1], 10));
      }
    });
    nums.sort((a, b) => a - b);
    return { paragraphNumbers: nums };
  }, [localRecords, selectedFileDoc]);

  // Compute pptx slide and paragraph lists
  const presentationStructure = React.useMemo(() => {
    const isPptx = selectedFileDoc?.type === 'pptx';
    if (!isPptx || localRecords.length === 0) return { slides: {}, slideNumbers: [] };
    const slides: Record<number, number[]> = {};
    localRecords.forEach((rec) => {
      const match = rec.label.match(/^Slide (\d+) - Para (\d+)$/);
      if (match) {
        const slideNum = parseInt(match[1], 10);
        const paraNum = parseInt(match[2], 10);
        if (!slides[slideNum]) slides[slideNum] = [];
        if (!slides[slideNum].includes(paraNum)) slides[slideNum].push(paraNum);
      }
    });
    const slideNumbers = Object.keys(slides).map(Number).sort((a, b) => a - b);
    return { slides, slideNumbers };
  }, [localRecords, selectedFileDoc]);

  // Compute txt line numbers
  const textDocumentStructure = React.useMemo(() => {
    const isTxt = selectedFileDoc?.type === 'txt';
    if (!isTxt || localRecords.length === 0) return { lineNumbers: [] };
    const nums: number[] = [];
    localRecords.forEach((rec) => {
      const match = rec.label.match(/^Line (\d+)$/);
      if (match) {
        nums.push(parseInt(match[1], 10));
      }
    });
    nums.sort((a, b) => a - b);
    return { lineNumbers: nums };
  }, [localRecords, selectedFileDoc]);

  // Autodetect sheet and set default values
  useEffect(() => {
    if (isSpreadsheet && spreadsheetStructure.sheets.length > 0) {
      if (!structSheet) setStructSheet(spreadsheetStructure.sheets[0]);
      if (!existingSheet) setExistingSheet(spreadsheetStructure.sheets[0]);
    }
  }, [isSpreadsheet, spreadsheetStructure.sheets, structSheet, existingSheet]);

  // Monitor coordinates changes for spreadsheet cells updates
  const matchedCellRec = React.useMemo(() => {
    if (!isSpreadsheet || !existingSheet || !existingRow || !existingCol) return null;
    return localRecords.find((rec) => {
      return rec.label === `${existingSheet} - Row ${existingRow} - ${existingCol}`;
    });
  }, [localRecords, isSpreadsheet, existingSheet, existingRow, existingCol]);

  useEffect(() => {
    if (matchedCellRec) {
      setExistingCellValue(matchedCellRec.value);
    } else {
      setExistingCellValue('');
    }
  }, [matchedCellRec]);

  // Monitor coordinate changes for non-spreadsheet document updates
  const docMatchedExistingRec = React.useMemo(() => {
    if (isSpreadsheet || !docExistingId) return null;
    return localRecords.find((rec) => rec.id === docExistingId);
  }, [localRecords, isSpreadsheet, docExistingId]);

  useEffect(() => {
    if (docMatchedExistingRec) {
      setDocExistingValue(docMatchedExistingRec.value);
    } else {
      setDocExistingValue('');
    }
  }, [docMatchedExistingRec]);

  // Sync matchedRecordIds ONLY when the search query or file changes.
  // We intentionally exclude localRecords from the dependencies to lock the matching items while editing row details.
  useEffect(() => {
    const q = fieldSearchQuery.trim().toLowerCase();
    if (!q) {
      setMatchedRecordIds(new Set());
      return;
    }

    const directlyMatched = localRecords.filter(
      (rec) =>
        rec.label.toLowerCase().includes(q) ||
        rec.value.toLowerCase().includes(q)
    );

    const matches = new Set<string>();

    if (isSpreadsheet) {
      const matchedRowKeys = new Set<string>();
      directlyMatched.forEach((rec) => {
        const rowKey = getRowGroupKey(rec);
        if (rowKey) {
          matchedRowKeys.add(rowKey);
        }
      });

      localRecords.forEach((rec) => {
        const rowKey = getRowGroupKey(rec);
        if (rowKey) {
          if (matchedRowKeys.has(rowKey)) {
            matches.add(rec.id);
          }
        } else if (directlyMatched.some((dm) => dm.id === rec.id)) {
          matches.add(rec.id);
        }
      });
    } else {
      directlyMatched.forEach((rec) => {
        matches.add(rec.id);
      });
    }

    setMatchedRecordIds(matches);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [fieldSearchQuery, selectedFileId, isSpreadsheet, getRowGroupKey]);

  // Filter local parameters based on the frozen set of matchedRecordIds
  const filteredLocalRecords = React.useMemo(() => {
    if (!fieldSearchQuery.trim()) {
      return []; // empty search returns no results!
    }
    return localRecords.filter((rec) => matchedRecordIds.has(rec.id));
  }, [localRecords, matchedRecordIds, fieldSearchQuery]);

  // Group the filtered records by row key (for display grouping in spreadsheet mode)
  const groupedSpreadsheetRows = React.useMemo(() => {
    if (!isSpreadsheet) return [];
    
    const rowsMap: Record<string, { key: string; sheetName: string; rowNum: string; records: DocumentRecord[] }> = {};
    
    filteredLocalRecords.forEach((rec) => {
      const match = rec.label.match(/^(.*) - Row (\d+) - (.*)$/);
      if (match) {
        const sheetName = match[1];
        const rowNum = match[2];
        const groupKey = `${sheetName} - Row ${rowNum}`;
        if (!rowsMap[groupKey]) {
          rowsMap[groupKey] = {
            key: groupKey,
            sheetName,
            rowNum,
            records: []
          };
        }
        rowsMap[groupKey].records.push(rec);
      } else {
        // Fallback for custom added parameters or rows without standard prefix
        const groupKey = 'Custom Appended Parameters';
        if (!rowsMap[groupKey]) {
          rowsMap[groupKey] = {
            key: groupKey,
            sheetName: 'Custom Appended',
            rowNum: 'Parameters',
            records: []
          };
        }
        rowsMap[groupKey].records.push(rec);
      }
    });

    return Object.values(rowsMap);
  }, [filteredLocalRecords, isSpreadsheet]);

  // Clear success messages
  useEffect(() => {
    if (statusMsg && statusMsg.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMsg(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Handle value change for static elements
  const handleValueChange = (id: string, text: string) => {
    setLocalRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, value: text } : rec))
    );
  };

  // Handle key label change for static elements (useful if users wanna rename keys)
  const handleLabelChange = (id: string, newLabel: string) => {
    setLocalRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, label: newLabel } : rec))
    );
  };

  // Append a brand new key-value item dynamically
  const handleAddNewRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileId) {
      setStatusMsg({ type: 'error', text: 'Please choose a file first.' });
      return;
    }
    if (!newKey.trim()) {
      setStatusMsg({ type: 'error', text: 'Please give the parameter a name.' });
      return;
    }

    const newRecItem: DocumentRecord = {
      id: `custom-added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileId: selectedFileId,
      label: newKey.trim(),
      value: newValue.trim()
    };

    setLocalRecords((prev) => [...prev, newRecItem]);
    setMatchedRecordIds((prev) => {
      const next = new Set(prev);
      next.add(newRecItem.id);
      return next;
    });
    setNewKey('');
    setNewValue('');
    setStatusMsg({ type: 'success', text: `Added custom parameter "${newKey.trim()}" to list memory. Click "Save Updates" to save for good.` });
  };

  // Insert a new row and shift rows elegantly below/above
  const handleInsertRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structSheet) {
      setStatusMsg({ type: 'error', text: 'Please select a sheet first.' });
      return;
    }

    const availableCols = spreadsheetStructure.columnsBySheet[structSheet] || ['Value'];
    const existingRows = spreadsheetStructure.rowsBySheet[structSheet] || [];
    let targetR = 1;

    if (structRowPosition === 'end') {
      const maxR = existingRows.length > 0 ? Math.max(...existingRows) : 0;
      targetR = maxR + 1;
    } else {
      if (!structTargetRow) {
        setStatusMsg({ type: 'error', text: 'Please select a row target position.' });
        return;
      }
      const selectedR = Number(structTargetRow);
      if (structRowPosition === 'above') {
        targetR = selectedR;
      } else {
        targetR = selectedR + 1;
      }
    }

    // Shift existing rows
    const updatedRecords = localRecords.map((rec) => {
      const match = rec.label.match(/^(.*) - Row (\d+)(?: - (.*))?$/);
      if (match) {
        const sName = match[1];
        const rNum = parseInt(match[2], 10);
        const cName = match[3] || '';

        if (sName === structSheet && rNum >= targetR) {
          return { ...rec, label: `${sName} - Row ${rNum + 1} - ${cName}` };
        }
      }
      return rec;
    });

    // Create the new row elements
    const newRecordsToAdd: DocumentRecord[] = [];
    availableCols.forEach((col) => {
      const colValue = structRowData[col] || '';
      const newRec: DocumentRecord = {
        id: `rec-xlsx-added-${Date.now()}-${col}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `${structSheet} - Row ${targetR} - ${col}`,
        value: colValue
      };
      newRecordsToAdd.push(newRec);
    });

    setLocalRecords([...updatedRecords, ...newRecordsToAdd]);
    
    // Clear form
    setStructRowData({});
    setStructTargetRow('');
    
    // Add new recs to matching IDs to preserve visibility in Update list if queried
    setMatchedRecordIds((prev) => {
      const next = new Set(prev);
      newRecordsToAdd.forEach(r => next.add(r.id));
      return next;
    });

    setStatusMsg({
      type: 'success',
      text: `Successfully inserted new Row ${targetR} in spreadsheet "${structSheet}" memory! Be sure to click "Save Updates".`
    });
  };

  // Add a new column to all rows
  const handleInsertColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structSheet) {
      setStatusMsg({ type: 'error', text: 'Please select a sheet first.' });
      return;
    }
    const colNameClean = structColName.trim();
    if (!colNameClean) {
      setStatusMsg({ type: 'error', text: 'Please enter a column name.' });
      return;
    }

    const existingCols = spreadsheetStructure.columnsBySheet[structSheet] || [];
    if (existingCols.includes(colNameClean)) {
      setStatusMsg({ type: 'error', text: `Column "${colNameClean}" already exists in sheet "${structSheet}".` });
      return;
    }

    // Insert column to every row
    const existingRows = spreadsheetStructure.rowsBySheet[structSheet] || [1];
    const newRecordsToAdd: DocumentRecord[] = [];

    existingRows.forEach((rNum) => {
      newRecordsToAdd.push({
        id: `rec-xlsx-added-col-${Date.now()}-${rNum}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `${structSheet} - Row ${rNum} - ${colNameClean}`,
        value: structColDefaultVal
      });
    });

    setLocalRecords((prev) => [...prev, ...newRecordsToAdd]);
    setStructColName('');
    setStructColDefaultVal('');

    setStatusMsg({
      type: 'success',
      text: `Added new column "${colNameClean}" with default value "${structColDefaultVal}" across all rows in memory!`
    });
  };

  // Insert a paragraph/line/slide-para shift
  const handleInsertDocumentElement = (e: React.FormEvent) => {
    e.preventDefault();
    const type = selectedFileDoc?.type;
    if (!type) return;

    if (!docStructContent.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter content to insert.' });
      return;
    }

    let targetSeq = 1;

    if (type === 'docx') {
      const idxs = wordDocumentStructure.paragraphNumbers;
      if (docStructAction === 'end') {
        targetSeq = idxs.length > 0 ? Math.max(...idxs) + 1 : 1;
      } else {
        if (!docStructTarget) {
          setStatusMsg({ type: 'error', text: 'Please select a paragraph position target.' });
          return;
        }
        const selIdx = Number(docStructTarget);
        targetSeq = docStructAction === 'above' ? selIdx : selIdx + 1;
      }

      // Shift existing components
      const updated = localRecords.map((rec) => {
        const match = rec.label.match(/^Paragraph (\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val >= targetSeq) {
            return { ...rec, label: `Paragraph ${val + 1}` };
          }
        }
        return rec;
      });

      const newRec: DocumentRecord = {
        id: `rec-docx-added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `Paragraph ${targetSeq}`,
        value: docStructContent.trim()
      };

      setLocalRecords([...updated, newRec]);
      setDocStructContent('');
      setDocStructTarget('');
      setStatusMsg({ type: 'success', text: `Paragraph ${targetSeq} added successfully! Remember to Save.` });

    } else if (type === 'txt') {
      const idxs = textDocumentStructure.lineNumbers;
      if (docStructAction === 'end') {
        targetSeq = idxs.length > 0 ? Math.max(...idxs) + 1 : 1;
      } else {
        if (!docStructTarget) {
          setStatusMsg({ type: 'error', text: 'Please select a line placement target.' });
          return;
        }
        const selIdx = Number(docStructTarget);
        targetSeq = docStructAction === 'above' ? selIdx : selIdx + 1;
      }

      const updated = localRecords.map((rec) => {
        const match = rec.label.match(/^Line (\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val >= targetSeq) {
            return { ...rec, label: `Line ${val + 1}` };
          }
        }
        return rec;
      });

      const newRec: DocumentRecord = {
        id: `rec-txt-added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `Line ${targetSeq}`,
        value: docStructContent.trim()
      };

      setLocalRecords([...updated, newRec]);
      setDocStructContent('');
      setDocStructTarget('');
      setStatusMsg({ type: 'success', text: `Line ${targetSeq} prepended/appended in memory!` });

    } else if (type === 'pptx') {
      const slideNum = docPptxSlide || 1;
      const paras = presentationStructure.slides[slideNum] || [];
      if (docStructAction === 'end') {
        targetSeq = paras.length > 0 ? Math.max(...paras) + 1 : 1;
      } else {
        if (!docStructTarget) {
          setStatusMsg({ type: 'error', text: 'Please select a text block sequence code.' });
          return;
        }
        const selIdx = Number(docStructTarget);
        targetSeq = docStructAction === 'above' ? selIdx : selIdx + 1;
      }

      const updated = localRecords.map((rec) => {
        const match = rec.label.match(/^Slide (\d+) - Para (\d+)$/);
        if (match) {
          const sName = parseInt(match[1], 10);
          const pSeq = parseInt(match[2], 10);
          if (sName === slideNum && pSeq >= targetSeq) {
            return { ...rec, label: `Slide ${sName} - Para ${pSeq + 1}` };
          }
        }
        return rec;
      });

      const newRec: DocumentRecord = {
        id: `rec-pptx-added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `Slide ${slideNum} - Para ${targetSeq}`,
        value: docStructContent.trim()
      };

      setLocalRecords([...updated, newRec]);
      setDocStructContent('');
      setDocStructTarget('');
      setStatusMsg({ type: 'success', text: `Slide ${slideNum} Text Block ${targetSeq} inserted into in-memory array.` });
    }
  };

  // Update a single spreadsheet cell directly via coordinate selection dropdowns
  const handleUpdateExistingCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingSheet || !existingRow || !existingCol) {
      setStatusMsg({ type: 'error', text: 'Please choose structural target Sheet, Row, and Column coordinates.' });
      return;
    }

    if (matchedCellRec) {
      setLocalRecords((prev) =>
        prev.map((rec) =>
          rec.id === matchedCellRec.id ? { ...rec, value: existingCellValue } : rec
        )
      );
      setStatusMsg({ type: 'success', text: `Updated sheet cell coordinate value successfully! Click "Save Updates" to save for good.` });
    } else {
      const newRec: DocumentRecord = {
        id: `rec-xlsx-added-cell-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: selectedFileId,
        label: `${existingSheet} - Row ${existingRow} - ${existingCol}`,
        value: existingCellValue
      };
      setLocalRecords((prev) => [...prev, newRec]);
      setStatusMsg({ type: 'success', text: `Populated empty cell at coordinate successfully! Click "Save Updates" to save for good.` });
    }
  };

  // Update a document sequence value directly
  const handleUpdateExistingDocElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docExistingId) {
      setStatusMsg({ type: 'error', text: 'Please select a coordinate node item to edit.' });
      return;
    }
    setLocalRecords((prev) =>
      prev.map((rec) =>
        rec.id === docExistingId ? { ...rec, value: docExistingValue } : rec
      )
    );
    setStatusMsg({ type: 'success', text: 'Saved coordinate textual content into memory! Click Save Updates to commit.' });
  };

  // Delete a record from the local state list (soft delete until saved)
  const handleRemoveLocalRecord = (id: string, label: string) => {
    setLocalRecords((prev) => prev.filter((r) => r.id !== id));
    setMatchedRecordIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setStatusMsg({
      type: 'success',
      text: `Removed "${label}" from state list. Make sure to Save Updates.`
    });
  };

  // Save the modified state list back to database
  const handleSaveAll = async () => {
    if (!selectedFileId) return;

    setSaving(true);
    setStatusMsg(null);

    try {
      await saveDocumentRecords(selectedFileId, localRecords);
      setStatusMsg({
        type: 'success',
        text: `Successfully saved ${localRecords.length} records. Your changes are preserved offline inside your browser!`
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: 'Could not save modifications to your browser database: ' + err.message
      });
    } finally {
      setSaving(false);
    }
  };



  const getFileIcon = (type: string) => {
    switch (type) {
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600 inline" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-600 inline" />;
      case 'pptx':
        return <FileCode className="w-5 h-5 text-orange-600 inline" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500 inline" />;
    }
  };

  return (
    <div className="space-y-8" id="update-view-root">
      {/* Introduction */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex justify-between items-start flex-wrap gap-4 animate-fade-in">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-indigo-600" />
            Edit and Manage File Content
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Edit cell values, correct spelling mistakes, or add entirely new records directly in your browser.
          </p>
        </div>
      </div>

      {/* Alert toast display */}
      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-start gap-3 border shadow-xs ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium leading-relaxed flex-1">
              {statusMsg.text}
            </div>
            <button 
              onClick={() => setStatusMsg(null)} 
              className="text-xs font-semibold hover:opacity-75 transition-opacity px-2 text-slate-400 hover:text-slate-755"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Selector Selector Dropdown Panel */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="file-dropdown-selector" className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Choose File to Edit
          </label>
          <div className="relative">
            <select
               id="file-dropdown-selector"
               value={selectedFileId}
               onChange={(e) => setSelectedFileId(e.target.value)}
               className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-slate-700 bg-white transition-all appearance-none outline-hidden text-sm"
            >
              <option value="">-- Select a file ({documents.length} available) --</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.rowCount} parameters, {doc.type.toUpperCase()})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 gap-1 flex items-center pr-3.5 text-slate-400">
              <ListFilter className="w-4 h-4" />
            </div>
          </div>
        </div>

        {selectedFileDoc && (
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] font-mono text-slate-500">
            <div>
              TYPE: <span className="font-bold text-slate-750 uppercase">{selectedFileDoc.type}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div>
              LOCAL FILENAME: <span className="font-bold text-slate-750 truncate max-w-xs">{selectedFileDoc.name}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div>
              CELLS/ROWS: <span className="font-bold text-indigo-600">{localRecords.length}</span>
            </div>
          </div>
        )}
      </div>

      {selectedFileId ? (
        <div className="space-y-6">
          {/* Mode Switcher Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-2xl max-w-sm border border-slate-200/40">
            <button
              onClick={() => setActiveMode('update')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeMode === 'update'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              Update
            </button>
            <button
              onClick={() => setActiveMode('create')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeMode === 'create'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Create
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeMode === 'update' ? (
              <motion.div
                key="update-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="bg-white rounded-2xl border border-slate-150 p-6 space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Parsed Field In-Memory Mapping
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Edit your file values live below.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2.5 rounded-xl font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save Updates'}
                  </button>
                </div>

                 {localRecords.length > 0 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFieldSearchQuery(fieldSearchInput);
                    }}
                    className="space-y-1.5"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Filter parameters by label selector or value..."
                        value={fieldSearchInput}
                        onChange={(e) => setFieldSearchInput(e.target.value)}
                        className="w-full h-11 pl-11 pr-24 text-xs font-semibold text-slate-700 bg-slate-50/50 hover:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl transition-all outline-hidden focus:ring-1 focus:ring-indigo-100 shadow-2xs focus:shadow-xs"
                      />
                      <button
                        type="submit"
                        className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 hover:text-indigo-600 transition-colors pointer-events-auto cursor-pointer border-none bg-transparent"
                        title="Execute Filter"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      {(fieldSearchInput || fieldSearchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFieldSearchInput('');
                            setFieldSearchQuery('');
                          }}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest cursor-pointer border-none bg-transparent"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {fieldSearchQuery && (
                      <div className="text-xs text-indigo-600 font-semibold mt-1.5 pl-1 animate-fade-in">
                        {isSpreadsheet 
                          ? `${groupedSpreadsheetRows.length} row${groupedSpreadsheetRows.length !== 1 ? 's' : ''} found (${filteredLocalRecords.length} cell${filteredLocalRecords.length !== 1 ? 's' : ''})` 
                          : `${filteredLocalRecords.length} record${filteredLocalRecords.length !== 1 ? 's' : ''} found`
                        } for "{fieldSearchQuery}"
                      </div>
                    )}
                  </form>
                )}

                {localRecords.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="text-sm font-medium">No fields indexed for this file or all records were removed.</p>
                    <p className="text-xs mt-1">Use the "Create" button tab above to manually append records.</p>
                  </div>
                ) : !fieldSearchQuery.trim() ? (
                  <div className="p-16 text-center text-slate-400 space-y-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/20 animate-fade-in">
                    <div className="w-12 h-12 rounded-full bg-indigo-50/70 flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100">
                      <Search className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">Awaiting Search Query</p>
                      <p className="text-xs max-w-sm mx-auto leading-relaxed text-slate-500">
                        Type a keyword, column name, or cell value into the filter input above. Results are hidden by default, and matching spreadsheet rows will load with all their cell values for aligned client updates.
                      </p>
                    </div>
                  </div>
                ) : filteredLocalRecords.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-4 border border-dashed border-slate-200 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">No Parameters Match Keyword</p>
                      <p className="text-xs max-w-xs mx-auto leading-relaxed">
                        No records matched <strong className="text-slate-600">"{fieldSearchQuery}"</strong>. Please check your spelling or clear the filter query.
                      </p>
                    </div>
                    <button
                      onClick={() => setFieldSearchQuery('')}
                      className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all rounded-lg cursor-pointer border border-transparent"
                    >
                      Reset Filter Search
                    </button>
                  </div>
                ) : isSpreadsheet ? (
                  <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {groupedSpreadsheetRows.map((rowGroup) => (
                        <motion.div
                          key={rowGroup.key}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="p-5 bg-slate-50/35 rounded-xl border border-slate-150 hover:border-slate-300 transition-all hover:bg-white space-y-4 hover:shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold font-mono">
                                XLSX ROW
                              </span>
                              <h4 className="text-xs font-bold text-slate-700">
                                {rowGroup.sheetName} — Row {rowGroup.rowNum}
                              </h4>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rowGroup.records.map((rec) => {
                              const match = rec.label.match(/^(.*) - Row (\d+) - (.*)$/);
                              const colName = match ? match[3] : rec.label;
                              const isMatch = fieldSearchQuery && (
                                rec.label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                                rec.value.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                              );
                              
                              return (
                                <div 
                                  key={rec.id} 
                                  className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                                    isMatch
                                      ? 'bg-amber-50/60 border-amber-305 ring-1 ring-amber-100'
                                      : 'bg-white border-slate-150 focus-within:border-indigo-400'
                                  }`}
                                >
                                  <div className="flex justify-between items-center gap-1">
                                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest truncate" title={rec.label}>
                                      {colName}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLocalRecord(rec.id, rec.label)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Remove Column Value"
                                    >
                                      <Trash className="w-3 h-3" />
                                    </button>
                                  </div>
                                  
                                  <input
                                    type="text"
                                    value={rec.value}
                                    onChange={(e) => handleValueChange(rec.id, e.target.value)}
                                    className="w-full text-xs font-medium border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-800 bg-white transition-colors outline-hidden search-item-input"
                                    placeholder="Empty attribute cell"
                                  />
                                  
                                  <details className="text-[9px] text-slate-400 cursor-pointer select-none">
                                    <summary className="hover:text-slate-600 font-semibold focus:outline-hidden text-[8px] uppercase tracking-wider">Edit Label Path</summary>
                                    <input
                                      type="text"
                                      value={rec.label}
                                      onChange={(e) => handleLabelChange(rec.id, e.target.value)}
                                      className="mt-1 w-full text-[9px] font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-hidden"
                                    />
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {filteredLocalRecords.map((rec) => (
                        <motion.div
                          key={rec.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          layoutId={rec.id}
                          transition={{ duration: 0.15 }}
                          className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center hover:shadow-2xs transition-all hover:bg-white hover:border-slate-300"
                        >
                          {/* Key Label Input */}
                          <div className="sm:col-span-4">
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                              Label Selector
                            </label>
                            <input
                              type="text"
                              value={rec.label}
                              onChange={(e) => handleLabelChange(rec.id, e.target.value)}
                              className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg px-2.5 py-2 text-slate-800 transition-colors"
                              title="Database representation path structure"
                            />
                          </div>

                          {/* Value text input fields */}
                          <div className="sm:col-span-7">
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                              Extracted Value Content
                            </label>
                            <input
                              type="text"
                              value={rec.value}
                              onChange={(e) => handleValueChange(rec.id, e.target.value)}
                              className="w-full text-sm font-medium border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-700 transition-colors bg-white font-sans"
                              placeholder="Empty content row"
                            />
                          </div>

                          {/* Quick Delete parameter row */}
                          <div className="sm:col-span-1 text-right sm:text-center shrink-0">
                            <label className="text-[10px] uppercase font-bold text-transparent block mb-1 max-sm:hidden">
                              R
                            </label>
                            <button
                              onClick={() => handleRemoveLocalRecord(rec.id, rec.label)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors active:scale-90 inline-block cursor-pointer border border-transparent hover:border-rose-100"
                              title="Remove Parameter Entry"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                
                {/* Quick footer save shortcut */}
                {localRecords.length > 5 && (
                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      onClick={handleSaveAll}
                      disabled={saving}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-6 py-2.5 rounded-xl font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Updates'}
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="create-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Create Options Sub-tabs */}
                <div className="flex border-b border-slate-200 gap-4 sm:gap-6 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCreateSubTab('structure')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
                      createSubTab === 'structure'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📂 {isSpreadsheet ? 'Add Row / Column' : 'Add Section / Paragraph'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateSubTab('custom')}
                    className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
                      createSubTab === 'custom'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🏷️ Custom Parameters
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Left Column: Form Controllers */}
                  <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-150 space-y-5 shadow-xs">
                    
                    {/* SUB-TAB 1: STRUCTURE INSERTION */}
                    {createSubTab === 'structure' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            {isSpreadsheet ? 'Add Row or Column' : 'Add Paragraph'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {isSpreadsheet 
                              ? `Add a new row or column to your spreadsheet "${selectedFileDoc?.name}".`
                              : `Add a paragraph or text segment to your document "${selectedFileDoc?.name}".`}
                          </p>
                        </div>

                        {isSpreadsheet ? (
                          // SPREADSHEET FORM
                          <div className="space-y-4 pt-1">
                            {/* Insert Row or Column Selection */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Insertion Target
                              </label>
                              <div className="flex bg-slate-100 p-1 rounded-xl max-w-xs border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setStructType('row')}
                                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    structType === 'row' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Insert Row
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStructType('col')}
                                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    structType === 'col' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Add Column
                                </button>
                              </div>
                            </div>

                            {/* Select Sheet Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label htmlFor="struct-sheet-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Target Sheet
                                </label>
                                <select
                                  id="struct-sheet-select"
                                  value={structSheet}
                                  onChange={(e) => setStructSheet(e.target.value)}
                                  className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                >
                                  {spreadsheetStructure.sheets.map((sheet) => (
                                    <option key={sheet} value={sheet}>{sheet}</option>
                                  ))}
                                  {spreadsheetStructure.sheets.length === 0 && <option value="">Sheet1</option>}
                                </select>
                              </div>

                              {structType === 'row' && (
                                <div className="space-y-1.5">
                                  <label htmlFor="struct-pos-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Row Placement Location
                                  </label>
                                  <select
                                    id="struct-pos-select"
                                    value={structRowPosition}
                                    onChange={(e) => setStructRowPosition(e.target.value as any)}
                                    className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                  >
                                    <option value="end">Add Row at end of Sheet</option>
                                    <option value="above">Insert Row Above Specific Row</option>
                                    <option value="below">Insert Row Below Specific Row</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Row specific inserts */}
                            {structType === 'row' ? (
                              <form onSubmit={handleInsertRow} className="space-y-4 pt-1">
                                {structRowPosition !== 'end' && (
                                  <div className="space-y-1.5 max-w-xs">
                                    <label htmlFor="struct-target-row-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      Target Row Position
                                    </label>
                                    <select
                                      id="struct-target-row-select"
                                      value={structTargetRow}
                                      onChange={(e) => setStructTargetRow(e.target.value)}
                                      required
                                      className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                    >
                                      <option value="">-- Choose Row --</option>
                                      {(spreadsheetStructure.rowsBySheet[structSheet] || []).map((rowNum) => (
                                        <option key={rowNum} value={rowNum}>Row {rowNum}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Row Inputs for columns dynamic rendering */}
                                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1.5">
                                    Enter Row Details
                                  </span>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {(spreadsheetStructure.columnsBySheet[structSheet] || ['Value']).map((col) => (
                                      <div key={col} className="space-y-1">
                                        <label htmlFor={`col-input-${col}`} className="text-[10px] font-mono font-bold text-slate-600 block">
                                          {col}
                                        </label>
                                        <input
                                          id={`col-input-${col}`}
                                          type="text"
                                          placeholder={`Enter values for ${col}...`}
                                          value={structRowData[col] || ''}
                                          onChange={(e) => setStructRowData({ ...structRowData, [col]: e.target.value })}
                                          className="w-full text-xs border border-slate-250 rounded-lg px-2.5 h-9 bg-white focus:border-indigo-505"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-lg active:scale-[0.98] transition-all cursor-pointer border border-transparent shadow-xs"
                                >
                                  + Add Row
                                </button>
                              </form>
                            ) : (
                              // COLUMN FORM
                              <form onSubmit={handleInsertColumn} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label htmlFor="col-name-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      New Column Label Name
                                    </label>
                                    <input
                                      id="col-name-input"
                                      type="text"
                                      required
                                      placeholder="e.g. Email Address, Primary Contact"
                                      value={structColName}
                                      onChange={(e) => setStructColName(e.target.value)}
                                      className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label htmlFor="col-default-val-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      Default Cell Starting Value
                                    </label>
                                    <input
                                      id="col-default-val-input"
                                      type="text"
                                      placeholder="e.g. N/A or Pending Update"
                                      value={structColDefaultVal}
                                      onChange={(e) => setStructColDefaultVal(e.target.value)}
                                      className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                    />
                                  </div>
                                </div>

                                <button
                                  type="submit"
                                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-lg active:scale-[0.98] transition-all cursor-pointer border border-transparent shadow-xs"
                                >
                                  + Add Column
                                </button>
                              </form>
                            )}
                          </div>
                        ) : (
                          // DOCUMENTS FORM
                          <form onSubmit={handleInsertDocumentElement} className="space-y-4 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {selectedFileDoc?.type === 'pptx' && (
                                <div className="space-y-1.5">
                                  <label htmlFor="doc-slide-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Target Slide Number
                                  </label>
                                  <select
                                    id="doc-slide-select"
                                    value={docPptxSlide}
                                    onChange={(e) => setDocPptxSlide(Number(e.target.value))}
                                    className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                  >
                                    {(presentationStructure.slideNumbers || [1]).map((s) => (
                                      <option key={s} value={s}>Slide {s}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <label htmlFor="doc-action-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Structural Location
                                </label>
                                <select
                                  id="doc-action-select"
                                  value={docStructAction}
                                  onChange={(e) => setDocStructAction(e.target.value as any)}
                                  className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                >
                                  <option value="end">Add at the end of Document</option>
                                  <option value="above">Insert Above Selected coordinate</option>
                                  <option value="below">Insert Below Selected coordinate</option>
                                </select>
                              </div>

                              {docStructAction !== 'end' && (
                                <div className="space-y-1.5">
                                  <label htmlFor="doc-target-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Target Placement Anchor
                                  </label>
                                  <select
                                    id="doc-target-select"
                                    value={docStructTarget}
                                    onChange={(e) => setDocStructTarget(e.target.value)}
                                    required
                                    className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg h-10 px-3 bg-white"
                                  >
                                    <option value="">-- Select Anchor --</option>
                                    {selectedFileDoc?.type === 'docx' && (wordDocumentStructure.paragraphNumbers || []).map((num) => (
                                      <option key={num} value={num}>Paragraph {num}</option>
                                    ))}
                                    {selectedFileDoc?.type === 'txt' && (textDocumentStructure.lineNumbers || []).map((num) => (
                                      <option key={num} value={num}>Line {num}</option>
                                    ))}
                                    {selectedFileDoc?.type === 'pptx' && (presentationStructure.slides[docPptxSlide] || []).map((num) => (
                                      <option key={num} value={num}>Slide Text Segment {num}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <label htmlFor="doc-content-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Text Block Content
                              </label>
                              <textarea
                                id="doc-content-input"
                                required
                                rows={4}
                                placeholder="Enter paragraphs, list points or sentences here..."
                                value={docStructContent}
                                onChange={(e) => setDocStructContent(e.target.value)}
                                className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg p-3 bg-white text-slate-800"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-lg active:scale-[0.98] transition-all cursor-pointer border border-transparent shadow-xs"
                            >
                              {selectedFileDoc?.type === 'pptx' ? '+ Add Text Block' : selectedFileDoc?.type === 'txt' ? '+ Add Line' : '+ Add Paragraph'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}


                    {/* SUB-TAB 3: LEGACY APPEND MANUALLY */}
                    {createSubTab === 'custom' && (
                      <div className="space-y-4 animate-fade-in">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                            Add Custom Parameter
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Manually add customized key-value parameters to this file.
                          </p>
                        </div>

                        <form onSubmit={handleAddNewRecord} className="space-y-4 pt-1">
                          <div className="space-y-1.5">
                            <label htmlFor="new-key-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Parameter Name
                            </label>
                            <input
                              id="new-key-input"
                              type="text"
                              required
                              placeholder="e.g. Primary Email Address"
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                              className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg px-3.5 py-2.5 bg-white text-slate-800 transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label htmlFor="new-val-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Parameter Value
                            </label>
                            <textarea
                              id="new-val-input"
                              placeholder="Enter cell or line value..."
                              rows={4}
                              value={newValue}
                              onChange={(e) => setNewValue(e.target.value)}
                              className="w-full text-xs border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-lg px-3.5 py-2.5 bg-white text-slate-800 transition-colors"
                            />
                          </div>

                          <div className="flex gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setNewKey('');
                                setNewValue('');
                              }}
                              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer animate-fade-in"
                            >
                              Clear Fields
                            </button>
                            <button
                              type="submit"
                              className="flex-1 bg-slate-801 hover:bg-slate-900 border border-transparent text-slate-800 font-semibold bg-slate-100 text-xs py-2.5 px-4 rounded-lg transition-all active:scale-[0.98] cursor-pointer"
                            >
                              + Add Parameter
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                  </div>

                  {/* Right Column: Information, Alerts, Save Actions */}
                  <div className="space-y-6">
                    {/* File specs summaries */}
                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-150 space-y-3.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">File Summary</h4>
                      <div className="space-y-4 text-xs">
                        <div className="flex justify-between items-center border-b border-dotted pb-2 text-slate-600">
                          <span>File Type:</span>
                          <span className="font-mono font-bold uppercase text-slate-800 px-1.5 py-0.5 bg-slate-100/70 rounded text-[10px]">
                            {selectedFileDoc?.type}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-dotted pb-2 text-slate-600">
                          <span>Active Columns:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {isSpreadsheet 
                              ? (spreadsheetStructure.columnsBySheet[structSheet] || []).length 
                              : '1 (Flat Text)'}
                          </span>
                        </div>
                        {isSpreadsheet && (
                          <div className="flex justify-between items-center border-b border-dotted pb-2 text-slate-600">
                            <span>Active Rows:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {(spreadsheetStructure.rowsBySheet[structSheet] || []).length}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-b border-dotted pb-2 text-slate-600">
                          <span>Total Recorded Data:</span>
                          <span className="font-mono font-bold text-indigo-600">
                            {localRecords.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 space-y-4 animate-fade-in">
          <Database className="w-12 h-12 text-indigo-300 mx-auto" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-700">No File Selected</p>
            <p className="text-xs max-w-sm mx-auto leading-relaxed">
              Choose a file from the dropdown above to load its content, view its rows, and start making changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
