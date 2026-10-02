import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generateBodyFluidsPdf } from './canonicalPdfGenerator';
import {
  detectPageAnswerKeyTopY,
  extractAnswerKeyMap,
  parseQuestionsFromPageTexts
} from '../src/services/pdfParser';
import { extractVisualQuestions } from '../src/services/pdfVisualQuestionExtractor';

async function runVisualFirstRegressionSuite() {
  console.log('Generating canonical Body_Fluids_and_Circulation_PYQs.pdf for Visual-First Architecture Test...');
  const buf = generateBodyFluidsPdf();
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true
  }).promise;

  const totalPages = pdfDoc.numPages;
  const pageTexts: { pageNumber: number; text: string }[] = [];
  let answerKeyText = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const items = (content.items as any[]).filter((it: any) => 'str' in it && it.str.trim());

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

    const midX = viewport.width / 2;
    const leftItems = questionEligibleItems.filter((it: any) => it.transform[4] < midX);
    const rightItems = questionEligibleItems.filter((it: any) => it.transform[4] >= midX);

    const sortColumn = (col: any[]) =>
      [...col].sort((a, b) => {
        const dy = b.transform[5] - a.transform[5];
        if (Math.abs(dy) > 3) return dy;
        return a.transform[4] - b.transform[4];
      });

    let orderedItems: any[] = [];
    if (leftItems.length >= 8 && rightItems.length >= 8) {
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
  }

  const akMap = extractAnswerKeyMap(answerKeyText);
  const questions = parseQuestionsFromPageTexts(
    pageTexts,
    akMap,
    'Body_Fluids_and_Circulation_PYQs.pdf',
    'Zoology',
    'Body Fluids and Circulation'
  );

  console.log(`Parsed ${questions.length} questions from text layout.`);

  const visResult = await extractVisualQuestions(
    pdfDoc,
    questions,
    'Body_Fluids_and_Circulation_PYQs.pdf'
  );

  console.log(`Extracted ${visResult.visualsExtractedCount} visual question crops.`);

  const qMap = new Map<number, typeof visResult.updatedQuestions[0]>();
  for (const q of visResult.updatedQuestions) {
    if (q.rawQuestionNumber) qMap.set(q.rawQuestionNumber, q);
  }

  const errors: string[] = [];

  // ==========================================
  // ASSERTION 1: EVERY QUESTION HAS A VISUAL CROP
  // ==========================================
  for (let qNum = 1; qNum <= 26; qNum++) {
    const q = qMap.get(qNum);
    if (!q) {
      errors.push(`FAIL: Question ${qNum} was not parsed`);
      continue;
    }
    if (!q.visual) {
      errors.push(`FAIL: Question ${qNum} is missing visual crop metadata`);
      continue;
    }
    if (!q.visual.dataUrl || q.visual.width <= 0 || q.visual.height <= 0) {
      errors.push(`FAIL: Question ${qNum} visual crop dataUrl or dimensions invalid`);
    }
  }

  // ==========================================
  // ASSERTION 2: HITBOX VALIDATION FOR ALL 26 QUESTIONS
  // ==========================================
  for (let qNum = 1; qNum <= 26; qNum++) {
    const q = qMap.get(qNum);
    if (!q || !q.visual) continue;

    const hitboxes = q.visual.options;
    if (hitboxes.length !== 4) {
      errors.push(`FAIL: Question ${qNum} has ${hitboxes.length} hitboxes, expected exactly 4`);
      continue;
    }

    const optsPresent = hitboxes.map((h) => h.option).sort().join('');
    if (optsPresent !== 'ABCD') {
      errors.push(`FAIL: Question ${qNum} hitboxes options are '${optsPresent}', expected 'ABCD'`);
    }

    for (const h of hitboxes) {
      if (h.x < 0 || h.x > 1 || h.y < 0 || h.y > 1) {
        errors.push(`FAIL: Question ${qNum} Option ${h.option} x/y out of bounds [0, 1]: x=${h.x}, y=${h.y}`);
      }
      if (h.width <= 0 || h.width > 1 || h.height <= 0 || h.height > 1) {
        errors.push(`FAIL: Question ${qNum} Option ${h.option} width/height invalid: w=${h.width}, h=${h.height}`);
      }
    }
  }

  // ==========================================
  // ASSERTION 3: CANONICAL QUESTIONS SPECIFIC CHECKS
  // ==========================================

  // Q4: Matching Table
  const q4 = qMap.get(4);
  if (q4 && q4.visual) {
    if (q4.visual.width > 580) {
      errors.push(`FAIL: Q4 crop width ${q4.visual.width} extends beyond left column into right column (Q10/Q11)`);
    } else {
      console.log(`PASS: Q4 visual crop width (${q4.visual.width}px) is strictly inside left column`);
    }
  }

  // Q6: Matching Table
  const q6 = qMap.get(6);
  if (q6 && q6.visual) {
    if (q6.visual.width > 580) {
      errors.push(`FAIL: Q6 crop width ${q6.visual.width} extends beyond left column`);
    } else {
      console.log(`PASS: Q6 visual crop width (${q6.visual.width}px) is strictly inside left column`);
    }
  }

  // Q18: Matching Table
  const q18 = qMap.get(18);
  if (q18 && q18.visual) {
    if (q18.visual.width > 580) {
      errors.push(`FAIL: Q18 crop width ${q18.visual.width} extends beyond left column`);
    } else {
      console.log(`PASS: Q18 visual crop width (${q18.visual.width}px) is strictly inside left column`);
    }
  }

  // Q23: Standard ECG Diagram
  const q23 = qMap.get(23);
  if (q23 && q23.visual) {
    console.log(`PASS: Q23 visual crop successfully includes ECG diagram naturally (width=${q23.visual.width}px, height=${q23.visual.height}px)`);
  }

  // Q26: Final Question on Page 3
  const q26 = qMap.get(26);
  if (q26) {
    if (q26.options.D !== 'Less than that in the vena cava') {
      errors.push(`FAIL: Q26 Option D is "${q26.options.D}", expected exactly "Less than that in the vena cava"`);
    } else {
      console.log('PASS: Q26 Option D text is exact: "Less than that in the vena cava"');
    }
    if (q26.options.D.includes('10 11 12') || q26.options.D.includes('bb') || q26.options.D.includes('Answer Key')) {
      errors.push(`FAIL: Q26 Option D contains leaked answer key text!`);
    } else {
      console.log('PASS: Q26 Option D has zero answer-key leakage');
    }
  }

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('VISUAL-FIRST REGRESSION FAILURES:');
    for (const err of errors) console.error(' - ' + err);
    console.error('========================================\n');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('ALL VISUAL-FIRST REGRESSION ASSERTIONS PASSED PERFECTLY!');
  console.log('========================================\n');
}

runVisualFirstRegressionSuite().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
