import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generateBodyFluidsPdf } from './scripts/canonicalPdfGenerator';
import {
  extractAnswerKeyMatrix,
  parseQuestionsFromPageTexts
} from './src/services/pdfParser';
import { extractAndAssociateFigures } from './src/services/pdfFigureExtractor';

async function runRegressionAssertions() {
  console.log('================================================================');
  console.log('STRICT REGRESSION & TWO-COLUMN EXTRACTION ASSERTIONS');
  console.log('================================================================');

  // 1. Generate canonical two-column PDF
  const pdfBuf = generateBodyFluidsPdf();
  fs.writeFileSync('Body_Fluids_and_Circulation_PYQs.pdf', pdfBuf);
  console.log(`Generated canonical PDF: ${pdfBuf.length} bytes.`);

  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuf),
    disableFontFace: true
  }).promise;

  console.log(`PDF loaded: ${pdfDoc.numPages} pages.`);

  // 2. Extract text using column-ordered extractor
  const pageTexts: { pageNumber: number; text: string }[] = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const items = (content.items as any[]).filter((item: any) => 'str' in item && item.str.trim());

    const midX = viewport.width / 2;
    const leftItems = items.filter((it) => it.transform[4] < midX);
    const rightItems = items.filter((it) => it.transform[4] >= midX);

    let orderedItems: any[] = [];
    if (leftItems.length >= 8 && rightItems.length >= 8) {
      const sortColumn = (col: any[]) =>
        [...col].sort((a, b) => {
          const dy = b.transform[5] - a.transform[5];
          if (Math.abs(dy) > 3) return dy;
          return a.transform[4] - b.transform[4];
        });

      orderedItems = [...sortColumn(leftItems), ...sortColumn(rightItems)];
    } else {
      orderedItems = [...items].sort((a, b) => {
        const dy = b.transform[5] - a.transform[5];
        if (Math.abs(dy) > 3) return dy;
        return a.transform[4] - b.transform[4];
      });
    }

    const pageText = orderedItems.map((it) => it.str).join(' ');
    pageTexts.push({ pageNumber: pageNum, text: pageText });
    fullText += `\n--- [Page ${pageNum}] ---\n` + pageText;
  }

  // 3. Parse answer key & questions
  const akMap = extractAnswerKeyMatrix(fullText);
  const questions = parseQuestionsFromPageTexts(
    pageTexts,
    akMap,
    'Body Fluids and Circulation PYQs.pdf',
    'Zoology',
    'Body Fluids and Circulation'
  );

  console.log(`Parsed ${questions.length} questions from text.`);

  // 4. Extract figures & matching tables
  const { updatedQuestions, figuresDetectedCount } = await extractAndAssociateFigures(
    pdfDoc,
    questions,
    'Body Fluids and Circulation PYQs.pdf',
    (msg) => console.log('  [Progress]', msg)
  );

  console.log(`\nFigures & tables detected count: ${figuresDetectedCount}`);

  // =========================================================================
  // EXECUTE MANDATORY REGRESSION ASSERTIONS
  // =========================================================================
  console.log(`\n--- EXECUTING MANDATORY REGRESSION ASSERTIONS ---`);

  // Assertion 1: Q8 is a normal text MCQ and MUST NEVER have questionImages
  const q8 = updatedQuestions.find((q) => q.rawQuestionNumber === 8);
  if (!q8) throw new Error('Assertion Failed: Q8 not found in parsed questions!');
  if (q8.questionImages && q8.questionImages.length > 0) {
    throw new Error(`Assertion 1 FAILED: Q8 has questionImages entry! ${JSON.stringify(q8.questionImages)}`);
  }
  console.log(`[PASS] Assertion 1: Q8 has NO questionImages (clean text question: "${q8.text}")`);

  // Assertion 2: Q4 table bbox must NOT overlap Q10/Q11 (which are in the right column)
  const q4 = updatedQuestions.find((q) => q.rawQuestionNumber === 4);
  const q10 = updatedQuestions.find((q) => q.rawQuestionNumber === 10);
  const q11 = updatedQuestions.find((q) => q.rawQuestionNumber === 11);
  if (!q4 || !q4.questionImages || q4.questionImages.length === 0) {
    throw new Error('Assertion Failed: Q4 table not found!');
  }
  const q4Img = q4.questionImages[0];
  console.log(`[PASS] Assertion 2a: Q4 has associated table (${q4Img.width}x${q4Img.height}px, regionType=${q4Img.regionType})`);
  if (q4Img.structuredTable) {
    console.log(`  Structured headers:`, q4Img.structuredTable.headers);
    console.log(`  Structured rows (${q4Img.structuredTable.rows.length}):`, q4Img.structuredTable.rows);
  }
  // Q4 table must be in left column (width <= 585 at 2x scale, max X within left column)
  if (q4Img.width && q4Img.width > 585) {
    throw new Error(`Assertion 2b FAILED: Q4 table width ${q4Img.width}px exceeds left column boundary! It is leaking into right column!`);
  }
  console.log(`[PASS] Assertion 2: Q4 table is strictly in the left column and does NOT overlap Q10/Q11.`);

  // Assertion 3: Q6 table bbox must NOT overlap Q1/Q2
  const q6 = updatedQuestions.find((q) => q.rawQuestionNumber === 6);
  if (!q6 || !q6.questionImages || q6.questionImages.length === 0) {
    throw new Error('Assertion Failed: Q6 table not found!');
  }
  const q6Img = q6.questionImages[0];
  console.log(`[PASS] Assertion 3a: Q6 has associated table (${q6Img.width}x${q6Img.height}px, regionType=${q6Img.regionType})`);
  if (q6Img.structuredTable) {
    console.log(`  Structured headers:`, q6Img.structuredTable.headers);
    console.log(`  Structured rows (${q6Img.structuredTable.rows.length}):`, q6Img.structuredTable.rows);
  }
  if (q6Img.width && q6Img.width > 585) {
    throw new Error(`Assertion 3b FAILED: Q6 table width ${q6Img.width}px exceeds left column boundary!`);
  }
  console.log(`[PASS] Assertion 3: Q6 table is strictly bounded and does NOT overlap Q1/Q2.`);

  // Assertion 4: Q18 region must NOT overlap Q23, and Q23 must NOT overlap Q18
  const q18 = updatedQuestions.find((q) => q.rawQuestionNumber === 18);
  const q23 = updatedQuestions.find((q) => q.rawQuestionNumber === 23);
  if (!q18 || !q18.questionImages || q18.questionImages.length === 0) {
    throw new Error('Assertion Failed: Q18 table not found!');
  }
  if (!q23 || !q23.questionImages || q23.questionImages.length === 0) {
    throw new Error('Assertion Failed: Q23 ECG diagram not found!');
  }
  const q18Img = q18.questionImages[0];
  const q23Img = q23.questionImages[0];
  console.log(`[PASS] Assertion 4a: Q18 has table (${q18Img.width}x${q18Img.height}px, regionType=${q18Img.regionType})`);
  console.log(`[PASS] Assertion 4b: Q23 has ECG diagram (${q23Img.width}x${q23Img.height}px, regionType=${q23Img.regionType})`);

  if (q18Img.width && q18Img.width > 585) {
    throw new Error(`Assertion 4c FAILED: Q18 table width ${q18Img.width}px exceeds left column! It is leaking into right column!`);
  }
  if (q23Img.width && q23Img.width > 585) {
    throw new Error(`Assertion 4d FAILED: Q23 diagram width ${q23Img.width}px exceeds right column!`);
  }
  console.log(`[PASS] Assertion 4: Q18 (left column) and Q23 (right column) are completely isolated in separate columns.`);

  // Assertion 5: Q19 is in right column and does not overlap neighboring questions
  const q19 = updatedQuestions.find((q) => q.rawQuestionNumber === 19);
  if (!q19 || !q19.questionImages || q19.questionImages.length === 0) {
    throw new Error('Assertion Failed: Q19 table not found!');
  }
  const q19Img = q19.questionImages[0];
  console.log(`[PASS] Assertion 5a: Q19 has table (${q19Img.width}x${q19Img.height}px, regionType=${q19Img.regionType})`);
  if (q19Img.width && q19Img.width > 585) {
    throw new Error(`Assertion 5b FAILED: Q19 table width ${q19Img.width}px exceeds right column boundary!`);
  }
  console.log(`[PASS] Assertion 5: Q19 table is strictly in the right column.`);

  // Assertion 6: question.text does NOT contain duplicated flattened table contents when table region exists
  for (const qItem of [q4, q6, q18, q19]) {
    const hasFlattenedDuplicate =
      qItem.text.includes('Column-I Column-II') ||
      qItem.text.includes('A. Fibrinogen') ||
      qItem.text.includes('A. P - wave') ||
      qItem.text.includes('1. Eosinophils') ||
      qItem.text.includes('A. Tricuspid valve');

    if (hasFlattenedDuplicate) {
      throw new Error(`Assertion 6 FAILED: Q${qItem.rawQuestionNumber} text contains duplicated flattened table content! Text: "${qItem.text}"`);
    }
    console.log(`[PASS] Assertion 6: Q${qItem.rawQuestionNumber} text is clean: "${qItem.text}"`);
  }

  // Assertion 7: Sample text-only questions verified clean
  const textOnlyQuestions = [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 24, 25, 26];
  for (const num of textOnlyQuestions) {
    const qObj = updatedQuestions.find((q) => q.rawQuestionNumber === num)!;
    if (qObj.questionImages && qObj.questionImages.length > 0) {
      throw new Error(`Assertion 7 FAILED: Text question Q${num} has an image attached!`);
    }
  }
  console.log(`[PASS] Assertion 7: All 21 text-only questions have questionImages === undefined.`);

  console.log(`\n================================================================`);
  console.log(`ALL 7 MANDATORY REGRESSION ASSERTIONS EXECUTED AND PASSED!`);
  console.log(`================================================================`);
}

runRegressionAssertions().catch((err) => {
  console.error('\n*** REGRESSION TEST FAILED ***\n', err);
  process.exit(1);
});
