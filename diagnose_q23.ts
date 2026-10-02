import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generateBodyFluidsPdf } from './scripts/canonicalPdfGenerator';
import { detectPageAnswerKeyTopY, parseQuestionsFromPageTexts } from './src/services/pdfParser';
import { extractAndAssociateFigures } from './src/services/pdfFigureExtractor';

async function main() {
  const buf = generateBodyFluidsPdf();
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  const pageTexts: { pageNumber: number; text: string }[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const items = (content.items as any[]).filter((it) => 'str' in it && it.str.trim());
    const akTopY = detectPageAnswerKeyTopY(items, viewport);
    const eligible = items.filter((it) => {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      return pt[1] < akTopY - 2;
    });
    const text = eligible.map((it) => it.str).join(' ');
    pageTexts.push({ pageNumber: pageNum, text });
  }

  const questions = parseQuestionsFromPageTexts(pageTexts, new Map(), 'test.pdf', 'Zoology', 'Body Fluids and Circulation');
  
  // Run extractAndAssociateFigures and capture console logs
  await extractAndAssociateFigures(pdfDoc, questions, 'test.pdf');
}

main();
