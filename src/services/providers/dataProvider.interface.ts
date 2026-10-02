import {
  ExamSubmissionPayload,
  PublicExamQuestion,
  Question,
  QuestionAttemptHistory,
  QuestionFilterParams,
  RandomNeetTestConfig,
  RandomNeetTestRpcResult,
  SecureExamResult,
  SourceChapter,
  SourceFile,
  Subject,
  TestSession
} from '../../types';

export interface IDataProvider {
  // Questions operations (Full models for Question Bank & Admin)
  getQuestions(filter?: QuestionFilterParams): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | null>;
  getQuestionsByIds(ids: string[]): Promise<Question[]>;
  saveSingleQuestion(question: Question): Promise<Question>;
  importQuestions(questions: Question[]): Promise<{ importedCount: number; updatedCount: number }>;
  deleteQuestion(id: string): Promise<boolean>;

  // Public Exam Question operations (Safe payload for live exam taking - NEVER returns correctAnswer)
  getExamQuestionsByIds(ids: string[]): Promise<PublicExamQuestion[]>;

  // PDF Source Library & Chapter Metadata
  uploadCompleteSourcePdf(params: {
    subject: Subject;
    chapter: string;
    file: File;
    customFileName?: string;
  }): Promise<{ storagePath: string }>;

  uploadQuestionFigure?(params: {
    subject: Subject;
    chapter: string;
    sourceFileName: string;
    questionId: string;
    figureData: Blob | string;
    fileName?: string;
  }): Promise<{ storagePath: string; publicUrl: string; signedUrl?: string }>;

  uploadSourcePdfs(params: {
    subject: Subject;
    chapter: string;
    questionFile: File;
    answerKeyFile?: File | null;
  }): Promise<{ questionPdfPath: string; answerKeyPdfPath?: string | null }>;

  createOrUpdateSourceChapter(source: {
    subject: Subject;
    chapter: string;
    title: string;
    questionPdfPath: string;
    answerKeyPdfPath?: string | null;
    questionCount: number;
    verifiedKeysCount: number;
    unknownKeysCount: number;
  }): Promise<SourceChapter>;

  getSourceChapters(subject?: Subject): Promise<SourceChapter[]>;

  // PDF Source Files (neet_source_files)
  createOrUpdateSourceFile(file: {
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
  }): Promise<SourceFile>;

  getSourceFiles(chapterId?: string): Promise<SourceFile[]>;

  // Server-Side Random Question Generator RPC
  generateRandomNeetTest(params: {
    title: string;
    mode: string;
    config: RandomNeetTestConfig;
    durationMinutes: number;
  }): Promise<RandomNeetTestRpcResult>;

  // Question Attempt Histories
  getAllQuestionHistories(): Promise<Record<string, QuestionAttemptHistory>>;
  getQuestionHistory(questionId: string): Promise<QuestionAttemptHistory | null>;
  saveQuestionHistory(history: QuestionAttemptHistory): Promise<void>;
  saveBatchQuestionHistories(histories: Record<string, QuestionAttemptHistory>): Promise<void>;

  // Test Sessions & History
  getTestHistory(): Promise<TestSession[]>;
  getTestById(id: string): Promise<TestSession | null>;
  saveTestSession(session: TestSession): Promise<TestSession>;

  // Secure Exam Submission & Server-Side Scoring
  submitAndScoreExam(payload: ExamSubmissionPayload): Promise<SecureExamResult>;

  // Data reset / seeding
  resetToDefaultSeed(): Promise<void>;
}
