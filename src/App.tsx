import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from './db';
import UploadView from './components/UploadView';
import UpdateView from './components/UpdateView';
import SearchView from './components/SearchView';
import { compileFileBlob } from './utils/parser';
import { 
  Database, 
  UploadCloud, 
  FileEdit, 
  Search, 
  Menu, 
  X,
  HardDrive,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Clock,
  Download,
  Loader2,
  FileText,
  FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PanelTab = 'upload' | 'update' | 'search';

export default function App() {
  const [activeTab, setActiveTab] = useState<PanelTab>('upload');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDrawerFiles, setSelectedDrawerFiles] = useState<string[]>([]);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [downloadingBatch, setDownloadingBatch] = useState(false);

  // Live database summary statistics
  const docCount = useLiveQuery(() => db.documents.count()) ?? 0;
  const recCount = useLiveQuery(() => db.records.count()) ?? 0;

  // Live list of documents for sliding drawer exports
  const documentsList = useLiveQuery(() => db.documents.orderBy('uploadedAt').reverse().toArray()) || [];

  // Bytes formatting helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Compile specific modified file with name changes and trigger download
  const getModifiedFilename = (name: string, customName?: string) => {
    const extIndex = name.lastIndexOf('.');
    const ext = extIndex !== -1 ? name.substring(extIndex + 1) : '';
    const baseName = extIndex !== -1 ? name.substring(0, extIndex) : name;

    const baseToUse = customName && customName.trim() ? customName.trim() : baseName;
    const isoTimestamp = new Date().toISOString().replace(/:/g, '-');
    return `${baseToUse}_modified_${isoTimestamp}.${ext}`;
  };

  const executeDownload = async (doc: any) => {
    try {
      const records = await db.records.where('fileId').equals(doc.id).toArray();
      const blob = compileFileBlob(doc.type, records);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const customName = customNames[doc.id];
      a.download = getModifiedFilename(doc.name, customName);
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download compilation failed for', doc.name, err);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedDrawerFiles.length === 0) return;
    setDownloadingBatch(true);
    const docsToDownload = documentsList.filter(doc => selectedDrawerFiles.includes(doc.id));
    for (const doc of docsToDownload) {
      await executeDownload(doc);
    }
    setDownloadingBatch(false);
  };

  // Tabs structure
  const tabsList = [
    { 
      id: 'upload' as PanelTab, 
      label: 'Upload Files', 
      icon: <UploadCloud className="w-5 h-5" />, 
      shortDesc: 'Import or drag new files' 
    },
    { 
      id: 'update' as PanelTab, 
      label: 'Update Client Details', 
      icon: <FileEdit className="w-5 h-5" />, 
      shortDesc: 'Edit text rows and cells' 
    },
    { 
      id: 'search' as PanelTab, 
      label: 'Search Files', 
      icon: <Search className="w-5 h-5" />, 
      shortDesc: 'Find matched data instantly' 
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row relative" id="main-app-shell">
      
      {/* Mobile nav header bar */}
      <div className="md:hidden w-full h-16 bg-slate-900 text-white flex items-center justify-between px-4 border-b border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
            CI
          </div>
          <span className="font-semibold tracking-tight text-sm">Cust Info</span>
        </div>
        
        <button 
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Main Sidebar Navigation Panel */}
      <div className={`
        fixed inset-y-0 left-0 bg-slate-900 text-white w-64 p-6 flex flex-col justify-between border-r border-slate-800 z-40 transition-transform duration-300 transform md:translate-x-0 md:static md:h-screen shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="space-y-8">
          {/* Brand/Heading block */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-indigo-600/20">
              CI
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white text-base">Cust Info</h1>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">OFFLINE MANAGER</span>
            </div>
          </div>

          {/* Connected db indicators badge */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Local Storage</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle className="w-2.5 h-2.5" /> PRIVATE
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-800">
                <span className="text-sm font-bold block text-white font-mono">{docCount}</span>
                <span className="text-[9px] text-slate-500 font-semibold block uppercase">FILES</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-800">
                <span className="text-sm font-bold block text-indigo-400 font-mono">{recCount}</span>
                <span className="text-[9px] text-slate-500 font-semibold block uppercase">RECORDS</span>
              </div>
            </div>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1.5 pt-2">
            <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 pl-2">
              Navigation
            </div>
            {tabsList.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left flex items-start gap-3.5 p-3 rounded-xl transition-all outline-hidden cursor-pointer ${
                    active 
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {tab.icon}
                  </span>
                  <div className="leading-none space-y-1">
                    <span className="text-xs font-semibold block">{tab.label}</span>
                    <span className="text-[9px] text-slate-400/80 font-medium block truncate max-w-[150px]">
                      {tab.shortDesc}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Downloads / Export Gateway */}
            <button
              onClick={() => {
                setDrawerOpen(true);
                setSidebarOpen(false);
              }}
              className={`w-full text-left flex items-start gap-3.5 p-3 rounded-xl transition-all outline-hidden cursor-pointer ${
                drawerOpen 
                  ? 'bg-slate-800 text-slate-100 font-semibold shadow-xs border-l-4 border-indigo-500 rounded-l-none' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`shrink-0 ${drawerOpen ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Download className="w-5 h-5" />
              </span>
              <div className="leading-none space-y-1">
                <span className="text-xs font-semibold block">Downloads</span>
                <span className="text-[9px] text-slate-400/80 font-medium block truncate max-w-[150px]">
                  Export files with live edits
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Client-side Info Footnote */}
        <div className="bg-slate-805 rounded-xl p-3 border border-slate-800 space-y-1.5 mt-8 md:mt-0">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Safe & Offline
          </div>
          <p className="text-[10px] text-slate-500 leading-normal font-medium">
            All your data stays safely inside this browser. Your files are never uploaded to any external server.
          </p>
        </div>
      </div>

      {/* Screen body container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full md:overflow-y-auto md:h-screen" id="main-scroll-panel">
        
        {/* Welcome and timezone clock */}
        <div className="flex justify-between items-center mb-6 pt-2 pb-4 border-b border-slate-200/60 max-md:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
            <span>Offline File Hub</span>
            <div className="w-1 h-3 bg-slate-300" />
            <span>Local Database</span>
          </div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Last Updated: {new Date().toISOString().substring(0, 16).replace('T', ' ')}
          </div>
        </div>

        {/* Interactive tab render engine with subtle fade transitions */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'upload' && <UploadView />}
              {activeTab === 'update' && <UpdateView />}
              {activeTab === 'search' && <SearchView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Slide-out Overlay mobile background container */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30" 
        />
      )}

      {/* Dynamic Sliding Drawer for Exports / Downloads */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-100 cursor-pointer"
              id="downloads-drawer-backdrop"
            />

            {/* Sliding Drawer Body Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl z-101 flex flex-col border-l border-slate-100"
              id="downloads-drawer-panel"
            >
              {/* Header section */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-600" />
                    Downloads & Exports
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Export files compiled with real-time session modifications.</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  id="close-drawer-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Utility Action Bar */}
              {documentsList.length > 0 && (
                <div className="px-6 py-3 border-b border-slate-100 bg-white flex justify-between items-center text-xs text-slate-500">
                  <span className="font-semibold">
                    {selectedDrawerFiles.length} of {documentsList.length} Selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedDrawerFiles(documentsList.map(d => d.id))}
                      className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      onClick={() => setSelectedDrawerFiles([])}
                      className="text-slate-500 hover:text-slate-600 font-bold hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable document listing */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                {documentsList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                    <HardDrive className="w-10 h-10 text-slate-300 animate-pulse" />
                    <p className="text-sm font-semibold text-slate-600">No files are currently loaded.</p>
                    <p className="text-[11.5px] text-slate-400 leading-normal max-w-xs">
                      Please import DOCX, XLSX, TEXT or PPTX document streams in the "Upload Files" screen first to register structures.
                    </p>
                  </div>
                ) : (
                  documentsList.map((doc) => {
                    const isSelected = selectedDrawerFiles.includes(doc.id);
                    const fileIcon = (() => {
                      switch (doc.type) {
                        case 'xlsx':
                          return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
                        case 'docx':
                          return <FileText className="w-5 h-5 text-blue-600" />;
                        case 'pptx':
                          return <FileCode className="w-5 h-5 text-orange-600" />;
                        default:
                          return <FileText className="w-5 h-5 text-slate-500" />;
                      }
                    })();

                    return (
                      <div 
                        key={doc.id}
                        className={`p-4 rounded-xl border transition-all space-y-3 ${
                          isSelected 
                            ? 'border-indigo-100 bg-indigo-50/20 shadow-2xs' 
                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-3xs'
                        }`}
                      >
                        {/* File Row Header */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedDrawerFiles(prev =>
                                prev.includes(doc.id) 
                                  ? prev.filter(id => id !== doc.id) 
                                  : [...prev, doc.id]
                              );
                            }}
                            className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4 mt-1 shrink-0"
                          />
                          <div className="shrink-0 mt-0.5">{fileIcon}</div>
                          
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <span className="block text-xs font-bold text-slate-850 truncate" title={doc.name}>
                              {doc.name}
                            </span>
                            <div className="flex gap-2 text-[10px] font-medium text-slate-400">
                              <span>{formatBytes(doc.size)}</span>
                              <span>•</span>
                              <span>{doc.rowCount} elements</span>
                            </div>
                          </div>

                          <button
                            onClick={() => executeDownload(doc)}
                            className="p-1 px-2.5 rounded-lg border border-slate-150 text-slate-655 hover:bg-slate-50 hover:text-indigo-600 active:scale-95 transition-all outline-hidden cursor-pointer shrink-0"
                            title="Direct Export with Mod_time"
                          >
                            <Download className="w-3.5 h-3.5 inline" />
                          </button>
                        </div>

                        {/* Inline custom renaming text field to customize file name */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Custom Export Filename (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Type alternative filename base..."
                            value={customNames[doc.id] || ''}
                            onChange={(e) => {
                              setCustomNames(prev => ({
                                ...prev,
                                [doc.id]: e.target.value
                              }));
                            }}
                            className="text-xs h-8 px-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 bg-slate-50/50 w-full outline-hidden transition-all text-slate-700 font-medium"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action footer frame */}
              {documentsList.length > 0 && (
                <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
                  <button
                    disabled={selectedDrawerFiles.length === 0 || downloadingBatch}
                    onClick={handleBatchDownload}
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {downloadingBatch ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting {selectedDrawerFiles.length} item{selectedDrawerFiles.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Selected ({selectedDrawerFiles.length})
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 font-medium leading-normal">
                    Files named: <code className="bg-slate-100/80 px-1 py-0.5 rounded text-[9px] font-mono">[name]_modified_[ISO_timestamp].[ext]</code>
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
