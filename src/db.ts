import Dexie, { type Table } from 'dexie';
import { type IndexedDocument, type DocumentRecord } from './types';

export class AppDatabase extends Dexie {
  documents!: Table<IndexedDocument, string>;
  records!: Table<DocumentRecord, string>;

  constructor() {
    super('OfflineDocProcessorDatabase');
    this.version(1).stores({
      documents: 'id, name, type, uploadedAt',
      records: 'id, fileId, label, value'
    });
  }
}

export const db = new AppDatabase();
export default db;
