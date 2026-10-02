/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isSupabaseConfigured } from '../lib/supabase';
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
  QuestionCBTStatus,
  QuestionFilterParams,
  RandomNeetTestConfig,
  RandomNeetTestRpcResult,
  SecureExamResult,
  SourceChapter,
  SourceFile,
  Subject,
  TestGenerationConfig,
  TestGenerationMode,
  TestScoreBreakdown,
  TestSession
} from '../types';
import { IDataProvider } from './providers/dataProvider.interface';
import { LocalStorageProvider } from './providers/localStorageProvider';
import { SupabaseProvider } from './providers/supabaseProvider';

// Active provider instance (Supabase is the primary authoritative data provider)
export const activeProvider: IDataProvider = new SupabaseProvider();

// Helper: Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Get priority value for a question based on its source_type or custom metadata
function getQuestionPriority(q: Question): number {
  if (q.visual?.priority !== undefined) {
    return Number(q.visual.priority);
  }
  const type = q.visual?.source_type || q.visual?.sourceType;
  if (type === 'PYQ') return 100;
  if (type === 'EXEMPLAR') return 90;
  if (type === 'PRACTICE') return 35;
  if (type === 'UNKNOWN') return 0;

  // Fallback for existing questions: if text contains bracketed exam info, treat as PYQ, else default practice
  const text = q.text || '';
  if (text.includes('[JEE') || text.includes('[NEET') || text.includes('PYQ') || text.match(/\[(19|20)\d{2}\]/)) {
    return 100;
  }
  return 35;
}

// ==========================================
// 1. QUESTIONS & SOURCE CHAPTERS
// ==========================================

export async function uploadCompleteSourcePdf(params: {
  subject: Subject;
  chapter: string;
  file: File;
  customFileName?: string;
}): Promise<{ storagePath: string }> {
  return activeProvider.uploadCompleteSourcePdf(params);
}

export async function uploadSourcePdfs(params: {
  subject: Subject;
  chapter: string;
  questionFile: File;
  answerKeyFile?: File | null;
}): Promise<{ questionPdfPath: string; answerKeyPdfPath?: string | null }> {
  return activeProvider.uploadSourcePdfs(params);
}

export async function createOrUpdateSourceChapter(source: {
  subject: Subject;
  chapter: string;
  title: string;
  questionPdfPath: string;
  answerKeyPdfPath?: string | null;
  questionCount: number;
  verifiedKeysCount: number;
  unknownKeysCount: number;
}): Promise<SourceChapter> {
  return activeProvider.createOrUpdateSourceChapter(source);
}

export async function getSourceChapters(subject?: Subject): Promise<SourceChapter[]> {
  return activeProvider.getSourceChapters(subject);
}

export async function createOrUpdateSourceFile(file: {
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
  return activeProvider.createOrUpdateSourceFile(file);
}

export async function getSourceFiles(chapterId?: string): Promise<SourceFile[]> {
  return activeProvider.getSourceFiles(chapterId);
}

export async function generateRandomNeetTest(params: {
  title: string;
  mode: string;
  config: RandomNeetTestConfig;
  durationMinutes: number;
}): Promise<RandomNeetTestRpcResult> {
  return activeProvider.generateRandomNeetTest(params);
}

export async function getQuestions(filter?: QuestionFilterParams): Promise<Question[]> {
  return activeProvider.getQuestions(filter);
}

export async function getQuestionById(id: string): Promise<Question | null> {
  return activeProvider.getQuestionById(id);
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  return activeProvider.getQuestionsByIds(ids);
}

export async function getExamQuestionsByIds(ids: string[]): Promise<PublicExamQuestion[]> {
  return activeProvider.getExamQuestionsByIds(ids);
}

export async function saveSingleQuestion(question: Question): Promise<Question> {
  return activeProvider.saveSingleQuestion(question);
}

export async function importQuestions(
  questions: Question[]
): Promise<{ importedCount: number; updatedCount: number }> {
  return activeProvider.importQuestions(questions);
}

export async function deleteQuestion(id: string): Promise<boolean> {
  return activeProvider.deleteQuestion(id);
}

export async function resetToDefaultSeed(): Promise<void> {
  return activeProvider.resetToDefaultSeed();
}

// ==========================================
// 2. ATTEMPT HISTORIES & FILTER HELPERS
// ==========================================

export async function getAllQuestionHistories(): Promise<Record<string, QuestionAttemptHistory>> {
  return activeProvider.getAllQuestionHistories();
}

export async function getQuestionHistory(questionId: string): Promise<QuestionAttemptHistory | null> {
  return activeProvider.getQuestionHistory(questionId);
}

export async function getUnusedQuestions(
  subject?: Subject | 'All',
  chapters?: string[]
): Promise<Question[]> {
  const questions = await getQuestions({ subject, chapters });
  const histories = await getAllQuestionHistories();

  return questions.filter((q) => !histories[q.id] || histories[q.id].attemptsCount === 0);
}

export async function getWrongQuestions(
  subject?: Subject | 'All',
  chapters?: string[]
): Promise<Question[]> {
  const questions = await getQuestions({ subject, chapters });
  const histories = await getAllQuestionHistories();

  return questions.filter((q) => {
    const history = histories[q.id];
    return history && (history.lastStatus === 'incorrect' || history.incorrectCount > 0);
  });
}

export async function getSkippedQuestions(
  subject?: Subject | 'All',
  chapters?: string[]
): Promise<Question[]> {
  const questions = await getQuestions({ subject, chapters });
  const histories = await getAllQuestionHistories();

  return questions.filter((q) => {
    const history = histories[q.id];
    return history && (history.lastStatus === 'unattempted' || history.unattemptedCount > 0);
  });
}

// ==========================================
// 3. FOUR-SUBJECT TEST GENERATION ENGINE
// ==========================================

export async function generateTest(config: {
  title?: string;
  subject?: Subject | 'All';
  selectedChapters?: string[];
  selectedChaptersBySubject?: Record<Subject, string[]>;
  mode: TestGenerationMode;
  repeatTestId?: string;
  customQuestionIds?: string[];
  questionCount: number;
  durationMinutes: number;
}): Promise<TestSession> {
  let selectedQuestions: Question[] = [];

  if (config.mode === 'repeat' && config.repeatTestId) {
    const oldTest = await activeProvider.getTestById(config.repeatTestId);
    if (!oldTest) {
      throw new Error('Previous test session was not found for repetition.');
    }
    selectedQuestions = await activeProvider.getQuestionsByIds(oldTest.questionIds);
    if (selectedQuestions.length === 0) {
      throw new Error('Could not retrieve questions from the requested past test.');
    }
  } else if (config.mode === 'custom' && config.customQuestionIds?.length) {
    selectedQuestions = await activeProvider.getQuestionsByIds(config.customQuestionIds);
    if (selectedQuestions.length === 0) {
      throw new Error('No valid questions selected for custom test.');
    }
  } else {
    // Standard test generation across 4 mandatory subjects: Physics, Chemistry, Botany, Zoology
    const chaptersBySubject: Record<Subject, string[]> = config.selectedChaptersBySubject || {
      Physics: config.selectedChapters || [],
      Chemistry: config.selectedChapters || [],
      Botany: config.selectedChapters || [],
      Zoology: config.selectedChapters || []
    };

    // Enforce chapter selection rule: Every subject MUST have >= 1 chapter selected
    const missingSubjects = ALL_SUBJECTS.filter(
      (s) => !chaptersBySubject[s] || chaptersBySubject[s].length === 0
    );

    if (missingSubjects.length > 0) {
      throw new Error(
        `Cannot generate test. At least one chapter must be selected for: ${missingSubjects.join(', ')}.`
      );
    }

    // Apportion questions across 4 subjects
    const countPerSubject = Math.floor(config.questionCount / 4);
    const remainder = config.questionCount % 4;

    const assembledBySubject: Record<Subject, Question[]> = {
      Physics: [],
      Chemistry: [],
      Botany: [],
      Zoology: []
    };

    for (let i = 0; i < ALL_SUBJECTS.length; i++) {
      const subj = ALL_SUBJECTS[i];
      const targetCount = countPerSubject + (i < remainder ? 1 : 0);
      const selectedChaps = chaptersBySubject[subj];

      let availablePool: Question[] = [];

      if (config.mode === 'fresh') {
        availablePool = await getUnusedQuestions(subj, selectedChaps);
      } else if (config.mode === 'wrong') {
        availablePool = await getWrongQuestions(subj, selectedChaps);
      } else if (config.mode === 'unattempted') {
        availablePool = await getSkippedQuestions(subj, selectedChaps);
      } else {
        // Random mode
        availablePool = await getQuestions({
          subject: subj,
          chapters: selectedChaps
        });
      }

      // If specific mode pool is too small, fallback to all questions from chosen chapters in that subject
      if (availablePool.length < targetCount) {
        const fullSubjectPool = await getQuestions({
          subject: subj,
          chapters: selectedChaps
        });
        const existingIds = new Set(availablePool.map((q) => q.id));
        const additional = shuffleArray(fullSubjectPool.filter((q) => !existingIds.has(q.id)));
        availablePool = [...availablePool, ...additional];
      }

      if (availablePool.length < targetCount && targetCount > 0) {
        throw new Error(
          `Insufficient questions in ${subj} (${availablePool.length} available in selected chapters, but ${targetCount} needed for this test).`
        );
      }

      // Group and shuffle available questions by priority buckets to implement prioritized NEET sampling
      const pyqs = shuffleArray(availablePool.filter(q => getQuestionPriority(q) >= 100));
      const exemplars = shuffleArray(availablePool.filter(q => getQuestionPriority(q) >= 90 && getQuestionPriority(q) < 100));
      const practices = shuffleArray(availablePool.filter(q => getQuestionPriority(q) >= 35 && getQuestionPriority(q) < 90));
      const unknowns = shuffleArray(availablePool.filter(q => getQuestionPriority(q) < 35));

      const prioritizedPool = [...pyqs, ...exemplars, ...practices, ...unknowns];
      assembledBySubject[subj] = prioritizedPool.slice(0, targetCount);
    }

    // Combine questions in NEET order: Physics -> Chemistry -> Botany -> Zoology
    selectedQuestions = [
      ...assembledBySubject.Physics,
      ...assembledBySubject.Chemistry,
      ...assembledBySubject.Botany,
      ...assembledBySubject.Zoology
    ];
  }

  // Guarantee uniqueness inside test session
  const uniqueQuestionsMap = new Map<string, Question>();
  for (const q of selectedQuestions) {
    uniqueQuestionsMap.set(q.id, q);
  }
  const finalQuestions = Array.from(uniqueQuestionsMap.values());

  if (finalQuestions.length === 0) {
    throw new Error('No questions could be assembled for the test with the given criteria.');
  }

  // Create test session
  const allSelectedChapters: string[] = [];
  if (config.selectedChaptersBySubject) {
    Object.values(config.selectedChaptersBySubject).forEach((chaps) => {
      allSelectedChapters.push(...chaps);
    });
  } else if (config.selectedChapters) {
    allSelectedChapters.push(...config.selectedChapters);
  }

  const newSession: TestSession = {
    id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title:
      config.title ||
      `NEET UG Mock Test (${finalQuestions.length} Qs - ${config.mode.toUpperCase()})`,
    mode: config.mode,
    originalTestId: config.repeatTestId,
    subject: config.subject || 'All',
    selectedChapters: allSelectedChapters,
    selectedChaptersBySubject: config.selectedChaptersBySubject,
    questionIds: finalQuestions.map((q) => q.id),
    durationMinutes: config.durationMinutes,
    startedAt: Date.now(),
    userResponses: {},
    questionStatuses: {},
    timeSpentPerQuestion: {},
    isSubmitted: false
  };

  await activeProvider.saveTestSession(newSession);
  return newSession;
}

// ==========================================
// 4. TEST SESSIONS & SECURE SCORING
// ==========================================

export async function getTestHistory(): Promise<TestSession[]> {
  return activeProvider.getTestHistory();
}

export async function getTestById(id: string): Promise<TestSession | null> {
  return activeProvider.getTestById(id);
}

export async function submitAndScoreTest(
  sessionId: string,
  userResponses: Record<string, AnswerOption | null>,
  questionStatuses: Record<string, QuestionCBTStatus>,
  timeSpentPerQuestion: Record<string, number>
): Promise<{ session: TestSession; evaluatedQuestions: EvaluatedQuestionReview[] }> {
  const result: SecureExamResult = await activeProvider.submitAndScoreExam({
    testId: sessionId,
    userResponses,
    questionStatuses,
    timeSpentPerQuestion
  });

  const updatedSession = await activeProvider.getTestById(sessionId);
  const finalSession: TestSession = updatedSession || {
    id: sessionId,
    title: 'NEET Mock Test',
    mode: 'random',
    subject: 'All',
    selectedChapters: [],
    questionIds: result.evaluatedQuestions.map((q) => q.id),
    durationMinutes: 180,
    startedAt: Date.now(),
    completedAt: result.completedAt,
    userResponses,
    questionStatuses,
    timeSpentPerQuestion,
    isSubmitted: true,
    score: result.score
  };

  // Attach exact server-returned analytics
  finalSession.score = result.score;
  finalSession.completedAt = result.completedAt;
  finalSession.isSubmitted = true;

  return {
    session: finalSession,
    evaluatedQuestions: result.evaluatedQuestions
  };
}

export function calculateTestScore(
  questions: Question[],
  userResponses: Record<string, AnswerOption | null>
): TestScoreBreakdown {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let unknownKeyCount = 0;
  let totalScore = 0;
  let scorableQuestionCount = 0;

  const subjectWise: Record<
    Subject,
    {
      correct: number;
      incorrect: number;
      unattempted: number;
      unknownKeys: number;
      score: number;
      maxScore: number;
    }
  > = {
    Physics: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
    Chemistry: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
    Botany: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
    Zoology: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 }
  };

  const chapterWise: Record<
    string,
    {
      subject: Subject;
      correct: number;
      incorrect: number;
      unattempted: number;
      unknownKeys: number;
      score: number;
      maxScore: number;
    }
  > = {};

  for (const q of questions) {
    const userAns = userResponses[q.id];
    const subj = q.subject;
    const chap = q.chapter || 'General';

    if (!chapterWise[chap]) {
      chapterWise[chap] = {
        subject: subj,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        unknownKeys: 0,
        score: 0,
        maxScore: 0
      };
    }

    if (q.correctAnswer === 'UNKNOWN') {
      unknownKeyCount++;
      subjectWise[subj].unknownKeys += 1;
      chapterWise[chap].unknownKeys += 1;
    } else if (!userAns) {
      unattemptedCount++;
      scorableQuestionCount++;
      subjectWise[subj].unattempted += 1;
      subjectWise[subj].maxScore += 4;
      chapterWise[chap].unattempted += 1;
      chapterWise[chap].maxScore += 4;
    } else if (userAns === q.correctAnswer) {
      correctCount++;
      totalScore += 4;
      scorableQuestionCount++;
      subjectWise[subj].correct += 1;
      subjectWise[subj].score += 4;
      subjectWise[subj].maxScore += 4;
      chapterWise[chap].correct += 1;
      chapterWise[chap].score += 4;
      chapterWise[chap].maxScore += 4;
    } else {
      incorrectCount++;
      totalScore -= 1;
      scorableQuestionCount++;
      subjectWise[subj].incorrect += 1;
      subjectWise[subj].score -= 1;
      subjectWise[subj].maxScore += 4;
      chapterWise[chap].incorrect += 1;
      chapterWise[chap].score -= 1;
      chapterWise[chap].maxScore += 4;
    }
  }

  const accuracy =
    correctCount + incorrectCount > 0
      ? Math.round((correctCount / (correctCount + incorrectCount)) * 1000) / 10
      : 0;

  const attemptPercentage =
    scorableQuestionCount > 0
      ? Math.round(((correctCount + incorrectCount) / scorableQuestionCount) * 1000) / 10
      : 0;

  return {
    totalScore,
    maxScore: scorableQuestionCount * 4,
    correctCount,
    incorrectCount,
    unattemptedCount,
    unknownKeyCount,
    evaluationStatus: unknownKeyCount > 0 ? 'HAS_UNKNOWN_KEYS' : 'EVALUATED',
    accuracy,
    attemptPercentage,
    subjectWise,
    chapterWise
  };
}
