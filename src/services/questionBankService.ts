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
    return {
      ...row,
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

  return {
    ...data,
    images: mergedImages,
    options: rawOptions
  };
}

/**
 * Fetch dynamic distinct chapters from question_bank
 */
export async function fetchDistinctChapters(subject?: string): Promise<{ chapter_slug: string; chapter_name: string; subject: string; count: number }[]> {
  let query = supabase
    .from('question_bank')
    .select('chapter_slug, chapter_name, subject');

  if (subject && subject !== 'All') {
    query = query.ilike('subject', `%${subject}%`);
  }

  const { data, error } = await query.limit(2000);

  if (error || !data) {
    console.warn('[Question Bank] Distinct chapters fetch error:', error);
    return [];
  }

  const map = new Map<string, { chapter_slug: string; chapter_name: string; subject: string; count: number }>();
  for (const item of data) {
    const slug = item.chapter_slug || item.chapter_name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'general';
    const name = item.chapter_name || slug.replace(/_/g, ' ');
    const subj = item.subject || 'General';
    const key = `${subj}::${slug}`;
    if (!map.has(key)) {
      map.set(key, { chapter_slug: slug, chapter_name: name, subject: subj, count: 1 });
    } else {
      map.get(key)!.count++;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.chapter_name.localeCompare(b.chapter_name));
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
  const { count: totalCount } = await supabase
    .from('question_bank')
    .select('*', { count: 'exact', head: true });

  const { count: neetCount } = await supabase
    .from('question_bank')
    .select('*', { count: 'exact', head: true })
    .ilike('exam_source', '%NEET%');

  const { count: jeeCount } = await supabase
    .from('question_bank')
    .select('*', { count: 'exact', head: true })
    .ilike('exam_source', '%JEE%');

  const chapters = await fetchDistinctChapters();

  // Query counts for Physics, Chemistry, Botany, Zoology
  const subjects = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  const questionsBySubject: Record<string, number> = {};

  for (const s of subjects) {
    const { count } = await supabase
      .from('question_bank')
      .select('*', { count: 'exact', head: true })
      .ilike('subject', `%${s}%`);
    questionsBySubject[s] = count || 0;
  }

  return {
    totalQuestions: totalCount || 0,
    neetQuestions: neetCount || 0,
    jeeMainQuestions: jeeCount || 0,
    totalChapters: chapters.length,
    questionsBySubject
  };
}

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

  if (isNeetHard) {
    // 1. NEET Hard pool
    let qNeet = supabase
      .from('question_bank')
      .select('*, options:question_options(*), question_images(*)')
      .ilike('exam_source', '%NEET%')
      .ilike('difficulty', 'hard');

    if (subject !== 'All') {
      qNeet = qNeet.ilike('subject', `%${subject}%`);
    }
    if (!isFullSyllabus) {
      qNeet = qNeet.in('chapter_slug', selectedChapters);
    }
    queryPromises.push(Promise.resolve(qNeet.limit(400)));

    // 2. JEE Main Hard pool: allowed ONLY for Physics & Chemistry, NEVER for Botany/Zoology
    const isPhysicsOrChemistry =
      subject === 'All' ||
      subject.toLowerCase() === 'physics' ||
      subject.toLowerCase() === 'chemistry';

    if (isPhysicsOrChemistry) {
      let qJee = supabase
        .from('question_bank')
        .select('*, options:question_options(*), question_images(*)')
        .ilike('exam_source', '%JEE%');

      if (subject !== 'All') {
        qJee = qJee.ilike('subject', `%${subject}%`);
      } else {
        qJee = qJee.or('subject.ilike.%physics%,subject.ilike.%chemistry%');
      }

      if (!isFullSyllabus) {
        qJee = qJee.in('chapter_slug', selectedChapters);
      }
      queryPromises.push(Promise.resolve(qJee.limit(400)));
    }
  } else if (exam === 'NEET') {
    // Normal NEET modes (Easy or Medium): JEE Main strictly excluded!
    let q = supabase
      .from('question_bank')
      .select('*, options:question_options(*), question_images(*)')
      .ilike('exam_source', '%NEET%')
      .ilike('difficulty', difficulty);

    if (subject !== 'All') {
      q = q.ilike('subject', `%${subject}%`);
    }
    if (!isFullSyllabus) {
      q = q.in('chapter_slug', selectedChapters);
    }
    queryPromises.push(Promise.resolve(q.limit(400)));
  } else if (exam === 'JEE Main') {
    // JEE Main mode: strictly JEE Main only (never add NEET questions)
    let q = supabase
      .from('question_bank')
      .select('*, options:question_options(*), question_images(*)')
      .ilike('exam_source', '%JEE%');

    if (difficulty) {
      q = q.ilike('difficulty', difficulty);
    }
    if (subject !== 'All') {
      q = q.ilike('subject', `%${subject}%`);
    }
    if (!isFullSyllabus) {
      q = q.in('chapter_slug', selectedChapters);
    }
    queryPromises.push(Promise.resolve(q.limit(400)));
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

  // Pre-resolve signed URLs for all images in the active session
  for (const q of selectedRecords) {
    if (Array.isArray(q.images)) {
      for (const img of q.images) {
        if (img.storage_path && img.is_available !== false) {
          try {
            const res = await resolveQuestionImage(img, q.question_code);
            if (res.url) {
              img.url = res.url;
            }
          } catch {
            // runtime QuestionImage will handle fallback
          }
        }
      }
    }
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
      chapter_name: q.chapter_name || q.chapter_slug || 'General',
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

  // If not in session storage, query database by IDs
  const missingIds = session.questions.map((q) => q.id).filter((id) => !secretKeyMap[id]);
  if (missingIds.length > 0) {
    const { data: dbRecords } = await supabase
      .from('question_bank')
      .select('id, correct_option, solution_text, solution_html')
      .in('id', missingIds);

    (dbRecords || []).forEach((r) => {
      secretKeyMap[r.id] = {
        correct_option: (r.correct_option || 'A').toUpperCase().trim(),
        solution_text: r.solution_text,
        solution_html: r.solution_html
      };
    });
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
