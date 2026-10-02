/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SEED_QUESTIONS } from '../../data/seedQuestions';
import {
  ALL_SUBJECTS,
  AnswerOption,
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
  subjectToTableName,
  TestScoreBreakdown,
  TestSession
} from '../../types';
import { IDataProvider } from './dataProvider.interface';

const STORAGE_KEYS = {
  PHYSICS_QUESTIONS: 'neet_physics_questions_v1',
  CHEMISTRY_QUESTIONS: 'neet_chemistry_questions_v1',
  BOTANY_QUESTIONS: 'neet_botany_questions_v1',
  ZOOLOGY_QUESTIONS: 'neet_zoology_questions_v1',
  ATTEMPT_HISTORIES: 'neet_cbt_question_histories_v1',
  TEST_SESSIONS: 'neet_cbt_test_sessions_v1',
  SOURCE_CHAPTERS: 'neet_source_chapters_v1',
  SOURCE_FILES: 'neet_source_files_v1'
};

function getStorageKeyForSubject(subject: Subject): string {
  switch (subject) {
    case 'Physics':
      return STORAGE_KEYS.PHYSICS_QUESTIONS;
    case 'Chemistry':
      return STORAGE_KEYS.CHEMISTRY_QUESTIONS;
    case 'Botany':
      return STORAGE_KEYS.BOTANY_QUESTIONS;
    case 'Zoology':
      return STORAGE_KEYS.ZOOLOGY_QUESTIONS;
  }
}

export class LocalStorageProvider implements IDataProvider {
  constructor() {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (typeof window === 'undefined') return;

    // Initialize 4 separate subject question tables
    for (const subject of ALL_SUBJECTS) {
      const key = getStorageKeyForSubject(subject);
      const existing = localStorage.getItem(key);
      if (!existing || JSON.parse(existing).length === 0) {
        const subjectSeeds = SEED_QUESTIONS.filter((q) => q.subject === subject);
        localStorage.setItem(key, JSON.stringify(subjectSeeds));
      }
    }

    if (!localStorage.getItem(STORAGE_KEYS.ATTEMPT_HISTORIES)) {
      localStorage.setItem(STORAGE_KEYS.ATTEMPT_HISTORIES, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS)) {
      localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify([]));
    }
  }

  // ==========================================
  // 1. FOUR SUBJECT QUESTION TABLES
  // ==========================================

  private getAllQuestionsFromAllTables(): Question[] {
    this.initializeStorage();
    let all: Question[] = [];
    for (const subject of ALL_SUBJECTS) {
      const raw = localStorage.getItem(getStorageKeyForSubject(subject));
      if (raw) {
        try {
          const list: Question[] = JSON.parse(raw);
          all = all.concat(list);
        } catch {
          // Ignore parse errors
        }
      }
    }
    return all;
  }

  async getQuestions(filter?: QuestionFilterParams): Promise<Question[]> {
    let questions: Question[];

    if (filter?.subject && filter.subject !== 'All') {
      const key = getStorageKeyForSubject(filter.subject);
      const raw = localStorage.getItem(key);
      questions = raw ? JSON.parse(raw) : [];
    } else {
      questions = this.getAllQuestionsFromAllTables();
    }

    if (filter?.chapters && filter.chapters.length > 0) {
      const chapSet = new Set(filter.chapters);
      questions = questions.filter((q) => chapSet.has(q.chapter));
    }

    if (filter?.difficulty) {
      questions = questions.filter((q) => q.difficulty === filter.difficulty);
    }

    if (filter?.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      questions = questions.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          item.chapter.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          Object.values(item.options).some((opt) => opt.toLowerCase().includes(q))
      );
    }

    if (filter?.limit && filter.limit > 0) {
      questions = questions.slice(0, filter.limit);
    }

    return questions;
  }

  async getQuestionById(id: string): Promise<Question | null> {
    const all = this.getAllQuestionsFromAllTables();
    return all.find((q) => q.id === id) || null;
  }

  async getQuestionsByIds(ids: string[]): Promise<Question[]> {
    const all = this.getAllQuestionsFromAllTables();
    const map = new Map(all.map((q) => [q.id, q]));
    return ids.map((id) => map.get(id)).filter((q): q is Question => Boolean(q));
  }

  async getExamQuestionsByIds(ids: string[]): Promise<PublicExamQuestion[]> {
    const questions = await this.getQuestionsByIds(ids);
    // Strip correctAnswer and explanation for safe exam rendering
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      sourcePdf: q.sourcePdf,
      pageNumber: q.pageNumber,
      createdAt: q.createdAt
    }));
  }

  async saveSingleQuestion(question: Question): Promise<Question> {
    const key = getStorageKeyForSubject(question.subject);
    const raw = localStorage.getItem(key);
    let list: Question[] = raw ? JSON.parse(raw) : [];

    const existingIndex = list.findIndex((q) => q.id === question.id);
    if (existingIndex >= 0) {
      list[existingIndex] = question;
    } else {
      list.unshift(question);
    }

    localStorage.setItem(key, JSON.stringify(list));
    return question;
  }

  async importQuestions(
    questions: Question[]
  ): Promise<{ importedCount: number; updatedCount: number }> {
    let importedCount = 0;
    let updatedCount = 0;

    // Group questions by subject
    const bySubject: Record<Subject, Question[]> = {
      Physics: [],
      Chemistry: [],
      Botany: [],
      Zoology: []
    };

    for (const q of questions) {
      if (bySubject[q.subject]) {
        bySubject[q.subject].push(q);
      } else {
        bySubject.Physics.push(q); // fallback
      }
    }

    for (const subject of ALL_SUBJECTS) {
      const qs = bySubject[subject];
      if (qs.length === 0) continue;

      const key = getStorageKeyForSubject(subject);
      const raw = localStorage.getItem(key);
      const list: Question[] = raw ? JSON.parse(raw) : [];
      const map = new Map(list.map((item) => [item.id, item]));

      for (const item of qs) {
        if (map.has(item.id)) {
          updatedCount++;
        } else {
          importedCount++;
        }
        map.set(item.id, item);
      }

      localStorage.setItem(key, JSON.stringify(Array.from(map.values())));
    }

    return { importedCount, updatedCount };
  }

  async deleteQuestion(id: string): Promise<boolean> {
    for (const subject of ALL_SUBJECTS) {
      const key = getStorageKeyForSubject(subject);
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: Question[] = JSON.parse(raw);
        const next = list.filter((q) => q.id !== id);
        if (next.length !== list.length) {
          localStorage.setItem(key, JSON.stringify(next));
          return true;
        }
      }
    }
    return false;
  }

  // ==========================================
  // 2. QUESTION ATTEMPT HISTORIES
  // ==========================================

  async getAllQuestionHistories(): Promise<Record<string, QuestionAttemptHistory>> {
    this.initializeStorage();
    const raw = localStorage.getItem(STORAGE_KEYS.ATTEMPT_HISTORIES);
    return raw ? JSON.parse(raw) : {};
  }

  async getQuestionHistory(questionId: string): Promise<QuestionAttemptHistory | null> {
    const all = await this.getAllQuestionHistories();
    return all[questionId] || null;
  }

  async saveQuestionHistory(history: QuestionAttemptHistory): Promise<void> {
    const all = await this.getAllQuestionHistories();
    all[history.questionId] = history;
    localStorage.setItem(STORAGE_KEYS.ATTEMPT_HISTORIES, JSON.stringify(all));
  }

  async saveBatchQuestionHistories(
    histories: Record<string, QuestionAttemptHistory>
  ): Promise<void> {
    const all = await this.getAllQuestionHistories();
    const merged = { ...all, ...histories };
    localStorage.setItem(STORAGE_KEYS.ATTEMPT_HISTORIES, JSON.stringify(merged));
  }

  // ==========================================
  // 3. TEST SESSIONS & RESULTS
  // ==========================================

  async getTestHistory(): Promise<TestSession[]> {
    this.initializeStorage();
    const raw = localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  }

  async getTestById(id: string): Promise<TestSession | null> {
    const tests = await this.getTestHistory();
    return tests.find((t) => t.id === id) || null;
  }

  async saveTestSession(session: TestSession): Promise<TestSession> {
    const tests = await this.getTestHistory();
    const idx = tests.findIndex((t) => t.id === session.id);
    if (idx >= 0) {
      tests[idx] = session;
    } else {
      tests.unshift(session);
    }
    localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(tests));
    return session;
  }

  /**
   * Local score calculation simulating the secure server evaluation.
   */
  async submitAndScoreExam(payload: ExamSubmissionPayload): Promise<SecureExamResult> {
    const session = await this.getTestById(payload.testId);
    if (!session) {
      throw new Error(`Test session ${payload.testId} not found`);
    }

    const allQuestions = await this.getQuestionsByIds(session.questionIds);
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let unknownKeyCount = 0;
    let totalScore = 0;
    let scorableQuestionCount = 0;

    const subjectWise: Record<Subject, any> = {
      Physics: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
      Chemistry: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
      Botany: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 },
      Zoology: { correct: 0, incorrect: 0, unattempted: 0, unknownKeys: 0, score: 0, maxScore: 0 }
    };

    const chapterWise: Record<string, any> = {};

    const evaluatedQuestions: EvaluatedQuestionReview[] = [];
    const attemptHistoriesUpdate: Record<string, QuestionAttemptHistory> = {};
    const existingHistories = await this.getAllQuestionHistories();
    const now = Date.now();

    for (const qId of session.questionIds) {
      const q = questionMap.get(qId);
      if (!q) continue;

      const userAns = payload.userResponses[qId] ?? null;
      const timeSpent = payload.timeSpentPerQuestion[qId] ?? 0;
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

      let status: 'correct' | 'incorrect' | 'unattempted' | 'unknown_key';
      let marks = 0;

      if (q.correctAnswer === 'UNKNOWN') {
        status = 'unknown_key';
        marks = 0;
        unknownKeyCount++;
        subjectWise[subj].unknownKeys += 1;
        chapterWise[chap].unknownKeys += 1;
      } else if (!userAns) {
        status = 'unattempted';
        marks = 0;
        unattemptedCount++;
        scorableQuestionCount++;
        subjectWise[subj].unattempted += 1;
        subjectWise[subj].maxScore += 4;
        chapterWise[chap].unattempted += 1;
        chapterWise[chap].maxScore += 4;
      } else if (userAns === q.correctAnswer) {
        status = 'correct';
        marks = 4;
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
        status = 'incorrect';
        marks = -1;
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

      evaluatedQuestions.push({
        id: q.id,
        text: q.text,
        options: q.options,
        subject: q.subject,
        chapter: q.chapter,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        sourcePdf: q.sourcePdf,
        pageNumber: q.pageNumber,
        explanation: q.explanation,
        userAnswer: userAns,
        correctAnswer: q.correctAnswer,
        status,
        marksAwarded: marks
      });

      // Update question attempt history
      const prevHistory: QuestionAttemptHistory = existingHistories[q.id] || {
        questionId: q.id,
        attemptsCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        unattemptedCount: 0,
        lastAttemptedAt: null,
        lastUserAnswer: null,
        lastStatus: null,
        history: []
      };

      prevHistory.attemptsCount += 1;
      if (status === 'correct') prevHistory.correctCount += 1;
      else if (status === 'incorrect') prevHistory.incorrectCount += 1;
      else if (status === 'unattempted') prevHistory.unattemptedCount += 1;

      prevHistory.lastAttemptedAt = now;
      prevHistory.lastUserAnswer = userAns;
      prevHistory.lastStatus = status;

      const record: QuestionAttemptRecord = {
        questionId: q.id,
        testId: session.id,
        userAnswer: userAns,
        status,
        timeSpentSeconds: timeSpent,
        attemptedAt: now
      };
      prevHistory.history.push(record);
      attemptHistoriesUpdate[q.id] = prevHistory;
    }

    const accuracy =
      correctCount + incorrectCount > 0
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 1000) / 10
        : 0;

    const attemptPercentage =
      scorableQuestionCount > 0
        ? Math.round(((correctCount + incorrectCount) / scorableQuestionCount) * 1000) / 10
        : 0;

    const score: TestScoreBreakdown = {
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

    // Save attempt histories
    await this.saveBatchQuestionHistories(attemptHistoriesUpdate);

    // Update test session
    session.isSubmitted = true;
    session.completedAt = now;
    session.userResponses = payload.userResponses;
    session.questionStatuses = payload.questionStatuses;
    session.timeSpentPerQuestion = payload.timeSpentPerQuestion;
    session.score = score;
    await this.saveTestSession(session);

    return {
      testId: session.id,
      completedAt: now,
      score,
      evaluatedQuestions
    };
  }

  // ==========================================
  // SOURCE CHAPTERS & STORAGE (OFFLINE FALLBACK)
  // ==========================================

  async uploadCompleteSourcePdf(params: {
    subject: Subject;
    chapter: string;
    file: File;
    customFileName?: string;
  }): Promise<{ storagePath: string }> {
    const chapterSlug = params.chapter
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    const fileName = params.customFileName || params.file.name;
    return {
      storagePath: `local/${params.subject}/${chapterSlug}/${fileName}`
    };
  }

  async uploadSourcePdfs(params: {
    subject: Subject;
    chapter: string;
    questionFile: File;
    answerKeyFile?: File | null;
  }): Promise<{ questionPdfPath: string; answerKeyPdfPath?: string | null }> {
    const chapterSlug = params.chapter
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    return {
      questionPdfPath: `local/${params.subject}/${chapterSlug}/questions.pdf`,
      answerKeyPdfPath: params.answerKeyFile
        ? `local/${params.subject}/${chapterSlug}/answer_key.pdf`
        : null
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
    const raw = localStorage.getItem(STORAGE_KEYS.SOURCE_CHAPTERS);
    const list: SourceChapter[] = raw ? JSON.parse(raw) : [];

    const existingIdx = list.findIndex(
      (s) => s.subject === source.subject && s.chapter === source.chapter && s.title === source.title
    );

    const record: SourceChapter = {
      id: existingIdx >= 0 ? list[existingIdx].id : `src_${Date.now()}`,
      subject: source.subject,
      chapter: source.chapter,
      title: source.title,
      questionPdfPath: source.questionPdfPath,
      answerKeyPdfPath: source.answerKeyPdfPath || null,
      questionCount: source.questionCount,
      verifiedKeysCount: source.verifiedKeysCount,
      unknownKeysCount: source.unknownKeysCount,
      createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }

    localStorage.setItem(STORAGE_KEYS.SOURCE_CHAPTERS, JSON.stringify(list));
    return record;
  }

  async getSourceChapters(subject?: Subject): Promise<SourceChapter[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.SOURCE_CHAPTERS);
    const list: SourceChapter[] = raw ? JSON.parse(raw) : [];
    if (subject && subject !== ('All' as any)) {
      return list.filter((s) => s.subject === subject);
    }
    return list;
  }

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
    const raw = localStorage.getItem(STORAGE_KEYS.SOURCE_FILES);
    const list: SourceFile[] = raw ? JSON.parse(raw) : [];

    const existingIdx = list.findIndex(
      (f) => f.chapterId === file.chapterId && f.fileName === file.fileName
    );

    const record: SourceFile = {
      id: existingIdx >= 0 ? list[existingIdx].id : `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
      createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }

    localStorage.setItem(STORAGE_KEYS.SOURCE_FILES, JSON.stringify(list));
    return record;
  }

  async getSourceFiles(chapterId?: string): Promise<SourceFile[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.SOURCE_FILES);
    const list: SourceFile[] = raw ? JSON.parse(raw) : [];
    if (chapterId) {
      return list.filter((f) => f.chapterId === chapterId);
    }
    return list;
  }

  async generateRandomNeetTest(params: {
    title: string;
    mode: string;
    config: RandomNeetTestConfig;
    durationMinutes: number;
  }): Promise<RandomNeetTestRpcResult> {
    const testId = `test_${Date.now()}`;
    const selectedQuestions: Question[] = [];

    const sampleFromPool = (subject: Subject, chapters: string[], count: number) => {
      const key = getStorageKeyForSubject(subject);
      const raw = localStorage.getItem(key);
      const all: Question[] = raw ? JSON.parse(raw) : [];
      const pool = all.filter((q) => chapters.includes(q.chapter));
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    selectedQuestions.push(
      ...sampleFromPool('Physics', params.config.physicsChapters, params.config.physicsCount),
      ...sampleFromPool('Chemistry', params.config.chemistryChapters, params.config.chemistryCount),
      ...sampleFromPool('Botany', params.config.botanyChapters, params.config.botanyCount),
      ...sampleFromPool('Zoology', params.config.zoologyChapters, params.config.zoologyCount)
    );

    const sanitizedQuestions: PublicExamQuestion[] = selectedQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      sourcePdf: q.sourcePdf,
      pageNumber: q.pageNumber,
      createdAt: q.createdAt
    }));

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
      questionIds: sanitizedQuestions.map((q) => q.id),
      durationMinutes: params.durationMinutes,
      startedAt: Date.now(),
      userResponses: {},
      questionStatuses: {},
      timeSpentPerQuestion: {},
      isSubmitted: false
    };

    await this.saveTestSession(testSession);

    return {
      testSession,
      sanitizedQuestions
    };
  }

  async resetToDefaultSeed(): Promise<void> {
    for (const subject of ALL_SUBJECTS) {
      const key = getStorageKeyForSubject(subject);
      const subjectSeeds = SEED_QUESTIONS.filter((q) => q.subject === subject);
      localStorage.setItem(key, JSON.stringify(subjectSeeds));
    }
  }
}
