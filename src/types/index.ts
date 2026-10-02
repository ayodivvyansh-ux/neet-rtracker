/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Subject = 'Physics' | 'Chemistry' | 'Botany' | 'Zoology';

export const ALL_SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Botany', 'Zoology'];

export type SubjectQuestionTable =
  | 'physics_questions'
  | 'chemistry_questions'
  | 'botany_questions'
  | 'zoology_questions';

export type PublicSubjectView =
  | 'public_physics_questions'
  | 'public_chemistry_questions'
  | 'public_botany_questions'
  | 'public_zoology_questions';

export function subjectToTableName(subject: Subject): SubjectQuestionTable {
  switch (subject) {
    case 'Physics':
      return 'physics_questions';
    case 'Chemistry':
      return 'chemistry_questions';
    case 'Botany':
      return 'botany_questions';
    case 'Zoology':
      return 'zoology_questions';
  }
}

export function subjectToPublicViewName(subject: Subject): PublicSubjectView {
  switch (subject) {
    case 'Physics':
      return 'public_physics_questions';
    case 'Chemistry':
      return 'public_chemistry_questions';
    case 'Botany':
      return 'public_botany_questions';
    case 'Zoology':
      return 'public_zoology_questions';
  }
}

export function tableNameToSubject(tableName: string): Subject {
  switch (tableName.toLowerCase()) {
    case 'physics_questions':
    case 'public_physics_questions':
      return 'Physics';
    case 'chemistry_questions':
    case 'public_chemistry_questions':
      return 'Chemistry';
    case 'botany_questions':
    case 'public_botany_questions':
      return 'Botany';
    case 'zoology_questions':
    case 'public_zoology_questions':
      return 'Zoology';
    default:
      return 'Physics';
  }
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type AnswerOption = 'A' | 'B' | 'C' | 'D';

export interface QuestionOptionHitbox {
  option: 'A' | 'B' | 'C' | 'D';
  x: number; // 0 to 1 normalized relative to question crop
  y: number; // 0 to 1 normalized relative to question crop
  width: number; // 0 to 1 normalized relative to question crop
  height: number; // 0 to 1 normalized relative to question crop
}

export interface QuestionVisual {
  hasVisual?: boolean;
  has_visual?: boolean;
  kind?: string;
  storage_bucket?: string;
  storageBucket?: string;
  storage_path?: string;
  storagePath?: string;
  imagePath?: string;
  image_path?: string;
  data_url?: string;
  dataUrl?: string;
  mime_type?: string;
  mimeType?: string;
  source?: string;
  pageNumber?: number;
  page_number?: number;
  width?: number;
  height?: number;
  options?: QuestionOptionHitbox[];
  priority?: number;
  source_type?: 'PYQ' | 'EXEMPLAR' | 'PRACTICE' | 'UNKNOWN';
  sourceType?: 'PYQ' | 'EXEMPLAR' | 'PRACTICE' | 'UNKNOWN';
}

/**
 * Question diagram / image representation
 */
export interface QuestionImage {
  id?: string;
  storage_bucket?: string;
  storageBucket?: string;
  storagePath?: string;
  storage_path?: string;
  imagePath?: string;
  image_path?: string;
  pageNumber?: number;
  page_number?: number;
  mimeType?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  altText?: string;
  alt_text?: string;
  dataUrl?: string;
  data_url?: string;
  regionType?: 'table' | 'diagram';
  structuredTable?: {
    headers: string[];
    rows: string[][];
  };
}

/**
 * Full Question format (Used in Question Bank, PDF parsing drafts, and LocalStorage offline mode)
 */
export interface Question {
  id: string;
  sourceId?: string;
  sourceFileId?: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: AnswerOption | 'UNKNOWN';
  subject: Subject;
  chapter: string;
  subtopic?: string;
  difficulty: Difficulty;
  sourcePdf?: string;
  pageNumber?: number;
  explanation?: string;
  questionImages?: QuestionImage[];
  visual?: QuestionVisual;
  createdAt: number;
}

export interface ExtractedQuestionDraft {
  id: string;
  sourceId?: string;
  sourceFileId?: string;
  rawQuestionNumber?: number;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: AnswerOption | 'UNKNOWN';
  subject: Subject;
  chapter: string;
  subtopic?: string;
  difficulty: Difficulty;
  sourcePdf?: string;
  pageNumber?: number;
  explanation?: string;
  questionImages?: QuestionImage[];
  visual?: QuestionVisual;
  isValid?: boolean;
  validationErrors?: string[];
}

/**
 * Public exam question payload delivered to the browser during a live examination.
 * STRICTLY excludes `correctAnswer` and `explanation` to prevent client-side inspection / cheating.
 */
export interface PublicExamQuestion {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  subject: Subject;
  chapter: string;
  subtopic?: string;
  difficulty: Difficulty;
  sourcePdf?: string;
  pageNumber?: number;
  sourceId?: string;
  sourceFileId?: string;
  questionImages?: QuestionImage[];
  visual?: QuestionVisual;
  createdAt?: number;
}

export type QuestionCBTStatus =
  | 'NOT_VISITED'
  | 'NOT_ANSWERED'
  | 'ANSWERED'
  | 'MARKED_FOR_REVIEW'
  | 'ANSWERED_AND_MARKED_FOR_REVIEW';

export interface QuestionAttemptRecord {
  questionId: string;
  testId: string;
  userAnswer: AnswerOption | null;
  status: 'correct' | 'incorrect' | 'unattempted' | 'unknown_key';
  timeSpentSeconds: number;
  attemptedAt: number;
}

export interface QuestionAttemptHistory {
  questionId: string;
  attemptsCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  lastAttemptedAt: number | null;
  lastUserAnswer: AnswerOption | null;
  lastStatus: 'correct' | 'incorrect' | 'unattempted' | 'unknown_key' | null;
  history: QuestionAttemptRecord[];
}

export type TestGenerationMode =
  | 'fresh'
  | 'random'
  | 'wrong'
  | 'unattempted'
  | 'repeat'
  | 'custom';

export interface SubjectScoreBreakdown {
  correct: number;
  incorrect: number;
  unattempted: number;
  unknownKeys: number;
  score: number;
  maxScore: number;
}

export interface TestScoreBreakdown {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  unknownKeyCount: number;
  evaluationStatus: 'EVALUATED' | 'HAS_UNKNOWN_KEYS';
  accuracy: number;
  attemptPercentage: number;
  subjectWise: Record<Subject, SubjectScoreBreakdown>;
  chapterWise: Record<
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
  >;
}

export interface TestSession {
  id: string;
  title: string;
  mode: TestGenerationMode;
  originalTestId?: string;
  subject: Subject | 'All';
  selectedChapters: string[];
  selectedChaptersBySubject?: Record<Subject, string[]>;
  questionIds: string[];
  durationMinutes: number;
  startedAt: number;
  completedAt?: number;
  userResponses: Record<string, AnswerOption | null>;
  questionStatuses: Record<string, QuestionCBTStatus>;
  timeSpentPerQuestion: Record<string, number>;
  isSubmitted: boolean;
  score?: TestScoreBreakdown;
}

export interface TestGenerationConfig {
  title?: string;
  subject: Subject | 'All';
  selectedChapters: string[];
  selectedChaptersBySubject?: Record<Subject, string[]>;
  mode: TestGenerationMode;
  repeatTestId?: string;
  customQuestionIds?: string[];
  questionCount?: number;
  durationMinutes?: number;
}

export interface QuestionFilterParams {
  subject?: Subject | 'All';
  chapters?: string[];
  difficulty?: Difficulty;
  searchQuery?: string;
  limit?: number;
}

export interface PDFSourceDocument {
  id: string;
  name: string;
  uploadedAt: number;
  questionCount: number;
  subject: Subject;
  sizeBytes: number;
}

export interface EvaluatedQuestionReview {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  subject: Subject;
  chapter: string;
  subtopic?: string;
  difficulty: Difficulty;
  sourcePdf?: string;
  pageNumber?: number;
  sourceId?: string;
  sourceFileId?: string;
  explanation?: string;
  userAnswer: AnswerOption | null;
  correctAnswer: AnswerOption | 'UNKNOWN';
  status: 'correct' | 'incorrect' | 'unattempted' | 'unknown_key';
  marksAwarded: number;
}

export interface SecureExamResult {
  testId: string;
  completedAt: number;
  score: TestScoreBreakdown;
  evaluatedQuestions: EvaluatedQuestionReview[];
}

export interface ExamSubmissionPayload {
  testId: string;
  userResponses: Record<string, AnswerOption | null>;
  questionStatuses: Record<string, QuestionCBTStatus>;
  timeSpentPerQuestion: Record<string, number>;
}

export interface SourceChapter {
  id: string;
  subject: Subject;
  chapter: string;
  title: string;
  questionPdfPath: string;
  answerKeyPdfPath?: string | null;
  questionCount: number;
  verifiedKeysCount: number;
  unknownKeysCount: number;
  createdBy?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SourceFile {
  id: string;
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
  createdBy?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RandomNeetTestConfig {
  physicsChapters: string[];
  chemistryChapters: string[];
  botanyChapters: string[];
  zoologyChapters: string[];
  physicsCount: number;
  chemistryCount: number;
  botanyCount: number;
  zoologyCount: number;
}

export interface RandomNeetTestRpcResult {
  testSession: TestSession;
  sanitizedQuestions: PublicExamQuestion[];
}

// ==========================================
// NEW QUESTION BANK SCHEMA TYPES
// ==========================================

export type ExamSource = 'NEET' | 'JEE Main' | string;

export interface QuestionOptionRecord {
  id?: string;
  question_id: string;
  option_key: 'A' | 'B' | 'C' | 'D' | string;
  option_text: string;
  option_html?: string | null;
  sort_order?: number;
}

export interface QuestionBankImageItem {
  id?: string;
  url?: string;
  data_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  storagePath?: string;
  is_available?: boolean;
  source_original_url?: string;
  source_local_path?: string;
  original_url?: string;
  local_path?: string;
  caption?: string;
  alt_text?: string;
  width?: number;
  height?: number;
  question_code?: string;
  [key: string]: any;
}

export interface QuestionBankRecord {
  id: string;
  question_code: string;
  exam_source: string;
  subject: Subject | string;
  chapter_slug: string;
  chapter_name: string;
  year?: number | string | null;
  paper_slug?: string | null;
  source_question_id?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  question_type?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question_text: string;
  question_html?: string | null;
  solution_text?: string | null;
  solution_html?: string | null;
  correct_option?: string | null;
  images?: QuestionBankImageItem[] | any;
  raw_payload?: any;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  options?: QuestionOptionRecord[];
}

export interface QuestionBankFilterParams {
  exam_source?: string;
  subject?: string;
  chapter_slug?: string;
  chapter_name?: string;
  year?: number | string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'All';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CbtTestConfig {
  title: string;
  exam: 'NEET' | 'JEE Main';
  subject: Subject | 'All';
  selectedChapters: string[]; // chapter_slugs
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionCount: number;
  durationMinutes: number;
  mode: 'chapterwise' | 'multi_chapter' | 'full_syllabus';
}

export interface CbtActiveQuestion {
  id: string;
  question_code: string;
  exam_source: string;
  subject: string;
  chapter_name: string;
  chapter_slug: string;
  year?: number | string | null;
  paper_slug?: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question_type?: 'single' | 'numerical' | 'integer' | string;
  question_text: string;
  question_html?: string | null;
  images?: QuestionBankImageItem[] | any;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;
  };
  optionsHtml?: {
    A?: string | null;
    B?: string | null;
    C?: string | null;
    D?: string | null;
    [key: string]: string | null | undefined;
  };
}

export interface CbtTestSession {
  id: string;
  title: string;
  exam: string;
  subject: string;
  difficulty: string;
  mode: string;
  questions: CbtActiveQuestion[];
  durationMinutes: number;
  startedAt: number;
  completedAt?: number;
  userResponses: Record<string, string | null>;
  questionStatuses: Record<string, QuestionCBTStatus>;
  timeSpentPerQuestion: Record<string, number>;
  isSubmitted: boolean;
  result?: CbtTestResult;
}

export interface CbtQuestionEvaluation {
  id: string;
  question_code: string;
  subject: string;
  chapter_name: string;
  difficulty: string;
  question_type?: 'single' | 'numerical' | 'integer' | string;
  question_text: string;
  question_html?: string | null;
  images?: any;
  options: Record<string, string>;
  optionsHtml?: Record<string, string | null | undefined>;
  userResponse: string | null;
  correctOption: string;
  isCorrect: boolean;
  isAttempted: boolean;
  marksAwarded: number;
  solution_text?: string | null;
  solution_html?: string | null;
  timeSpentSeconds: number;
}

export interface CbtTestResult {
  totalScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracy: number;
  totalTimeSpentSeconds: number;
  evaluations: CbtQuestionEvaluation[];
  subjectWise: Record<string, {
    correct: number;
    incorrect: number;
    unattempted: number;
    score: number;
    maxScore: number;
  }>;
}

