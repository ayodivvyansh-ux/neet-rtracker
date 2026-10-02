/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SEED_QUESTIONS } from '../../data/seedQuestions';
import { supabase } from '../../lib/supabase';
import {
  ALL_SUBJECTS,
  AnswerOption,
  Difficulty,
  EvaluatedQuestionReview,
  ExamSubmissionPayload,
  PublicExamQuestion,
  Question,
  QuestionAttemptHistory,
  QuestionAttemptRecord,
  QuestionFilterParams,
  RandomNeetTestConfig,
  RandomNeetTestRpcResult,
  SecureExamResult,
  SourceChapter,
  SourceFile,
  Subject,
  SubjectQuestionTable,
  subjectToPublicViewName,
  subjectToTableName,
  TestScoreBreakdown,
  TestSession
} from '../../types';
import { getCurrentUserId } from '../auth';
import { IDataProvider } from './dataProvider.interface';

// ==========================================
// DB ROW MAPPERS
// ==========================================

function mapDbRowToQuestion(row: any, subjectFallback?: Subject): Question {
  const parsedOptions = typeof row.options === 'string' ? JSON.parse(row.options) : row.options || { A: '', B: '', C: '', D: '' };
  const questionImages = row.question_images || row.questionImages || parsedOptions?.questionImages || undefined;
  const visual = row.visual ? (typeof row.visual === 'string' ? JSON.parse(row.visual) : row.visual) : parsedOptions?.visual || undefined;

  return {
    id: row.id,
    sourceId: row.source_id || undefined,
    sourceFileId: row.source_file_id || undefined,
    text: row.text,
    options: {
      A: parsedOptions.A || '',
      B: parsedOptions.B || '',
      C: parsedOptions.C || '',
      D: parsedOptions.D || ''
    },
    correctAnswer: row.correct_answer || 'UNKNOWN',
    subject: (row.subject as Subject) || subjectFallback || 'Physics',
    chapter: row.chapter,
    subtopic: row.subtopic || undefined,
    difficulty: (row.difficulty as Difficulty) || 'Medium',
    sourcePdf: row.source_pdf_name || row.source_pdf_id || undefined,
    pageNumber: row.page_number || undefined,
    explanation: row.explanation || undefined,
    questionImages,
    visual,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

function mapDbRowToPublicExamQuestion(row: any, subjectFallback?: Subject): PublicExamQuestion {
  const parsedOptions = typeof row.options === 'string' ? JSON.parse(row.options) : row.options || { A: '', B: '', C: '', D: '' };
  const questionImages = row.question_images || row.questionImages || parsedOptions?.questionImages || undefined;
  const visual = row.visual ? (typeof row.visual === 'string' ? JSON.parse(row.visual) : row.visual) : parsedOptions?.visual || undefined;

  return {
    id: row.id,
    text: row.text,
    options: {
      A: parsedOptions.A || '',
      B: parsedOptions.B || '',
      C: parsedOptions.C || '',
      D: parsedOptions.D || ''
    },
    subject: (row.subject as Subject) || subjectFallback || 'Physics',
    chapter: row.chapter,
    subtopic: row.subtopic || undefined,
    difficulty: (row.difficulty as Difficulty) || 'Medium',
    sourcePdf: row.source_pdf_name || row.source_pdf_id || undefined,
    pageNumber: row.page_number || undefined,
    sourceId: row.source_id || undefined,
    sourceFileId: row.source_file_id || undefined,
    questionImages,
    visual,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

function mapQuestionToDbRow(q: Question) {
  // Store questionImages in options if present (so it's preserved in JSONB without schema alter),
  // as well as in question_images top-level property for the RPC
  const optionsPayload = {
    ...q.options,
    ...(q.questionImages && q.questionImages.length > 0 ? { questionImages: q.questionImages } : {}),
    ...(q.visual ? { visual: q.visual } : {})
  };

  return {
    id: q.id,
    source_id: q.sourceId || null,
    source_file_id: q.sourceFileId || null,
    text: q.text,
    options: optionsPayload,
    correct_answer: q.correctAnswer,
    subject: q.subject,
    chapter: q.chapter,
    subtopic: q.subtopic || null,
    difficulty: q.difficulty,
    source_pdf_name: q.sourcePdf || null,
    page_number: q.pageNumber || null,
    explanation: q.explanation || null,
    question_images: q.questionImages || null,
    visual: q.visual || null,
    created_at: new Date(q.createdAt || Date.now()).toISOString(),
    updated_at: new Date().toISOString()
  };
}

export class SupabaseProvider implements IDataProvider {
  // ==========================================
  // 1. QUESTIONS ACROSS FOUR PUBLIC SUBJECT VIEWS
  // ==========================================

  private getTableForSubject(subject: Subject): string {
    return subjectToTableName(subject);
  }

  async getQuestions(filter?: QuestionFilterParams): Promise<Question[]> {
    const subjectsToQuery: Subject[] =
      filter?.subject && filter.subject !== 'All' ? [filter.subject] : ALL_SUBJECTS;

    let allQuestions: Question[] = [];

    for (const subj of subjectsToQuery) {
      const viewName = subjectToPublicViewName(subj);
      let query = (supabase as any).from(viewName).select('*');

      if (filter?.chapters && filter.chapters.length > 0) {
        query = query.in('chapter', filter.chapters);
      }
      if (filter?.difficulty) {
        query = query.eq('difficulty', filter.difficulty);
      }
      if (filter?.searchQuery && filter.searchQuery.trim()) {
        const q = filter.searchQuery.trim();
        query = query.or(`text.ilike.%${q}%,chapter.ilike.%${q}%,id.ilike.%${q}%`);
      }
      if (filter?.limit && filter.limit > 0) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error(`[SupabaseProvider] Error reading public view ${viewName}:`, error.message);
        throw new Error(`Unable to load questions from Supabase (${viewName}): ${error.message}`);
      }

      if (data) {
        allQuestions = allQuestions.concat(data.map((r: any) => mapDbRowToQuestion(r, subj)));
      }
    }

    return allQuestions;
  }

  async getQuestionById(id: string): Promise<Question | null> {
    for (const subj of ALL_SUBJECTS) {
      const viewName = subjectToPublicViewName(subj);
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return mapDbRowToQuestion(data, subj);
      }
    }

    return null;
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    if (!ids || ids.length === 0) return [];
    const questions: Question[] = [];

    for (const subj of ALL_SUBJECTS) {
      const viewName = subjectToPublicViewName(subj);
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select('*')
        .in('id', ids);

      if (!error && data) {
        questions.push(...data.map((r: any) => mapDbRowToQuestion(r, subj)));
      }
    }

    const map = new Map(questions.map((q) => [q.id, q]));
    return ids.map((id) => map.get(id)).filter((q): q is Question => Boolean(q));
  }

  async getExamQuestionsByIds(ids: string[]): Promise<PublicExamQuestion[]> {
    if (!ids || ids.length === 0) return [];
    const questions: PublicExamQuestion[] = [];

    for (const subj of ALL_SUBJECTS) {
      const viewName = subjectToPublicViewName(subj);
      const { data, error } = await (supabase as any)
        .from(viewName)
        .select('id, text, options, chapter, subtopic, difficulty, source_pdf_name, page_number, question_images, visual, created_at')
        .in('id', ids);

      if (!error && data) {
        questions.push(...data.map((r: any) => mapDbRowToPublicExamQuestion(r, subj)));
      }
    }

    const map = new Map(questions.map((q) => [q.id, q]));
    return ids.map((id) => map.get(id)).filter((q): q is PublicExamQuestion => Boolean(q));
  }

  async saveSingleQuestion(question: Question): Promise<Question> {
    const tableName = this.getTableForSubject(question.subject);
    const row = mapQuestionToDbRow(question);
    const { error } = await supabase.from(tableName as any).upsert(row);

    if (error) {
      // Fallback
      await supabase.from('neet_questions').upsert(row);
    }

    return question;
  }

  async importQuestions(
    questions: Question[]
  ): Promise<{ importedCount: number; updatedCount: number }> {
    if (!questions || questions.length === 0) {
      return { importedCount: 0, updatedCount: 0 };
    }

    let importedCount = 0;
    let updatedCount = 0;

    // Ensure authenticated session before invoking authenticated RPC
    await getCurrentUserId();

    for (const subj of ALL_SUBJECTS) {
      const subjQuestions = questions.filter((q) => q.subject === subj);
      if (subjQuestions.length === 0) continue;

      const rows = subjQuestions.map(mapQuestionToDbRow);

      console.log(`[SupabaseProvider] Calling import_neet_questions RPC for ${subj}:`, {
        subject: subj,
        rowCount: rows.length,
        sampleRow: rows[0]
          ? {
              id: rows[0].id,
              subject: rows[0].subject,
              chapter: rows[0].chapter,
              source_id: rows[0].source_id,
              source_file_id: rows[0].source_file_id,
              hasCorrectAnswer: !!rows[0].correct_answer
            }
          : null
      });

      const { data, error } = await supabase.rpc('import_neet_questions', {
        p_subject: subj,
        p_rows: rows
      });

      if (error) {
        console.error(`[SupabaseProvider] import_neet_questions RPC failed for ${subj}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(
          `Question import failed for ${subj} (${error.code || 'RPC_ERROR'}): ${error.message}${
            error.hint ? ` (Hint: ${error.hint})` : ''
          }`
        );
      }

      console.log(`[SupabaseProvider] import_neet_questions RPC response for ${subj}:`, data);

      const countInserted = typeof data?.insertedCount === 'number' ? data.insertedCount : rows.length;
      const countUpdated = typeof data?.updatedCount === 'number' ? data.updatedCount : 0;

      importedCount += countInserted;
      updatedCount += countUpdated;
    }

    return { importedCount, updatedCount };
  }

  // ==========================================
  // 1B. PDF SOURCE LIBRARY & CHAPTER METADATA
  // ==========================================

  async uploadCompleteSourcePdf(params: {
    subject: Subject;
    chapter: string;
    file: File;
    customFileName?: string;
  }): Promise<{ storagePath: string }> {
    const userId = (await getCurrentUserId()) || 'default_user';
    const chapterSlug = params.chapter
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    const fileName = params.customFileName || params.file.name;

    const storagePath = `${userId}/${params.subject}/${chapterSlug}/${fileName}`;

    const { error } = await supabase.storage
      .from('neet-source-pdfs')
      .upload(storagePath, params.file, {
        upsert: true,
        contentType: 'application/pdf'
      });

    if (error) {
      console.warn('[SupabaseProvider] Complete PDF storage upload warning:', error.message);
    }

    return { storagePath };
  }

  async uploadQuestionFigure(params: {
    subject: Subject;
    chapter: string;
    sourceFileName: string;
    questionId: string;
    figureData: Blob | string;
    fileName?: string;
  }): Promise<{ storagePath: string; publicUrl: string; signedUrl?: string }> {
    const userId = (await getCurrentUserId()) || 'default_user';
    const chapterSlug = params.chapter
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    const cleanSourceFile = (params.sourceFileName || 'source_pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const figureName = params.fileName || 'figure-01.png';

    // Required path: <user-id>/<Subject>/<chapter-slug>/figures/<source-file>/<question-id>/figure-01.png
    const storagePath = `${userId}/${params.subject}/${chapterSlug}/figures/${cleanSourceFile}/${params.questionId}/${figureName}`;

    let body: any;
    let contentType = 'image/png';

    if (typeof params.figureData === 'string' && params.figureData.startsWith('data:')) {
      const parts = params.figureData.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) contentType = mimeMatch[1];
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      body = new Blob([array], { type: contentType });
    } else {
      body = params.figureData;
    }

    const { error } = await supabase.storage
      .from('neet-source-pdfs')
      .upload(storagePath, body, {
        upsert: true,
        contentType
      });

    if (error) {
      console.warn('[SupabaseProvider] Question figure storage upload warning:', error.message);
    }

    const { data: pubData } = supabase.storage.from('neet-source-pdfs').getPublicUrl(storagePath);
    let signedUrl: string | undefined;
    try {
      const { data: sData } = await supabase.storage.from('neet-source-pdfs').createSignedUrl(storagePath, 86400);
      signedUrl = sData?.signedUrl;
    } catch {}

    return {
      storagePath,
      publicUrl: pubData.publicUrl,
      signedUrl
    };
  }

  async uploadSourcePdfs(params: {
    subject: Subject;
    chapter: string;
    questionFile: File;
    answerKeyFile?: File | null;
  }): Promise<{ questionPdfPath: string; answerKeyPdfPath?: string | null }> {
    const userId = (await getCurrentUserId()) || 'default_user';
    const chapterSlug = params.chapter
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    const questionPath = `${userId}/${params.subject}/${chapterSlug}/questions.pdf`;
    let answerKeyPath: string | null = null;

    const { error: qError } = await supabase.storage
      .from('neet-source-pdfs')
      .upload(questionPath, params.questionFile, {
        upsert: true,
        contentType: 'application/pdf'
      });

    if (qError) {
      console.warn('[SupabaseProvider] Storage upload warning for question PDF:', qError.message);
    }

    if (params.answerKeyFile) {
      answerKeyPath = `${userId}/${params.subject}/${chapterSlug}/answer_key.pdf`;
      const { error: aError } = await supabase.storage
        .from('neet-source-pdfs')
        .upload(answerKeyPath, params.answerKeyFile, {
          upsert: true,
          contentType: 'application/pdf'
        });

      if (aError) {
        console.warn('[SupabaseProvider] Storage upload warning for answer key PDF:', aError.message);
      }
    }

    return {
      questionPdfPath: questionPath,
      answerKeyPdfPath: answerKeyPath
    };
  }

  async createOrUpdateSourceChapter(source: {
    subject: Subject;
    chapter: string;
    title: string;
    questionPdfPath: string;
    answerKeyPdfPath?: string | null;
    questionCount: number;
    verifiedKeysCount: number;
    unknownKeysCount: number;
  }): Promise<SourceChapter> {
    const userId = await getCurrentUserId();
    const row = {
      subject: source.subject,
      chapter: source.chapter,
      title: source.title,
      question_pdf_path: source.questionPdfPath,
      answer_key_pdf_path: source.answerKeyPdfPath || null,
      question_count: source.questionCount,
      verified_keys_count: source.verifiedKeysCount,
      unknown_keys_count: source.unknownKeysCount,
      created_by: userId && userId !== 'local-user' ? userId : null,
      updated_at: new Date().toISOString()
    };

    // Look for existing record by subject and chapter
    const { data: existing } = await (supabase as any)
      .from('neet_source_chapters')
      .select('id')
      .eq('subject', source.subject)
      .eq('chapter', source.chapter)
      .maybeSingle();

    let data: any = null;
    let error: any = null;

    if (existing?.id) {
      const res = await (supabase as any)
        .from('neet_source_chapters')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    } else {
      const res = await (supabase as any)
        .from('neet_source_chapters')
        .insert(row)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      console.warn('[SupabaseProvider] neet_source_chapters save error:', error?.message);
      return {
        id: `src_${Date.now()}`,
        subject: source.subject,
        chapter: source.chapter,
        title: source.title,
        questionPdfPath: source.questionPdfPath,
        answerKeyPdfPath: source.answerKeyPdfPath || null,
        questionCount: source.questionCount,
        verifiedKeysCount: source.verifiedKeysCount,
        unknownKeysCount: source.unknownKeysCount,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    return {
      id: data.id,
      subject: data.subject as Subject,
      chapter: data.chapter,
      title: data.title,
      questionPdfPath: data.question_pdf_path,
      answerKeyPdfPath: data.answer_key_pdf_path,
      questionCount: data.question_count || 0,
      verifiedKeysCount: data.verified_keys_count || 0,
      unknownKeysCount: data.unknown_keys_count || 0,
      createdBy: data.created_by,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
    };
  }

  async getSourceChapters(subject?: Subject): Promise<SourceChapter[]> {
    let query = (supabase as any)
      .from('neet_source_chapters')
      .select('*')
      .order('updated_at', { ascending: false });

    if (subject && subject !== ('All' as any)) {
      query = query.eq('subject', subject);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[SupabaseProvider] Error fetching source chapters:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      subject: row.subject as Subject,
      chapter: row.chapter,
      title: row.title,
      questionPdfPath: row.question_pdf_path,
      answerKeyPdfPath: row.answer_key_pdf_path,
      questionCount: row.question_count || 0,
      verifiedKeysCount: row.verified_keys_count || 0,
      unknownKeysCount: row.unknown_keys_count || 0,
      createdBy: row.created_by,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
    }));
  }

  // ==========================================
  // 1B.2 SOURCE FILES (neet_source_files)
  // ==========================================

  async createOrUpdateSourceFile(file: {
    chapterId: string;
    fileName: string;
    filePath: string;
    fileType: 'question' | 'answer_key';
    pairedQuestionFileId?: string | null;
    fileSizeBytes?: number;
    totalPages?: number;
    questionCount?: number;
    verifiedKeysCount?: number;
    unknownKeysCount?: number;
  }): Promise<SourceFile> {
    const userId = await getCurrentUserId();
    const row = {
      source_chapter_id: file.chapterId,
      file_name: file.fileName,
      storage_path: file.filePath,
      file_type: file.fileType,
      paired_question_file_id: file.pairedQuestionFileId || null,
      page_count: file.totalPages || null,
      created_by: userId && userId !== 'local-user' ? userId : null,
      updated_at: new Date().toISOString()
    };

    // Look for existing file by source_chapter_id and file_name
    const { data: existing } = await (supabase as any)
      .from('neet_source_files')
      .select('id')
      .eq('source_chapter_id', file.chapterId)
      .eq('file_name', file.fileName)
      .maybeSingle();

    let data: any = null;
    let error: any = null;

    if (existing?.id) {
      const res = await (supabase as any)
        .from('neet_source_files')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    } else {
      const res = await (supabase as any)
        .from('neet_source_files')
        .insert(row)
        .select('*')
        .single();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      console.warn('[SupabaseProvider] neet_source_files save warning:', error?.message);
      return {
        id: `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        chapterId: file.chapterId,
        fileName: file.fileName,
        filePath: file.filePath,
        fileType: file.fileType,
        pairedQuestionFileId: file.pairedQuestionFileId || null,
        fileSizeBytes: file.fileSizeBytes,
        totalPages: file.totalPages,
        questionCount: file.questionCount || 0,
        verifiedKeysCount: file.verifiedKeysCount || 0,
        unknownKeysCount: file.unknownKeysCount || 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    return {
      id: data.id,
      chapterId: data.source_chapter_id,
      fileName: data.file_name,
      filePath: data.storage_path,
      fileType: data.file_type,
      pairedQuestionFileId: data.paired_question_file_id,
      totalPages: data.page_count,
      questionCount: file.questionCount || 0,
      verifiedKeysCount: file.verifiedKeysCount || 0,
      unknownKeysCount: file.unknownKeysCount || 0,
      createdBy: data.created_by,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
    };
  }

  async getSourceFiles(chapterId?: string): Promise<SourceFile[]> {
    let query = (supabase as any)
      .from('neet_source_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (chapterId) {
      query = query.eq('source_chapter_id', chapterId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map((r: any) => ({
      id: r.id,
      chapterId: r.source_chapter_id,
      fileName: r.file_name,
      filePath: r.storage_path,
      fileType: r.file_type,
      pairedQuestionFileId: r.paired_question_file_id,
      totalPages: r.page_count,
      questionCount: 0,
      verifiedKeysCount: 0,
      unknownKeysCount: 0,
      createdBy: r.created_by,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now()
    }));
  }

  // ==========================================
  // 1C. SECURE SERVER-SIDE RANDOM TEST GENERATOR
  // ==========================================

  async generateRandomNeetTest(params: {
    title: string;
    mode: string;
    config: RandomNeetTestConfig;
    durationMinutes: number;
  }): Promise<RandomNeetTestRpcResult> {
    const userId = await getCurrentUserId();
    if (!userId || userId === 'local-user') {
      throw new Error('Unauthenticated test generation. Valid Supabase session required.');
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('generate_random_neet_test', {
      p_title: params.title,
      p_mode: params.mode,
      p_config: {
        physicsChapters: params.config.physicsChapters,
        chemistryChapters: params.config.chemistryChapters,
        botanyChapters: params.config.botanyChapters,
        zoologyChapters: params.config.zoologyChapters,
        physicsCount: params.config.physicsCount,
        chemistryCount: params.config.chemistryCount,
        botanyCount: params.config.botanyCount,
        zoologyCount: params.config.zoologyCount
      },
      p_duration_minutes: params.durationMinutes
    });

    if (rpcError) {
      console.error('[SupabaseProvider] generate_random_neet_test RPC error:', rpcError.message);
      throw new Error(`Server-side random test generation failed: ${rpcError.message}`);
    }

    const raw = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData || {};
    const testId = raw.testId || raw.test_id || `test_${Date.now()}`;
    const rawQuestions = raw.questions || [];

    const sanitizedQuestions: PublicExamQuestion[] = rawQuestions.map((q: any) => ({
      id: q.id,
      text: q.text,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options || { A: '', B: '', C: '', D: '' },
      subject: (q.subject as Subject) || 'Physics',
      chapter: q.chapter,
      subtopic: q.subtopic || undefined,
      difficulty: (q.difficulty as Difficulty) || 'Medium',
      sourcePdf: q.sourcePdf || q.source_pdf_name || undefined,
      pageNumber: q.pageNumber || q.page_number || undefined,
      createdAt: q.createdAt || (q.created_at ? new Date(q.created_at).getTime() : Date.now())
    }));

    const questionIds = sanitizedQuestions.map((q) => q.id);

    const testSession: TestSession = {
      id: testId,
      title: params.title,
      mode: (params.mode as any) || 'random',
      subject: 'All',
      selectedChapters: [
        ...params.config.physicsChapters,
        ...params.config.chemistryChapters,
        ...params.config.botanyChapters,
        ...params.config.zoologyChapters
      ],
      selectedChaptersBySubject: {
        Physics: params.config.physicsChapters,
        Chemistry: params.config.chemistryChapters,
        Botany: params.config.botanyChapters,
        Zoology: params.config.zoologyChapters
      },
      questionIds,
      durationMinutes: params.durationMinutes,
      startedAt: Date.now(),
      userResponses: {},
      questionStatuses: {},
      timeSpentPerQuestion: {},
      isSubmitted: false
    };

    return {
      testSession,
      sanitizedQuestions
    };
  }

  async deleteQuestion(id: string): Promise<boolean> {
    for (const subj of ALL_SUBJECTS) {
      const tableName = this.getTableForSubject(subj);
      await supabase.from(tableName as any).delete().eq('id', id);
    }
    await supabase.from('neet_questions').delete().eq('id', id);
    return true;
  }

  // ==========================================
  // 2. QUESTION ATTEMPT HISTORIES
  // ==========================================

  async getAllQuestionHistories(): Promise<Record<string, QuestionAttemptHistory>> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('neet_question_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: true });

    if (error) {
      console.error('[SupabaseProvider] Error in getAllQuestionHistories:', error.message);
      return {};
    }

    const result: Record<string, QuestionAttemptHistory> = {};

    for (const row of data || []) {
      const qId = row.question_id;
      if (!result[qId]) {
        result[qId] = {
          questionId: qId,
          attemptsCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          unattemptedCount: 0,
          lastAttemptedAt: null,
          lastUserAnswer: null,
          lastStatus: null,
          history: []
        };
      }

      const item = result[qId];
      item.attemptsCount += 1;
      const status = row.status as 'correct' | 'incorrect' | 'unattempted' | 'unknown_key';

      if (status === 'correct') item.correctCount += 1;
      else if (status === 'incorrect') item.incorrectCount += 1;
      else if (status === 'unattempted') item.unattemptedCount += 1;

      item.lastAttemptedAt = new Date(row.attempted_at).getTime();
      item.lastUserAnswer = row.user_answer as AnswerOption | null;
      item.lastStatus = status;

      item.history.push({
        questionId: qId,
        testId: row.test_id,
        userAnswer: row.user_answer as AnswerOption | null,
        status,
        timeSpentSeconds: row.time_spent_seconds || 0,
        attemptedAt: new Date(row.attempted_at).getTime()
      });
    }

    return result;
  }

  async getQuestionHistory(questionId: string): Promise<QuestionAttemptHistory | null> {
    const all = await this.getAllQuestionHistories();
    return all[questionId] || null;
  }

  async saveQuestionHistory(history: QuestionAttemptHistory): Promise<void> {
    const userId = await getCurrentUserId();
    const latest = history.history[history.history.length - 1];
    if (!latest) return;

    await supabase.from('neet_question_attempts').insert({
      user_id: userId,
      test_id: latest.testId,
      question_id: history.questionId,
      user_answer: latest.userAnswer,
      status: latest.status,
      time_spent_seconds: latest.timeSpentSeconds,
      attempted_at: new Date(latest.attemptedAt || Date.now()).toISOString()
    });
  }

  async saveBatchQuestionHistories(
    histories: Record<string, QuestionAttemptHistory>
  ): Promise<void> {
    const userId = await getCurrentUserId();
    const rowsToInsert: any[] = [];

    for (const h of Object.values(histories)) {
      const latest = h.history[h.history.length - 1];
      if (latest) {
        rowsToInsert.push({
          user_id: userId,
          test_id: latest.testId,
          question_id: h.questionId,
          user_answer: latest.userAnswer,
          status: latest.status,
          time_spent_seconds: latest.timeSpentSeconds,
          attempted_at: new Date(latest.attemptedAt || Date.now()).toISOString()
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('neet_question_attempts').insert(rowsToInsert);
      if (error) {
        console.error('[SupabaseProvider] Error saving batch attempts:', error.message);
      }
    }
  }

  // ==========================================
  // 3. TEST SESSIONS & RESULTS
  // ==========================================

  async getTestHistory(): Promise<TestSession[]> {
    const userId = await getCurrentUserId();

    const { data: testRows, error: testError } = await supabase
      .from('neet_tests')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (testError || !testRows) {
      console.error('[SupabaseProvider] Error fetching test history:', testError?.message);
      return [];
    }

    const testIds = testRows.map((t: any) => t.id);
    if (testIds.length === 0) return [];

    const { data: resultsRows } = await supabase
      .from('neet_test_results')
      .select('*')
      .in('test_id', testIds);

    const resultMap = new Map<string, any>(
      (resultsRows || []).map((r: any) => [r.test_id, r])
    );

    const { data: answersRows } = await supabase
      .from('neet_test_answers')
      .select('*')
      .in('test_id', testIds);

    const answersMap = new Map<string, { responses: Record<string, any>; timeSpent: Record<string, number> }>();
    for (const a of answersRows || []) {
      if (!answersMap.has(a.test_id)) {
        answersMap.set(a.test_id, { responses: {}, timeSpent: {} });
      }
      const item = answersMap.get(a.test_id)!;
      item.responses[a.question_id] = a.user_answer;
      item.timeSpent[a.question_id] = a.time_spent_seconds || 0;
    }

    return testRows.map((row: any) => {
      const r = resultMap.get(row.id);
      const a = answersMap.get(row.id) || { responses: {}, timeSpent: {} };

      let score: TestScoreBreakdown | undefined = undefined;
      if (r) {
        score = {
          totalScore: r.total_score,
          maxScore: r.max_score,
          correctCount: r.correct_count,
          incorrectCount: r.incorrect_count,
          unattemptedCount: r.unattempted_count,
          unknownKeyCount: r.unknown_key_count || 0,
          evaluationStatus: (r.evaluation_status as any) || 'EVALUATED',
          accuracy: Number(r.accuracy) || 0,
          attemptPercentage: Number(r.attempt_percentage) || 0,
          subjectWise: typeof r.subject_wise === 'string' ? JSON.parse(r.subject_wise) : r.subject_wise || {},
          chapterWise: typeof r.chapter_wise === 'string' ? JSON.parse(r.chapter_wise) : r.chapter_wise || {}
        };
      }

      return {
        id: row.id,
        title: row.title,
        mode: row.mode,
        originalTestId: row.original_test_id || undefined,
        subject: row.subject || 'All',
        selectedChapters: typeof row.selected_chapters === 'string' ? JSON.parse(row.selected_chapters) : row.selected_chapters || [],
        questionIds: typeof row.question_ids === 'string' ? JSON.parse(row.question_ids) : row.question_ids || [],
        durationMinutes: row.duration_minutes,
        startedAt: new Date(row.started_at).getTime(),
        completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
        userResponses: a.responses,
        questionStatuses: {},
        timeSpentPerQuestion: a.timeSpent,
        isSubmitted: Boolean(row.is_submitted),
        score
      };
    });
  }

  async getTestById(id: string): Promise<TestSession | null> {
    const { data: row, error } = await supabase
      .from('neet_tests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !row) return null;

    const { data: r } = await supabase
      .from('neet_test_results')
      .select('*')
      .eq('test_id', id)
      .maybeSingle();

    const { data: answersRows } = await supabase
      .from('neet_test_answers')
      .select('*')
      .eq('test_id', id);

    const userResponses: Record<string, AnswerOption | null> = {};
    const timeSpentPerQuestion: Record<string, number> = {};

    for (const a of answersRows || []) {
      userResponses[a.question_id] = a.user_answer;
      timeSpentPerQuestion[a.question_id] = a.time_spent_seconds || 0;
    }

    let score: TestScoreBreakdown | undefined = undefined;
    if (r) {
      score = {
        totalScore: r.total_score,
        maxScore: r.max_score,
        correctCount: r.correct_count,
        incorrectCount: r.incorrect_count,
        unattemptedCount: r.unattempted_count,
        unknownKeyCount: r.unknown_key_count || 0,
        evaluationStatus: (r.evaluation_status as any) || 'EVALUATED',
        accuracy: Number(r.accuracy) || 0,
        attemptPercentage: Number(r.attempt_percentage) || 0,
        subjectWise: typeof r.subject_wise === 'string' ? JSON.parse(r.subject_wise) : r.subject_wise || {},
        chapterWise: typeof r.chapter_wise === 'string' ? JSON.parse(r.chapter_wise) : r.chapter_wise || {}
      };
    }

    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      originalTestId: row.original_test_id || undefined,
      subject: row.subject || 'All',
      selectedChapters: typeof row.selected_chapters === 'string' ? JSON.parse(row.selected_chapters) : row.selected_chapters || [],
      questionIds: typeof row.question_ids === 'string' ? JSON.parse(row.question_ids) : row.question_ids || [],
      durationMinutes: row.duration_minutes,
      startedAt: new Date(row.started_at).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
      userResponses,
      questionStatuses: {},
      timeSpentPerQuestion,
      isSubmitted: Boolean(row.is_submitted),
      score
    };
  }

  async saveTestSession(session: TestSession): Promise<TestSession> {
    const userId = await getCurrentUserId();

    const { error: testError } = await supabase.from('neet_tests').upsert({
      id: session.id,
      user_id: userId,
      title: session.title,
      mode: session.mode,
      original_test_id: session.originalTestId || null,
      subject: session.subject,
      selected_chapters: session.selectedChapters,
      question_ids: session.questionIds,
      duration_minutes: session.durationMinutes,
      started_at: new Date(session.startedAt).toISOString(),
      completed_at: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      is_submitted: session.isSubmitted
    });

    if (testError) {
      console.error('[SupabaseProvider] Error saving test session:', testError.message);
      throw new Error(`Failed to save test session: ${testError.message}`);
    }

    return session;
  }

  async submitAndScoreExam(payload: ExamSubmissionPayload): Promise<SecureExamResult> {
    const userId = await getCurrentUserId();
    if (!userId || userId === 'local-user') {
      throw new Error('Unauthenticated submission. Valid Supabase session required.');
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_and_score_exam', {
      p_test_id: payload.testId,
      p_user_responses: payload.userResponses,
      p_question_statuses: payload.questionStatuses,
      p_time_spent: payload.timeSpentPerQuestion
    });

    if (rpcError) {
      console.error('[SupabaseProvider] Server-side RPC scoring error:', rpcError.message);
      throw new Error(`Server-side scoring failed: ${rpcError.message}`);
    }

    const raw = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData || {};
    const scoreObj = raw.score || raw;

    const parseObject = (val: any) => {
      if (!val) return {};
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      }
      return val;
    };

    const subjectWise = parseObject(scoreObj.subjectWise || scoreObj.subject_wise);
    const chapterWise = parseObject(scoreObj.chapterWise || scoreObj.chapter_wise);

    const score: TestScoreBreakdown = {
      totalScore: Number(scoreObj.totalScore ?? scoreObj.total_score ?? 0),
      maxScore: Number(scoreObj.maxScore ?? scoreObj.max_score ?? 0),
      correctCount: Number(scoreObj.correctCount ?? scoreObj.correct_count ?? 0),
      incorrectCount: Number(scoreObj.incorrectCount ?? scoreObj.incorrect_count ?? 0),
      unattemptedCount: Number(scoreObj.unattemptedCount ?? scoreObj.unattempted_count ?? 0),
      unknownKeyCount: Number(scoreObj.unknownKeyCount ?? scoreObj.unknown_key_count ?? 0),
      accuracy: Number(scoreObj.accuracy ?? 0),
      attemptPercentage: Number(scoreObj.attemptPercentage ?? scoreObj.attempt_percentage ?? 0),
      evaluationStatus:
        scoreObj.evaluationStatus ||
        scoreObj.evaluation_status ||
        (Number(scoreObj.unknownKeyCount ?? scoreObj.unknown_key_count ?? 0) > 0
          ? 'HAS_UNKNOWN_KEYS'
          : 'EVALUATED'),
      subjectWise,
      chapterWise
    };

    const evaluatedQuestions: EvaluatedQuestionReview[] = (raw.evaluatedQuestions || raw.evaluated_questions || []).map(
      (q: any) => ({
        id: q.id,
        text: q.text,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        subject: (q.subject as Subject) || 'Physics',
        chapter: q.chapter,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        sourcePdf: q.sourcePdf || q.source_pdf_name,
        pageNumber: q.pageNumber || q.page_number,
        explanation: q.explanation,
        userAnswer: q.userAnswer || q.user_answer || null,
        correctAnswer: q.correctAnswer || q.correct_answer || 'UNKNOWN',
        status: q.status,
        marksAwarded: q.marksAwarded ?? q.marks_awarded ?? 0
      })
    );

    return {
      testId: raw.testId || raw.test_id || payload.testId,
      completedAt: raw.completedAt || raw.completed_at || Date.now(),
      score,
      evaluatedQuestions
    };
  }

  async resetToDefaultSeed(): Promise<void> {
    await this.importQuestions(SEED_QUESTIONS);
  }
}
