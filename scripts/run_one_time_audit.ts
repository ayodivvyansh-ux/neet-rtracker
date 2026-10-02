import { supabase } from '../src/lib/supabase';
import { ALL_SUBJECTS, subjectToPublicViewName } from '../src/types';
import { detectPageAnswerKeyTopY } from '../src/services/pdfParser';
import { collectPageGraphicObjects } from '../src/services/pdfFigureExtractor';
import { validateQuestionVisual, TextItem, QuarantineReason, VisualStatus } from '../src/services/visualValidator';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';

// Explicit lists of known states from manual review
const MANUALLY_APPROVED = new Set([
  'q_morph_kattar_020',
  'q_morph_practice_039',
  'q_morph_kattar_024',
  'q_morph_kattar_013',
  'q_morph_kattar_018',
  'q_morph_kattar_046',
  'q_bfc_pyq_050',
  'q_body_fluids_and_circulat_p2_q18_ajrva5',
  'q_bfc_pyq_002'
]);

const MANUALLY_QUARANTINED: Record<string, QuarantineReason[]> = {
  'q_com_1_16': ['LOW_CONFIDENCE', 'NEIGHBOURING_QUESTION_DETECTED'],
  'q_morph_kattar_041': ['MCQ_OPTIONS_DETECTED', 'LOW_CONFIDENCE'],
  'q_morph_practice_005': ['SOURCE_PAGE_CONTAMINATION', 'LOW_CONFIDENCE'],
  'q_morph_practice_019': ['DUPLICATED_CONTENT', 'LOW_CONFIDENCE'],
  'q_body_fluids_and_circulat_p2_q19_on3te1': ['NEIGHBOURING_QUESTION_DETECTED', 'LOW_CONFIDENCE'],
  'q_morph_pyq_038': ['ANSWER_KEY_DETECTED']
};

// Helper to map question back to database row structure
function mapQuestionToDbRow(q: any) {
  const optionsPayload = {
    ...q.options,
    ...(q.questionImages && q.questionImages.length > 0 ? { questionImages: q.questionImages } : {}),
    ...(q.visual ? { visual: q.visual } : {})
  };

  return {
    id: q.id,
    source_id: q.sourceId || null,
    source_file_id: q.sourceFileId || null,
    text: q.text,
    options: optionsPayload,
    correct_answer: q.correctAnswer || q.correct_answer || 'UNKNOWN',
    subject: q.subject,
    chapter: q.chapter,
    subtopic: q.subtopic || null,
    difficulty: q.difficulty,
    source_pdf_name: q.sourcePdf || q.source_pdf_name || null,
    page_number: q.pageNumber || q.page_number || null,
    explanation: q.explanation || null,
    question_images: q.questionImages || null,
    visual: q.visual || null,
    created_at: q.created_at ? new Date(q.created_at).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function main() {
  console.log('======================================================');
  console.log('STARTING CONSERVATIVE HARDENED VISUAL QUALITY AUDIT');
  console.log('======================================================');

  // Sign in anonymously to get storage bucket read access
  console.log('Signing in anonymously to Supabase...');
  await supabase.auth.signInAnonymously();

  const detailedLogs: any[] = [];
  
  // Counters for final report
  let totalVisualsChecked = 0;
  let safeCount = 0;
  let quarantinedCount = 0;
  let missingCount = 0;
  let unresolvableCount = 0;

  // Triggers counters
  let answerKeyLeaks = 0;
  let neighbouringQuestionLeaks = 0;
  let incompleteVisuals = 0;

  // 1. Load local PDF if available
  let localPdfDoc: any = null;
  const localPdfPath = './Body_Fluids_and_Circulation_PYQs.pdf';
  if (fs.existsSync(localPdfPath)) {
    console.log('Local PDF file found. Will use it for geometric layout validation of Zoology PYQs.');
    const buf = fs.readFileSync(localPdfPath);
    localPdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      disableFontFace: true
    }).promise;
  }

  // 2. Fetch all questions from views
  for (const subject of ALL_SUBJECTS) {
    const viewName = subjectToPublicViewName(subject);
    console.log(`Fetching questions for subject "${subject}" from ${viewName}...`);
    const { data: rows, error } = await supabase.from(viewName).select('*');
    if (error) {
      console.error(`Error querying ${viewName}:`, error.message);
      continue;
    }

    const visualQuestions = (rows || []).filter((q: any) => {
      const v = q.visual ? (typeof q.visual === 'string' ? JSON.parse(q.visual) : q.visual) : null;
      // Also audit any questions currently marked disabled but exist in MANUALLY_QUARANTINED list
      return (v && (v.hasVisual === true || v.has_visual === true)) || MANUALLY_QUARANTINED[q.id];
    });

    console.log(`Found ${visualQuestions.length} visual questions in subject "${subject}".`);

    for (const q of visualQuestions) {
      totalVisualsChecked++;
      const visual = q.visual ? (typeof q.visual === 'string' ? JSON.parse(q.visual) : q.visual) : {};
      const qNum = visual.source_question_number || q.raw_question_number || parseInt(q.id.replace(/[^0-9]/g, ''), 10) || 0;
      const pdfName = q.source_pdf_name || visual.source_pdf || 'Unknown PDF';
      const storagePath = visual.storage_path || visual.storagePath || '';
      const bucket = visual.storage_bucket || visual.storageBucket || 'neet-source-pdfs';

      console.log(`[AUDITING Q#${totalVisualsChecked}] ID: ${q.id} | Subject: ${subject} | PDF: ${pdfName} | QNum: ${qNum}`);

      // Check manually quarantined overrides
      if (MANUALLY_QUARANTINED[q.id]) {
        console.log(`  [OVERRIDE] Question ${q.id} is flagged as MANUALLY QUARANTINED.`);
        quarantinedCount++;
        const reasons = MANUALLY_QUARANTINED[q.id];
        
        if (reasons.includes('ANSWER_KEY_DETECTED') || reasons.includes('ANSWER_PATTERN_DETECTED')) answerKeyLeaks++;
        if (reasons.includes('NEIGHBOURING_QUESTION_DETECTED')) neighbouringQuestionLeaks++;
        if (reasons.includes('INCOMPLETE_TABLE') || reasons.includes('INCOMPLETE_DIAGRAM')) incompleteVisuals++;

        detailedLogs.push({
          questionId: q.id,
          subject,
          sourcePdf: pdfName,
          sourceQuestionNumber: qNum,
          storageBucket: bucket,
          storagePath,
          hasVisual: false,
          validationStatus: 'QUARANTINED',
          validationReasons: reasons,
          ocrSummary: 'Manually Quarantined overriding audit pipeline.'
        });

        // Ensure database stays disabled
        if (visual.hasVisual !== false) {
          const updatedVisual = { ...visual, hasVisual: false, has_visual: false };
          const updatedQuestion = { ...q, visual: updatedVisual, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options };
          await supabase.rpc('import_neet_questions', { p_subject: subject, p_rows: [mapQuestionToDbRow(updatedQuestion)] });
        }
        continue;
      }

      // Step 1: Resolve Storage asset
      let storageResolved = false;
      let assetSize = 0;

      if (storagePath) {
        try {
          const { data: downloadData, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
          if (!downloadError && downloadData) {
            storageResolved = true;
            assetSize = downloadData.size;
          }
        } catch (err: any) {
          console.warn(`  [STORAGE FAIL] Path "${storagePath}":`, err.message);
        }
      }

      if (!storageResolved) {
        unresolvableCount++;
        detailedLogs.push({
          questionId: q.id,
          subject,
          sourcePdf: pdfName,
          sourceQuestionNumber: qNum,
          storageBucket: bucket,
          storagePath,
          hasVisual: false,
          validationStatus: 'UNRESOLVABLE',
          validationReasons: ['UNREADABLE_VISUAL'],
          ocrSummary: 'Private Storage asset not found or unresolvable.'
        });
        continue;
      }

      // Step 2 & 3: Run pipeline check
      let isValid = true;
      let score = 1.0;
      let reasons: QuarantineReason[] = [];
      let rejectionReason = '';
      let ocrSummary = '';

      const isLocalPdf = localPdfDoc && (
        pdfName.toLowerCase().includes('body fluids and circulation pyqs') ||
        pdfName.toLowerCase().includes('body_fluids_and_circulation_pyqs')
      );

      if (isLocalPdf) {
        console.log(`  Running spatial and layout-isolation pipeline using local PDF...`);
        try {
          const pageNum = q.page_number || visual.pageNumber || 1;
          const page = await localPdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          const textContent = await page.getTextContent();
          const items = (textContent.items as any[]).filter((it) => it.str && it.str.trim());

          const akTopY = detectPageAnswerKeyTopY(items, viewport);
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

          const numPat = new RegExp(`(?:^|\\s)${qNum}\\.\\s*`);
          let headerItem = items.find((it) => {
            if (!it.str || !numPat.test(it.str)) return false;
            const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
            return pt[1] < akTopY - 10;
          });

          if (headerItem) {
            const headerPt = viewport.convertToViewportPoint(headerItem.transform[4], headerItem.transform[5]);
            const column: 'left' | 'right' = isTwoColumnPage && headerPt[0] >= midX ? 'right' : 'left';
            const colBounds = column === 'left' ? leftCol : rightCol;

            const otherHeaders = items.filter((it) => {
              const m = /^\s*(\d{1,3})\.\s+(.*)/.exec(it.str);
              if (m) {
                const num = parseInt(m[1], 10);
                return num !== qNum;
              }
              return false;
            }).map((it) => {
              const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
              return { y: pt[1], x: pt[0], str: it.str };
            });

            const nextHeaderInCol = otherHeaders
              .filter((h) => h.y > headerPt[1] && h.x >= colBounds.minX && h.x <= colBounds.maxX)
              .sort((a, b) => a.y - b.y)[0];

            const startY = headerPt[1] - 4;
            const endY = nextHeaderInCol ? nextHeaderInCol.y - 2 : Math.min(akTopY - 4, viewport.height - 10);

            const questionItems = items.filter((it) => {
              const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
              return (
                pt[0] >= colBounds.minX &&
                pt[0] <= colBounds.maxX &&
                pt[1] >= startY &&
                pt[1] <= endY
              );
            });

            const itemPoints = questionItems.map((it) => {
              const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
              const itW = (it.width || 20) * 2.0;
              return { minX: pt[0], maxX: pt[0] + itW, minY: pt[1] - 14, maxY: pt[1] + 4 };
            });

            const rawMinX = Math.min(...itemPoints.map((p) => p.minX), colBounds.minX + 10);
            const rawMaxX = Math.max(...itemPoints.map((p) => p.maxX), colBounds.maxX - 10);
            const rawMaxY = Math.max(...itemPoints.map((p) => p.maxY), endY);

            const cropBox = {
              minX: Math.max(colBounds.minX + 2, Math.round(rawMinX - 8)),
              minY: Math.max(0, Math.round(startY)),
              maxX: Math.min(colBounds.maxX - 2, Math.round(rawMaxX + 8)),
              maxY: Math.min(endY, Math.round(rawMaxY + 12)),
              width: Math.max(40, rawMaxX - rawMinX),
              height: Math.max(20, rawMaxY - startY)
            };

            const textInsideCrop = questionItems.map((it) => {
              const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
              return { str: it.str.trim(), x: pt[0], y: pt[1] };
            });

            const isDiag = visual.kind === 'diagram';
            const valResult = validateQuestionVisual({
              cropBox,
              textItems: textInsideCrop,
              isDiagram: isDiag,
              qNum,
              sourcePdf: pdfName
            });

            isValid = valResult.isValid;
            score = valResult.confidence;
            reasons = valResult.reasons;
            rejectionReason = valResult.rejectionReason;
            ocrSummary = textInsideCrop.map(t => t.str).join(' ');
          } else {
            isValid = false;
            score = 0.5;
            reasons = ['LOW_CONFIDENCE'];
            rejectionReason = 'Failed to find question header geometrically on PDF page';
            ocrSummary = '';
          }
        } catch (err: any) {
          isValid = false;
          score = 0.5;
          reasons = ['UNREADABLE_VISUAL'];
          rejectionReason = 'PDF parsing exception';
        }
      } else {
        // Fallback to text checks by mock-mapping fields to TextItem
        console.log(`  Running database text-checks pipeline...`);
        const textItems: TextItem[] = [
          { str: q.text || '', x: 0, y: 0 },
          ...(q.explanation ? [{ str: q.explanation, x: 0, y: 0 }] : []),
          ...(q.options ? Object.entries(q.options).map(([k, v]) => ({ str: `${k}. ${v}`, x: 0, y: 0 })) : [])
        ];
        const isDiag = visual.kind === 'diagram';
        const valResult = validateQuestionVisual({
          textItems,
          isDiagram: isDiag,
          qNum,
          sourcePdf: pdfName
        });

        isValid = valResult.isValid;
        score = valResult.confidence;
        reasons = valResult.reasons;
        rejectionReason = valResult.rejectionReason;
        ocrSummary = textItems.map(t => t.str).join(' ');
      }

      // Check manually approved list bypass
      if (MANUALLY_APPROVED.has(q.id)) {
        console.log(`  [OVERRIDE] Question ${q.id} is flagged as MANUALLY APPROVED. Classifying as SAFE.`);
        isValid = true;
        reasons = [];
        score = 1.0;
      }

      // Count reason statistics
      if (!isValid) {
        if (reasons.includes('ANSWER_KEY_DETECTED') || reasons.includes('ANSWER_PATTERN_DETECTED')) answerKeyLeaks++;
        if (reasons.includes('NEIGHBOURING_QUESTION_DETECTED')) neighbouringQuestionLeaks++;
        if (reasons.includes('INCOMPLETE_TABLE') || reasons.includes('INCOMPLETE_DIAGRAM')) incompleteVisuals++;
      }

      if (isValid) {
        safeCount++;
        detailedLogs.push({
          questionId: q.id,
          subject,
          sourcePdf: pdfName,
          sourceQuestionNumber: qNum,
          storageBucket: bucket,
          storagePath,
          hasVisual: true,
          validationStatus: 'SAFE',
          validationReasons: [],
          ocrSummary,
          imageDimensions: visual.width && visual.height ? `${visual.width}x${visual.height}` : undefined
        });

        // Ensure hasVisual is true in the database if originally disabled
        if (visual.hasVisual === false) {
          const updatedVisual = { ...visual, hasVisual: true, has_visual: true };
          const updatedQuestion = { ...q, visual: updatedVisual, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options };
          await supabase.rpc('import_neet_questions', { p_subject: subject, p_rows: [mapQuestionToDbRow(updatedQuestion)] });
        }
      } else {
        quarantinedCount++;
        detailedLogs.push({
          questionId: q.id,
          subject,
          sourcePdf: pdfName,
          sourceQuestionNumber: qNum,
          storageBucket: bucket,
          storagePath,
          hasVisual: false,
          validationStatus: 'QUARANTINED',
          validationReasons: reasons,
          ocrSummary
        });

        // Disable in database by setting visual.hasVisual = false
        console.log(`  [QUARANTINING] Setting visual.hasVisual = false for ${q.id}...`);
        const updatedVisual = { ...visual, hasVisual: false, has_visual: false };
        const updatedQuestion = { ...q, visual: updatedVisual, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options };
        
        await supabase.rpc('import_neet_questions', { p_subject: subject, p_rows: [mapQuestionToDbRow(updatedQuestion)] });
      }
    }
  }

  // 3. Print the final report
  console.log('\n');
  console.log('======================================================');
  console.log('FINAL AUDIT SUMMARY REPORT');
  console.log('======================================================');
  console.log(`Total Visuals Checked:               ${totalVisualsChecked}`);
  console.log(`SAFE:                                ${safeCount}`);
  console.log(`QUARANTINED:                         ${quarantinedCount}`);
  console.log(`MISSING:                             ${missingCount}`);
  console.log(`UNRESOLVABLE:                        ${unresolvableCount}`);
  console.log('------------------------------------------------------');
  console.log(`Answer Key Leaks Detected:           ${answerKeyLeaks}`);
  console.log(`Neighboring Question Leaks:          ${neighbouringQuestionLeaks}`);
  console.log(`Incomplete Visuals Detected:         ${incompleteVisuals}`);
  console.log('======================================================');

  // Also write the report to a JSON file (preserves previous run)
  const reportPath = './final_audit_report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      totalVisualsChecked,
      safe: safeCount,
      quarantined: quarantinedCount,
      missing: missingCount,
      unresolvable: unresolvableCount,
      answerKeyLeaks,
      neighbouringQuestionLeaks,
      incompleteVisuals
    },
    logs: detailedLogs
  }, null, 2));
  console.log(`\nWritten complete hardened audit report to "${reportPath}".`);
}

main().catch(err => {
  console.error('Exception in main visual quality audit runner:', err);
});
