import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db';
import { parseDocument, MAX_FILE_SIZE_BYTES, compileFileBlob } from '../utils/parser';
import { saveDocumentToDb, deleteDocumentFromDb } from '../utils/dbHelpers';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  HardDrive, 
  FileCode, 
  Plus,
  Loader2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function UploadView() {
  const [isDragActive, setIsDragActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingFileName, setProcessingFileName] = useState('');
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<{ id: string; name: string } | null>(null);

  // Live monitor the IndexedDB documents list using Dexie's live query hook
  const documentsList = useLiveQuery(() => db.documents.orderBy('uploadedAt').reverse().toArray()) || [];

  // Automatically clear success toasts after some time
  useEffect(() => {
    if (statusMsg && statusMsg.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMsg(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Handle Drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  // Perform document reading and ingestion
  const processAndIngestFile = async (file: File) => {
    if (!file) return;

    setProcessingFileName(file.name);
    setStatusMsg(null);

    // 1. Validate File Size Constraint (10MB Limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatusMsg({
        type: 'error',
        text: `"${file.name}" is bigger than our 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).`
      });
      setIsDragActive(false);
      return;
    }

    setParsing(true);
    setProgress(15);

    try {
      const progressTimer = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + Math.floor(Math.random() * 15) + 5 : prev));
      }, 200);

      const parsedData = await parseDocument(file);
      
      clearInterval(progressTimer);
      setProgress(95);

      // Save to IndexedDB
      const docId = await saveDocumentToDb(file.name, parsedData.type, file.size, parsedData.records);

      setProgress(100);
      setTimeout(() => {
        setParsing(false);
        setProgress(0);
        setStatusMsg({
          type: 'success',
          text: `"${file.name}" uploaded successfully! We indexed ${parsedData.records.length} items.`
        });
      }, 400);

    } catch (err: any) {
      setParsing(false);
      setProgress(0);
      setStatusMsg({
        type: 'error',
        text: err.message || 'We could not read this file. Please make sure it is not corrupted.'
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndIngestFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processAndIngestFile(e.target.files[0]);
    }
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    setDeleteConfirmDoc({ id, name });
  };

  const executeDelete = async () => {
    if (!deleteConfirmDoc) return;
    const { id, name } = deleteConfirmDoc;
    setDeleteConfirmDoc(null);
    try {
      await deleteDocumentFromDb(id);
      setStatusMsg({
        type: 'success',
        text: `Deleted "${name}" from your browser.`
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: 'Could not delete the file. Please try again.'
      });
    }
  };

  // Human-friendly byte helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Document icons selector mapping
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'xlsx':
        return <FileSpreadsheet className="w-8 h-8 text-emerald-600" />;
      case 'docx':
        return <FileText className="w-8 h-8 text-blue-600" />;
      case 'pptx':
        return <FileCode className="w-8 h-8 text-orange-600" />;
      default:
        return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-8" id="upload-panel-container">
      {/* Title & Introduction block */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs animate-fade-in">
        <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-indigo-600" />
          Upload and Manage Files
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Drag and drop spreadsheets, documents, or presentations here to search and edit them. Everything stays private on your browser and never leaves your computer.
        </p>
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
              className="text-xs font-semibold hover:opacity-75 transition-opacity px-2 text-slate-400 hover:text-slate-700"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Drag-Drop parsing box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all bg-white overflow-hidden ${
              isDragActive 
                ? 'border-indigo-500 bg-indigo-50/20 scale-[0.99] shadow-inner' 
                : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
            }`}
          >
            <input 
              type="file" 
              id="file-upload-input" 
              className="hidden" 
              accept=".docx,.xlsx,.pptx,.txt"
              onChange={handleFileChange}
              disabled={parsing}
            />

            {!parsing ? (
              <label 
                htmlFor="file-upload-input" 
                className="cursor-pointer flex flex-col items-center justify-center space-y-4 py-8"
              >
                <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-slate-700">
                    Drag and drop files here, or <span className="text-indigo-600 hover:text-indigo-700 underline font-semibold">browse files</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    We support Word documents (.docx), Excel spreadsheets (.xlsx), PowerPoint presentations (.pptx), and plain text files (.txt)
                  </p>
                </div>
                <div className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
                  Max file size: 10MB
                </div>
              </label>
            ) : (
              <div className="py-12 space-y-6 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <div className="space-y-2 max-w-sm w-full">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Loading your file...
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {processingFileName}
                  </p>
                  
                  {/* Progress Container */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3 border border-slate-50">
                    <motion.div 
                      className="bg-indigo-600 h-full rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>Status: Reading file</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Formats Guidelines Sidebar Panel */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50 space-y-4">
          <h3 className="text-sm font-bold text-slate-750 uppercase tracking-wide">
            How we read your files
          </h3>

          <div className="space-y-4 text-xs text-slate-600">
            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">X</span>
              <div>
                <strong className="text-slate-800 block">Excel (.xlsx)</strong>
                Loads each sheet tab and rows so you can view, edit, or filter cells individually.
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 font-bold">W</span>
              <div>
                <strong className="text-slate-800 block">Word (.docx)</strong>
                Splits headings and paragraphs into editable lines.
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-md bg-orange-100 text-orange-850 flex items-center justify-center shrink-0 font-bold">P</span>
              <div>
                <strong className="text-slate-800 block">PowerPoint (.pptx)</strong>
                Extracts the text from every slide of your presentation.
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-800 flex items-center justify-center shrink-0 font-bold">T</span>
              <div>
                <strong className="text-slate-800 block">Plain Text (.txt)</strong>
                Reads your log or text file line-by-line.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Indexed Files Inventory Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Your Uploaded Files ({documentsList.length})
            </h3>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-mono font-bold">
              LOCAL FILE STORAGE
            </span>
          </div>
        </div>

        {documentsList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 space-y-2">
            <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">Your folder is empty</p>
            <p className="text-xs">Drag and drop files in the box above to start editing them offline.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500 border-b border-slate-100">
                  <th className="p-4 pl-6">File Name</th>
                  <th className="p-4">Extension</th>
                  <th className="p-4">File Size</th>
                  <th className="p-4">Indexed Rows</th>
                  <th className="p-4">Uploaded At</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                {documentsList.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6 font-medium text-slate-800 text-ellipsis overflow-hidden max-w-[280px]">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.type)}
                        <span className="truncate" title={doc.name}>{doc.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`uppercase font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                        doc.type === 'xlsx' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        doc.type === 'docx' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        doc.type === 'pptx' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs">{formatBytes(doc.size)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        {doc.rowCount} row{doc.rowCount !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-400">
                      {new Date(doc.uploadedAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                        className="p-1 px-2.5 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition-all outline-hidden cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Native confirmation modal to prevent iFrame window.confirm blocks */}
      <AnimatePresence>
        {deleteConfirmDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmDoc(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-2xl border border-slate-150 p-6 max-w-md w-full shadow-xl space-y-4 z-10 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-950">Erase File?</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Are you sure you want to delete <strong className="text-slate-800 break-all">"{deleteConfirmDoc.name}"</strong> from your browser? Any edits you made will be permanently deleted.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmDoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:scale-95 transition-all rounded-lg border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all rounded-lg shadow-xs cursor-pointer border border-transparent"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
