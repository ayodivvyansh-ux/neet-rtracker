import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  extractAnswerKeyMatrix,
  parseQuestionsFromPageTexts
} from './src/services/pdfParser';

async function checkQ5Items() {
  const buf = fs.readFileSync('Body_Fluids_and_Circulation_PYQs.pdf');
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const textContent = await page.getTextContent();
  const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

  const numPat = new RegExp(`(?:^|\\s)5\\.\\s*`);
  const matches = items.filter((it) => numPat.test(it.str));
  console.log('Matches for 5.:', matches.map((m) => m.str));

  // Find header item
  for (const it of items) {
    if (it.str && numPat.test(it.str)) {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      console.log('Found Q5 header at:', pt[1]);
    }
  }

  // Also check Q6 header
  const numPat6 = new RegExp(`(?:^|\\s)6\\.\\s*`);
  for (const it of items) {
    if (it.str && numPat6.test(it.str)) {
      const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      console.log('Found Q6 header at:', pt[1]);
    }
  }
}

checkQ5Items();
