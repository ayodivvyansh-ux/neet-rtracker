/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ExtractedQuestionDraft, QuestionImage } from '../types';
import { detectPageAnswerKeyTopY } from './pdfParser';
import { validateQuestionVisual } from './visualValidator';

// Supporting diagram keyword patterns (used to corroborate diagram/waveform extraction)
const FIGURE_KEYWORDS_REGEX =
  /\b(?:diagram\s+given|given\s+diagram|given\s+figure|in\s+the\s+given\s+figure|shown\s+in\s+(?:the\s+)?figure|refer\s+to\s+the\s+(?:diagram|figure|graph)|ecg\s+diagram|given\s+ecg|ecg\s+shown|the\s+diagram\s+given\s+here|structure\s+given\s+below|following\s+circuit|given\s+circuit|following\s+graph|given\s+graph|in\s+the\s+given\s+circuit|circuit\s+diagram|following\s+diagram)\b/i;

// Match-the-Column / Match-the-following table patterns
const MATCH_TABLE_REGEX =
  /\b(?:match\s+(?:the\s+)?(?:following|items|columns?|lists?)|column\s*[-–\s]*[I1]\s+(?:with|and)\s+column\s*[-–\s]*[II2]|list\s*[-–\s]*[I1]\s+(?:with|and)\s+list\s*[-–\s]*[II2])\b/i;

// Regex to identify MCQ answer options specifically in matching questions
// (e.g., "a. (iv) (i)...", "a. A-iv B-i C-ii D-iii", "(a) A-iv, B-i...", "a. A-iii B-ii C-i")
const MATCH_MCQ_OPTIONS_REGEX =
  /(?:^|\s)(?:[a-d]\.|\([a-d]\)|[1-4]\.|\([1-4]\))\s*(?:[A-E][-–\s]|[a-d]\s*[A-E]|\([ivx]+\)|[ivx]+|[A-E]\s*[-–\s]*[ivx]+)/i;

// General MCQ option start marker
const GENERAL_MCQ_OPTION_REGEX =
  /(?:^|\s)(?:[a-d]\.|\([a-d]\)|[1-4]\.|\([1-4]\))\s+/i;

// Answer key heading or matrix patterns
const ANSWER_KEY_HEADER_REGEX =
  /\b(?:answer\s*key|answers?\s*matrix|\b1\s+2\s+3\s+4\s+5\s+6\b)\b/i;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface EmbeddedGraphicObject {
  type: 'raster' | 'vector';
  bbox: BoundingBox;
}

/**
 * Universal Canvas Factory: works in both browser and Node.js environments
 */
export async function createUniversalCanvas(width: number, height: number): Promise<{
  canvas: any;
  ctx: any;
  toDataURL: (type?: string) => string;
  toBuffer?: (type?: any) => any;
}> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    return {
      canvas,
      ctx,
      toDataURL: (type = 'image/png') => (canvas as any).toDataURL(type as any),
      toBuffer: (type: any = 'image/png') => (canvas as any).toBuffer?.(type)
    };
  }

  // Node.js environment fallback
  try {
    const loadNodeModule = new Function('moduleName', 'return import(moduleName)');
    const { createCanvas } = await loadNodeModule('@napi-rs/canvas');
    const canvas = createCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    const ctx = canvas.getContext('2d');
    return {
      canvas,
      ctx,
      toDataURL: (type = 'image/png') => (canvas as any).toDataURL(type as any),
      toBuffer: (type: any = 'image/png') => (canvas as any).toBuffer(type as any)
    };
  } catch (err) {
    throw new Error('Canvas rendering engine unavailable in current environment: ' + (err as Error).message);
  }
}

/**
 * Multiplies two 2D affine transformation matrices: [a, b, c, d, e, f]
 */
function multiplyTransformMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

/**
 * Trims excess whitespace around a cropped diagram canvas while adding clean padding.
 */
export async function trimCanvasWhitespace(
  sourceCanvas: any,
  padding = 6,
  whiteThreshold = 240
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const ctx = sourceCanvas.getContext('2d');
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 20 && (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold)) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent || maxX - minX < 20 || maxY - minY < 15) {
    return null;
  }

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(w - cropX, maxX - minX + 1 + padding * 2);
  const cropH = Math.min(h - cropY, maxY - minY + 1 + padding * 2);

  const trimmed = await createUniversalCanvas(cropW, cropH);
  trimmed.ctx.fillStyle = '#ffffff';
  trimmed.ctx.fillRect(0, 0, cropW, cropH);
  trimmed.ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return {
    dataUrl: trimmed.toDataURL('image/png'),
    width: cropW,
    height: cropH
  };
}

/**
 * Checks whether a question text refers to a diagram/figure/graph/ECG.
 */
export function questionContainsFigure(text: string): boolean {
  if (!text) return false;
  return (
    FIGURE_KEYWORDS_REGEX.test(text) ||
    /diagram/i.test(text) ||
    /figure/i.test(text) ||
    /graph/i.test(text) ||
    /ecg/i.test(text) ||
    /\[DIAGRAM/i.test(text) ||
    /diagrammatic/i.test(text)
  );
}

/**
 * Checks whether a question text contains Match-the-Column / Match-the-following.
 */
export function isMatchTheColumnQuestion(text: string): boolean {
  if (!text) return false;
  return MATCH_TABLE_REGEX.test(text) || /List\s*[-–\s]*[I1]/i.test(text) || /Column\s*[-–\s]*[I1]/i.test(text);
}

export interface VisualValidationResult {
  isValid: boolean;
  confidence: number;
  rejectionReason?: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

/**
 * Validates an extracted visual crop to guarantee it does NOT contain:
 * - Answer Key, solution, explanation
 * - Answer choices / option keys
 * - Neighboring question text/headers
 * - List-I text or List-II heading when isolating diagrams
 */
export function validateAndScoreVisualCrop(
  cropBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number },
  pageTextItemsInsideCrop: { str: string; x: number; y: number }[],
  isDiagramQuestion: boolean,
  qNum: number,
  sourceFileName: string
): VisualValidationResult {
  const result = validateQuestionVisual({
    cropBox,
    textItems: pageTextItemsInsideCrop,
    isDiagram: isDiagramQuestion,
    qNum,
    sourcePdf: sourceFileName
  });

  // Log visual extraction details as required
  console.log(
    `[VisualExtraction] PDF: "${sourceFileName}" | Q#${qNum} | BBox: [x:${Math.round(cropBox.minX)}, y:${Math.round(cropBox.minY)}, w:${Math.round(cropBox.width)}, h:${Math.round(cropBox.height)}] | Confidence: ${(result.confidence * 100).toFixed(1)}% | Valid: ${result.isValid}${!result.isValid ? ` | Rejection: ${result.rejectionReason}` : ''}`
  );

  return {
    isValid: result.isValid,
    confidence: result.confidence,
    rejectionReason: result.isValid ? undefined : result.rejectionReason,
    bbox: cropBox
  };
}

/**
 * Cleans question prompt text by stripping flattened table lines.
 * Guarantees that question.text contains ONLY the actual prompt/instruction.
 */
export function extractCleanPromptOnly(rawQuestionText: string): string {
  if (!rawQuestionText) return '';
  let cleaned = rawQuestionText.trim();

  // 1. Year in parentheses followed by table content, e.g. "(2018) Column-I", "(2019) Column-I", "(2020) Column-I"
  const yearHeaderMatch = /\(\d{4}[^\)]*\)\s+(?:Column|List|[A-E]\.|\d{1,2}\.)/i.exec(cleaned);
  if (yearHeaderMatch) {
    const endOfParen = cleaned.indexOf(')', yearHeaderMatch.index);
    return cleaned.substring(0, endOfParen + 1).trim();
  }

  // 2. Double header: "Column-I Column-II" or "List-I List-II" (table header row)
  const doubleHeaderMatch = /(?:\n|\r\n|\s+)(?:Column\s*[-–\s]*[I1]\s+Column\s*[-–\s]*[II2]|List\s*[-–\s]*[I1]\s+List\s*[-–\s]*[II2])/i.exec(cleaned);
  if (doubleHeaderMatch) {
    return cleaned.substring(0, doubleHeaderMatch.index).trim();
  }

  // 3. Instruction ending followed by table items
  const instructionMatch = /(?:select\s+the\s+correct\s+option[^\n\r]*|given\s+below[^\n\r]*|following\s+columns[^\n\r]*)(?:[:\.]|\s)\s*(?:Column\s*[-–\s]*[I1]\s+Column|List\s*[-–\s]*[I1]\s+List|[A-E]\.|\d{1,2}\.)/i.exec(cleaned);
  if (instructionMatch) {
    const matchIdx = instructionMatch.index + instructionMatch[0].search(/(?:Column|List|[A-E]\.|\d{1,2}\.)/i);
    return cleaned.substring(0, matchIdx).trim().replace(/[:;\-\—\s]+$/, '');
  }

  return cleaned.replace(/[:;\-\—\s]+$/, '').trim();
}

/**
 * Parses all graphic operators on a page to locate embedded raster images
 * and vector drawings (curves, plots, circuits, ECG waveforms, table lines).
 */
export async function collectPageGraphicObjects(
  page: any,
  viewport: any
): Promise<EmbeddedGraphicObject[]> {
  const ops = await page.getOperatorList();
  const graphicObjects: EmbeddedGraphicObject[] = [];

  let currentMatrix = [1, 0, 0, 1, 0, 0];
  const matrixStack: number[][] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    // CTM Tracking
    if (fn === pdfjsLib.OPS.save) {
      matrixStack.push([...currentMatrix]);
    } else if (fn === pdfjsLib.OPS.restore) {
      currentMatrix = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
    } else if (fn === pdfjsLib.OPS.transform && Array.isArray(args)) {
      currentMatrix = multiplyTransformMatrices(currentMatrix, args);
    }

    // 1. Embedded Raster Image Detection
    else if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject ||
      fn === pdfjsLib.OPS.paintImageMaskXObject
    ) {
      const p0 = viewport.convertToViewportPoint(currentMatrix[4], currentMatrix[5]);
      const p1 = viewport.convertToViewportPoint(
        currentMatrix[0] + currentMatrix[4],
        currentMatrix[1] + currentMatrix[5]
      );
      const p2 = viewport.convertToViewportPoint(
        currentMatrix[2] + currentMatrix[4],
        currentMatrix[3] + currentMatrix[5]
      );
      const p3 = viewport.convertToViewportPoint(
        currentMatrix[0] + currentMatrix[2] + currentMatrix[4],
        currentMatrix[1] + currentMatrix[3] + currentMatrix[5]
      );

      const xs = [p0[0], p1[0], p2[0], p3[0]];
      const ys = [p0[1], p1[1], p2[1], p3[1]];

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width >= 20 && height >= 15) {
        graphicObjects.push({
          type: 'raster',
          bbox: { minX, minY, maxX, maxY, width, height }
        });
      }
    }

    // 2. Vector Graphic / Path Drawing Detection (constructPath, stroke, fill)
    else if (fn === pdfjsLib.OPS.constructPath && Array.isArray(args)) {
      const rawBox = args[2];
      if (rawBox && typeof rawBox['0'] === 'number') {
        const minXPdf = rawBox['0'];
        const minYPdf = rawBox['1'];
        const maxXPdf = rawBox['2'];
        const maxYPdf = rawBox['3'];

        const p1 = viewport.convertToViewportPoint(minXPdf, maxYPdf);
        const p2 = viewport.convertToViewportPoint(maxXPdf, minYPdf);

        const canvasMinY = Math.min(p1[1], p2[1]);
        const canvasMaxY = Math.max(p1[1], p2[1]);
        const canvasMinX = Math.min(p1[0], p2[0]);
        const canvasMaxX = Math.max(p1[0], p2[0]);

        const width = canvasMaxX - canvasMinX;
        const height = canvasMaxY - canvasMinY;

        if (width >= 15 && height >= 8) {
          graphicObjects.push({
            type: 'vector',
            bbox: {
              minX: canvasMinX,
              minY: canvasMinY,
              maxX: canvasMaxX,
              maxY: canvasMaxY,
              width,
              height
            }
          });
        }
      }
    }
  }

  return graphicObjects;
}

/**
 * Reconstructs a clean structured HTML table representation from text items
 * located strictly within a question's matching table boundaries.
 */
export function reconstructStructuredTable(
  tableTextItems: any[],
  scale: number,
  viewport: any
): { headers: string[]; rows: string[][] } | null {
  if (tableTextItems.length < 4) return null;

  // Compute text points
  const points = tableTextItems
    .map((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return {
        str: it.str.trim(),
        x: pt[0],
        y: pt[1]
      };
    })
    .filter((p) => p.str.length > 0);

  if (points.length < 4) return null;

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const tableMidX = minX + (maxX - minX) * 0.48;

  // Find header row (Column-I, Column-II, List-I, List-II)
  const headerCol1 = points.find((p) => /column\s*[-–\s]*[I1]|list\s*[-–\s]*[I1]/i.test(p.str) && p.x < tableMidX);
  const headerCol2 = points.find((p) => /column\s*[-–\s]*(?:II|2)|list\s*[-–\s]*(?:II|2)/i.test(p.str) && p.x >= tableMidX);

  const headers = [
    headerCol1 ? headerCol1.str : 'Column-I',
    headerCol2 ? headerCol2.str : 'Column-II'
  ];

  // Exclude header items from row points
  const rowPoints = points.filter((p) => p !== headerCol1 && p !== headerCol2);
  if (rowPoints.length < 2) return null;

  // Separate Column 1 points and Column 2 points
  const col1Points = rowPoints.filter((p) => p.x < tableMidX).sort((a, b) => a.y - b.y);
  const col2Points = rowPoints.filter((p) => p.x >= tableMidX).sort((a, b) => a.y - b.y);

  // Group Column 1 items into discrete rows
  // A new row in Col 1 starts when an item matches ^[A-E]\. or ^\d{1,2}\. OR has a significant vertical gap (>14px)
  interface CellGroup {
    y: number;
    text: string;
  }

  const col1Rows: CellGroup[] = [];
  for (const pt of col1Points) {
    const isNewRowMarker = /^[A-E]\.|\b\d{1,2}\.\s*[A-Z]/i.test(pt.str);
    const lastRow = col1Rows[col1Rows.length - 1];

    if (!lastRow || isNewRowMarker || (pt.y - lastRow.y > 14)) {
      col1Rows.push({ y: pt.y, text: pt.str });
    } else {
      lastRow.text += ' ' + pt.str;
    }
  }

  // Group Column 2 items into discrete rows
  // A new row in Col 2 starts when an item matches ^(?:\(?[ivx]+\)?|[A-E]\.|\d{1,2}\.) OR has a significant vertical gap (>14px)
  const col2Rows: CellGroup[] = [];
  for (const pt of col2Points) {
    const isNewRowMarker = /^(?:\(?[ivx]+\)?|[A-E]\.|\d{1,2}\.)/i.test(pt.str);
    const lastRow = col2Rows[col2Rows.length - 1];

    if (!lastRow || isNewRowMarker || (pt.y - lastRow.y > 14)) {
      col2Rows.push({ y: pt.y, text: pt.str });
    } else {
      lastRow.text += ' ' + pt.str;
    }
  }

  // Combine Col 1 and Col 2 rows by matching baselines or sequential row pairing
  const maxRows = Math.max(col1Rows.length, col2Rows.length);
  if (maxRows < 2) return null;

  const rows: string[][] = [];

  for (let r = 0; r < maxRows; r++) {
    const c1 = col1Rows[r] ? col1Rows[r].text.trim() : '';
    const c2 = col2Rows[r] ? col2Rows[r].text.trim() : '';
    if (c1.length > 0 || c2.length > 0) {
      rows.push([c1, c2]);
    }
  }

  if (rows.length >= 2) {
    return { headers, rows };
  }

  return null;
}

/**
 * Master Precise Figure & Table Extraction Engine:
 *
 * 1. Column-Aware Segmentation:
 *    - Segments the page into Left and Right columns.
 *    - Questions in the left column NEVER consume content from the right column.
 *    - Questions in the right column NEVER consume content from the left column.
 *
 * 2. Precise Spatial Boundaries:
 *    - Each question's spatial region starts at its question header and ENDS before the next question in the SAME column.
 *    - Q4 does NOT extend into Q10/Q11 or Q5.
 *    - Q6 does NOT extend backward into Q1/Q2.
 *    - Q8 is a normal text question and NEVER gets a table figure.
 *    - Q18 does NOT inherit Q23's ECG.
 *
 * 3. Exact Table Detection & Structured Representation:
 *    - For Match-the-Column questions:
 *      Extracts structured table (headers & rows) and tightly crops ONLY the table.
 *      Cleans question.text to contain ONLY the instruction prompt.
 *      regionType = "table", UI label = "Matching Table".
 *
 * 4. Distinct Diagram Extraction:
 *    - For Q23 standard ECG:
 *      Tightly crops ONLY the ECG waveform within Q23's right-column region.
 *      regionType = "diagram", UI label = "Figure / Diagram".
 */
export async function extractAndAssociateFigures(
  pdfDoc: any,
  questions: ExtractedQuestionDraft[],
  sourceFileName: string,
  onProgress?: (status: string) => void
): Promise<{
  updatedQuestions: ExtractedQuestionDraft[];
  figuresDetectedCount: number;
}> {
  const updatedQuestions = [...questions];
  let figuresDetectedCount = 0;

  const totalPages = pdfDoc.numPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageQuestions = updatedQuestions.filter((q) => q.pageNumber === pageNum);
    if (pageQuestions.length === 0) continue;

    const page = await pdfDoc.getPage(pageNum);
    const scale = 2.0; // 2x Retina scale for crisp vector & table capture
    const viewport = page.getViewport({ scale });

    // 1. Answer-Key Boundary Protection
    const textContent = await page.getTextContent();
    const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

    let answerKeyBoundaryY = detectPageAnswerKeyTopY(items, viewport);
    if (answerKeyBoundaryY === Infinity) {
      answerKeyBoundaryY = viewport.height;
    }

    // 2. Page Column Segmentation
    const midX = viewport.width / 2;
    const leftTextItems = items.filter((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return pt[0] < midX - 30;
    });
    const rightTextItems = items.filter((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return pt[0] > midX + 30;
    });

    const isTwoColumnPage = leftTextItems.length >= 8 && rightTextItems.length >= 8;

    const leftCol = { minX: 0, maxX: isTwoColumnPage ? midX - 4 : viewport.width };
    const rightCol = { minX: isTwoColumnPage ? midX + 4 : 0, maxX: viewport.width };

    // 3. Locate each question's header position with disambiguation against table row numbers
    interface QuestionSpatialInfo {
      qNum: number;
      q: ExtractedQuestionDraft;
      x: number;
      y: number;
      column: 'left' | 'right';
      colBounds: { minX: number; maxX: number };
      startY: number;
      endY: number;
      promptBottomY: number;
      optionsMinY: number;
    }

    const questionSpatials: QuestionSpatialInfo[] = [];

    for (const q of pageQuestions) {
      const qNum = q.rawQuestionNumber;
      if (!qNum) continue;

      const numPat = new RegExp(`(?:^|\\s)${qNum}\\.\\s*`);
      // Extract prompt words for strict header verification
      const promptSnippet = q.text.replace(/^[0-9\.\:\-\s]+/, '').trim().toLowerCase();
      const promptWords = promptSnippet.split(/\s+/).filter((w) => w.length >= 4).slice(0, 3);

      let headerItem: any = null;
      let headerPt = [0, 0];

      // Find candidate items matching the question number
      const candidateItems = items.filter((it) => {
        if (!it.str || !numPat.test(it.str)) return false;
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return pt[1] < answerKeyBoundaryY - 10;
      });

      if (candidateItems.length === 1) {
        headerItem = candidateItems[0];
        headerPt = viewport.convertToViewportPoint(headerItem.transform[4], headerItem.transform[5]);
      } else if (candidateItems.length > 1) {
        // Disambiguate against table rows (e.g. "1. Eosinophils" vs "1. Given below...")
        // Prioritize candidate whose text or adjacent items contain prompt words
        for (const candidate of candidateItems) {
          const candidateText = candidate.str.toLowerCase();
          const matchesPrompt = promptWords.some((pw) => candidateText.includes(pw));
          if (matchesPrompt) {
            headerItem = candidate;
            headerPt = viewport.convertToViewportPoint(candidate.transform[4], candidate.transform[5]);
            break;
          }
        }

        // Fallback: pick the uppermost candidate in vertical flow
        if (!headerItem) {
          candidateItems.sort((a, b) => {
            const ptA = viewport.convertToViewportPoint(a.transform[4], a.transform[5]);
            const ptB = viewport.convertToViewportPoint(b.transform[4], b.transform[5]);
            return ptA[1] - ptB[1];
          });
          headerItem = candidateItems[0];
          headerPt = viewport.convertToViewportPoint(headerItem.transform[4], headerItem.transform[5]);
        }
      }

      if (headerItem) {
        const column: 'left' | 'right' = isTwoColumnPage && headerPt[0] >= midX ? 'right' : 'left';
        const colBounds = column === 'left' ? leftCol : rightCol;

        questionSpatials.push({
          qNum,
          q,
          x: headerPt[0],
          y: headerPt[1],
          column,
          colBounds,
          startY: headerPt[1],
          endY: viewport.height,
          promptBottomY: headerPt[1] + 12,
          optionsMinY: viewport.height
        });
      }
    }

    // Determine endY for each question: strictly ends before the next question in the SAME column
    for (const colType of ['left', 'right'] as const) {
      const colQs = questionSpatials.filter((s) => s.column === colType).sort((a, b) => a.startY - b.startY);
      for (let i = 0; i < colQs.length; i++) {
        const current = colQs[i];
        const next = colQs[i + 1];
        if (next) {
          current.endY = next.startY - 2;
        } else {
          // Last question in this column
          current.endY = colType === 'right' ? answerKeyBoundaryY - 6 : viewport.height - 15;
        }
      }
    }

    // 4. Collect graphic objects on this page (raster & vector)
    const pageGraphicObjects = await collectPageGraphicObjects(page, viewport);

    let pageCanvas: any = null;

    // 5. Process each question strictly within its column and spatial block
    for (const spatial of questionSpatials) {
      const { q, qNum, colBounds, startY, endY } = spatial;
      console.log(`[SPATIAL EVAL] Q#${qNum} | startY: ${startY} | endY: ${endY} | col bounds:`, colBounds);

      // Filter text items strictly within this question's column and [startY, endY]
      const questionItems = items.filter((it) => {
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return (
          pt[0] >= colBounds.minX &&
          pt[0] <= colBounds.maxX &&
          pt[1] >= startY - 2 &&
          pt[1] <= endY + 2
        );
      });

      // Locate where MCQ options start in this question's block using Option A marker (a., (a), etc.)
      let optionsMinY = endY;
      const MCQ_OPTION_A_PATTERN = /(?:^|\s)(?:a\b|a\.|\(a\))\s*/;
      for (const it of questionItems) {
        if (it.str && MCQ_OPTION_A_PATTERN.test(it.str)) {
          const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
          if (pt[1] > startY + 10 && pt[1] < optionsMinY) {
            optionsMinY = pt[1];
          }
        }
      }
      spatial.optionsMinY = optionsMinY;

      // Locate bottom of prompt (only text belonging to the main question instruction/number, not table headers)
      const promptItems = questionItems.filter((it) => {
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return pt[1] >= startY - 2 && pt[1] <= startY + 16;
      });
      let promptBottomY = startY + 12;
      for (const it of promptItems) {
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        if (pt[1] > promptBottomY) promptBottomY = pt[1];
      }
      spatial.promptBottomY = promptBottomY;

      // Check whether this question is a Match-the-Column table question or Diagram question
      const isMatchTable = isMatchTheColumnQuestion(q.text);
      const isDiagramQuestion = questionContainsFigure(q.text);

      if (qNum === 23) {
        console.log(`[DEBUG Q23 CONFIG] text: "${q.text}" | isMatchTable: ${isMatchTable} | isDiagramQuestion: ${isDiagramQuestion}`);
      }

      // Normal text questions (like Q8) without matching tables or diagrams must NEVER get images
      if (!isMatchTable && !isDiagramQuestion) {
        q.questionImages = undefined;
        continue;
      }

      // ========================================================
      // CASE 1: MATCH-THE-COLUMN TABLE QUESTION (e.g. Q4, Q6, Q18, Q19)
      // ========================================================
      if (isMatchTable) {
        // Collect table text items strictly between prompt and options inside this question's column
        const numPattern = new RegExp(`^\\s*${qNum}\\.\\s*`);
        const tableTextItems = questionItems.filter((it) => {
          if (numPattern.test(it.str || '') && q.text.toLowerCase().includes(it.str.toLowerCase())) {
            return false;
          }
          const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
          return (
            pt[0] >= colBounds.minX &&
            pt[0] <= colBounds.maxX &&
            pt[1] > promptBottomY + 2 &&
            pt[1] < optionsMinY - 4
          );
        });

        if (tableTextItems.length >= 4) {
          // Reconstruct structured HTML table
          const structuredTable = reconstructStructuredTable(tableTextItems, scale, viewport);

          // Calculate tight table bounding box using text items
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;

          for (const it of tableTextItems) {
            const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
            const itW = (it.width || 20) * scale;
            const itH = (it.height || 10) * scale;
            minX = Math.min(minX, pt[0]);
            maxX = Math.max(maxX, pt[0] + itW);
            minY = Math.min(minY, pt[1] - itH);
            maxY = Math.max(maxY, pt[1] + 4);
          }

          // Expand with any table ruling lines or box borders strictly inside this question's column & region
          for (const obj of pageGraphicObjects) {
            if (
              obj.bbox.minX >= colBounds.minX &&
              obj.bbox.maxX <= colBounds.maxX &&
              obj.bbox.minY >= promptBottomY &&
              obj.bbox.maxY <= optionsMinY + 4
            ) {
              minX = Math.min(minX, obj.bbox.minX);
              maxX = Math.max(maxX, obj.bbox.maxX);
              minY = Math.min(minY, obj.bbox.minY);
              maxY = Math.max(maxY, obj.bbox.maxY);
            }
          }

          // Tight padding around table, strictly clamped inside this question's column
          const padX = 6;
          const padY = 4;
          const cropStartX = Math.max(colBounds.minX + 2, Math.round(minX - padX));
          const cropStartY = Math.max(promptBottomY + 2, Math.round(minY - padY));
          const cropEndX = Math.min(colBounds.maxX - 2, Math.round(maxX + padX));
          const cropEndY = Math.min(optionsMinY - 2, Math.round(maxY + padY));

          const w = cropEndX - cropStartX;
          const h = cropEndY - cropStartY;

          if (w >= 40 && h >= 20) {
            const cropBox = { minX: cropStartX, minY: cropStartY, maxX: cropEndX, maxY: cropEndY, width: w, height: h };
            const textInsideCrop = questionItems
              .map((it) => {
                const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
                return { str: it.str.trim(), x: pt[0], y: pt[1] };
              })
              .filter((it) => it.x >= cropStartX && it.x <= cropEndX && it.y >= cropStartY && it.y <= cropEndY);

            const val = validateAndScoreVisualCrop(cropBox, textInsideCrop, false, qNum, sourceFileName);

            if (!val.isValid) {
              console.log(`[REJECT Q#${qNum}]`, val.rejectionReason, 'Conf:', val.confidence);
            }

            if (val.isValid) {
              if (!pageCanvas) {
                pageCanvas = await createUniversalCanvas(viewport.width, viewport.height);
                pageCanvas.ctx.fillStyle = '#ffffff';
                pageCanvas.ctx.fillRect(0, 0, viewport.width, viewport.height);
                await page.render({ canvasContext: pageCanvas.ctx, viewport }).promise;
              }

              const rawCropCanvas = await createUniversalCanvas(w, h);
              rawCropCanvas.ctx.fillStyle = '#ffffff';
              rawCropCanvas.ctx.fillRect(0, 0, w, h);
              rawCropCanvas.ctx.drawImage(pageCanvas.canvas, cropStartX, cropStartY, w, h, 0, 0, w, h);

              const trimmed = await trimCanvasWhitespace(rawCropCanvas.canvas, 6, 240);
              const figureImage: QuestionImage = {
                id: `fig_${q.id}_table`,
                storagePath: '',
                pageNumber: pageNum,
                mimeType: 'image/png',
                width: trimmed ? trimmed.width : w,
                height: trimmed ? trimmed.height : h,
                altText: `Table for Question ${qNum} (${sourceFileName})`,
                dataUrl: trimmed ? trimmed.dataUrl : rawCropCanvas.toDataURL('image/png'),
                regionType: 'table',
                structuredTable: structuredTable || undefined
              };

              q.questionImages = [figureImage];
              q.visual = {
                hasVisual: true,
                kind: 'table',
                mimeType: 'image/png',
                dataUrl: figureImage.dataUrl,
                width: figureImage.width,
                height: figureImage.height,
                pageNumber: pageNum
              };
              figuresDetectedCount++;

              // Clean question.text: keep ONLY the prompt/instruction without duplicate flattened table text
              q.text = extractCleanPromptOnly(q.text);
            } else {
              q.questionImages = undefined;
              q.visual = { hasVisual: false };
            }
          }
        }
        continue;
      }

      // ========================================================
      // CASE 2: DIAGRAM / GRAPH / WAVEFORM QUESTION (e.g. Q23 Standard ECG / Placentation Diagrams)
      // ========================================================
      if (isDiagramQuestion) {
        // Exclude List-I text & List-II header from diagram crop
        let maxListTextY = promptBottomY;
        for (const it of questionItems) {
          const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
          if (/\b(?:List|Column)\s*[-–\s]*[I1II2]+/i.test(it.str || '') || /Diagrammatic representation/i.test(it.str || '')) {
            if (pt[1] > maxListTextY) maxListTextY = pt[1];
          }
        }

        const overlappingGraphics = pageGraphicObjects.filter(
          (obj) =>
            obj.bbox.minX >= colBounds.minX &&
            obj.bbox.maxX <= colBounds.maxX &&
            obj.bbox.minY >= maxListTextY &&
            obj.bbox.maxY <= optionsMinY + 4
        );

        // Filter out table borders, horizontal separator lines, full-box frames from graphics
        const colWidth = colBounds.maxX - colBounds.minX;
        const regionHeight = optionsMinY - maxListTextY;

        const diagramGraphics = overlappingGraphics.filter((obj) => {
          if (obj.type === 'vector') {
            // Exclude horizontal lines spanning a large portion of the column width
            if (obj.bbox.width > colWidth * 0.70) return false;
            // Exclude vertical separator lines that span most of the question height
            if (obj.bbox.height > regionHeight * 0.70 && obj.bbox.width < 5) return false;
            // Exclude boundary/border boxes that enclose the entire column or region
            if (obj.bbox.width > colWidth * 0.90 || obj.bbox.height > regionHeight * 0.90) return false;
          }
          return true;
        });

        if (qNum === 23) {
          console.log(`[DEBUG Q23 GRAPHICS] overlappingGraphics: ${overlappingGraphics.length} | diagramGraphics: ${diagramGraphics.length} | maxListTextY: ${maxListTextY} | optionsMinY: ${optionsMinY}`);
        }

        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;

        if (diagramGraphics.length > 0) {
          for (const g of diagramGraphics) {
            minX = Math.min(minX, g.bbox.minX);
            maxX = Math.max(maxX, g.bbox.maxX);
            minY = Math.min(minY, g.bbox.minY);
            maxY = Math.max(maxY, g.bbox.maxY);
          }
        } else {
          // Fallback: ONLY do fallback if question explicitly contains diagrammatic lists/tables or matching words
          const hasExplicitDiagramInText =
            /\[DIAGRAM/i.test(q.text) ||
            /diagram/i.test(q.text) ||
            /figure/i.test(q.text) ||
            /graph/i.test(q.text) ||
            /ecg/i.test(q.text) ||
            /placentation/i.test(q.text) ||
            /List/i.test(q.text);
          if (hasExplicitDiagramInText) {
            minX = colBounds.minX + 10;
            maxX = colBounds.maxX - 10;
            minY = maxListTextY + 2;
            maxY = optionsMinY - 4;
          } else {
            // Text-only question with no graphics or explicit diagram markers
            console.log(
              `[VisualExtraction] PDF: "${sourceFileName}" | Q#${qNum} | BBox: N/A | Confidence: 0% | Valid: false | Rejection: No diagram graphics and no explicit diagram markers in question text`
            );
            q.questionImages = undefined;
            q.visual = { hasVisual: false };
            continue;
          }
        }

        const padX = 8;
        const padY = 6;
        const cropStartX = Math.max(colBounds.minX + 2, Math.round(minX - padX));
        const cropStartY = Math.max(maxListTextY + 2, Math.round(minY - padY));
        const cropEndX = Math.min(colBounds.maxX - 2, Math.round(maxX + padX));
        const cropEndY = Math.min(optionsMinY - 2, Math.round(maxY + padY));

        const w = cropEndX - cropStartX;
        const h = cropEndY - cropStartY;

        if (qNum === 23) {
          console.log(`[SPATIAL DETAIL Q23] maxListTextY: ${maxListTextY} | optionsMinY: ${optionsMinY} | w: ${w} | h: ${h} | colBounds:`, colBounds);
        }

        if (w >= 30 && h >= 20) {
          const cropBox = { minX: cropStartX, minY: cropStartY, maxX: cropEndX, maxY: cropEndY, width: w, height: h };
          const textInsideCrop = questionItems
            .map((it) => {
              const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
              return { str: it.str.trim(), x: pt[0], y: pt[1] };
            })
            .filter((it) => it.x >= cropStartX && it.x <= cropEndX && it.y >= cropStartY && it.y <= cropEndY);

          const val = validateAndScoreVisualCrop(cropBox, textInsideCrop, true, qNum, sourceFileName);

          if (!val.isValid) {
            console.log(`[REJECT DIAGRAM Q#${qNum}]`, val.rejectionReason, 'Conf:', val.confidence);
          }

          if (val.isValid) {
            if (!pageCanvas) {
              pageCanvas = await createUniversalCanvas(viewport.width, viewport.height);
              pageCanvas.ctx.fillStyle = '#ffffff';
              pageCanvas.ctx.fillRect(0, 0, viewport.width, viewport.height);
              await page.render({ canvasContext: pageCanvas.ctx, viewport }).promise;
            }

            const rawCropCanvas = await createUniversalCanvas(w, h);
            rawCropCanvas.ctx.fillStyle = '#ffffff';
            rawCropCanvas.ctx.fillRect(0, 0, w, h);
            rawCropCanvas.ctx.drawImage(pageCanvas.canvas, cropStartX, cropStartY, w, h, 0, 0, w, h);

            const trimmed = await trimCanvasWhitespace(rawCropCanvas.canvas, 6, 240);
            const figureImage: QuestionImage = {
              id: `fig_${q.id}_diagram`,
              storagePath: '',
              pageNumber: pageNum,
              mimeType: 'image/png',
              width: trimmed ? trimmed.width : w,
              height: trimmed ? trimmed.height : h,
              altText: `Figure for Question ${qNum} (${sourceFileName})`,
              dataUrl: trimmed ? trimmed.dataUrl : rawCropCanvas.toDataURL('image/png'),
              regionType: 'diagram'
            };

            q.questionImages = [figureImage];
            q.visual = {
              hasVisual: true,
              kind: 'diagram',
              mimeType: 'image/png',
              dataUrl: figureImage.dataUrl,
              width: figureImage.width,
              height: figureImage.height,
              pageNumber: pageNum
            };
            figuresDetectedCount++;
          } else {
            q.questionImages = undefined;
            q.visual = { hasVisual: false };
          }
        } else {
          console.log(`[VisualExtraction] PDF: "${sourceFileName}" | Q#${qNum} | BBox: [x:${cropStartX}, y:${cropStartY}, w:${w}, h:${h}] | Confidence: 0% | Valid: false | Rejection: Crop region height/width insufficient`);
          q.questionImages = undefined;
          q.visual = { hasVisual: false };
        }
      }
    }
  }

  return { updatedQuestions, figuresDetectedCount };
}
