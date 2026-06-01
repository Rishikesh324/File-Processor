import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { type DocumentRecord } from '../types';

// Constants
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Parses plain text file contents, splitting them by line.
 */
export function parseTxt(file: File): Promise<DocumentRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);
        const records: DocumentRecord[] = [];
        let lineIndex = 1;
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            records.push({
              id: `rec-txt-${Date.now()}-${lineIndex}-${Math.random().toString(36).substring(2, 6)}`,
              fileId: '', // To be filled by the database ingestion code
              label: `Line ${lineIndex}`,
              value: trimmed,
            });
            lineIndex++;
          }
        }
        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

/**
 * Parses word documents (.docx) extracting paragraph blocks.
 */
export function parseDocx(file: File): Promise<DocumentRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // mammoth.extractRawText works client-side as well
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        const lines = text.split(/\r?\n/);
        const records: DocumentRecord[] = [];
        let paragraphIdx = 1;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            records.push({
              id: `rec-docx-${Date.now()}-${paragraphIdx}-${Math.random().toString(36).substring(2, 6)}`,
              fileId: '',
              label: `Paragraph ${paragraphIdx}`,
              value: trimmed,
            });
            paragraphIdx++;
          }
        }
        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses Excel spreadsheets (.xlsx) cell-by-cell mapping to key-value rows.
 */
export function parseXlsx(file: File): Promise<DocumentRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const records: DocumentRecord[] = [];
        let totalCount = 1;

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          // Convert worksheet to raw rows
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
          if (jsonData.length === 0) return;

          // Deduce standard headers
          const headers: string[] = [];
          const firstRow = jsonData[0] as any[];
          if (Array.isArray(firstRow)) {
            firstRow.forEach((colValue, idx) => {
              headers.push(colValue ? String(colValue).trim() : `Col ${idx + 1}`);
            });
          }

          // Generate records cell by cell
          // Row indices start from 1. We treat the first row as headers list, but we still parse values
          jsonData.forEach((row: any, rowIdx) => {
            if (!Array.isArray(row)) return;

            row.forEach((cellValue, colIdx) => {
              if (cellValue === undefined || cellValue === null || String(cellValue).trim() === '') {
                return;
              }
              const colName = headers[colIdx] || `Col ${colIdx + 1}`;
              const label = `${sheetName} - Row ${rowIdx + 1} - ${colName}`;
              
              records.push({
                id: `rec-xlsx-${Date.now()}-${totalCount}-${Math.random().toString(36).substring(2, 6)}`,
                fileId: '',
                label: label,
                value: String(cellValue).trim(),
              });
              totalCount++;
            });
          });
        });

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses PowerPoint presentations (.pptx) slide-by-slide extracting textual nodes.
 */
export function parsePptx(file: File): Promise<DocumentRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const zip = await JSZip.loadAsync(arrayBuffer);
        const records: DocumentRecord[] = [];
        let totalIndex = 1;

        const slideFiles: { name: string; file: JSZip.JSZipObject }[] = [];
        zip.forEach((relativePath, fileObj) => {
          if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
            slideFiles.push({ name: relativePath, file: fileObj });
          }
        });

        // Numeric sort for slides: ppt/slides/slide1.xml, ppt/slides/slide2.xml...
        slideFiles.sort((a, b) => {
          const matchA = a.name.match(/\d+/);
          const matchB = b.name.match(/\d+/);
          const numA = matchA ? parseInt(matchA[0], 10) : 0;
          const numB = matchB ? parseInt(matchB[0], 10) : 0;
          return numA - numB;
        });

        const domParser = new DOMParser();

        for (let i = 0; i < slideFiles.length; i++) {
          const slideItem = slideFiles[i];
          const slideNum = i + 1;
          const xmlText = await slideItem.file.async('string');
          const xmlDoc = domParser.parseFromString(xmlText, 'application/xml');
          
          // Elements <a:t> carry shape and text box paragraph values inside slides
          const textNodes = xmlDoc.getElementsByTagName('a:t');
          let elIdx = 1;

          for (let tn = 0; tn < textNodes.length; tn++) {
            const rawVal = textNodes[tn].textContent?.trim();
            if (rawVal) {
              records.push({
                id: `rec-pptx-${Date.now()}-${totalIndex}-${Math.random().toString(36).substring(2, 6)}`,
                fileId: '',
                label: `Slide ${slideNum} - Para ${elIdx}`,
                value: rawVal,
              });
              elIdx++;
              totalIndex++;
            }
          }
        }

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Controller router to dispatch parsing according to the file extension
 */
export async function parseDocument(file: File): Promise<{ records: DocumentRecord[]; type: 'docx' | 'xlsx' | 'pptx' | 'txt' }> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds the strict 10MB limit.');
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const recs = await parseXlsx(file);
    return { records: recs, type: 'xlsx' };
  } else if (name.endsWith('.docx')) {
    const recs = await parseDocx(file);
    return { records: recs, type: 'docx' };
  } else if (name.endsWith('.pptx')) {
    const recs = await parsePptx(file);
    return { records: recs, type: 'pptx' };
  } else if (name.endsWith('.txt')) {
    const recs = await parseTxt(file);
    return { records: recs, type: 'txt' };
  } else {
    throw new Error('Unsupported format. Please upload word (.docx), excel (.xlsx), powerpoint (.pptx), or plain text (.txt).');
  }
}

/**
 * Recompiles edited database records back into a downloadable file blob
 */
export function compileFileBlob(type: string, records: DocumentRecord[]): Blob {
  if (type === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const sheetData: Record<string, Record<number, Record<string, string>>> = {};
    const sheetCols: Record<string, Set<string>> = {};
    
    // Sort records by original parsing sequence index to reconstruct original column headers layout
    const getSequenceNumber = (id: string): number => {
      const parts = id.split('-');
      if (parts.length >= 4 && parts[2] !== 'added') {
        const num = parseInt(parts[3], 10);
        if (!isNaN(num)) return num;
      }
      return Infinity; // Put newly added columns/rows at the end
    };

    const sortedRecords = [...records].sort((a, b) => {
      const seqA = getSequenceNumber(a.id);
      const seqB = getSequenceNumber(b.id);
      if (seqA !== seqB) return seqA - seqB;
      return a.id.localeCompare(b.id);
    });

    sortedRecords.forEach((rec) => {
      // spreadsheet row pattern: SheetName - Row X - ColumnName
      const match = rec.label.match(/^(.*) - Row (\d+)(?: - (.*))?$/);
      if (match) {
        const sheetName = match[1];
        const rowNum = parseInt(match[2], 10);
        const colName = match[3] || 'Value';
        
        if (!sheetData[sheetName]) sheetData[sheetName] = {};
        if (!sheetData[sheetName][rowNum]) sheetData[sheetName][rowNum] = {};
        
        sheetData[sheetName][rowNum][colName] = rec.value;
        
        if (!sheetCols[sheetName]) sheetCols[sheetName] = new Set();
        sheetCols[sheetName].add(colName);
      } else {
        // Fallback for custom labels
        const sheetName = 'Sheet1';
        const rowNum = 1;
        const colName = rec.label || 'Attribute';
        
        if (!sheetData[sheetName]) sheetData[sheetName] = {};
        if (!sheetData[sheetName][rowNum]) sheetData[sheetName][rowNum] = {};
        
        sheetData[sheetName][rowNum][colName] = rec.value;
        if (!sheetCols[sheetName]) sheetCols[sheetName] = new Set();
        sheetCols[sheetName].add(colName);
      }
    });

    const sheetNames = Object.keys(sheetData);
    if (sheetNames.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['No Data']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    } else {
      sheetNames.forEach((sheetName) => {
        const cols = Array.from(sheetCols[sheetName]);
        const rows: any[][] = [];
        
        // Add headers as row 1
        rows.push(cols);
        
        const sortedRowNums = Object.keys(sheetData[sheetName])
          .map(Number)
          .sort((a, b) => a - b);
          
        sortedRowNums.forEach((rowNum) => {
          const rowMap = sheetData[sheetName][rowNum];
          const rowCells = cols.map((col) => rowMap[col] || '');
          rows.push(rowCells);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      });
    }

    const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } else if (type === 'docx') {
    const paragraphs = records.map((rec) => {
      const match = rec.label.match(/^Paragraph (\d+)$/);
      const idx = match ? parseInt(match[1], 10) : Infinity;
      return { idx, value: rec.value };
    });
    
    paragraphs.sort((a, b) => {
      if (a.idx === Infinity && b.idx === Infinity) return 0;
      return a.idx - b.idx;
    });
    
    const textContent = paragraphs.map((p) => p.value).join('\r\n\r\n');
    return new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  } else if (type === 'pptx') {
    const slideParas = records.map((rec) => {
      const match = rec.label.match(/^Slide (\d+) - Para (\d+)$/);
      const slideNum = match ? parseInt(match[1], 10) : Infinity;
      const paraNum = match ? parseInt(match[2], 10) : Infinity;
      return { slideNum, paraNum, value: rec.value };
    });
    
    slideParas.sort((a, b) => {
      if (a.slideNum !== b.slideNum) return a.slideNum - b.slideNum;
      return a.paraNum - b.paraNum;
    });
    
    let currentSlide = -1;
    let outline = '';
    slideParas.forEach((p) => {
      if (p.slideNum !== currentSlide) {
        currentSlide = p.slideNum;
        outline += `\n[Slide ${currentSlide}]\n====================\n`;
      }
      outline += `${p.value}\n`;
    });
    return new Blob([outline.trim()], { type: 'text/plain;charset=utf-8' });
  } else {
    // txt or unknown
    const lines = records.map((rec) => {
      const match = rec.label.match(/^Line (\d+)$/);
      const lineNum = match ? parseInt(match[1], 10) : Infinity;
      return { lineNum, value: rec.value };
    });
    
    lines.sort((a, b) => {
      if (a.lineNum === Infinity && b.lineNum === Infinity) return 0;
      return a.lineNum - b.lineNum;
    });
    
    const textContent = lines.map((l) => l.value).join('\r\n');
    return new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  }
}

