import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generateBodyFluidsPdf } from './canonicalPdfGenerator';
import {
  detectPageAnswerKeyTopY,
  extractAnswerKeyMap,
  parseQuestionsFromPageTexts
} from '../src/services/pdfParser';
import { extractAndAssociateFigures } from '../src/services/pdfFigureExtractor';

async function testCanonicalRegression() {
  console.log('Generating canonical Body_Fluids_and_Circulation_PYQs.pdf...');
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

  console.log(`Parsed ${questions.length} questions.`);

  const figResult = await extractAndAssociateFigures(
    pdfDoc,
    questions,
    'Body_Fluids_and_Circulation_PYQs.pdf'
  );

  console.log(`Figures detected count: ${figResult.figuresDetectedCount}`);

  const qMap = new Map<number, typeof figResult.updatedQuestions[0]>();
  for (const q of figResult.updatedQuestions) {
    if (q.rawQuestionNumber) qMap.set(q.rawQuestionNumber, q);
  }

  const errors: string[] = [];

  // ==========================================
  // ASSERTION 1: Q8 is normal text MCQ, MUST NEVER HAVE ANY FIGURE/TABLE
  // ==========================================
  const q8 = qMap.get(8);
  if (!q8) {
    errors.push('Q8 was not parsed');
  } else {
    if (q8.questionImages && q8.questionImages.length > 0) {
      errors.push(`FAIL: Q8 has questionImages (${q8.questionImages.length} images)! Q8 must have questionImages === undefined.`);
    } else {
      console.log('PASS: Q8 is image-free (questionImages === undefined)');
    }
  }

  // ==========================================
  // ASSERTION 2: Q4 is Matching Table
  // ==========================================
  const q4 = qMap.get(4);
  if (!q4) {
    errors.push('Q4 was not parsed');
  } else {
    if (!q4.questionImages || q4.questionImages.length === 0) {
      errors.push('FAIL: Q4 missing questionImages table');
    } else {
      const img = q4.questionImages[0];
      if (img.regionType !== 'table') {
        errors.push(`FAIL: Q4 regionType is '${img.regionType}', expected 'table'`);
      }
      if (q4.text.toLowerCase().includes('column-i') || q4.text.toLowerCase().includes('eosinophils')) {
        errors.push(`FAIL: Q4 text still contains flattened table content: "${q4.text}"`);
      } else {
        console.log(`PASS: Q4 text is clean instruction prompt: "${q4.text}"`);
      }
      if (img.structuredTable) {
        console.log('PASS: Q4 structuredTable headers:', img.structuredTable.headers);
        console.log('PASS: Q4 structuredTable rows count:', img.structuredTable.rows.length);
      }
      if (img.width && img.width > 580) {
        errors.push(`FAIL: Q4 width is ${img.width}, extending outside left column into right column (Q10/Q11)`);
      } else {
        console.log(`PASS: Q4 table width ${img.width} is strictly inside left column`);
      }
    }
  }

  // ==========================================
  // ASSERTION 3: Q6 is Matching Table
  // ==========================================
  const q6 = qMap.get(6);
  if (!q6) {
    errors.push('Q6 was not parsed');
  } else {
    if (!q6.questionImages || q6.questionImages.length === 0) {
      errors.push('FAIL: Q6 missing questionImages table');
    } else {
      const img = q6.questionImages[0];
      if (img.regionType !== 'table') {
        errors.push(`FAIL: Q6 regionType is '${img.regionType}', expected 'table'`);
      }
      if (q6.text.toLowerCase().includes('fibrinogen') || q6.text.toLowerCase().includes('globulin') || q6.text.toLowerCase().includes('albumin')) {
        errors.push(`FAIL: Q6 text still contains flattened table content: "${q6.text}"`);
      } else {
        console.log(`PASS: Q6 text is clean instruction prompt: "${q6.text}"`);
      }
      if (img.structuredTable) {
        console.log('PASS: Q6 structuredTable headers:', img.structuredTable.headers);
        console.log('PASS: Q6 structuredTable rows count:', img.structuredTable.rows.length);
      }
      if (img.width && img.width > 580) {
        errors.push(`FAIL: Q6 width is ${img.width}, extending outside left column`);
      } else {
        console.log(`PASS: Q6 table width ${img.width} is strictly inside left column`);
      }
    }
  }

  // ==========================================
  // ASSERTION 4: Q18 is Matching Table (Left column)
  // ==========================================
  const q18 = qMap.get(18);
  if (!q18) {
    errors.push('Q18 was not parsed');
  } else {
    if (!q18.questionImages || q18.questionImages.length === 0) {
      errors.push('FAIL: Q18 missing questionImages table');
    } else {
      const img = q18.questionImages[0];
      if (img.regionType !== 'table') {
        errors.push(`FAIL: Q18 regionType is '${img.regionType}', expected 'table'`);
      }
      if (q18.text.toLowerCase().includes('p - wave') || q18.text.toLowerCase().includes('qrs complex') || q18.text.toLowerCase().includes('ischemia')) {
        errors.push(`FAIL: Q18 text still contains flattened table content: "${q18.text}"`);
      } else {
        console.log(`PASS: Q18 text is clean instruction prompt: "${q18.text}"`);
      }
      if (img.structuredTable) {
        console.log('PASS: Q18 structuredTable headers:', img.structuredTable.headers);
        console.log('PASS: Q18 structuredTable rows count:', img.structuredTable.rows.length);
        if (img.structuredTable.rows.length < 4) {
          errors.push(`FAIL: Q18 structured table has only ${img.structuredTable.rows.length} rows, expected at least 4-5`);
        }
      }
      if (img.width && img.width > 580) {
        errors.push(`FAIL: Q18 width is ${img.width}, extending outside left column`);
      } else {
        console.log(`PASS: Q18 table width ${img.width} is strictly inside left column`);
      }
    }
  }

  // ==========================================
  // ASSERTION 5: Q19 is Matching Table (Right column)
  // ==========================================
  const q19 = qMap.get(19);
  if (!q19) {
    errors.push('Q19 was not parsed');
  } else {
    if (!q19.questionImages || q19.questionImages.length === 0) {
      errors.push('FAIL: Q19 missing questionImages table');
    } else {
      const img = q19.questionImages[0];
      if (img.regionType !== 'table') {
        errors.push(`FAIL: Q19 regionType is '${img.regionType}', expected 'table'`);
      }
      if (q19.text.toLowerCase().includes('tricuspid') || q19.text.toLowerCase().includes('bicuspid') || q19.text.toLowerCase().includes('semilunar')) {
        errors.push(`FAIL: Q19 text still contains flattened table content: "${q19.text}"`);
      } else {
        console.log(`PASS: Q19 text is clean instruction prompt: "${q19.text}"`);
      }
      if (img.structuredTable) {
        console.log('PASS: Q19 structuredTable headers:', img.structuredTable.headers);
        console.log('PASS: Q19 structuredTable rows count:', img.structuredTable.rows.length);
      }
    }
  }

  // ==========================================
  // ASSERTION 6: Q23 is Standard ECG (Right column, diagram)
  // ==========================================
  const q23 = qMap.get(23);
  if (!q23) {
    errors.push('Q23 was not parsed');
  } else {
    if (!q23.questionImages || q23.questionImages.length === 0) {
      errors.push('FAIL: Q23 missing ECG diagram');
    } else {
      const img = q23.questionImages[0];
      if (img.regionType !== 'diagram') {
        errors.push(`FAIL: Q23 regionType is '${img.regionType}', expected 'diagram'`);
      } else {
        console.log(`PASS: Q23 regionType is 'diagram', altText: "${img.altText}"`);
      }
    }
  }

  // ==========================================
  // ASSERTION 7: Text questions without tables/figures must have undefined questionImages
  // ==========================================
  const textOnlyQuestions = [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 24, 25, 26];
  for (const qNum of textOnlyQuestions) {
    const q = qMap.get(qNum);
    if (q && q.questionImages && q.questionImages.length > 0) {
      errors.push(`FAIL: Text-only Question ${qNum} has unexpected questionImages!`);
    }
  }

  // ==========================================
  // ASSERTION 8: Q26 Option D EXACT MATCH & Page 3 Answer-Key Exclusivity
  // ==========================================
  const q26 = qMap.get(26);
  if (!q26) {
    errors.push('FAIL: Q26 was not parsed');
  } else {
    if (q26.options.D !== 'Less than that in the vena cava') {
      errors.push(`FAIL: Q26 Option D is "${q26.options.D}", expected exactly "Less than that in the vena cava"`);
    } else {
      console.log('PASS: Q26 Option D matches exactly: "Less than that in the vena cava"');
    }
    if (q26.options.D.includes('10 11 12') || q26.options.D.includes('bb') || q26.options.D.includes('Answer Key')) {
      errors.push(`FAIL: Q26 Option D contains answer-key content!`);
    } else {
      console.log('PASS: Q26 Option D is 100% free of answer-key numbers/letters');
    }
  }

  // Verify all page 3 questions (Q24, Q25, Q26)
  for (const qNum of [24, 25, 26]) {
    const q = qMap.get(qNum);
    if (q) {
      const allText = `${q.text} ${q.options.A} ${q.options.B} ${q.options.C} ${q.options.D}`;
      if (allText.includes('10 11 12') || allText.includes('18 19 20') || allText.includes('Answer Key')) {
        errors.push(`FAIL: Question ${qNum} contains leaked answer-key content!`);
      } else {
        console.log(`PASS: Question ${qNum} has zero answer-key leakage in text or options`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('REGRESSION ASSERTION FAILURES:');
    for (const err of errors) console.error(' - ' + err);
    console.error('========================================\n');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('ALL REGRESSION ASSERTIONS PASSED PERFECTLY!');
  console.log('========================================\n');
}

testCanonicalRegression().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
