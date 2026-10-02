/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

export type VisualStatus = 'SAFE' | 'QUARANTINED' | 'MISSING' | 'UNRESOLVABLE';

export type QuarantineReason =
  | 'ANSWER_KEY_DETECTED'
  | 'ANSWER_PATTERN_DETECTED'
  | 'NEIGHBOURING_QUESTION_DETECTED'
  | 'MCQ_OPTIONS_DETECTED'
  | 'DUPLICATED_CONTENT'
  | 'INCOMPLETE_TABLE'
  | 'INCOMPLETE_DIAGRAM'
  | 'UNRELATED_CONTENT'
  | 'SOURCE_PAGE_CONTAMINATION'
  | 'UNREADABLE_VISUAL'
  | 'LOW_CONFIDENCE';

export interface VisualValidationResult {
  isValid: boolean;
  status: VisualStatus;
  confidence: number;
  reasons: QuarantineReason[];
  rejectionReason: string; // Combined text summary for backward compatibility
}

/**
 * Robust, conservative validator for question visuals.
 * Prefer "NO VISUAL" over "POTENTIALLY CONTAMINATED VISUAL" (When in doubt, quarantine).
 */
export function validateQuestionVisual(params: {
  cropBox?: BoundingBox;
  textItems: TextItem[];
  isDiagram: boolean;
  qNum: number;
  sourcePdf: string;
  questionText?: string;
  options?: any;
}): VisualValidationResult {
  const { cropBox, textItems, isDiagram, qNum, sourcePdf } = params;
  let confidence = 1.0;
  const reasons: QuarantineReason[] = [];

  const fullText = textItems.map((it) => it.str).join(' ');
  const fullTextLower = fullText.toLowerCase();

  // 1. DIMENSIONS CHECK (INCOMPLETE / UNREADABLE)
  if (cropBox) {
    if (cropBox.width < 25 || cropBox.height < 15) {
      confidence = 0;
      reasons.push('UNREADABLE_VISUAL');
    }
  }

  // 2. ANSWER-KEY CONTAMINATION DETECTION
  // Check variations of Answer Key headings
  const ANSWER_KEY_HEADERS = [
    /\banswer\s*key\b/i,
    /\bcorrect\s+answer\b/i,
    /\bcorrect\s+answers\b/i,
    /\banswer\(s\)\b/i,
    /\bsolutions\b/i,
    /\bsolution\b/i,
    /\bexplanation\b/i,
    /\bexplanations\b/i
  ];

  for (const regex of ANSWER_KEY_HEADERS) {
    if (regex.test(fullText)) {
      confidence -= 0.6;
      reasons.push('ANSWER_KEY_DETECTED');
      break;
    }
  }

  // Detect exact or approximate words for answers matrix
  // E.g. "Answer", "Answers", "Key" followed by sequences
  if (/\b(?:answers?|key)\b/i.test(fullText)) {
    // Check if it looks like a sequence of answer letters, e.g. "1. d 2. a" or similar
    if (/\b\d{1,3}\s*[-–\.\:\s]\s*[a-d]\b/i.test(fullText)) {
      confidence -= 0.6;
      reasons.push('ANSWER_KEY_DETECTED');
    }
  }

  // Sequence detection: E.g., "1 2 3 4 5" and "a b c d" or "A B C D"
  const answerSequencePatterns = [
    /\b1\s+2\s+3\s+4\s+5\b/i,
    /\b[1-4]\s*-\s*[A-D]\b/i,
    /\b\d{1,2}\s*[\(]?\s*[a-d]\s*[\)]?\s*\d{1,2}\s*[\(]?\s*[a-d]\b/i // e.g. "25 (a) 26 (b)" or "25 a 26 b"
  ];

  for (const regex of answerSequencePatterns) {
    if (regex.test(fullText)) {
      confidence -= 0.7;
      if (!reasons.includes('ANSWER_PATTERN_DETECTED')) {
        reasons.push('ANSWER_PATTERN_DETECTED');
      }
    }
  }

  // 3. NEIGHBOURING QUESTION CONTAMINATION
  const PROMPT_HEADER_WORDS = /\b(?:which|select|what|match|in|the|consider|identify|find|given|how|where|when|statement|column)\b/i;
  const neighboringHeaders = textItems.filter((it) => {
    const m = /^\s*(\d{1,3})\.\s+(.*)/.exec(it.str);
    if (m) {
      const num = parseInt(m[1], 10);
      const rest = m[2];
      return num !== qNum && PROMPT_HEADER_WORDS.test(rest);
    }
    return false;
  });

  if (neighboringHeaders.length > 0) {
    confidence -= 0.5;
    reasons.push('NEIGHBOURING_QUESTION_DETECTED');
  }

  // 4. MCQ OPTION CONTAMINATION
  // Legitimate letters in matching tables are A, B, C, D and Column-I, List-I.
  // But option rows like (a) A-iv, B-iii or choices are not allowed inside a cropped visual.
  const hasOptionsMatrixInText =
    /(?:[a-d]\.|\([a-d]\))\s*(?:[A-E][-–\s]|[a-d]\s*[A-E]|\([ivx]+\)|[ivx]+|[A-E]\s*[-–\s]*[ivx]+)/.test(fullText) ||
    /[a-d]\.\s+[A-Z][a-z]+.*[b-d]\.\s+[A-Z][a-z]+/.test(fullText) ||
    /\b(?:A-iv|B-iii|C-ii|D-i)\b/i.test(fullText);

  if (hasOptionsMatrixInText) {
    confidence -= 0.5;
    reasons.push('MCQ_OPTIONS_DETECTED');
  }

  // 5. DUPLICATED CONTENT & SOURCE-PAGE CONTAMINATION
  // Check for repeated "Column" or "List" headers implying duplicate structure
  const columnHeaderCount = (fullText.match(/\bColumn\s*[-–\s]*I\b/ig) || []).length;
  const listHeaderCount = (fullText.match(/\bList\s*[-–\s]*I\b/ig) || []).length;

  if (columnHeaderCount > 1 || listHeaderCount > 1) {
    confidence -= 0.4;
    reasons.push('DUPLICATED_CONTENT');
  }

  // Page headers, footers, website watermarks
  if (
    /\b(?:page\s*\d+\s*of|\bwww\.[a-z0-9]+\.[a-z]{2,3})\b/i.test(fullText) ||
    /\b(?:class\s*-\s*xi|all\s*rights\s*reserved|physics\s*by|chemistry\s*by|botany\s*by|zoology\s*by)\b/i.test(fullTextLower)
  ) {
    confidence -= 0.3;
    reasons.push('SOURCE_PAGE_CONTAMINATION');
  }

  // 6. INCOMPLETE VISUALS
  // For matching tables, check if expected markers exist
  if (!isDiagram) {
    const colHasA = /\bA\b/.test(fullText);
    const colHasB = /\bB\b/.test(fullText);
    const colHasC = /\bC\b/.test(fullText);
    const colHasD = /\bD\b/.test(fullText);

    // If we have some but not all of A/B/C/D
    const presentCount = [colHasA, colHasB, colHasC, colHasD].filter(Boolean).length;
    if (presentCount > 0 && presentCount < 4) {
      confidence -= 0.5;
      reasons.push('INCOMPLETE_TABLE');
    }
  }

  // Deduce validity & combine reason strings
  const isValid = confidence >= 0.75 && reasons.length === 0;
  const status: VisualStatus = isValid ? 'SAFE' : 'QUARANTINED';
  const rejectionReason = reasons.length > 0 ? reasons.join('; ') : 'Passed all validation checks successfully';

  return {
    isValid,
    status,
    confidence: Math.max(0, Number(confidence.toFixed(2))),
    reasons,
    rejectionReason
  };
}
