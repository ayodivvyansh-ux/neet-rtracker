/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CbtQuestionEvaluation, CbtTestResult, CbtTestSession } from '../types';
import {
  transformEmbeddedHtmlImages,
  resolveQuestionImage,
  getStandaloneQuestionImages
} from './imageService';
import {
  renderTrustedQuestionHtml,
  renderTrustedOptionHtml,
  renderMathText
} from '../components/MathRenderer';

// Standard A4 dimensions in CSS pixels at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PAGE_PADDING_TOP_PX = 24;
const PAGE_PADDING_BOTTOM_PX = 28;
const PAGE_PADDING_X_PX = 28;
const COLUMN_GAP_PX = 16;
const COLUMN_WIDTH_PX = (A4_WIDTH_PX - PAGE_PADDING_X_PX * 2 - COLUMN_GAP_PX) / 2; // ~361px
const MAX_COLUMN_HEIGHT_PX = A4_HEIGHT_PX - PAGE_PADDING_TOP_PX - PAGE_PADDING_BOTTOM_PX - 20; // ~1050px

interface PreparedMistakeItem {
  id: string;
  globalIndex: number;
  question_code: string;
  subject: string;
  chapter_name: string;
  userResponse: string | null;
  correctOption: string;
  isAttempted: boolean;
  isWrong: boolean;
  renderedStatement: string;
  validStandaloneUrls: string[];
  resolvedOptions: {
    key: string;
    renderedHtml: string;
    isUserPick: boolean;
    isCorrect: boolean;
  }[];
  renderedSolution: string;
}

/**
 * Generates and triggers download of a dense, two-column NEET Coaching / PYQ Assignment style Mistake Revision PDF.
 */
export async function generateMistakeRevisionPdf(
  session: CbtTestSession,
  result: CbtTestResult
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Filter ONLY Wrong and Unattempted questions
  const mistakes = result.evaluations.filter((q) => !q.isCorrect);

  if (mistakes.length === 0) {
    const emptyDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    emptyDoc.setFont('helvetica', 'bold');
    emptyDoc.setFontSize(14);
    emptyDoc.setTextColor(16, 185, 129);
    emptyDoc.text('Congratulations! 100% Score. No mistakes to revise!', 20, 30);
    emptyDoc.save(`NEET_Mistake_Revision_${Date.now()}.pdf`);
    return;
  }

  // 2. Pre-process and resolve all embedded images, standalone diagrams, and KaTeX markup asynchronously
  let counter = 1;
  const preparedItems: PreparedMistakeItem[] = await Promise.all(
    mistakes.map(async (q) => {
      // Statement HTML with KaTeX and resolved signed images
      let renderedStatement = '';
      if (q.question_html && q.question_html.trim()) {
        const transformedHtml = await transformEmbeddedHtmlImages(
          q.question_html,
          q.images,
          q.question_code,
          false
        );
        renderedStatement = renderTrustedQuestionHtml(transformedHtml);
      } else if (q.question_text) {
        renderedStatement = renderMathText(q.question_text);
      }

      // Standalone Diagrams
      const allImages = Array.isArray(q.images) ? q.images : q.images ? [q.images] : [];
      const standalone = getStandaloneQuestionImages(
        allImages,
        q.question_html,
        q.options
          ? Object.entries(q.options).map(([k, v]) => ({
              option_html: q.optionsHtml?.[k] || v
            }))
          : []
      );

      const standaloneResolved = await Promise.all(
        standalone.map(async (img) => {
          const res = await resolveQuestionImage(img, q.question_code);
          return res.url;
        })
      );
      const validStandaloneUrls = standaloneResolved.filter(Boolean) as string[];

      // Options
      const optionsKeys = ['A', 'B', 'C', 'D'];
      const resolvedOptions: {
        key: string;
        renderedHtml: string;
        isUserPick: boolean;
        isCorrect: boolean;
      }[] = [];

      for (const optKey of optionsKeys) {
        const optText = q.options?.[optKey];
        const optHtml = q.optionsHtml?.[optKey];
        if (!optText && !optHtml) continue;

        let renderedOpt = '';
        if (optHtml && optHtml.trim()) {
          const transformedOpt = await transformEmbeddedHtmlImages(
            optHtml,
            q.images,
            q.question_code,
            true
          );
          renderedOpt = renderTrustedOptionHtml(transformedOpt);
        } else if (optText) {
          renderedOpt = renderMathText(optText);
        }

        resolvedOptions.push({
          key: optKey,
          renderedHtml: renderedOpt,
          isUserPick: q.userResponse === optKey,
          isCorrect: q.correctOption === optKey
        });
      }

      // Solution
      let renderedSolution = '';
      if (q.solution_html && q.solution_html.trim()) {
        const transformedSol = await transformEmbeddedHtmlImages(
          q.solution_html,
          q.images,
          q.question_code,
          false
        );
        renderedSolution = renderTrustedQuestionHtml(transformedSol);
      } else if (q.solution_text && q.solution_text.trim()) {
        renderedSolution = renderMathText(q.solution_text);
      }

      return {
        id: q.id,
        globalIndex: 0, // will assign sequentially
        question_code: q.question_code,
        subject: q.subject,
        chapter_name: q.chapter_name || 'General',
        userResponse: q.userResponse,
        correctOption: q.correctOption,
        isAttempted: q.isAttempted,
        isWrong: q.isAttempted && !q.isCorrect,
        renderedStatement,
        validStandaloneUrls,
        resolvedOptions,
        renderedSolution
      };
    })
  );

  // Sort and assign global sequential question numbers by Subject and Chapter
  const canonicalSubjects = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
  const presentSubjects = Array.from(new Set(preparedItems.map((m) => m.subject || 'General')));
  const orderedSubjects = [
    ...canonicalSubjects.filter((s) => presentSubjects.some((p) => p.toLowerCase() === s.toLowerCase())),
    ...presentSubjects.filter((p) => !canonicalSubjects.some((s) => s.toLowerCase() === p.toLowerCase()))
  ];

  const orderedItems: PreparedMistakeItem[] = [];
  for (const subj of orderedSubjects) {
    const subjItems = preparedItems.filter((i) => (i.subject || 'General').toLowerCase() === subj.toLowerCase());
    // Group by chapter
    const chapters = Array.from(new Set(subjItems.map((i) => i.chapter_name)));
    for (const chap of chapters) {
      const chapItems = subjItems.filter((i) => i.chapter_name === chap);
      for (const item of chapItems) {
        item.globalIndex = counter++;
        orderedItems.push(item);
      }
    }
  }

  // 3. Create off-screen staging DOM
  const stagingRoot = document.createElement('div');
  stagingRoot.id = 'neet-coaching-pdf-root';
  stagingRoot.style.position = 'fixed';
  stagingRoot.style.left = '-9999px';
  stagingRoot.style.top = '0';
  stagingRoot.style.width = `${A4_WIDTH_PX}px`;
  stagingRoot.style.backgroundColor = '#ffffff';
  stagingRoot.style.zIndex = '-9999';
  stagingRoot.style.opacity = '1';
  document.body.appendChild(stagingRoot);

  try {
    const pageElements: HTMLElement[] = [];

    interface PageContext {
      pageEl: HTMLElement;
      leftCol: HTMLElement;
      rightCol: HTMLElement;
      currentCol: HTMLElement;
      isRightCol: boolean;
    }

    const createNewPage = (isFirstPage = false): PageContext => {
      const pageEl = document.createElement('div');
      pageEl.className = 'pdf-page';
      pageEl.style.width = `${A4_WIDTH_PX}px`;
      pageEl.style.minHeight = `${A4_HEIGHT_PX}px`;
      pageEl.style.maxHeight = `${A4_HEIGHT_PX}px`;
      pageEl.style.height = `${A4_HEIGHT_PX}px`;
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.padding = `${PAGE_PADDING_TOP_PX}px ${PAGE_PADDING_X_PX}px ${PAGE_PADDING_BOTTOM_PX}px ${PAGE_PADDING_X_PX}px`;
      pageEl.style.backgroundColor = '#ffffff';
      pageEl.style.color = '#0f172a';
      pageEl.style.fontFamily = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';
      pageEl.style.position = 'relative';
      pageEl.style.overflow = 'hidden';

      // Page Top Header Banner on Page 1
      if (isFirstPage) {
        const wrongCount = orderedItems.filter((q) => q.isWrong).length;
        const unattemptedCount = orderedItems.filter((q) => !q.isAttempted).length;

        const headerEl = document.createElement('div');
        headerEl.className = 'pdf-page-top-header';
        headerEl.style.borderBottom = '2px solid #0f172a';
        headerEl.style.paddingBottom = '6px';
        headerEl.style.marginBottom = '10px';
        headerEl.style.display = 'flex';
        headerEl.style.justifyContent = 'space-between';
        headerEl.style.alignItems = 'flex-end';
        headerEl.innerHTML = `
          <div>
            <div style="font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; color: #475569; text-transform: uppercase;">
              NEET UG CBT SIMULATOR &middot; REVISION PRACTICE SHEET
            </div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a; font-family: 'Newsreader', Georgia, serif; line-height: 1.15; margin-top: 2px;">
              ${session.title || 'Official Mock Exam'} &mdash; Mistake Compendium
            </div>
          </div>
          <div style="text-align: right; font-size: 9px; color: #334155; line-height: 1.35;">
            <div>Score: <strong>${result.totalScore}/${result.maxScore}</strong> (${result.accuracy}% Acc)</div>
            <div style="color: #64748b;">Target: <strong style="color: #b91c1c;">${orderedItems.length} Questions</strong> (${wrongCount} Wrong, ${unattemptedCount} Unattempted)</div>
          </div>
        `;
        pageEl.appendChild(headerEl);
      } else {
        // Slim running header on subsequent pages
        const runningHeader = document.createElement('div');
        runningHeader.style.borderBottom = '1px solid #e2e8f0';
        runningHeader.style.paddingBottom = '4px';
        runningHeader.style.marginBottom = '8px';
        runningHeader.style.display = 'flex';
        runningHeader.style.justifyContent = 'space-between';
        runningHeader.style.fontSize = '8px';
        runningHeader.style.fontWeight = '700';
        runningHeader.style.color = '#64748b';
        runningHeader.style.letterSpacing = '0.06em';
        runningHeader.style.textTransform = 'uppercase';
        runningHeader.innerHTML = `
          <span>NEET CBT Mistake Revision Assignment</span>
          <span>${session.title || ''}</span>
        `;
        pageEl.appendChild(runningHeader);
      }

      // Two-Column Container
      const columnsContainer = document.createElement('div');
      columnsContainer.className = 'pdf-columns-container';
      columnsContainer.style.display = 'grid';
      columnsContainer.style.gridTemplateColumns = '1fr 1fr';
      columnsContainer.style.columnGap = `${COLUMN_GAP_PX}px`;
      columnsContainer.style.flex = '1';
      columnsContainer.style.overflow = 'hidden';
      columnsContainer.style.position = 'relative';

      // Left Column
      const leftCol = document.createElement('div');
      leftCol.className = 'pdf-col pdf-left-col';
      leftCol.style.display = 'flex';
      leftCol.style.flexDirection = 'column';
      leftCol.style.gap = '8px';
      leftCol.style.borderRight = '1px solid #f1f5f9';
      leftCol.style.paddingRight = `${COLUMN_GAP_PX / 2}px`;
      leftCol.style.boxSizing = 'border-box';
      columnsContainer.appendChild(leftCol);

      // Right Column
      const rightCol = document.createElement('div');
      rightCol.className = 'pdf-col pdf-right-col';
      rightCol.style.display = 'flex';
      rightCol.style.flexDirection = 'column';
      rightCol.style.gap = '8px';
      rightCol.style.boxSizing = 'border-box';
      columnsContainer.appendChild(rightCol);

      pageEl.appendChild(columnsContainer);
      stagingRoot.appendChild(pageEl);
      pageElements.push(pageEl);

      return {
        pageEl,
        leftCol,
        rightCol,
        currentCol: leftCol,
        isRightCol: false
      };
    };

    let ctx = createNewPage(true);

    const getColHeight = (col: HTMLElement): number => {
      return col.scrollHeight;
    };

    const maxAllowedColHeight = (isFirstPage: boolean): number => {
      return isFirstPage ? MAX_COLUMN_HEIGHT_PX - 45 : MAX_COLUMN_HEIGHT_PX;
    };

    const advanceColumnOrPage = (neededHeight: number) => {
      const isFirst = pageElements.length === 1;
      const limit = maxAllowedColHeight(isFirst);

      if (!ctx.isRightCol) {
        if (getColHeight(ctx.leftCol) + neededHeight > limit) {
          ctx.currentCol = ctx.rightCol;
          ctx.isRightCol = true;
        }
      } else {
        if (getColHeight(ctx.rightCol) + neededHeight > limit) {
          ctx = createNewPage(false);
        }
      }
    };

    const appendElementToFlow = (element: HTMLElement) => {
      // Temporary attach to measure
      ctx.currentCol.appendChild(element);
      const elHeight = element.offsetHeight;
      const isFirst = pageElements.length === 1;
      const limit = maxAllowedColHeight(isFirst);

      if (getColHeight(ctx.currentCol) > limit) {
        ctx.currentCol.removeChild(element);

        if (!ctx.isRightCol) {
          ctx.currentCol = ctx.rightCol;
          ctx.isRightCol = true;
          ctx.currentCol.appendChild(element);

          if (getColHeight(ctx.currentCol) > limit) {
            ctx.currentCol.removeChild(element);
            ctx = createNewPage(false);
            ctx.currentCol.appendChild(element);
          }
        } else {
          ctx = createNewPage(false);
          ctx.currentCol.appendChild(element);
        }
      }
    };

    // ==========================================
    // SECTION 1: QUESTIONS FLOW (TWO COLUMNS)
    // ==========================================
    let currentRenderedSubject = '';
    let currentRenderedChapter = '';

    for (const item of orderedItems) {
      // 1. Subject Header if changed
      if (item.subject !== currentRenderedSubject) {
        currentRenderedSubject = item.subject;
        currentRenderedChapter = ''; // reset chapter

        const subjHeader = document.createElement('div');
        subjHeader.style.backgroundColor = '#0f172a';
        subjHeader.style.color = '#ffffff';
        subjHeader.style.padding = '4px 8px';
        subjHeader.style.fontSize = '9.5px';
        subjHeader.style.fontWeight = '800';
        subjHeader.style.letterSpacing = '0.08em';
        subjHeader.style.textTransform = 'uppercase';
        subjHeader.style.borderRadius = '3px';
        subjHeader.style.marginTop = '4px';
        subjHeader.innerHTML = `${currentRenderedSubject.toUpperCase()}`;
        appendElementToFlow(subjHeader);
      }

      // 2. Chapter Header if changed
      if (item.chapter_name && item.chapter_name !== currentRenderedChapter) {
        currentRenderedChapter = item.chapter_name;
        const chapHeader = document.createElement('div');
        chapHeader.style.borderBottom = '1.5px solid #94a3b8';
        chapHeader.style.paddingBottom = '2px';
        chapHeader.style.fontSize = '9px';
        chapHeader.style.fontWeight = '700';
        chapHeader.style.color = '#334155';
        chapHeader.style.letterSpacing = '0.04em';
        chapHeader.style.textTransform = 'uppercase';
        chapHeader.style.marginTop = '3px';
        chapHeader.innerHTML = `${currentRenderedChapter}`;
        appendElementToFlow(chapHeader);
      }

      // 3. Question Item Card (Compact Coaching Style)
      const qCard = document.createElement('div');
      qCard.className = 'pdf-question-item';
      qCard.style.fontSize = '10.5px';
      qCard.style.lineHeight = '1.42';
      qCard.style.color = '#0f172a';
      qCard.style.padding = '5px 0 8px 0';
      qCard.style.borderBottom = '1px dashed #e2e8f0';
      qCard.style.display = 'flex';
      qCard.style.flexDirection = 'column';
      qCard.style.gap = '4px';

      // Header line: Question Number & Code
      const qHead = document.createElement('div');
      qHead.style.display = 'flex';
      qHead.style.justifyContent = 'space-between';
      qHead.style.alignItems = 'baseline';
      qHead.style.marginBottom = '2px';
      qHead.innerHTML = `
        <span style="font-weight: 800; font-size: 11px; color: #0f172a;">Q${item.globalIndex}.</span>
        <span style="font-size: 7.5px; font-family: monospace; color: #94a3b8;">${item.question_code}</span>
      `;
      qCard.appendChild(qHead);

      // Question Statement
      const stmtEl = document.createElement('div');
      stmtEl.className = 'math-content';
      stmtEl.style.fontSize = '10.5px';
      stmtEl.style.lineHeight = '1.42';
      stmtEl.style.color = '#1e293b';
      stmtEl.innerHTML = item.renderedStatement;
      qCard.appendChild(stmtEl);

      // Standalone Diagrams if any
      if (item.validStandaloneUrls.length > 0) {
        const diagramContainer = document.createElement('div');
        diagramContainer.style.display = 'flex';
        diagramContainer.style.flexDirection = 'column';
        diagramContainer.style.alignItems = 'center';
        diagramContainer.style.margin = '4px 0';
        for (const url of item.validStandaloneUrls) {
          const img = document.createElement('img');
          img.src = url;
          img.crossOrigin = 'anonymous';
          img.style.maxWidth = '92%';
          img.style.maxHeight = '160px';
          img.style.height = 'auto';
          img.style.objectFit = 'contain';
          img.style.borderRadius = '4px';
          img.style.border = '1px solid #e2e8f0';
          img.style.padding = '3px';
          img.style.backgroundColor = '#ffffff';
          diagramContainer.appendChild(img);
        }
        qCard.appendChild(diagramContainer);
      }

      // Options (Compact Layout)
      if (item.resolvedOptions.length > 0) {
        const optionsWrapper = document.createElement('div');
        optionsWrapper.style.display = 'flex';
        optionsWrapper.style.flexDirection = 'column';
        optionsWrapper.style.gap = '2.5px';
        optionsWrapper.style.marginTop = '2px';

        for (const opt of item.resolvedOptions) {
          const optRow = document.createElement('div');
          optRow.style.display = 'flex';
          optRow.style.alignItems = 'flex-start';
          optRow.style.gap = '5px';
          optRow.style.fontSize = '10px';
          optRow.style.lineHeight = '1.35';

          optRow.innerHTML = `
            <span style="font-weight: 700; color: #475569; min-width: 18px;">(${opt.key})</span>
            <div class="math-content" style="flex: 1; color: #1e293b;">${opt.renderedHtml}</div>
          `;
          optionsWrapper.appendChild(optRow);
        }
        qCard.appendChild(optionsWrapper);
      }

      // Subtle Inline Mistake Attempt Indicator (NO correct answer revealed here!)
      const attemptNote = document.createElement('div');
      attemptNote.style.fontSize = '8px';
      attemptNote.style.marginTop = '2px';
      attemptNote.style.fontFamily = 'monospace';

      if (item.isWrong) {
        attemptNote.innerHTML = `
          <span style="color: #b91c1c; background: #fee2e2; padding: 1px 4px; border-radius: 2px; font-weight: 700;">
            [Your Attempt: (${item.userResponse}) &middot; WRONG]
          </span>
        `;
      } else {
        attemptNote.innerHTML = `
          <span style="color: #b45309; background: #fef3c7; padding: 1px 4px; border-radius: 2px; font-weight: 700;">
            [UNATTEMPTED]
          </span>
        `;
      }
      qCard.appendChild(attemptNote);

      appendElementToFlow(qCard);
    }

    // ==========================================
    // SECTION 2: ANSWER KEY (SEPARATE SECTION)
    // ==========================================
    const ansKeySectionHeader = document.createElement('div');
    ansKeySectionHeader.style.backgroundColor = '#0f172a';
    ansKeySectionHeader.style.color = '#ffffff';
    ansKeySectionHeader.style.padding = '5px 8px';
    ansKeySectionHeader.style.fontSize = '11px';
    ansKeySectionHeader.style.fontWeight = '800';
    ansKeySectionHeader.style.letterSpacing = '0.08em';
    ansKeySectionHeader.style.textTransform = 'uppercase';
    ansKeySectionHeader.style.borderRadius = '3px';
    ansKeySectionHeader.style.textAlign = 'center';
    ansKeySectionHeader.style.marginTop = '10px';
    ansKeySectionHeader.innerHTML = `&mdash; ANSWER KEY &mdash;`;
    appendElementToFlow(ansKeySectionHeader);

    // Answer Key Table Grid (Compact 2-column or 3-column in coaching style)
    const ansKeyCard = document.createElement('div');
    ansKeyCard.style.backgroundColor = '#f8fafc';
    ansKeyCard.style.border = '1px solid #cbd5e1';
    ansKeyCard.style.borderRadius = '4px';
    ansKeyCard.style.padding = '8px';
    ansKeyCard.style.display = 'grid';
    ansKeyCard.style.gridTemplateColumns = 'repeat(3, 1fr)';
    ansKeyCard.style.gap = '4px 8px';
    ansKeyCard.style.fontSize = '9.5px';
    ansKeyCard.style.fontFamily = 'monospace';

    for (const item of orderedItems) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.borderBottom = '1px dotted #e2e8f0';
      row.style.padding = '1.5px 0';
      row.innerHTML = `
        <span style="font-weight: 700; color: #0f172a;">Q${item.globalIndex}</span>
        <span style="font-weight: 800; color: #16a34a;">(${item.correctOption})</span>
      `;
      ansKeyCard.appendChild(row);
    }
    appendElementToFlow(ansKeyCard);

    // ==========================================
    // SECTION 3: SOLUTIONS & KEY CONCEPTS (SEPARATE SECTION)
    // ==========================================
    const itemsWithSolutions = orderedItems.filter(
      (item) => item.renderedSolution && item.renderedSolution.trim().length > 0
    );

    if (itemsWithSolutions.length > 0) {
      const solSectionHeader = document.createElement('div');
      solSectionHeader.style.backgroundColor = '#1e293b';
      solSectionHeader.style.color = '#ffffff';
      solSectionHeader.style.padding = '5px 8px';
      solSectionHeader.style.fontSize = '11px';
      solSectionHeader.style.fontWeight = '800';
      solSectionHeader.style.letterSpacing = '0.08em';
      solSectionHeader.style.textTransform = 'uppercase';
      solSectionHeader.style.borderRadius = '3px';
      solSectionHeader.style.textAlign = 'center';
      solSectionHeader.style.marginTop = '12px';
      solSectionHeader.innerHTML = `&mdash; HINTS &amp; DETAILED SOLUTIONS &mdash;`;
      appendElementToFlow(solSectionHeader);

      for (const item of itemsWithSolutions) {
        const solCard = document.createElement('div');
        solCard.className = 'pdf-solution-item';
        solCard.style.fontSize = '9.5px';
        solCard.style.lineHeight = '1.4';
        solCard.style.padding = '6px 8px';
        solCard.style.backgroundColor = '#f0f9ff';
        solCard.style.border = '1px solid #bae6fd';
        solCard.style.borderRadius = '4px';
        solCard.style.display = 'flex';
        solCard.style.flexDirection = 'column';
        solCard.style.gap = '3px';

        const solHead = document.createElement('div');
        solHead.style.display = 'flex';
        solHead.style.justifyContent = 'space-between';
        solHead.style.fontSize = '9.5px';
        solHead.style.fontWeight = '700';
        solHead.style.color = '#0369a1';
        solHead.innerHTML = `
          <span>Q${item.globalIndex}. Solution &middot; Ans (${item.correctOption})</span>
          <span style="font-size: 7.5px; font-family: monospace; color: #64748b;">${item.question_code}</span>
        `;
        solCard.appendChild(solHead);

        const solBody = document.createElement('div');
        solBody.className = 'math-content';
        solBody.style.color = '#0c4a6e';
        solBody.style.fontSize = '9.5px';
        solBody.innerHTML = item.renderedSolution;
        solCard.appendChild(solBody);

        appendElementToFlow(solCard);
      }
    }

    // 4. Attach Running Footers to all pages
    const totalPagesCount = pageElements.length;
    pageElements.forEach((pageEl, idx) => {
      const footerEl = document.createElement('div');
      footerEl.className = 'pdf-page-footer';
      footerEl.style.borderTop = '1px solid #cbd5e1';
      footerEl.style.paddingTop = '4px';
      footerEl.style.display = 'flex';
      footerEl.style.justifyContent = 'space-between';
      footerEl.style.alignItems = 'center';
      footerEl.style.fontSize = '8px';
      footerEl.style.fontWeight = '600';
      footerEl.style.color = '#64748b';
      footerEl.innerHTML = `
        <span>NEET UG CBT Exam Simulator &middot; Mistake Revision Module</span>
        <span>Page ${idx + 1} of ${totalPagesCount}</span>
      `;
      pageEl.appendChild(footerEl);
    });

    // 5. Wait for all fonts and images to load
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const allImgs = Array.from(stagingRoot.querySelectorAll('img'));
    await Promise.all(
      allImgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(() => resolve(), 3000);
        });
      })
    );

    // Short reflow buffer
    await new Promise((resolve) => setTimeout(resolve, 120));

    // 6. Generate PDF with jsPDF and html2canvas (Scale 2 for crisp vector/raster print quality)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const canvas = await html2canvas(pageElements[i], {
        scale: 2, // High resolution for clear print
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // 7. Save file
    const filename = `NEET_Mistake_Assignment_${session.id || Date.now()}.pdf`;
    pdf.save(filename);
  } finally {
    // 8. Clean up staging root
    if (stagingRoot && stagingRoot.parentNode) {
      stagingRoot.parentNode.removeChild(stagingRoot);
    }
  }
}
