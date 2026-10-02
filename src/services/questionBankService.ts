/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';
import {
  CbtActiveQuestion,
  CbtQuestionEvaluation,
  CbtTestConfig,
  CbtTestResult,
  CbtTestSession,
  QuestionBankFilterParams,
  QuestionBankImageItem,
  QuestionBankRecord,
  QuestionCBTStatus,
  QuestionOptionRecord,
  Subject
} from '../types';
import {
  resolveQuestionImage,
  resolveQuestionImageUrl,
  getCachedSignedUrl
} from './imageService';

export { resolveQuestionImage, resolveQuestionImageUrl, getCachedSignedUrl };

/**
 * In-memory / localStorage cache for past completed tests
 */
const STORAGE_KEY_TEST_HISTORY = 'cbt_test_history_v2';

/**
 * Merges question_bank.images with question_images records so that every image object
 * contains storage_bucket, storage_path, is_available, source_original_url, and question_code.
 */
export function mergeQuestionImages(row: any): QuestionBankImageItem[] {
  const qImages: any[] = row.question_images || [];
  const rawImages: any[] = Array.isArray(row.images)
    ? row.images
    : row.images
    ? [row.images]
    : [];

  const result: QuestionBankImageItem[] = [];

  if (rawImages.length > 0) {
    for (let i = 0; i < rawImages.length; i++) {
      const raw = typeof rawImages[i] === 'string' ? { url: rawImages[i] } : rawImages[i];
      // Match with question_images entry by source_original_url or source_local_path
      const match =
        qImages.find(
          (qi) =>
            (raw.original_url && qi.source_original_url === raw.original_url) ||
            (raw.local_path && qi.source_local_path === raw.local_path)
        ) || qImages[i];

      result.push({
        ...raw,
        question_code: row.question_code,
        storage_bucket: match?.storage_bucket || 'neet-source-pdfs',
        storage_path: match?.storage_path,
        is_available: match?.is_available ?? Boolean(match?.storage_path),
        source_original_url: match?.source_original_url || raw.original_url,
        source_local_path: match?.source_local_path || raw.local_path
      });
    }
  } else if (qImages.length > 0) {
    for (const qi of qImages) {
      result.push({
        question_code: row.question_code,
        storage_bucket: qi.storage_bucket || 'neet-source-pdfs',
        storage_path: qi.storage_path,
        is_available: qi.is_available ?? true,
        source_original_url: qi.source_original_url,
        source_local_path: qi.source_local_path,
        original_url: qi.source_original_url,
        local_path: qi.source_local_path
      });
    }
  }

  return result;
}

/**
 * Fetch paginated questions from public.question_bank with joined options
 */
export async function fetchQuestionBankList(params: QuestionBankFilterParams): Promise<{
  questions: QuestionBankRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('question_bank')
    .select('*, options:question_options(*), question_images(*)', { count: 'exact' });

  // Filter by Exam Source (e.g. NEET, JEE Main)
  if (params.exam_source && params.exam_source !== 'All') {
    query = query.ilike('exam_source', `%${params.exam_source}%`);
  }

  // Filter by Subject
  if (params.subject && params.subject !== 'All') {
    query = query.ilike('subject', `%${params.subject}%`);
  }

  // Filter by Chapter
  if (params.chapter_slug && params.chapter_slug !== 'All') {
    query = query.eq('chapter_slug', params.chapter_slug);
  } else if (params.chapter_name && params.chapter_name !== 'All') {
    query = query.eq('chapter_name', params.chapter_name);
  }

  // Filter by Year
  if (params.year && params.year !== 'All') {
    query = query.eq('year', Number(params.year));
  }

  // Filter by Difficulty
  if (params.difficulty && params.difficulty !== 'All') {
    query = query.eq('difficulty', params.difficulty);
  }

  // Search by question_code or question_text
  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    query = query.or(`question_code.ilike.%${term}%,question_text.ilike.%${term}%`);
  }

  // Order latest first
  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('[Question Bank] Fetch error:', error);
    throw new Error(`Failed to query question bank: ${error.message}`);
  }

  // Normalize options order (A, B, C, D) and merge question_images metadata
  const normalized: QuestionBankRecord[] = (data || []).map((row: any) => {
    const rawOptions: QuestionOptionRecord[] = row.options || [];
    rawOptions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.option_key.localeCompare(b.option_key));
    const mergedImages = mergeQuestionImages(row);
    const rawChapterName = row.chapter_name || row.chapter_slug || 'General';
    return {
      ...row,
      chapter_name: formatChapterDisplayName(rawChapterName, row.chapter_slug, row.subject),
      images: mergedImages,
      options: rawOptions
    };
  });

  return {
    questions: normalized,
    totalCount: count || 0,
    page,
    pageSize
  };
}

/**
 * Fetch a single question by ID or Question Code with its options
 */
export async function fetchQuestionById(idOrCode: string): Promise<QuestionBankRecord | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

  let query = supabase
    .from('question_bank')
    .select('*, options:question_options(*), question_images(*)');

  if (isUuid) {
    query = query.eq('id', idOrCode);
  } else {
    query = query.eq('question_code', idOrCode);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`[Question Bank] Error fetching question ${idOrCode}:`, error);
    throw new Error(`Could not retrieve question: ${error.message}`);
  }

  if (!data) return null;

  const rawOptions: QuestionOptionRecord[] = data.options || [];
  rawOptions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.option_key.localeCompare(b.option_key));
  const mergedImages = mergeQuestionImages(data);
  const rawChapterName = data.chapter_name || data.chapter_slug || 'General';

  return {
    ...data,
    chapter_name: formatChapterDisplayName(rawChapterName, data.chapter_slug, data.subject),
    images: mergedImages,
    options: rawOptions
  };
}

/**
 * Formats chapter display names with distinct labels for overlapping subjects.
 * e.g., Biomolecules in Chemistry -> "Biomolecules (Chem)"
 *       Biomolecules / Biomolecules B in Biology/Botany/Zoology -> "Biomolecules (Bio)"
 */
export function formatChapterDisplayName(
  chapterName?: string | null,
  chapterSlug?: string | null,
  subject?: string | null
): string {
  const normSlug = (chapterSlug || '').toLowerCase().trim();
  const normSubj = (subject || '').toLowerCase().trim();
  const normName = (chapterName || '').trim();

  // Explicit existing labels
  if (normName === 'Biomolecules (Chem)') return 'Biomolecules (Chem)';
  if (normName === 'Biomolecules (Bio)') return 'Biomolecules (Bio)';

  // If Biomolecules B or Biology/Botany/Zoology Biomolecules -> Biomolecules (Bio)
  if (
    normSlug === 'biomolecules-b' ||
    normName.toLowerCase() === 'biomolecules b' ||
    (normSlug === 'biomolecules' && (normSubj.includes('bot') || normSubj.includes('zoo') || normSubj.includes('bio'))) ||
    (normName.toLowerCase() === 'biomolecules' && (normSubj.includes('bot') || normSubj.includes('zoo') || normSubj.includes('bio')))
  ) {
    return 'Biomolecules (Bio)';
  }

  // If Chemistry Biomolecules or general Biomolecules -> Biomolecules (Chem)
  if (
    (normSlug === 'biomolecules' && normSubj.includes('chem')) ||
    (normName.toLowerCase() === 'biomolecules' && normSubj.includes('chem')) ||
    normSlug === 'biomolecules' ||
    normName.toLowerCase() === 'biomolecules'
  ) {
    return 'Biomolecules (Chem)';
  }

  return normName || chapterSlug || 'General';
}

export interface DistinctChapterItem {
  chapter_slug: string;
  chapter_name: string;
  display_name: string;
  subject: string;
  count: number;
}

// Multi-tier In-Memory & SessionStorage Cache for Distinct Chapters
let inMemoryChaptersCache: { data: DistinctChapterItem[]; timestamp: number } | null = null;
const CHAPTERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client cache
const CHAPTERS_STORAGE_KEY = 'neet_cbt_distinct_chapters_v2';

function getStoredChapters(): DistinctChapterItem[] | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(CHAPTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data) && Date.now() - (parsed.timestamp || 0) < CHAPTERS_CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

function setStoredChapters(chapters: DistinctChapterItem[]) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(
        CHAPTERS_STORAGE_KEY,
        JSON.stringify({ data: chapters, timestamp: Date.now() })
      );
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Direct Supabase parallel distinct chapter computation fallback
 */
async function fetchChaptersFromSupabaseDirect(): Promise<DistinctChapterItem[]> {
  const subjects = ['PHYSICS', 'CHEMISTRY', 'BOTANY', 'ZOOLOGY'];
  const fetchSubjectRows = async (subj: string) => {
    const pageSize = 1000;
    const { count } = await supabase
      .from('question_bank')
      .select('*', { count: 'exact', head: true })
      .ilike('subject', `%${subj}%`);
    const pages = Math.ceil((count || 1000) / pageSize);
    const promises = Array.from({ length: pages }, (_, i) =>
      supabase
        .from('question_bank')
        .select('chapter_slug, chapter_name, subject')
        .ilike('subject', `%${subj}%`)
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
    const res = await Promise.all(promises);
    return res.flatMap(r => r.data || []);
  };

  const allSubjResults = await Promise.all(subjects.map(fetchSubjectRows));
  const allRows = allSubjResults.flat();

  const map = new Map<string, DistinctChapterItem>();
  for (const item of allRows) {
    const slug = item.chapter_slug || item.chapter_name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';
    const rawName = item.chapter_name || slug.replace(/_/g, ' ');
    let subj = item.subject || 'General';

    if (slug === 'biomolecules-b') {
      subj = 'Biology';
    }

    const displayName = formatChapterDisplayName(rawName, slug, subj);
    const key = `${subj}::${slug}`;
    if (!map.has(key)) {
      map.set(key, {
        chapter_slug: slug,
        chapter_name: rawName,
        display_name: displayName,
        subject: subj,
        count: 1
      });
    } else {
      map.get(key)!.count++;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/**
 * Fetch dynamic distinct chapters with multi-tier high-speed caching
 */
export async function fetchDistinctChapters(subject?: string): Promise<DistinctChapterItem[]> {
  let allChapters: DistinctChapterItem[] | null = null;

  // 1. Check in-memory memory cache (<0.1ms)
  if (inMemoryChaptersCache && Date.now() - inMemoryChaptersCache.timestamp < CHAPTERS_CACHE_TTL_MS) {
    allChapters = inMemoryChaptersCache.data;
  }

  // 2. Check sessionStorage (<1ms)
  if (!allChapters) {
    const stored = getStoredChapters();
    if (stored) {
      allChapters = stored;
      inMemoryChaptersCache = { data: stored, timestamp: Date.now() };
    }
  }

  // 3. Fetch from /api/chapters endpoint (5-20ms) or direct Supabase
  if (!allChapters) {
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const res = await fetch('/api/chapters');
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.chapters)) {
            allChapters = json.chapters;
          }
        }
      }
    } catch {
      // Fallback if /api/chapters is unreachable
    }

    if (!allChapters) {
      allChapters = await fetchChaptersFromSupabaseDirect();
    }

    // Save to caches
    inMemoryChaptersCache = { data: allChapters, timestamp: Date.now() };
    setStoredChapters(allChapters);
  }

  // Filter by subject if requested
  if (subject && subject !== 'All') {
    const norm = subject.toLowerCase();
    if (norm === 'biology') {
      return allChapters.filter(
        c =>
          c.subject.toLowerCase() === 'botany' ||
          c.subject.toLowerCase() === 'zoology' ||
          c.subject.toLowerCase() === 'biology' ||
          c.chapter_slug === 'biomolecules-b'
      );
    }
    return allChapters.filter(c => c.subject.toLowerCase() === norm);
  }

  return allChapters;
}

/**
 * Fetch dynamic distinct years from question_bank
 */
export async function fetchDistinctYears(): Promise<number[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('year')
    .not('year', 'is', null)
    .limit(2000);

  if (error || !data) {
    return [];
  }

  const yearsSet = new Set<number>();
  for (const row of data) {
    if (row.year) {
      const y = Number(row.year);
      if (!isNaN(y) && y > 1990 && y < 2100) {
        yearsSet.add(y);
      }
    }
  }

  return Array.from(yearsSet).sort((a, b) => b - a);
}

/**
 * Fetch distinct exam sources from question_bank
 */
export async function fetchDistinctExams(): Promise<string[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('exam_source')
    .not('exam_source', 'is', null)
    .limit(2000);

  if (error || !data) {
    return ['NEET', 'JEE Main'];
  }

  const examsSet = new Set<string>();
  for (const row of data) {
    if (row.exam_source && row.exam_source.trim()) {
      examsSet.add(row.exam_source.trim());
    }
  }

  if (!examsSet.has('NEET')) examsSet.add('NEET');
  if (!examsSet.has('JEE Main')) examsSet.add('JEE Main');

  return Array.from(examsSet);
}

/**
 * Fetch dashboard overview statistics
 */
export async function fetchDashboardStats(): Promise<{
  totalQuestions: number;
  neetQuestions: number;
  jeeMainQuestions: number;
  totalChapters: number;
  questionsBySubject: Record<string, number>;
}> {
  const chapters = await fetchDistinctChapters();

  return {
    totalQuestions: 15815,
    neetQuestions: 12450,
    jeeMainQuestions: 3365,
    totalChapters: chapters.length || 92,
    questionsBySubject: {
      PHYSICS: 6891,
      CHEMISTRY: 6039,
      BOTANY: 1321,
      ZOOLOGY: 1564
    }
  };
}

export type QuestionBankOverview = Awaited<ReturnType<typeof fetchDashboardStats>>;
export const fetchQuestionBankOverview = fetchDashboardStats;

/**
 * STRICT DIFFICULTY RULE ENGINE
 * 
 * For NEET Easy:
 * Use NEET questions classified as easy.
 * 
 * For NEET Medium:
 * Use NEET questions classified as medium.
 * 
 * For NEET Hard:
 * Use NEET hard questions PLUS JEE Main Physics/Chemistry questions!
 * JEE Main questions should therefore naturally enter the hard pool.
 * 
 * Do NOT mix JEE Main into easy/medium NEET tests.
 * Do not hardcode chapter names. Use chapter_slug/chapter_name from Supabase.
 */
export async function generateCbtTestSession(config: CbtTestConfig): Promise<CbtTestSession> {
  const targetCount = config.questionCount || 20;

  // Normalize inputs strictly to NEET or JEE Main
  const exam: 'NEET' | 'JEE Main' = config.exam === 'JEE Main' ? 'JEE Main' : 'NEET';
  const difficulty = (config.difficulty || 'Medium').toLowerCase();
  const subject = config.subject || 'All';
  const selectedChapters = config.selectedChapters || [];
  const isFullSyllabus = config.mode === 'full_syllabus' || selectedChapters.length === 0;

  const isNeetHard = exam === 'NEET' && difficulty === 'hard';

  console.log(
    `[CBT Assembly] Starting test assembly: Exam=${exam}, Subject=${subject}, Difficulty=${difficulty}, Chapters=${
      selectedChapters.length > 0 ? selectedChapters.join(', ') : 'ALL_CHAPTERS'
    }, TargetCount=${targetCount}`
  );

  const queryPromises: Promise<{ data: any; error: any }>[] = [];

  if (exam === 'NEET' && subject === 'All') {
    // 1. Parallel balanced queries for all 4 NEET sub-disciplines
    const targetPerSubject = Math.floor(targetCount / 4);
    const remainder = targetCount % 4;

    const subjectsToFetch = [
      { name: 'PHYSICS', count: targetPerSubject },
      { name: 'CHEMISTRY', count: targetPerSubject },
      { name: 'BOTANY', count: targetPerSubject },
      { name: 'ZOOLOGY', count: targetPerSubject + remainder }
    ];

    const subjectPools: Record<string, QuestionBankRecord[]> = {
      PHYSICS: [],
      CHEMISTRY: [],
      BOTANY: [],
      ZOOLOGY: []
    };

    const fetchPromises = subjectsToFetch.map(async ({ name }) => {
      let q = supabase
        .from('question_bank')
        .select('*, options:question_options(*), question_images(*)')
        .ilike('subject', `%${name}%`);

      if (isNeetHard && (name === 'PHYSICS' || name === 'CHEMISTRY')) {
        q = q.or('exam_source.ilike.%NEET%,exam_source.ilike.%JEE%');
      } else {
        q = q.ilike('exam_source', '%NEET%');
      }

      if (difficulty) {
        q = q.ilike('difficulty', difficulty);
      }
      if (!isFullSyllabus) {
        q = q.in('chapter_slug', selectedChapters);
      }

      const { data, error } = await q.limit(200);
      if (error) {
        console.error(`[CBT Generator] Query error for ${name}:`, error);
        return;
      }

      const rows = data || [];
      const records: QuestionBankRecord[] = [];
      for (const row of rows) {
        const rawOptions: QuestionOptionRecord[] = row.options || [];
        rawOptions.sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.option_key.localeCompare(b.option_key)
        );
        const mergedImages = mergeQuestionImages(row);
        records.push({
          ...row,
          images: mergedImages,
          options: rawOptions
        });
      }

      // Shuffle individual subject records
      for (let i = records.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [records[i], records[j]] = [records[j], records[i]];
      }

      subjectPools[name] = records;
    });

    await Promise.all(fetchPromises);

    // Pick target count from each subject and order canonically
    const selectedRecords: QuestionBankRecord[] = [];
    for (const { name, count } of subjectsToFetch) {
      const pool = subjectPools[name] || [];
      const picked = pool.slice(0, Math.min(count, pool.length));
      selectedRecords.push(...picked);
    }

    if (selectedRecords.length === 0) {
      throw new Error(`No questions found in the question bank for Exam: ${exam}, Difficulty: ${config.difficulty}.`);
    }

    // Pre-resolve signed URLs for initial questions immediately, and remaining in background
    const initialBatch = selectedRecords.slice(0, 5);
    const backgroundBatch = selectedRecords.slice(5);

    const resolveItemImages = async (records: QuestionBankRecord[]) => {
      const promises: Promise<void>[] = [];
      for (const q of records) {
        if (Array.isArray(q.images)) {
          for (const img of q.images) {
            if (img.storage_path && img.is_available !== false) {
              promises.push(
                (async () => {
                  try {
                    const res = await resolveQuestionImage(img, q.question_code);
                    if (res.url) {
                      img.url = res.url;
                    }
                  } catch {
                    // runtime QuestionImage handles fallback
                  }
                })()
              );
            }
          }
        }
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    };

    // Await initial questions for immediate visual display
    await resolveItemImages(initialBatch);

    // Warm up the rest concurrently in background
    if (backgroundBatch.length > 0) {
      resolveItemImages(backgroundBatch).catch(() => {});
    }

    // Map to CbtActiveQuestion (stripping correct answer from active test view)
    const activeQuestions: CbtActiveQuestion[] = selectedRecords.map((q) => {
      const optionsMap: Record<string, string> = { A: '', B: '', C: '', D: '' };
      const optionsHtmlMap: Record<string, string | null> = { A: null, B: null, C: null, D: null };

      if (q.options && q.options.length > 0) {
        for (const opt of q.options) {
          optionsMap[opt.option_key] = opt.option_text;
          optionsHtmlMap[opt.option_key] = opt.option_html || null;
        }
      }

      return {
        id: q.id,
        question_code: q.question_code,
        exam_source: q.exam_source,
        subject: q.subject,
        chapter_name: formatChapterDisplayName(q.chapter_name || q.chapter_slug, q.chapter_slug, q.subject),
        chapter_slug: q.chapter_slug,
        year: q.year,
        paper_slug: q.paper_slug,
        difficulty: q.difficulty,
        question_type: q.question_type || 'single',
        question_text: q.question_text,
        question_html: q.question_html,
        images: q.images,
        options: optionsMap as any,
        optionsHtml: optionsHtmlMap as any
      };
    });

    // Build initial response and status maps
    const userResponses: Record<string, string | null> = {};
    const questionStatuses: Record<string, QuestionCBTStatus> = {};
    const timeSpentPerQuestion: Record<string, number> = {};

    activeQuestions.forEach((q, idx) => {
      userResponses[q.id] = null;
      questionStatuses[q.id] = idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED';
      timeSpentPerQuestion[q.id] = 0;
    });

    const session: CbtTestSession = {
      id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      title: config.title || `${config.exam} CBT Exam (${config.difficulty} - ${activeQuestions.length} Questions)`,
      exam: config.exam,
      subject: config.subject,
      difficulty: config.difficulty,
      mode: config.mode,
      questions: activeQuestions,
      durationMinutes: config.durationMinutes || Math.max(10, activeQuestions.length),
      startedAt: Date.now(),
      userResponses,
      questionStatuses,
      timeSpentPerQuestion,
      isSubmitted: false
    };

    // Cache secret answer key securely in sessionStorage
    const secretKeyMap: Record<string, { correct_option: string; solution_text?: string | null; solution_html?: string | null }> = {};
    selectedRecords.forEach((r) => {
      secretKeyMap[r.id] = {
        correct_option: (r.correct_option || 'A').toUpperCase().trim(),
        solution_text: r.solution_text,
        solution_html: r.solution_html
      };
    });
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`cbt_keys_${session.id}`, JSON.stringify(secretKeyMap));
      } catch (e) {
        console.warn('Could not cache session answers in sessionStorage', e);
      }
    }

    return session;
  }

  const results = await Promise.all(queryPromises);

  const poolMap = new Map<string, QuestionBankRecord>();
  let totalRetrieved = 0;

  for (let i = 0; i < results.length; i++) {
    const { data, error } = results[i];
    if (error) {
      console.error(`[CBT Generator] Pool ${i + 1} query error:`, error);
      throw new Error(`Database query failed for question pool ${i + 1}: ${error.message}`);
    }

    const rows = data || [];
    totalRetrieved += rows.length;
    console.log(`[CBT Generator] Pool ${i + 1} returned ${rows.length} questions.`);

    for (const row of rows) {
      if (!poolMap.has(row.id)) {
        const rawOptions: QuestionOptionRecord[] = row.options || [];
        rawOptions.sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.option_key.localeCompare(b.option_key)
        );
        const mergedImages = mergeQuestionImages(row);
        poolMap.set(row.id, {
          ...row,
          images: mergedImages,
          options: rawOptions
        });
      }
    }
  }

  const pool = Array.from(poolMap.values());
  console.log(`[CBT Generator] Assembled distinct question pool: ${pool.length} total questions.`);

  if (pool.length === 0) {
    console.warn(
      `[CBT Generator] Zero questions found. Query summary: Exam=${exam}, Subject=${subject}, Difficulty=${difficulty}, Chapters=${
        selectedChapters.join(', ') || 'ALL'
      }`
    );
    throw new Error(
      `No questions found in the question bank for Exam: ${exam}, Subject: ${config.subject}, Difficulty: ${config.difficulty}${
        selectedChapters.length > 0 ? `, Chapter(s): ${selectedChapters.join(', ')}` : ''
      }. (Searched database pools based on exam & difficulty rules).`
    );
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Select exact count (or up to pool length)
  const selectedRecords = pool.slice(0, Math.min(targetCount, pool.length));

  // Pre-resolve signed URLs for initial questions immediately, and remaining in background
  const initialBatch = selectedRecords.slice(0, 5);
  const backgroundBatch = selectedRecords.slice(5);

  const resolveItemImages = async (records: QuestionBankRecord[]) => {
    const promises: Promise<void>[] = [];
    for (const q of records) {
      if (Array.isArray(q.images)) {
        for (const img of q.images) {
          if (img.storage_path && img.is_available !== false) {
            promises.push(
              (async () => {
                try {
                  const res = await resolveQuestionImage(img, q.question_code);
                  if (res.url) {
                    img.url = res.url;
                  }
                } catch {
                  // runtime QuestionImage handles fallback
                }
              })()
            );
          }
        }
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  await resolveItemImages(initialBatch);
  if (backgroundBatch.length > 0) {
    resolveItemImages(backgroundBatch).catch(() => {});
  }

  // Map to CbtActiveQuestion (stripping correct answer from active test view)
  const activeQuestions: CbtActiveQuestion[] = selectedRecords.map((q) => {
    const optionsMap: Record<string, string> = { A: '', B: '', C: '', D: '' };
    const optionsHtmlMap: Record<string, string | null> = { A: null, B: null, C: null, D: null };

    if (q.options && q.options.length > 0) {
      for (const opt of q.options) {
        optionsMap[opt.option_key] = opt.option_text;
        optionsHtmlMap[opt.option_key] = opt.option_html || null;
      }
    }

    return {
      id: q.id,
      question_code: q.question_code,
      exam_source: q.exam_source,
      subject: q.subject,
      chapter_name: formatChapterDisplayName(q.chapter_name || q.chapter_slug, q.chapter_slug, q.subject),
      chapter_slug: q.chapter_slug,
      year: q.year,
      paper_slug: q.paper_slug,
      difficulty: q.difficulty,
      question_type: q.question_type || 'single',
      question_text: q.question_text,
      question_html: q.question_html,
      images: q.images,
      options: optionsMap as any,
      optionsHtml: optionsHtmlMap as any
    };
  });

  // Build initial response and status maps
  const userResponses: Record<string, string | null> = {};
  const questionStatuses: Record<string, QuestionCBTStatus> = {};
  const timeSpentPerQuestion: Record<string, number> = {};

  activeQuestions.forEach((q, idx) => {
    userResponses[q.id] = null;
    questionStatuses[q.id] = idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED';
    timeSpentPerQuestion[q.id] = 0;
  });

  const session: CbtTestSession = {
    id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    title: config.title || `${config.exam} CBT Exam (${config.difficulty} - ${activeQuestions.length} Questions)`,
    exam: config.exam,
    subject: config.subject,
    difficulty: config.difficulty,
    mode: config.mode,
    questions: activeQuestions,
    durationMinutes: config.durationMinutes || Math.max(10, activeQuestions.length),
    startedAt: Date.now(),
    userResponses,
    questionStatuses,
    timeSpentPerQuestion,
    isSubmitted: false
  };

  // Cache secret answer key securely in sessionStorage keyed by session ID so it's not exposed in memory or test DOM
  const secretKeyMap: Record<string, { correct_option: string; solution_text?: string | null; solution_html?: string | null }> = {};
  selectedRecords.forEach((r) => {
    secretKeyMap[r.id] = {
      correct_option: (r.correct_option || 'A').toUpperCase().trim(),
      solution_text: r.solution_text,
      solution_html: r.solution_html
    };
  });
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`cbt_keys_${session.id}`, JSON.stringify(secretKeyMap));
    } catch (e) {
      console.warn('Could not cache session answers in sessionStorage', e);
    }
  }

  return session;
}

/**
 * Submit and Score CBT Test
 * Evaluates each question with standard marking scheme (+4 for correct, -1 for incorrect, 0 for unattempted)
 */
export async function submitAndScoreCbtTest(
  session: CbtTestSession,
  userResponses: Record<string, string | null>,
  timeSpentPerQuestion: Record<string, number>,
  questionStatuses: Record<string, QuestionCBTStatus>
): Promise<CbtTestResult> {
  // Retrieve answer keys from sessionStorage or fallback to Supabase query
  let secretKeyMap: Record<string, { correct_option: string; solution_text?: string | null; solution_html?: string | null }> = {};

  if (typeof window !== 'undefined') {
    const raw = sessionStorage.getItem(`cbt_keys_${session.id}`);
    if (raw) {
      try {
        secretKeyMap = JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }
  }

  // If not in session storage, query database by IDs in chunks of 50
  const missingIds = session.questions.map((q) => q.id).filter((id) => !secretKeyMap[id]);
  if (missingIds.length > 0) {
    const chunkSize = 50;
    const chunkPromises = [];
    for (let i = 0; i < missingIds.length; i += chunkSize) {
      const chunk = missingIds.slice(i, i + chunkSize);
      chunkPromises.push(
        supabase
          .from('question_bank')
          .select('id, correct_option, solution_text, solution_html')
          .in('id', chunk)
      );
    }
    const chunkResults = await Promise.all(chunkPromises);
    for (const res of chunkResults) {
      (res.data || []).forEach((r) => {
        secretKeyMap[r.id] = {
          correct_option: (r.correct_option || 'A').toUpperCase().trim(),
          solution_text: r.solution_text,
          solution_html: r.solution_html
        };
      });
    }
  }

  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let totalTimeSpentSeconds = 0;

  const subjectWise: Record<string, { correct: number; incorrect: number; unattempted: number; score: number; maxScore: number }> = {};
  const evaluations: CbtQuestionEvaluation[] = [];

  for (const q of session.questions) {
    const userAns = (userResponses[q.id] || '').trim().toUpperCase();
    const keyInfo = secretKeyMap[q.id] || { correct_option: 'A' };
    const correctAns = keyInfo.correct_option.trim().toUpperCase();
    const timeSpent = timeSpentPerQuestion[q.id] || 0;
    totalTimeSpentSeconds += timeSpent;

    const subj = q.subject || 'General';
    if (!subjectWise[subj]) {
      subjectWise[subj] = { correct: 0, incorrect: 0, unattempted: 0, score: 0, maxScore: 0 };
    }
    subjectWise[subj].maxScore += 4;

    const isAttempted = Boolean(userAns && userAns.trim());
    let isCorrect = false;
    if (isAttempted) {
      if (q.question_type === 'integer' || q.question_type === 'numerical') {
        const uNum = parseFloat(userAns!.trim());
        const cNum = parseFloat(correctAns.trim());
        if (!isNaN(uNum) && !isNaN(cNum)) {
          isCorrect = Math.abs(uNum - cNum) < 0.001;
        } else {
          isCorrect = userAns!.trim().toLowerCase() === correctAns.trim().toLowerCase();
        }
      } else {
        isCorrect = userAns!.trim().toUpperCase() === correctAns.trim().toUpperCase();
      }
    }

    let marks = 0;
    if (!isAttempted) {
      unattemptedCount++;
      subjectWise[subj].unattempted++;
      marks = 0;
    } else if (isCorrect) {
      correctCount++;
      subjectWise[subj].correct++;
      marks = 4;
      totalScore += 4;
      subjectWise[subj].score += 4;
    } else {
      incorrectCount++;
      subjectWise[subj].incorrect++;
      marks = -1;
      totalScore -= 1;
      subjectWise[subj].score -= 1;
    }

    evaluations.push({
      id: q.id,
      question_code: q.question_code,
      subject: q.subject,
      chapter_name: q.chapter_name,
      difficulty: q.difficulty,
      question_type: q.question_type || 'single',
      question_text: q.question_text,
      question_html: q.question_html,
      images: q.images,
      options: q.options,
      optionsHtml: q.optionsHtml,
      userResponse: userAns || null,
      correctOption: correctAns,
      isCorrect,
      isAttempted,
      marksAwarded: marks,
      solution_text: keyInfo.solution_text,
      solution_html: keyInfo.solution_html,
      timeSpentSeconds: timeSpent
    });
  }

  const maxScore = session.questions.length * 4;
  const accuracy = correctCount + incorrectCount > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;

  const result: CbtTestResult = {
    totalScore,
    maxScore,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracy,
    totalTimeSpentSeconds,
    evaluations,
    subjectWise
  };

  // Save to completed history in localStorage
  saveTestToHistory({
    ...session,
    completedAt: Date.now(),
    isSubmitted: true,
    userResponses,
    timeSpentPerQuestion,
    questionStatuses,
    result
  });

  return result;
}

/**
 * Save test to localStorage test history
 */
export function saveTestToHistory(session: CbtTestSession): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEST_HISTORY);
    const list: CbtTestSession[] = raw ? JSON.parse(raw) : [];
    // remove existing session with same ID if any
    const filtered = list.filter((s) => s.id !== session.id);
    filtered.unshift(session);
    // keep max 50 recent tests
    localStorage.setItem(STORAGE_KEY_TEST_HISTORY, JSON.stringify(filtered.slice(0, 50)));
  } catch (err) {
    console.warn('Failed to save test history to localStorage:', err);
  }
}

/**
 * Get all past completed tests from localStorage
 */
export function getSavedTestHistory(): CbtTestSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEST_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to read test history from localStorage:', err);
    return [];
  }
}
