import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../auth';

export interface StoredSourcePdfMetadata {
  id: string;
  fileName: string;
  storagePath: string;
  subject?: string;
  chapter?: string;
  pageCount?: number;
  parserVersion?: string;
  importedAt: number;
  createdAt: number;
}

export interface StoredResultPdfMetadata {
  id: string;
  userId: string;
  testId: string;
  kind: 'wrong_unattempted' | 'full_test';
  storagePath: string;
  createdAt: number;
}

const BUCKET_SOURCE_PDFS = 'neet-source-pdfs';
const BUCKET_RESULT_PDFS = 'neet-result-pdfs';

// ==========================================
// SOURCE PDF OPERATIONS (neet-source-pdfs)
// ==========================================

export async function uploadSourcePdf(
  file: File,
  metadata?: { subject?: string; chapter?: string; pageCount?: number }
): Promise<StoredSourcePdfMetadata> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Source PDF upload requires Supabase connection.');
  }

  const userId = await getCurrentUserId();
  const fileExt = file.name.split('.').pop() || 'pdf';
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}_${cleanName}`;

  // 1. Upload to Supabase Storage Bucket
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_SOURCE_PDFS)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    console.error('[Storage] Error uploading source PDF:', uploadError.message);
    throw new Error(`Failed to upload source PDF: ${uploadError.message}`);
  }

  const pdfId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();

  // 2. Insert metadata row into neet_source_pdfs table
  const { error: dbError } = await supabase.from('neet_source_pdfs').insert({
    id: pdfId,
    file_name: file.name,
    storage_path: storagePath,
    subject: metadata?.subject || null,
    chapter: metadata?.chapter || null,
    page_count: metadata?.pageCount || null,
    parser_version: 'v1.0',
    imported_at: new Date(now).toISOString(),
    created_at: new Date(now).toISOString()
  });

  if (dbError) {
    console.error('[Storage] Error saving source PDF metadata in DB:', dbError.message);
    // Cleanup uploaded file if DB insert fails
    await supabase.storage.from(BUCKET_SOURCE_PDFS).remove([storagePath]);
    throw new Error(`Failed to save source PDF record: ${dbError.message}`);
  }

  return {
    id: pdfId,
    fileName: file.name,
    storagePath,
    subject: metadata?.subject,
    chapter: metadata?.chapter,
    pageCount: metadata?.pageCount,
    parserVersion: 'v1.0',
    importedAt: now,
    createdAt: now
  };
}

export async function getSourcePdf(storagePath: string): Promise<Blob> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.storage.from(BUCKET_SOURCE_PDFS).download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download source PDF: ${error?.message || 'File not found'}`);
  }
  return data;
}

export async function deleteSourcePdf(storagePath: string, pdfId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  // Delete from storage
  await supabase.storage.from(BUCKET_SOURCE_PDFS).remove([storagePath]);

  // Delete from DB
  if (pdfId) {
    await supabase.from('neet_source_pdfs').delete().eq('id', pdfId);
  } else {
    await supabase.from('neet_source_pdfs').delete().eq('storage_path', storagePath);
  }

  return true;
}

export async function getSourcePdfs(): Promise<StoredSourcePdfMetadata[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('neet_source_pdfs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Storage] Error fetching source PDFs:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    fileName: row.file_name,
    storagePath: row.storage_path,
    subject: row.subject,
    chapter: row.chapter,
    pageCount: row.page_count,
    parserVersion: row.parser_version,
    importedAt: new Date(row.imported_at || row.created_at).getTime(),
    createdAt: new Date(row.created_at).getTime()
  }));
}

// ==========================================
// RESULT PDF OPERATIONS (neet-result-pdfs)
// ==========================================

export async function uploadResultPdf(
  pdfBlob: Blob,
  fileName: string,
  testId: string,
  kind: 'wrong_unattempted' | 'full_test' = 'wrong_unattempted'
): Promise<StoredResultPdfMetadata> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  const userId = await getCurrentUserId();
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${testId}/${Date.now()}_${cleanName}`;

  // 1. Upload to Supabase Storage Bucket
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_RESULT_PDFS)
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error('[Storage] Error uploading result PDF:', uploadError.message);
    throw new Error(`Failed to upload result PDF: ${uploadError.message}`);
  }

  const recordId = `res_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();

  // 2. Insert into neet_result_pdfs table
  const { error: dbError } = await supabase.from('neet_result_pdfs').insert({
    id: recordId,
    user_id: userId,
    test_id: testId,
    kind,
    storage_path: storagePath,
    created_at: new Date(now).toISOString()
  });

  if (dbError) {
    console.error('[Storage] Error saving result PDF record:', dbError.message);
  }

  return {
    id: recordId,
    userId,
    testId,
    kind,
    storagePath,
    createdAt: now
  };
}
