import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { type DocumentRecord, type IndexedDocument } from '../types';
import { 
  Search, 
  FileText, 
  Database, 
  Tag, 
  Info, 
  SlidersHorizontal,
  ChevronRight,
  FileSpreadsheet,
  FileCode,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SearchView() {
  const [fileFilter, setFileFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [allRecords, setAllRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Live queries for documents metadata
  const docList = useLiveQuery(() => db.documents.toArray()) || [];

  // Create a lookup map of documents for ultra-fast name retrieval in search outputs
  const docMap = React.useMemo(() => {
    const map: Record<string, IndexedDocument> = {};
    docList.forEach((doc) => {
      map[doc.id] = doc;
    });
    return map;
  }, [docList]);

  // Load records according to fileFilter option
  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        if (fileFilter === 'all') {
          const records = await db.records.toArray();
          setAllRecords(records);
        } else {
          const records = await db.records.where('fileId').equals(fileFilter).toArray();
          setAllRecords(records);
        }
      } catch (err) {
        console.error('Failed to query records:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [fileFilter, docList]);

  // Group all spreadsheet records in memory by their Row compound key to display full row context
  const xlsxRows = React.useMemo(() => {
    const rows: Record<string, { sheetName: string; rowNum: string; cells: { colName: string; value: string; originalId: string }[] }> = {};
    
    allRecords.forEach((rec) => {
      const doc = docMap[rec.fileId];
      if (doc && doc.type === 'xlsx') {
        const match = rec.label.match(/^(.*) - Row (\d+) - (.*)$/);
        if (match) {
          const sheetName = match[1];
          const rowNum = match[2];
          const colName = match[3];
          const key = `${rec.fileId}::${sheetName}::${rowNum}`;
          
          if (!rows[key]) {
            rows[key] = {
              sheetName,
              rowNum,
              cells: []
            };
          }
          rows[key].cells.push({ colName, value: rec.value, originalId: rec.id });
        }
      }
    });
    
    return rows;
  }, [allRecords, docMap]);

  // Transform records into unified SearchResults (grouped XLSX rows & independent standard document records)
  const allProcessedResults = React.useMemo(() => {
    const list: {
      id: string;
      type: 'xlsx-row' | 'standard';
      parentDocId: string;
      record?: DocumentRecord;
      xlsxSheetName?: string;
      xlsxRowNum?: string;
      xlsxCells?: { colName: string; value: string; originalId: string }[];
    }[] = [];
    
    const addedXlsxKeys = new Set<string>();

    allRecords.forEach((rec) => {
      const doc = docMap[rec.fileId];
      if (doc && doc.type === 'xlsx') {
        const match = rec.label.match(/^(.*) - Row (\d+) - (.*)$/);
        if (match) {
          const sheetName = match[1];
          const rowNum = match[2];
          const key = `${rec.fileId}::${sheetName}::${rowNum}`;
          
          if (!addedXlsxKeys.has(key)) {
            addedXlsxKeys.add(key);
            const rowData = xlsxRows[key];
            if (rowData) {
              list.push({
                id: `row-${key}`,
                type: 'xlsx-row',
                parentDocId: rec.fileId,
                xlsxSheetName: sheetName,
                xlsxRowNum: rowNum,
                xlsxCells: rowData.cells
              });
            }
          }
        } else {
          list.push({
            id: rec.id,
            type: 'standard',
            parentDocId: rec.fileId,
            record: rec
          });
        }
      } else {
        list.push({
          id: rec.id,
          type: 'standard',
          parentDocId: rec.fileId,
          record: rec
        });
      }
    });

    return list;
  }, [allRecords, docMap, xlsxRows]);

  // Filter records case-insensitively based on text inputs
  const filteredResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return allProcessedResults.filter((item) => {
      if (item.type === 'standard' && item.record) {
        const matchLabel = item.record.label.toLowerCase().includes(query);
        const matchVal = item.record.value.toLowerCase().includes(query);
        return matchLabel || matchVal;
      } else if (item.type === 'xlsx-row' && item.xlsxCells) {
        if (item.xlsxSheetName?.toLowerCase().includes(query)) return true;
        if (`row ${item.xlsxRowNum}`.toLowerCase().includes(query)) return true;
        return item.xlsxCells.some(
          (cell) =>
            cell.colName.toLowerCase().includes(query) ||
            cell.value.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [allProcessedResults, searchQuery]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'xlsx':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'pptx':
        return <FileCode className="w-4 h-4 text-orange-600 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  /**
   * Highlights the matched search term in text for maximum visual scannability
   */
  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return <span>{text}</span>;
    
    const parts = text.split(new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) => 
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={index} className="bg-amber-100 text-amber-950 font-semibold px-0.5 rounded-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="space-y-8" id="search-view-root">
      {/* Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs animate-fade-in">
        <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-600" />
          Search Your Files
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Search across all your sheets, documents, and slides. Matches are made fully offline on your device.
        </p>
      </div>

      {/* Query Filter and Search bar panel */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-4 font-sans">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Document Isolation dropdown filter */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <label htmlFor="search-file-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Search Specific File
            </label>
            <div className="relative">
              <select
                id="search-file-select"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 hover:border-slate-350 focus:border-indigo-500 text-slate-700 bg-white transition-all appearance-none text-sm cursor-pointer outline-hidden"
              >
                <option value="all">📁 All Files ({docList.length})</option>
                {docList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.type === 'xlsx' ? '📊' : doc.type === 'docx' ? '📝' : doc.type === 'pptx' ? '🖥️' : '📄'} {doc.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search bar inputs */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              setSearchQuery(searchInput);
            }}
            className="md:col-span-8 flex flex-col gap-1.5"
          >
            <label htmlFor="search-input-field" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Type Keywords to Search
            </label>
            <div className="relative">
              <input
                id="search-input-field"
                type="text"
                placeholder="What would you like to find? (e.g., Akhila, Row 3, Total)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-11 pl-11 pr-24 rounded-xl border border-slate-200 hover:border-slate-350 focus:border-indigo-500 text-slate-700 transition-all font-medium text-sm bg-white"
              />
              <button
                type="submit"
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-indigo-600 transition-colors pointer-events-auto cursor-pointer border-none bg-transparent"
                title="Execute Search"
              >
                <Search className="w-5 h-5" />
              </button>
              
              {(searchInput || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-none bg-transparent"
                >
                  Clear
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="text-xs text-indigo-600 font-semibold mt-1.5 pl-1 animate-fade-in">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found for "{searchQuery}"
              </div>
            )}
          </form>

        </div>

        {/* Stats strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
          <div className="flex gap-4">
            <span>TOTAL: <strong className="text-slate-600">{allRecords.length} records</strong></span>
            <span>MATCHES: <strong className="text-indigo-600">{filteredResults.length} rows found</strong></span>
          </div>
          {searchQuery && (
            <span className="text-indigo-500 font-semibold uppercase">SEARCH ACTIVE</span>
          )}
        </div>
      </div>

      {/* Match Results list */}
      {loading ? (
        <div className="py-24 text-center">
          <Database className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Searching through files...</p>
        </div>
      ) : !searchQuery.trim() ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 space-y-4 shadow-sm animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600 border border-indigo-100 animate-pulse">
            <Search className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-800">Awaiting Search Keywords</p>
            <p className="text-xs max-w-sm mx-auto leading-relaxed text-slate-500">
              Type some keywords in the search box above to instantly find matching text in your spreadsheets, documents, and presentations.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setSearchInput('row 1');
                setSearchQuery('row 1');
              }}
              className="px-3 py-1.5 text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Try "row 1"
            </button>
            <button
              onClick={() => {
                setSearchInput('total');
                setSearchQuery('total');
              }}
              className="px-3 py-1.5 text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Try "total"
            </button>
          </div>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-700">No Matched Entries</p>
            <p className="text-xs max-w-md mx-auto leading-relaxed">
              No matching parameter labels or cell values found for the query <strong className="text-slate-600">"{searchQuery}"</strong>. 
              Verify your casing (though search handles it automatically) or filter selections.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
            Matched Parameters Index ({filteredResults.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredResults.map((item) => {
                const parentDoc = docMap[item.parentDocId];
                
                if (item.type === 'xlsx-row') {
                  return (
                    <motion.div
                      key={item.id}
                      layoutId={item.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="bg-white border border-slate-150 p-5 rounded-xl hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between md:col-span-2 shadow-2xs"
                    >
                      <div className="space-y-3">
                        {/* Spreadsheet Row Header */}
                        <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold font-mono text-xs">
                              XLSX Row
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {item.xlsxSheetName} — Row {item.xlsxRowNum}
                            </span>
                          </div>
                          
                          {parentDoc && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 max-w-[200px]">
                              {getFileIcon(parentDoc.type)}
                              <span className="truncate font-medium text-[11px]" title={parentDoc.name}>
                                {parentDoc.name}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Rendering the Full Row Columns Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1.5">
                          {item.xlsxCells?.map((cell, cIdx) => {
                            const isValMatched = searchQuery && cell.value.toLowerCase().includes(searchQuery.toLowerCase());
                            const isColMatched = searchQuery && cell.colName.toLowerCase().includes(searchQuery.toLowerCase());
                            
                            return (
                              <div 
                                key={cIdx} 
                                className={`p-2.5 rounded-lg border transition-all flex flex-col gap-0.5 ${
                                  isValMatched || isColMatched
                                    ? 'bg-amber-50/70 border-amber-250'
                                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                }`}
                              >
                                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider truncate" title={cell.colName}>
                                  {highlightMatch(cell.colName, searchQuery)}
                                </span>
                                <span className="text-xs font-medium text-slate-800 break-words leading-relaxed line-clamp-3">
                                  {highlightMatch(cell.value, searchQuery)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Spreadsheet Metadata Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-300" />
                          ROW KEY: {item.xlsxSheetName}_R{item.xlsxRowNum}
                        </div>
                        <div className="flex items-center gap-1">
                          <ArrowRightLeft className="w-3 h-3 text-emerald-400" />
                          OFFLINE SYNCED ROW
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                // Default individual card representation for docx paragraphs / slides / list elements
                const rec = item.record!;
                return (
                  <motion.div
                    key={rec.id}
                    layoutId={rec.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white border border-slate-150 p-5 rounded-xl hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      
                      {/* Grid Item Header - Label & Category */}
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md truncate max-w-[210px]" title={rec.label}>
                          {highlightMatch(rec.label, searchQuery)}
                        </span>
                        
                        {parentDoc && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 max-w-[150px]">
                            {getFileIcon(parentDoc.type)}
                            <span className="truncate font-medium text-[11px]" title={parentDoc.name}>
                              {parentDoc.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Main Record Value Text area */}
                      <div className="pt-1.5">
                        <p className="text-sm font-semibold text-slate-800 break-words leading-relaxed font-sans min-h-[40px] pl-1 border-l-2 border-indigo-500/20">
                          {highlightMatch(rec.value, searchQuery)}
                        </p>
                      </div>

                    </div>

                    {/* Metadata Footer bar */}
                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-300" />
                        ID: {rec.id.substring(rec.id.length - 8)}
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3 text-emerald-400" />
                        OFFLINE SAFE
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
