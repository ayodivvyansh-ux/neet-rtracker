import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function diagnose() {
  const buf = fs.readFileSync('Body_Fluids_and_Circulation_PYQs.pdf');
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const textContent = await page.getTextContent();
  const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

  console.log('--- ALL ITEMS ON PAGE 1 LEFT COLUMN (X < 595) ---');
  for (const it of items) {
    const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
    if (pt[0] < 595) {
      console.log(`[Y=${pt[1].toFixed(1)}, X=${pt[0].toFixed(1)}] "${it.str}"`);
    }
  }
}

diagnose();
