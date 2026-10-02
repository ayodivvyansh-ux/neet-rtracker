import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  extractAnswerKeyMatrix,
  parseQuestionsFromPageTexts
} from './src/services/pdfParser';
import { extractAndAssociateFigures } from './src/services/pdfFigureExtractor';

async function diagnose() {
  const buf = fs.readFileSync('Body_Fluids_and_Circulation_PYQs.pdf');
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;

  const pageTexts: { pageNumber: number; text: string }[] = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const str = (content.items as any[]).map((it) => it.str).join(' ');
    pageTexts.push({ pageNumber: i, text: str });
  }

  const akMap = extractAnswerKeyMatrix(pageTexts.map((p) => p.text).join('\n'));
  const questions = parseQuestionsFromPageTexts(pageTexts, akMap, 'test.pdf', 'Zoology', 'Body Fluids and Circulation');

  const { updatedQuestions } = await extractAndAssociateFigures(pdfDoc, questions, 'test.pdf');

  const q5 = updatedQuestions.find((q) => q.rawQuestionNumber === 5);
  console.log('Q5 images:', q5?.questionImages);
}

diagnose();
