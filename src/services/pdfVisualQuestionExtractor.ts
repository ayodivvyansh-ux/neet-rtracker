/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedQuestionDraft, QuestionOptionHitbox, QuestionVisual } from '../types';
import { detectPageAnswerKeyTopY } from './pdfParser';
import { createUniversalCanvas } from './pdfFigureExtractor';

/**
 * Detects printed answer option hitboxes (A, B, C, D) within a question's PDF crop.
 * Resolves statement labels vs MCQ options (Bug 1) and prevents C/D hitbox overlaps (Bug 2).
 */
export function detectOptionHitboxes(
  questionItems: any[],
  cropBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number },
  viewport: any,
  scale: number
): QuestionOptionHitbox[] {
  if (cropBox.width <= 0 || cropBox.height <= 0) return [];

  // Convert text items to crop coordinates
  const items = questionItems
    .map((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      const itW = (it.width || 20) * scale;
      const itH = (it.height || 10) * scale;
      return {
        str: it.str.trim(),
        x: pt[0],
        y: pt[1],
        w: itW,
        h: itH,
        minX: pt[0],
        maxX: pt[0] + itW,
        minY: pt[1] - itH,
        maxY: pt[1] + 2
      };
    })
    .filter((it) => it.str.length > 0);

  // Group candidates for options A, B, C, D
  // Lowercase/parenthesized pattern (high priority): e.g. "a.", "(a)", "a )"
  const LOWER_PATTERNS = {
    A: /(?:^|\s)(?:a\b|a\.|\(a\))\s*/,
    B: /(?:^|\s)(?:b\b|b\.|\(b\))\s*/,
    C: /(?:^|\s)(?:c\b|c\.|\(c\))\s*/,
    D: /(?:^|\s)(?:d\b|d\.|\(d\))\s*/
  };

  // Uppercase pattern (fallback): e.g. "A.", "(A)"
  const UPPER_PATTERNS = {
    A: /(?:^|\s)(?:A\b|A\.|\(A\))\s*/,
    B: /(?:^|\s)(?:B\b|B\.|\(B\))\s*/,
    C: /(?:^|\s)(?:C\b|C\.|\(C\))\s*/,
    D: /(?:^|\s)(?:D\b|D\.|\(D\))\s*/
  };

  // Numeric pattern (fallback): e.g. "(1)", "(2)", "(3)", "(4)"
  const NUMERIC_PATTERNS = {
    A: /(?:^|\s)(?:1\.|\(1\))\s*/,
    B: /(?:^|\s)(?:2\.|\(2\))\s*/,
    C: /(?:^|\s)(?:3\.|\(3\))\s*/,
    D: /(?:^|\s)(?:4\.|\(4\))\s*/
  };

  let selectedMarkers: { opt: 'A' | 'B' | 'C' | 'D'; item: typeof items[0] }[] = [];

  // Try lowercase set first
  const lowerMarkers: { opt: 'A' | 'B' | 'C' | 'D'; item: typeof items[0] }[] = [];
  for (const optKey of ['A', 'B', 'C', 'D'] as const) {
    const pat = LOWER_PATTERNS[optKey];
    const matching = items.filter((it) => pat.test(it.str));
    if (matching.length > 0) {
      // Pick the last matching item (belonging to the final MCQ option block)
      lowerMarkers.push({ opt: optKey, item: matching[matching.length - 1] });
    }
  }

  if (lowerMarkers.length === 4) {
    selectedMarkers = lowerMarkers;
  } else {
    // Try numeric set
    const numMarkers: { opt: 'A' | 'B' | 'C' | 'D'; item: typeof items[0] }[] = [];
    for (const optKey of ['A', 'B', 'C', 'D'] as const) {
      const pat = NUMERIC_PATTERNS[optKey];
      const matching = items.filter((it) => pat.test(it.str));
      if (matching.length > 0) {
        numMarkers.push({ opt: optKey, item: matching[matching.length - 1] });
      }
    }

    if (numMarkers.length === 4) {
      selectedMarkers = numMarkers;
    } else {
      // Fallback to uppercase set (pick the LAST set if statement labels appeared earlier)
      const upperMarkers: { opt: 'A' | 'B' | 'C' | 'D'; item: typeof items[0] }[] = [];
      for (const optKey of ['A', 'B', 'C', 'D'] as const) {
        const pat = UPPER_PATTERNS[optKey];
        const matching = items.filter((it) => pat.test(it.str));
        if (matching.length > 0) {
          upperMarkers.push({ opt: optKey, item: matching[matching.length - 1] });
        }
      }
      if (upperMarkers.length === 4) {
        selectedMarkers = upperMarkers;
      }
    }
  }

  if (selectedMarkers.length !== 4) return [];

  // Map markers to option keys
  const markerA = selectedMarkers.find((m) => m.opt === 'A')!;
  const markerB = selectedMarkers.find((m) => m.opt === 'B')!;
  const markerC = selectedMarkers.find((m) => m.opt === 'C')!;
  const markerD = selectedMarkers.find((m) => m.opt === 'D')!;

  // Detect Layout Type: Single-column vertical vs 2x2 Grid
  // Check if A and B share approximately the same Y level (within 12px)
  const is2x2Grid = Math.abs(markerA.item.minY - markerB.item.minY) <= 12 && markerB.item.minX > markerA.item.minX + 30;

  const hitboxes: QuestionOptionHitbox[] = [];

  if (is2x2Grid) {
    // 2x2 Grid Layout
    // Row 1: A (left) and B (right)
    // Row 2: C (left) and D (right)
    const xSplit1 = (markerA.item.minX + markerB.item.minX) / 2;
    const xSplit2 = (markerC.item.minX + markerD.item.minX) / 2;
    const yRow2 = Math.min(markerC.item.minY, markerD.item.minY);

    // Option A (Row 1, Left)
    const itemsA = items.filter((it) => it.minY < yRow2 - 4 && it.minX < xSplit1 - 4);
    const minXA = Math.min(markerA.item.minX - 4, ...itemsA.map((it) => it.minX));
    const maxXA = Math.min(xSplit1 - 6, Math.max(markerA.item.maxX + 4, ...itemsA.map((it) => it.maxX)));
    const minYA = Math.min(markerA.item.minY - 3, ...itemsA.map((it) => it.minY));
    const maxYA = Math.min(yRow2 - 4, Math.max(markerA.item.maxY + 3, ...itemsA.map((it) => it.maxY)));

    // Option B (Row 1, Right)
    const itemsB = items.filter((it) => it.minY < yRow2 - 4 && it.minX >= xSplit1 - 4);
    const minXB = Math.max(xSplit1 + 4, Math.min(markerB.item.minX - 4, ...itemsB.map((it) => it.minX)));
    const maxXB = Math.max(markerB.item.maxX + 4, ...itemsB.map((it) => it.maxX));
    const minYB = Math.min(markerB.item.minY - 3, ...itemsB.map((it) => it.minY));
    const maxYB = Math.min(yRow2 - 4, Math.max(markerB.item.maxY + 3, ...itemsB.map((it) => it.maxY)));

    // Option C (Row 2, Left)
    const itemsC = items.filter((it) => it.minY >= yRow2 - 4 && it.minX < xSplit2 - 4);
    const minXC = Math.min(markerC.item.minX - 4, ...itemsC.map((it) => it.minX));
    const maxXC = Math.min(xSplit2 - 6, Math.max(markerC.item.maxX + 4, ...itemsC.map((it) => it.maxX)));
    const minYC = Math.min(markerC.item.minY - 3, ...itemsC.map((it) => it.minY));
    const maxYC = Math.max(cropBox.maxY - 2, Math.max(markerC.item.maxY + 3, ...itemsC.map((it) => it.maxY)));

    // Option D (Row 2, Right)
    const itemsD = items.filter((it) => it.minY >= yRow2 - 4 && it.minX >= xSplit2 - 4);
    const minXD = Math.max(xSplit2 + 4, Math.min(markerD.item.minX - 4, ...itemsD.map((it) => it.minX)));
    const maxXD = Math.max(markerD.item.maxX + 4, ...itemsD.map((it) => it.maxX));
    const minYD = Math.min(markerD.item.minY - 3, ...itemsD.map((it) => it.minY));
    const maxYD = Math.max(cropBox.maxY - 2, Math.max(markerD.item.maxY + 3, ...itemsD.map((it) => it.maxY)));

    const rawBoxes = [
      { opt: 'A' as const, minX: minXA, maxX: maxXA, minY: minYA, maxY: maxYA },
      { opt: 'B' as const, minX: minXB, maxX: maxXB, minY: minYB, maxY: maxYB },
      { opt: 'C' as const, minX: minXC, maxX: maxXC, minY: minYC, maxY: maxYC },
      { opt: 'D' as const, minX: minXD, maxX: maxXD, minY: minYD, maxY: maxYD }
    ];

    for (const b of rawBoxes) {
      const normX = Math.max(0, Math.min(0.95, (b.minX - cropBox.minX) / cropBox.width));
      const normY = Math.max(0, Math.min(0.95, (b.minY - cropBox.minY) / cropBox.height));
      const normW = Math.max(0.04, Math.min(1 - normX, (b.maxX - b.minX) / cropBox.width));
      const normH = Math.max(0.025, Math.min(1 - normY, (b.maxY - b.minY) / cropBox.height));

      hitboxes.push({
        option: b.opt,
        x: Number(normX.toFixed(4)),
        y: Number(normY.toFixed(4)),
        width: Number(normW.toFixed(4)),
        height: Number(normH.toFixed(4))
      });
    }
  } else {
    // 1x4 Vertical Layout
    const sorted = [markerA, markerB, markerC, markerD].sort((a, b) => a.item.minY - b.item.minY);

    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      const optItems = items.filter(
        (it) => it.minY >= curr.item.minY - 4 && (next ? it.minY < next.item.minY - 3 : it.maxY <= cropBox.maxY + 4)
      );

      const minX = Math.min(curr.item.minX - 4, ...optItems.map((it) => it.minX));
      const maxX = Math.max(curr.item.maxX + 4, ...optItems.map((it) => it.maxX), minX + 60);
      const minY = Math.min(curr.item.minY - 3, ...optItems.map((it) => it.minY));
      const maxY = next ? next.item.minY - 3 : Math.max(curr.item.maxY + 3, ...optItems.map((it) => it.maxY));

      const normX = Math.max(0, Math.min(0.95, (minX - cropBox.minX) / cropBox.width));
      const normY = Math.max(0, Math.min(0.95, (minY - cropBox.minY) / cropBox.height));
      const normW = Math.max(0.04, Math.min(1 - normX, (maxX - minX) / cropBox.width));
      const normH = Math.max(0.025, Math.min(1 - normY, (maxY - minY) / cropBox.height));

      hitboxes.push({
        option: curr.opt,
        x: Number(normX.toFixed(4)),
        y: Number(normY.toFixed(4)),
        width: Number(normW.toFixed(4)),
        height: Number(normH.toFixed(4))
      });
    }
  }

  // Ensure strict option key ordering: A, B, C, D
  hitboxes.sort((a, b) => a.option.localeCompare(b.option));

  if (hitboxes.length !== 4) return [];

  return hitboxes;
}

/**
 * Master Visual Question Crop & Option Hitbox Extraction Pipeline.
 * Extracts every PDF question into its exact visual crop and attaches normalized A/B/C/D hitboxes.
 */
export async function extractVisualQuestions(
  pdfDoc: any,
  questions: ExtractedQuestionDraft[],
  sourceFileName: string,
  userId?: string,
  onProgress?: (status: string) => void
): Promise<{
  updatedQuestions: ExtractedQuestionDraft[];
  visualsExtractedCount: number;
}> {
  const updatedQuestions = [...questions];
  let visualsExtractedCount = 0;
  const totalPages = pdfDoc.numPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageQuestions = updatedQuestions.filter((q) => q.pageNumber === pageNum);
    if (pageQuestions.length === 0) continue;

    const page = await pdfDoc.getPage(pageNum);
    const scale = 2.0; // 2x high-resolution rendering
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();
    const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

    // 1. Answer-Key Boundary Protection (Bug 4)
    const akTopY = detectPageAnswerKeyTopY(items, viewport);

    // 2. Column Segmentation (Bug 5)
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

    // 3. Locate each question's header position
    interface QuestionSpatial {
      qNum: number;
      q: ExtractedQuestionDraft;
      x: number;
      y: number;
      column: 'left' | 'right';
      colBounds: { minX: number; maxX: number };
      startY: number;
      endY: number;
      headerItem: any;
      headerPt: [number, number];
    }

    const questionSpatials: QuestionSpatial[] = [];

    for (const q of pageQuestions) {
      const qNum = q.rawQuestionNumber;
      if (!qNum) continue;

      const numPat = new RegExp(`(?:^|\\s)${qNum}\\.\\s*`);
      const promptSnippet = q.text.replace(/^[0-9\.\:\-\s]+/, '').trim().toLowerCase();
      const promptWords = promptSnippet.split(/\s+/).filter((w) => w.length >= 4).slice(0, 3);

      const candidateItems = items.filter((it) => {
        if (!it.str || !numPat.test(it.str)) return false;
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return pt[1] < akTopY - 10;
      });

      let headerItem: any = null;
      let headerPt: [number, number] = [0, 0];

      if (candidateItems.length === 1) {
        headerItem = candidateItems[0];
        headerPt = viewport.convertToViewportPoint(headerItem.transform[4], headerItem.transform[5]);
      } else if (candidateItems.length > 1) {
        for (const candidate of candidateItems) {
          const candidateText = candidate.str.toLowerCase();
          if (promptWords.some((pw) => candidateText.includes(pw))) {
            headerItem = candidate;
            headerPt = viewport.convertToViewportPoint(candidate.transform[4], candidate.transform[5]);
            break;
          }
        }
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
          startY: Math.max(0, headerPt[1] - 4),
          endY: viewport.height,
          headerItem,
          headerPt
        });
      }
    }

    // Set endY: strictly ends before the next question in the SAME column or answerKeyTopY (Bug 4 & 5)
    for (const colType of ['left', 'right'] as const) {
      const colQs = questionSpatials.filter((s) => s.column === colType).sort((a, b) => a.startY - b.startY);
      for (let i = 0; i < colQs.length; i++) {
        const current = colQs[i];
        const next = colQs[i + 1];
        if (next) {
          current.endY = next.startY - 2;
        } else {
          current.endY = colType === 'right' || !isTwoColumnPage ? Math.min(akTopY - 4, viewport.height - 10) : viewport.height - 10;
        }
      }
    }

    // Lazy render page canvas
    let pageCanvas: any = null;

    // 4. Crop each question and detect option hitboxes
    for (const spatial of questionSpatials) {
      const { q, qNum, colBounds, startY, endY, headerItem, headerPt } = spatial;

      const questionItems = items.filter((it) => {
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        return (
          pt[0] >= colBounds.minX &&
          pt[0] <= colBounds.maxX &&
          pt[1] >= startY &&
          pt[1] <= endY
        );
      });

      if (questionItems.length === 0) continue;

      const itemPoints = questionItems.map((it) => {
        const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        const itW = (it.width || 20) * scale;
        return { minX: pt[0], maxX: pt[0] + itW, minY: pt[1] - 14, maxY: pt[1] + 4 };
      });

      const rawMinX = Math.min(...itemPoints.map((p) => p.minX));
      const rawMaxX = Math.max(...itemPoints.map((p) => p.maxX));
      const rawMaxY = Math.max(...itemPoints.map((p) => p.maxY));

      const cropMinX = Math.max(colBounds.minX + 2, Math.round(rawMinX - 8));
      const cropMaxX = Math.min(colBounds.maxX - 2, Math.round(rawMaxX + 8));
      const cropMinY = Math.max(0, Math.round(startY));
      // Tightly bounded by question items + padding, never exceeding endY or akTopY (Bug 4)
      const cropMaxY = Math.min(endY, Math.round(rawMaxY + 12));

      const cropW = cropMaxX - cropMinX;
      const cropH = cropMaxY - cropMinY;

      if (cropW >= 40 && cropH >= 20) {
        if (!pageCanvas) {
          pageCanvas = await createUniversalCanvas(viewport.width, viewport.height);
          pageCanvas.ctx.fillStyle = '#ffffff';
          pageCanvas.ctx.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: pageCanvas.ctx, viewport }).promise;
        }

        // MASK OUT PRINTED SOURCE QUESTION NUMBER (Bug 3)
        if (headerItem && headerPt) {
          const match = /^\s*(\d{1,3})\.\s*/.exec(headerItem.str.trim());
          if (match) {
            const qNumGlyph = match[0];
            const frac = qNumGlyph.length / headerItem.str.trim().length;
            const itemWidth = (headerItem.width || 20) * scale;
            const glyphWidth = Math.max(16 * scale, itemWidth * frac);
            const itemHeight = (headerItem.height || 12) * scale;

            const maskX = Math.max(0, headerPt[0] - 3);
            const maskY = Math.max(0, headerPt[1] - itemHeight - 3);
            const maskW = glyphWidth + 4;
            const maskH = itemHeight + 6;

            pageCanvas.ctx.fillStyle = '#ffffff';
            pageCanvas.ctx.fillRect(maskX, maskY, maskW, maskH);
          }
        }

        const cropCanvas = await createUniversalCanvas(cropW, cropH);
        cropCanvas.ctx.fillStyle = '#ffffff';
        cropCanvas.ctx.fillRect(0, 0, cropW, cropH);
        cropCanvas.ctx.drawImage(pageCanvas.canvas, cropMinX, cropMinY, cropW, cropH, 0, 0, cropW, cropH);

        const cropBox = {
          minX: cropMinX,
          minY: cropMinY,
          maxX: cropMaxX,
          maxY: cropMaxY,
          width: cropW,
          height: cropH
        };

        const hitboxes = detectOptionHitboxes(questionItems, cropBox, viewport, scale);

        const chapterSlug = (q.chapter || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const cleanFileName = sourceFileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const deterministicPath = `${userId || 'system'}/${q.subject}/${chapterSlug}/question-crops/${cleanFileName}/${q.id}.png`;

        const visual: QuestionVisual = {
          imagePath: deterministicPath,
          dataUrl: cropCanvas.toDataURL('image/png'),
          pageNumber: pageNum,
          width: cropW,
          height: cropH,
          options: hitboxes
        };

        q.visual = visual;
        visualsExtractedCount++;
      }
    }
  }

  return { updatedQuestions, visualsExtractedCount };
}
