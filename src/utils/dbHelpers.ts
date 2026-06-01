import db from '../db';
import { type IndexedDocument, type DocumentRecord } from '../types';

/**
 * Persists a new document and all of its parsed records inside the IndexedDB tables within a single transaction.
 */
export async function saveDocumentToDb(
  name: string,
  type: 'docx' | 'xlsx' | 'pptx' | 'txt' | 'unknown',
  size: number,
  records: DocumentRecord[]
): Promise<string> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  const docHistory: IndexedDocument = {
    id: fileId,
    name,
    type,
    size,
    uploadedAt: Date.now(),
    rowCount: records.length,
  };

  // Associate each record with the newly generated document file ID
  const linkedRecords = records.map((rec) => ({
    ...rec,
    fileId,
  }));

  await db.transaction('rw', [db.documents, db.records], async () => {
    await db.documents.add(docHistory);
    if (linkedRecords.length > 0) {
      await db.records.bulkAdd(linkedRecords);
    }
  });

  return fileId;
}

/**
 * Deletes a document and all associated records in IndexedDB
 */
export async function deleteDocumentFromDb(fileId: string): Promise<void> {
  await db.transaction('rw', [db.documents, db.records], async () => {
    await db.documents.delete(fileId);
    await db.records.where('fileId').equals(fileId).delete();
  });
}

/**
 * Updates or re-saves modified records for a specific file.
 * Handles both editing of existing fields and appending new key-value parameter cells.
 */
export async function saveDocumentRecords(fileId: string, updatedRecords: DocumentRecord[]): Promise<void> {
  await db.transaction('rw', [db.documents, db.records], async () => {
    // 1. Delete existing records for this fileId
    await db.records.where('fileId').equals(fileId).delete();
    
    // 2. Add the updated list
    const linkedRecords = updatedRecords.map((rec) => ({
      ...rec,
      fileId,
    }));
    
    if (linkedRecords.length > 0) {
      await db.records.bulkAdd(linkedRecords);
    }
    
    // 3. Update the document row count
    await db.documents.update(fileId, { rowCount: updatedRecords.length });
  });
}
