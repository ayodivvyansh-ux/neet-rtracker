/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { NEET_CHAPTERS } from '../data/neetSyllabus';
import { AnswerOption, Difficulty, ExtractedQuestionDraft, Subject } from '../types';
import { extractAndAssociateFigures, extractCleanPromptOnly } from './pdfFigureExtractor';
import { extractVisualQuestions } from './pdfVisualQuestionExtractor';

// Set up pdf.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface AnswerKeyBoundaryInfo {
  pageNumber: number; // 1-indexed page where answer key section begins (0 if not detected)
  confidence: 'high' | 'medium' | 'low' | 'none';
  detectedPattern: string;
  charIndexInFullText?: number;
}

export interface SingleFileParseResult {
  fileName: string;
  totalPages: number;
  questionPagesCount: number;
  answerKeyPagesCount: number;
  boundary: AnswerKeyBoundaryInfo;
  questions: ExtractedQuestionDraft[];
  answerKeyMap: Record<number, AnswerOption>;
  stats: {
    totalQuestions: number;
    verifiedKeys: number;
    unknownKeys: number;
    needsReviewCount: number;
    figuresCount: number;
  };
}

/**
 * Generates a stable deterministic question identifier based on PDF source, page number, question number, and question text hash.
 * This guarantees idempotence: re-importing the same PDF updates questions in place rather than creating duplicates,
 * while multiple PDFs in the same chapter remain isolated by their source filename.
 */
export function generateDeterministicQuestionId(
  sourcePdf: string,
  pageNumber: number | undefined,
  questionNumber: number | undefined,
  questionText: string
): string {
  const cleanPdf = (sourcePdf || 'manual')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 24);

  // 32-bit hash of normalized question text
  let hash = 5381;
  const normalized = questionText.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 100);
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(36);

  const pNum = pageNumber && pageNumber > 0 ? pageNumber : 1;
  const qNum = questionNumber && questionNumber > 0 ? questionNumber : 1;
  return `q_${cleanPdf}_p${pNum}_q${qNum}_${hexHash}`;
}

export interface TextItemLine {
  y: number;
  text: string;
  items: any[];
}

/**
 * Detects the Answer-Key boundary at the layout / text-item level on a single page.
 * Returns the minimum Y coordinate (in viewport points) where the Answer-Key section begins,
 * or Infinity if no answer key is present on the page.
 */
export function detectPageAnswerKeyTopY(items: any[], viewport: any): number {
  const converted = items
    .map((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return {
        str: it.str.trim(),
        x: pt[0],
        y: pt[1]
      };
    })
    .filter((it) => it.str.length > 0);

  converted.sort((a, b) => a.y - b.y);
  const lines: TextItemLine[] = [];
  for (const it of converted) {
    const existing = lines.find((l) => Math.abs(l.y - it.y) <= 4);
    if (existing) {
      existing.items.push(it);
      existing.text += ' ' + it.str;
    } else {
      lines.push({ y: it.y, text: it.str, items: [it] });
    }
  }

  let answerKeyTopY = Infinity;

  // 1. Standalone explicit header (e.g. "Answer Key", "Answers", "Answer Sheet")
  const STANDALONE_AK_HEADER = /^(?:\s*ANSWERS?|\s*ANSWER\s*KEYS?|\s*KEY\s*ANSWERS?|\s*ANSWERS?\s*MATRIX|\s*ANSWER\s*SHEET)\s*[:\-\—]?\s*$/i;
  for (const line of lines) {
    if (STANDALONE_AK_HEADER.test(line.text)) {
      if (line.y < answerKeyTopY) answerKeyTopY = line.y;
    }
  }

  // 2. Answer key matrix (sequential question numbers followed by answer letters row)
  for (let i = 0; i < lines.length - 1; i++) {
    const lineNum = lines[i];
    const lineAns = lines[i + 1];

    if (lineAns.y - lineNum.y > 28 || lineAns.y - lineNum.y < 4) continue;

    const numTokens = lineNum.text.split(/\s+/).filter(Boolean);
    const validInts = numTokens.map((t) => (/^\d{1,3}$/.test(t) ? parseInt(t, 10) : null)).filter((n): n is number => n !== null);

    if (validInts.length >= 5) {
      let isSequential = true;
      for (let k = 1; k < validInts.length; k++) {
        if (validInts[k] !== validInts[k - 1] + 1) {
          isSequential = false;
          break;
        }
      }

      if (isSequential) {
        const ansTokens = lineAns.text.split(/\s+/).filter(Boolean);
        const validLetters = ansTokens.filter((t) => /^[a-dA-D1-4]$/.test(t));

        if (validLetters.length >= 5 && validLetters.length >= ansTokens.length * 0.8) {
          if (lineNum.y < answerKeyTopY) answerKeyTopY = lineNum.y;
        }
      }
    }
  }

  return answerKeyTopY;
}

export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: number, page: number, totalPages: number) => void
): Promise<{ fullText: string; pageTexts: { pageNumber: number; text: string }[]; answerKeyText: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageTexts: { pageNumber: number; text: string }[] = [];
  let fullText = '';
  let answerKeyText = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const items = (content.items as any[]).filter((item: any) => 'str' in item && item.str.trim());

    // 1. Detect Answer-Key boundary geometrically at the layout / text-item level
    const akTopY = detectPageAnswerKeyTopY(items, viewport);

    // 2. Filter at the text-item level: exclude all answer-key items from question processing
    const questionEligibleItems = items.filter((it: any) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return pt[1] < akTopY - 2;
    });

    const akItems = items.filter((it: any) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return pt[1] >= akTopY - 2;
    });

    if (akItems.length > 0) {
      answerKeyText += `\n--- [Page ${pageNum} Answer Key] ---\n` + akItems.map((it: any) => it.str).join(' ');
    }

    // Check if page has a two-column layout
    const midX = viewport.width / 2;
    const leftItems = questionEligibleItems.filter((it: any) => it.transform[4] < midX);
    const rightItems = questionEligibleItems.filter((it: any) => it.transform[4] >= midX);

    let orderedItems: any[] = [];
    if (leftItems.length >= 8 && rightItems.length >= 8) {
      // Sort left column top-to-bottom (descending transform[5]), then right column top-to-bottom
      const sortColumn = (col: any[]) =>
        [...col].sort((a, b) => {
          const dy = b.transform[5] - a.transform[5];
          if (Math.abs(dy) > 3) return dy;
          return a.transform[4] - b.transform[4];
        });

      orderedItems = [...sortColumn(leftItems), ...sortColumn(rightItems)];
    } else {
      orderedItems = [...questionEligibleItems].sort((a, b) => {
        const dy = b.transform[5] - a.transform[5];
        if (Math.abs(dy) > 3) return dy;
        return a.transform[4] - b.transform[4];
      });
    }

    const pageText = orderedItems.map((it) => it.str).join(' ');
    pageTexts.push({ pageNumber: pageNum, text: pageText });
    fullText += `\n--- [Page ${pageNum}] ---\n` + pageText;

    if (onProgress) {
      onProgress(Math.round((pageNum / totalPages) * 100), pageNum, totalPages);
    }
  }

  return { fullText, pageTexts, answerKeyText };
}

/**
 * Dedicated Matrix Answer Key Parser:
 * Detects answer keys structured as columnar matrices, e.g.:
 * 1  2  3  4  5  6 ... 17
 * a  d  c  d  a  d ... c
 * 18 19 20 21 22 23 24 25 26
 * a  a  a  b  b  b  a  d  c
 */
export function extractAnswerKeyMatrix(text: string): Record<number, AnswerOption> {
  const result: Record<number, AnswerOption> = {};
  const clean = text.replace(/\r/g, '').replace(/[\u00A0\u200B]/g, ' ');

  // 1. Line-by-line block matching
  const rawLines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const numTokens = line.split(/\s+/).filter(Boolean);

    // Identify a candidate question-number row (>= 3 integers)
    const areAllIntegers = numTokens.length >= 3 && numTokens.every((t) => /^\d{1,3}$/.test(t));

    if (areAllIntegers) {
      const numbers = numTokens.map((t) => parseInt(t, 10));

      // Scan subsequent lines for the answer letters row
      for (let j = i + 1; j < Math.min(rawLines.length, i + 5); j++) {
        const nextLine = rawLines[j];
        const ansTokens = nextLine.split(/\s+/).filter(Boolean);

        const areAllLetters =
          ansTokens.length >= 3 &&
          ansTokens.every((t) => /^[a-dA-D1-4]$/i.test(t));

        if (areAllLetters) {
          const count = Math.min(numbers.length, ansTokens.length);
          for (let k = 0; k < count; k++) {
            const qNum = numbers[k];
            const raw = ansTokens[k].toUpperCase();
            let opt: AnswerOption | null = null;
            if (raw === 'A' || raw === '1') opt = 'A';
            else if (raw === 'B' || raw === '2') opt = 'B';
            else if (raw === 'C' || raw === '3') opt = 'C';
            else if (raw === 'D' || raw === '4') opt = 'D';

            if (opt && qNum > 0 && qNum <= 300) {
              result[qNum] = opt;
            }
          }
          i = j; // Advance past the matched answer row
          break;
        }
      }
    }
  }

  // 2. Stream-based regex matching for PDF token sequences without hard newlines
  const streamPattern = /(\b\d{1,3}(?:\s+\d{1,3}){2,}\b)\s+([a-dA-D1-4](?:\s+[a-dA-D1-4]){2,}\b)/g;
  let match;
  while ((match = streamPattern.exec(clean)) !== null) {
    const numbers = match[1].split(/\s+/).map((n) => parseInt(n, 10));
    const letters = match[2].split(/\s+/);
    const count = Math.min(numbers.length, letters.length);

    for (let k = 0; k < count; k++) {
      const qNum = numbers[k];
      const raw = letters[k].toUpperCase();
      let opt: AnswerOption | null = null;
      if (raw === 'A' || raw === '1') opt = 'A';
      else if (raw === 'B' || raw === '2') opt = 'B';
      else if (raw === 'C' || raw === '3') opt = 'C';
      else if (raw === 'D' || raw === '4') opt = 'D';

      if (opt && qNum > 0 && qNum <= 300 && !result[qNum]) {
        result[qNum] = opt;
      }
    }
  }

  return result;
}

/**
 * Standard Pairwise Answer Key Parser (e.g., 1. (A), 1-A, Q1: B)
 */
export function extractPairwiseAnswerKeyMap(text: string): Record<number, AnswerOption> {
  const answerKeyMap: Record<number, AnswerOption> = {};

  const pairPatterns = [
    /(?:^|\s|\n)(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[\.\:\-\)\s]\s*[\(\[]?\s*([A-Da-d1-4])\s*[\)\]]?(?:\s|$|,|;|\n)/g,
    /(?:^|\s)(\d{1,3})\s*[\-]\s*([A-Da-d1-4])/g,
    /\((\d{1,3})\)\s*([A-Da-d1-4])/g
  ];

  for (const regex of pairPatterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const qNum = parseInt(match[1], 10);
      const rawAns = match[2].toUpperCase();
      let normalizedAns: AnswerOption | null = null;

      if (rawAns === 'A' || rawAns === '1') normalizedAns = 'A';
      else if (rawAns === 'B' || rawAns === '2') normalizedAns = 'B';
      else if (rawAns === 'C' || rawAns === '3') normalizedAns = 'C';
      else if (rawAns === 'D' || rawAns === '4') normalizedAns = 'D';

      if (normalizedAns && qNum > 0 && qNum <= 300) {
        if (!answerKeyMap[qNum]) {
          answerKeyMap[qNum] = normalizedAns;
        }
      }
    }
  }

  return answerKeyMap;
}

/**
 * Universal Answer Key Parser (Combines Matrix and Pairwise formats)
 */
export function extractAnswerKeyMap(text: string): Record<number, AnswerOption> {
  const matrixResult = extractAnswerKeyMatrix(text);
  const pairResult = extractPairwiseAnswerKeyMap(text);
  return { ...pairResult, ...matrixResult };
}

/**
 * Finds the starting position of the Answer Key section in a text document
 */
export function findAnswerKeyStartIndex(text: string): number {
  // 1. Check for standalone explicit "Answer Key" heading
  const headerMatch = /(?:^|\n|\r\n)\s*(?:ANSWER\s*KEYS?|KEY\s*ANSWERS?|ANSWER\s*SHEET)\s*(?:[:\-\—]|\n|\r\n|$)/i.exec(text);
  if (headerMatch) {
    return headerMatch.index;
  }

  // 2. Check for standalone "Answers" on its own line
  const answersLineMatch = /(?:^|\n|\r\n)\s*ANSWERS?\s*(?:[:\-\—]|\n|\r\n|$)/i.exec(text);
  if (answersLineMatch) {
    return answersLineMatch.index;
  }

  // 3. Check for matrix row: sequence of consecutive integers "1 2 3 4 5 6 7 8 9 10"
  const matrixMatch = /(?:^|\n|\r\n|\s)(?:1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10)/.exec(text);
  if (matrixMatch) {
    return matrixMatch.index;
  }

  return -1;
}

/**
 * Detects answer-key section boundary across pages
 */
export function detectAnswerKeyBoundary(
  pageTexts: { pageNumber: number; text: string }[]
): AnswerKeyBoundaryInfo {
  if (pageTexts.length === 0) {
    return { pageNumber: 0, confidence: 'none', detectedPattern: 'No pages' };
  }

  for (let i = pageTexts.length - 1; i >= 0; i--) {
    const page = pageTexts[i];
    const text = page.text;
    const matrixMap = extractAnswerKeyMatrix(text);
    const matrixKeysCount = Object.keys(matrixMap).length;

    const hasExplicitHeader = /(?:^|\n|\s)(?:ANSWER\s*KEYS?|ANSWERS?|ANSWER\s*SHEET)(?:\s*[:\-\—]|\s*\n|\s*$)/i.test(text);

    if (matrixKeysCount >= 8 || hasExplicitHeader) {
      return {
        pageNumber: page.pageNumber,
        confidence: 'high',
        detectedPattern: matrixKeysCount > 0 ? `Answer Key Matrix (${matrixKeysCount} entries)` : 'Explicit Answer Key Header'
      };
    }
  }

  return {
    pageNumber: 0,
    confidence: 'none',
    detectedPattern: 'None'
  };
}

// Auto-detect subject and chapter from question text
export function detectSubjectAndChapter(
  questionText: string,
  defaultSubject: Subject = 'Physics',
  defaultChapter = 'Motion in a Straight Line'
): { subject: Subject; chapter: string } {
  const lower = questionText.toLowerCase();

  // Zoology terms
  if (
    lower.includes('blood') ||
    lower.includes('lymph') ||
    lower.includes('circulation') ||
    lower.includes('erythrocyte') ||
    lower.includes('cardiac') ||
    lower.includes('ventricle') ||
    lower.includes('atrium') ||
    lower.includes('ecg') ||
    lower.includes('p-wave') ||
    lower.includes('qrs') ||
    lower.includes('systole') ||
    lower.includes('diastole') ||
    lower.includes('aorta') ||
    lower.includes('pulmonary') ||
    lower.includes('animal') ||
    lower.includes('human') ||
    lower.includes('hormone') ||
    lower.includes('heart') ||
    lower.includes('kidney') ||
    lower.includes('neuron')
  ) {
    for (const chap of NEET_CHAPTERS.Zoology) {
      const keywords = chap.name.toLowerCase().split(/[\s,]+/);
      if (keywords.some((k: string) => k.length > 4 && lower.includes(k))) {
        return { subject: 'Zoology', chapter: chap.name };
      }
    }
    return { subject: 'Zoology', chapter: 'Body Fluids and Circulation' };
  }

  // Botany terms
  if (
    lower.includes('photosynthesis') ||
    lower.includes('plant') ||
    lower.includes('chloroplast') ||
    lower.includes('flower') ||
    lower.includes('angiosperm') ||
    lower.includes('gymnosperm') ||
    lower.includes('xylem') ||
    lower.includes('phloem') ||
    lower.includes('ecology') ||
    lower.includes('ecosystem')
  ) {
    for (const chap of NEET_CHAPTERS.Botany) {
      const keywords = chap.name.toLowerCase().split(/[\s,]+/);
      if (keywords.some((k: string) => k.length > 4 && lower.includes(k))) {
        return { subject: 'Botany', chapter: chap.name };
      }
    }
    return { subject: 'Botany', chapter: defaultSubject === 'Botany' ? defaultChapter : 'Plant Kingdom' };
  }

  // Physics terms
  if (
    lower.includes('velocity') ||
    lower.includes('acceleration') ||
    lower.includes('friction') ||
    lower.includes('momentum') ||
    lower.includes('resistor') ||
    lower.includes('magnetic') ||
    lower.includes('capacitance') ||
    lower.includes('refractive index') ||
    lower.includes('carnot') ||
    lower.includes('wavelength') ||
    lower.includes('kinetic energy') ||
    lower.includes('gravitation')
  ) {
    for (const chap of NEET_CHAPTERS.Physics) {
      const keywords = chap.name.toLowerCase().split(/[\s,]+/);
      if (keywords.some((k) => k.length > 4 && lower.includes(k))) {
        return { subject: 'Physics', chapter: chap.name };
      }
    }
    return { subject: 'Physics', chapter: defaultSubject === 'Physics' ? defaultChapter : 'Motion in a Straight Line' };
  }

  // Chemistry terms
  if (
    lower.includes('reaction') ||
    lower.includes('moles') ||
    lower.includes('acid') ||
    lower.includes('orbital') ||
    lower.includes('enthalpy') ||
    lower.includes('ph of') ||
    lower.includes('iupac') ||
    lower.includes('hybridization') ||
    lower.includes('cation') ||
    lower.includes('anion') ||
    lower.includes('organic')
  ) {
    for (const chap of NEET_CHAPTERS.Chemistry) {
      const keywords = chap.name.toLowerCase().split(/[\s,]+/);
      if (keywords.some((k) => k.length > 4 && lower.includes(k))) {
        return { subject: 'Chemistry', chapter: chap.name };
      }
    }
    return { subject: 'Chemistry', chapter: defaultSubject === 'Chemistry' ? defaultChapter : 'Some Basic Concepts of Chemistry' };
  }

  return { subject: defaultSubject, chapter: defaultChapter };
}

/**
 * Question Parser with Sequential Progression & Match-the-Column Protection:
 * 1. Identifies questions numbered sequentially (1., 2., 3. ... N.).
 * 2. Prevents table rows inside Match-the-Column questions (e.g. 1. Eosinophils, 2. Basophils) from triggering false splits.
 * 3. Cuts off question text cleanly before trailing answer-key matrices.
 */
export function parseQuestionsFromPageTexts(
  pageTexts: { pageNumber: number; text: string }[],
  answerKeyMap: Record<number, AnswerOption>,
  fileName: string,
  defaultSubject: Subject,
  defaultChapter: string
): ExtractedQuestionDraft[] {
  // Build accumulated text with page offset mapping
  let accumulatedText = '';
  const pageOffsetMap: { start: number; end: number; pageNumber: number }[] = [];

  for (const p of pageTexts) {
    const start = accumulatedText.length;
    accumulatedText += `\n` + p.text;
    const end = accumulatedText.length;
    pageOffsetMap.push({ start, end, pageNumber: p.pageNumber });
  }

  // 1. Isolate question section (cut off any trailing answer key matrix)
  const akIndex = findAnswerKeyStartIndex(accumulatedText);
  const questionContent = akIndex > 0 ? accumulatedText.substring(0, akIndex) : accumulatedText;

  // 2. Locate sequential question headers: 1., 2., 3. ... 26.
  const questionPositions: { qNum: number; index: number }[] = [];

  // Match: (start of line / whitespace) followed by number and dot, e.g. " 1. ", "\n2. ", "24. "
  const headerRegex = /(?:^|\n|\r\n|\s)(\d{1,3})\.\s+/g;
  let match;
  let expectedQNum = 1;

  while ((match = headerRegex.exec(questionContent)) !== null) {
    const matchedQNum = parseInt(match[1], 10);
    const matchIndex = match.index + (match[0].length - match[1].length - 2); // Start of the number

    // Sequential check: accept strictly in-sequence question headers
    if (matchedQNum === expectedQNum) {
      questionPositions.push({ qNum: matchedQNum, index: matchIndex });
      expectedQNum++;
    } else if (matchedQNum === expectedQNum + 1 && questionPositions.length > 0) {
      // Allow minor single skip if present in document
      questionPositions.push({ qNum: matchedQNum, index: matchIndex });
      expectedQNum = matchedQNum + 1;
    }
  }

  if (questionPositions.length === 0) {
    return [];
  }

  const questions: ExtractedQuestionDraft[] = [];

  for (let i = 0; i < questionPositions.length; i++) {
    const current = questionPositions[i];
    const nextIndex = i + 1 < questionPositions.length ? questionPositions[i + 1].index : questionContent.length;
    const block = questionContent.substring(current.index, nextIndex).trim();

    const pageEntry = pageOffsetMap.find((p) => current.index >= p.start && current.index < p.end);
    const origPageNumber = pageEntry ? pageEntry.pageNumber : 1;

    const parsed = parseSingleQuestionBlock(
      block,
      current.qNum,
      answerKeyMap[current.qNum],
      fileName,
      origPageNumber,
      defaultSubject,
      defaultChapter
    );

    if (parsed) {
      questions.push(parsed);
    }
  }

  return questions;
}

/**
 * Extracts question prompt and options (a, b, c, d) from a single question block
 */
function parseSingleQuestionBlock(
  block: string,
  questionNumber: number,
  detectedAnswer: AnswerOption | undefined,
  sourcePdf: string,
  pageNumber: number,
  defaultSubject: Subject,
  defaultChapter: string
): ExtractedQuestionDraft | null {
  // Strip question number prefix: "1. ", "14. ", "26. "
  let cleaned = block.replace(/^(?:Q(?:uestion)?\.?\s*\d{1,3}[\.\:\-\)]?|\d{1,3}[\.\:\-\)])\s*/i, '').trim();

  // Look for options in priority order:
  // 1. Lowercase a. b. c. d. (The canonical NEET format)
  // 2. Parenthesized (a) (b) (c) (d) or (A) (B) (C) (D)
  // 3. Uppercase A. B. C. D.

  let optIndices: { label: 'A' | 'B' | 'C' | 'D'; start: number; textStart: number }[] = [];

  // Lowercase dot: a. ... b. ... c. ... d.
  const lowerDotRegexes = [
    /(?:^|\s|\n)a\.\s+/g,
    /(?:^|\s|\n)b\.\s+/g,
    /(?:^|\s|\n)c\.\s+/g,
    /(?:^|\s|\n)d\.\s+/g
  ];

  const lowerPositions: { label: 'A' | 'B' | 'C' | 'D'; start: number; textStart: number }[] = [];
  let isLowerValid = true;

  for (let k = 0; k < 4; k++) {
    const reg = lowerDotRegexes[k];
    reg.lastIndex = 0;
    const m = reg.exec(cleaned);
    if (!m) {
      isLowerValid = false;
      break;
    }
    const label = ['A', 'B', 'C', 'D'][k] as 'A' | 'B' | 'C' | 'D';
    lowerPositions.push({
      label,
      start: m.index,
      textStart: m.index + m[0].length
    });
  }

  // Ensure positions are strictly increasing
  if (
    isLowerValid &&
    lowerPositions.length === 4 &&
    lowerPositions[0].start < lowerPositions[1].start &&
    lowerPositions[1].start < lowerPositions[2].start &&
    lowerPositions[2].start < lowerPositions[3].start
  ) {
    optIndices = lowerPositions;
  } else {
    // Fallback: Parenthesized options (a) (b) (c) (d) or (A) (B) (C) (D)
    const parenRegexes = [
      /(?:^|\s|\n)\([aA1]\)\s*/g,
      /(?:^|\s|\n)\([bB2]\)\s*/g,
      /(?:^|\s|\n)\([cC3]\)\s*/g,
      /(?:^|\s|\n)\([dD4]\)\s*/g
    ];

    const parenPositions: { label: 'A' | 'B' | 'C' | 'D'; start: number; textStart: number }[] = [];
    let isParenValid = true;

    for (let k = 0; k < 4; k++) {
      const reg = parenRegexes[k];
      reg.lastIndex = 0;
      const m = reg.exec(cleaned);
      if (!m) {
        isParenValid = false;
        break;
      }
      const label = ['A', 'B', 'C', 'D'][k] as 'A' | 'B' | 'C' | 'D';
      parenPositions.push({
        label,
        start: m.index,
        textStart: m.index + m[0].length
      });
    }

    if (
      isParenValid &&
      parenPositions.length === 4 &&
      parenPositions[0].start < parenPositions[1].start &&
      parenPositions[1].start < parenPositions[2].start &&
      parenPositions[2].start < parenPositions[3].start
    ) {
      optIndices = parenPositions;
    } else {
      // Fallback: Uppercase dot A. B. C. D.
      const upperDotRegexes = [
        /(?:^|\s|\n)A\.\s+/g,
        /(?:^|\s|\n)B\.\s+/g,
        /(?:^|\s|\n)C\.\s+/g,
        /(?:^|\s|\n)D\.\s+/g
      ];
      const upperPositions: { label: 'A' | 'B' | 'C' | 'D'; start: number; textStart: number }[] = [];
      let isUpperValid = true;

      for (let k = 0; k < 4; k++) {
        const reg = upperDotRegexes[k];
        reg.lastIndex = 0;
        const m = reg.exec(cleaned);
        if (!m) {
          isUpperValid = false;
          break;
        }
        const label = ['A', 'B', 'C', 'D'][k] as 'A' | 'B' | 'C' | 'D';
        upperPositions.push({
          label,
          start: m.index,
          textStart: m.index + m[0].length
        });
      }

      if (
        isUpperValid &&
        upperPositions.length === 4 &&
        upperPositions[0].start < upperPositions[1].start &&
        upperPositions[1].start < upperPositions[2].start &&
        upperPositions[2].start < upperPositions[3].start
      ) {
        optIndices = upperPositions;
      }
    }
  }

  let questionText = cleaned;
  const options = {
    A: '',
    B: '',
    C: '',
    D: ''
  };

  if (optIndices.length === 4) {
    questionText = cleaned.substring(0, optIndices[0].start).trim();
    options.A = cleaned.substring(optIndices[0].textStart, optIndices[1].start).trim();
    options.B = cleaned.substring(optIndices[1].textStart, optIndices[2].start).trim();
    options.C = cleaned.substring(optIndices[2].textStart, optIndices[3].start).trim();
    options.D = cleaned.substring(optIndices[3].textStart).trim();

    // For match-the-column questions, keep ONLY the prompt/instruction and strip duplicate flattened table text
    questionText = extractCleanPromptOnly(questionText);
  }

  // Clean stray trailing section/chapter headers from option D or question text
  const headerStripRegex = /(?:\n|\r\n|\s+)(?:C\s*H\s*A\s*P\s*T\s*E\s*R\s*\d*.*|Chapter\s*&\s*Topicwise.*|Circulatory\s*Pathways.*|Double\s*Circulation.*|Disorders\s*of\s*Circulatory.*|Blood\s*and\s*Lymph.*|Answer\s*Key.*|\b1\s+2\s+3\s+4\s+5\s+6\b.*)$/is;
  options.D = options.D.replace(headerStripRegex, '').trim();
  options.D = options.D.replace(/(?:Chapter\s*&\s*Topicwise\s*NEET\s*PYQ.*|Answer\s*Key.*|\b1\s+2\s+3\s+4\s+5\s+6\b.*)$/is, '').trim();

  const { subject, chapter } = detectSubjectAndChapter(questionText, defaultSubject, defaultChapter);

  const errors: string[] = [];
  if (!questionText || questionText.length < 5) errors.push('Question text is too short or empty');
  if (!options.A) errors.push('Option A is missing');
  if (!options.B) errors.push('Option B is missing');
  if (!options.C) errors.push('Option C is missing');
  if (!options.D) errors.push('Option D is missing');

  const stableId = generateDeterministicQuestionId(
    sourcePdf,
    pageNumber,
    questionNumber,
    questionText
  );

  return {
    id: stableId,
    rawQuestionNumber: questionNumber,
    text: questionText,
    options,
    correctAnswer: detectedAnswer || 'UNKNOWN',
    subject,
    chapter,
    difficulty: 'Medium',
    sourcePdf,
    pageNumber,
    isValid: errors.length === 0,
    validationErrors: errors
  };
}

/**
 * Master parser for a single complete PDF containing both questions and trailing answer-key matrix.
 */
export async function parseSingleCompletePdf(
  file: File,
  defaultSubject: Subject = 'Physics',
  defaultChapter = 'Motion in a Straight Line',
  onProgress?: (progress: number, page: number, totalPages: number) => void
): Promise<SingleFileParseResult> {
  const { fullText, pageTexts, answerKeyText } = await extractTextFromPDF(file, onProgress);
  const totalPages = pageTexts.length;

  // 1. Parse Answer Key from combined text (including geometrically isolated answer-key section)
  const answerKeyCombinedText = fullText + (answerKeyText ? '\n' + answerKeyText : '');
  const answerKeyMap = extractAnswerKeyMap(answerKeyCombinedText);

  // 2. Parse Questions from page texts
  const questions = parseQuestionsFromPageTexts(
    pageTexts,
    answerKeyMap,
    file.name,
    defaultSubject,
    defaultChapter
  );

  // 3. Extract exact visual question crops with A/B/C/D option hitboxes
  let finalQuestions = questions;
  let figuresDetectedCount = 0;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      disableFontFace: true
    }).promise;

    const visResult = await extractVisualQuestions(
      pdfDoc,
      questions,
      file.name,
      undefined,
      (status) => onProgress?.(90, totalPages, totalPages)
    );
    finalQuestions = visResult.updatedQuestions;

    const figResult = await extractAndAssociateFigures(
      pdfDoc,
      finalQuestions,
      file.name,
      (status) => onProgress?.(95, totalPages, totalPages)
    );

    finalQuestions = figResult.updatedQuestions;
    figuresDetectedCount = figResult.figuresDetectedCount;
  } catch (figErr) {
    console.warn('[PDFParser] Figure/Visual extraction warning (continuing with text questions):', figErr);
  }

  const boundary = detectAnswerKeyBoundary(pageTexts);

  const verifiedKeys = finalQuestions.filter((q) => (q.correctAnswer as string) !== 'UNKNOWN').length;
  const unknownKeys = finalQuestions.filter((q) => (q.correctAnswer as string) === 'UNKNOWN').length;
  const needsReviewCount = finalQuestions.filter((q) => !q.isValid || (q.correctAnswer as string) === 'UNKNOWN').length;

  return {
    fileName: file.name,
    totalPages,
    questionPagesCount: totalPages,
    answerKeyPagesCount: boundary.pageNumber > 0 ? totalPages - boundary.pageNumber + 1 : 0,
    boundary,
    questions: finalQuestions,
    answerKeyMap,
    stats: {
      totalQuestions: finalQuestions.length,
      verifiedKeys,
      unknownKeys,
      needsReviewCount,
      figuresCount: figuresDetectedCount
    }
  };
}

// Backward compatible raw text parser
export function parseQuestionsFromRawText(
  rawText: string,
  fileName: string,
  defaultSubject: Subject = 'Physics',
  defaultChapter = 'Motion in a Straight Line'
): ExtractedQuestionDraft[] {
  const answerKeyMap = extractAnswerKeyMap(rawText);
  return parseQuestionsFromPageTexts(
    [{ pageNumber: 1, text: rawText }],
    answerKeyMap,
    fileName,
    defaultSubject,
    defaultChapter
  );
}

export async function parseQuestionsFromBlock(
  rawTextChunk: string,
  sourcePdfName: string
): Promise<ExtractedQuestionDraft[]> {
  return parseQuestionsFromRawText(rawTextChunk, sourcePdfName);
}
