import { jsPDF } from 'jspdf';
import { isSupabaseConfigured } from '../lib/supabase';
import { uploadResultPdf } from './storage/pdfStorage';
import { Question, TestSession } from '../types';

export function generateWrongAndUnattemptedPDF(
  testSession: TestSession,
  allQuestions: Question[]
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

  const wrongQuestions: { question: Question; userAns: string | null; index: number }[] = [];
  const unattemptedQuestions: { question: Question; index: number }[] = [];

  testSession.questionIds.forEach((qId, idx) => {
    const q = questionMap.get(qId);
    if (!q) return;
    const userAns = testSession.userResponses[qId];

    if (q.correctAnswer === 'UNKNOWN') {
      return; // Exclude un-keyed questions from wrong list
    }
    if (!userAns) {
      unattemptedQuestions.push({ question: q, index: idx + 1 });
    } else if (userAns !== q.correctAnswer) {
      wrongQuestions.push({ question: q, userAns, index: idx + 1 });
    }
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  }

  function drawHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 60, 130);
    doc.text('NEET UG - INCORRECT & UNATTEMPTED QUESTIONS REPORT', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Test: ${testSession.title} | Generated: ${new Date().toLocaleString()} | Total Questions in Test: ${testSession.questionIds.length}`,
      margin,
      y
    );
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // First page header
  drawHeader();

  // Summary box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const scoreText = testSession.score
    ? `Score: ${testSession.score.totalScore}/${testSession.score.maxScore} (${testSession.score.accuracy}% Acc)`
    : '';
  doc.text(`Performance Summary: ${scoreText}`, margin + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text(`• Wrong Questions: ${wrongQuestions.length}`, margin + 5, y + 13);
  doc.setTextColor(217, 119, 6);
  doc.text(`• Unattempted Questions: ${unattemptedQuestions.length}`, margin + 55, y + 13);
  doc.setTextColor(22, 163, 74);
  const correctCount = testSession.score ? testSession.score.correctCount : 0;
  doc.text(`• Correct Questions: ${correctCount}`, margin + 120, y + 13);

  y += 28;

  // SECTION 1: WRONG QUESTIONS
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28);
  doc.text(`SECTION 1: WRONG QUESTIONS (${wrongQuestions.length})`, margin + 4, y + 6);
  y += 14;

  if (wrongQuestions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No incorrect questions in this test session! Excellent job.', margin + 4, y);
    y += 10;
  } else {
    wrongQuestions.forEach((item, i) => {
      renderQuestionBlock(item.question, item.index, item.userAns, 'WRONG');
    });
  }

  checkPageBreak(30);

  // SECTION 2: UNATTEMPTED QUESTIONS
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9);
  doc.text(`SECTION 2: UNATTEMPTED QUESTIONS (${unattemptedQuestions.length})`, margin + 4, y + 6);
  y += 14;

  if (unattemptedQuestions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('All questions were attempted in this test.', margin + 4, y);
    y += 10;
  } else {
    unattemptedQuestions.forEach((item) => {
      renderQuestionBlock(item.question, item.index, null, 'UNATTEMPTED');
    });
  }

  function renderQuestionBlock(
    q: Question,
    testQNum: number,
    userAnswer: string | null,
    type: 'WRONG' | 'UNATTEMPTED'
  ) {
    const minHeightNeeded = 50;
    checkPageBreak(minHeightNeeded);

    // Question header badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Q${testQNum}. [${q.subject} > ${q.chapter}] ${q.difficulty ? `(${q.difficulty})` : ''}`,
      margin,
      y
    );
    y += 5;

    // Question text wrapped
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const splitQuestion = doc.splitTextToSize(q.text, contentWidth);
    doc.text(splitQuestion, margin, y);
    y += splitQuestion.length * 4.5 + 2;

    // Options
    const optKeys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    doc.setFontSize(9);

    optKeys.forEach((key) => {
      const optText = q.options[key] || '';
      const isCorrect = q.correctAnswer === key;
      const isUserPicked = userAnswer === key;

      let prefix = `(${key}) `;
      if (isUserPicked && !isCorrect) {
        prefix = `[X] (${key}) `;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // Red
      } else if (isCorrect) {
        prefix = `[✓] (${key}) `;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74); // Green
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
      }

      const splitOpt = doc.splitTextToSize(`${prefix}${optText}`, contentWidth - 6);
      checkPageBreak(splitOpt.length * 4 + 2);
      doc.text(splitOpt, margin + 4, y);
      y += splitOpt.length * 4 + 1;
    });

    y += 2;

    // Answers Summary & Explanation Box
    checkPageBreak(20);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 14 + (q.explanation ? 10 : 0), 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Your Answer: ${userAnswer ? `(${userAnswer})` : 'Not Attempted'}`, margin + 4, y + 5);

    doc.setTextColor(22, 163, 74);
    doc.text(`Correct Answer: (${q.correctAnswer})`, margin + 60, y + 5);

    if (q.explanation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitExp = doc.splitTextToSize(`Explanation: ${q.explanation}`, contentWidth - 8);
      doc.text(splitExp, margin + 4, y + 10);
      y += splitExp.length * 3.5;
    }

    y += 18;

    // Separator
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  return doc;
}

export function downloadWrongAndUnattemptedPDF(testSession: TestSession, questions: Question[]) {
  const doc = generateWrongAndUnattemptedPDF(testSession, questions);
  const cleanTitle = (testSession.title || 'NEET_Mock')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const fileName = `NEET_Wrong_Unattempted_${cleanTitle}_${Date.now()}.pdf`;

  // Local immediate download
  doc.save(fileName);

  // Sync to Supabase storage if available
  if (isSupabaseConfigured()) {
    try {
      const blob = doc.output('blob');
      uploadResultPdf(blob, fileName, testSession.id, 'wrong_unattempted').catch((err) => {
        console.warn('[pdfExport] Result PDF upload to Supabase storage:', err);
      });
    } catch (e) {
      console.warn('[pdfExport] Could not generate blob for storage:', e);
    }
  }
}
