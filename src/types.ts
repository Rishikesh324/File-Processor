export interface IndexedDocument {
  id: string; // Unique file ID (derived or random UUID)
  name: string; // Original filename
  type: 'docx' | 'xlsx' | 'pptx' | 'txt' | 'unknown'; // File extension type
  size: number; // File size in bytes
  uploadedAt: number; // Timestamp of import
  rowCount: number; // Total extracted records count
}

export interface DocumentRecord {
  id: string; // Unique record ID (UUID)
  fileId: string; // Refers to IndexedDocument.id
  label: string; // Meaningful key/label (e.g., "Sheet1 - Row 2 - Company" or "Slide 1 - Title")
  value: string; // Clean text content
}
