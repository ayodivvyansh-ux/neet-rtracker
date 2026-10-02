import { jsPDF } from 'jspdf';
import * as fs from 'fs';

export function generateBodyFluidsPdf(): Buffer {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt

  const colWidth = 250;
  const leftColX = 36;
  const rightColX = 308;
  const gutterX = 297;

  // Helper to draw two-column vertical divider rule
  const drawColumnDivider = (topY: number, botY: number) => {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(gutterX, topY, gutterX, botY);
  };

  // =========================================================================
  // PAGE 1: Two-Column Layout (Left: Q1-Q6, Right: Q7-Q11)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Blood and Lymph', leftColX, 32);

  drawColumnDivider(38, pageHeight - 30);

  // --- PAGE 1: LEFT COLUMN (Q1 to Q6) ---
  let yLeft = 46;
  const lineGap = 8.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  // Q1
  const q1Text = '1. Given below are two statements: (2022)\nStatement I: The coagulum is formed of network of threads called thrombins\nStatement II: Spleen is the graveyard of erythrocytes\nIn the light of the above statements, choose the most appropriate answer:';
  const q1Lines = doc.splitTextToSize(q1Text, colWidth);
  doc.text(q1Lines, leftColX, yLeft);
  yLeft += q1Lines.length * lineGap;
  const q1Opts = [
    'a. Statement I is incorrect but Statement II is correct',
    'b. Both Statement I and Statement II are correct',
    'c. Both statement I and statement II are incorrect',
    'd. Statement I is correct but Statement II is incorrect'
  ];
  for (const opt of q1Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, leftColX + 6, yLeft);
    yLeft += optL.length * lineGap;
  }
  yLeft += 4;

  // Q2
  const q2Lines = doc.splitTextToSize('2. Which enzyme is responsible for the conversion of inactive fibrinogens to fibrins? (2021)', colWidth);
  doc.text(q2Lines, leftColX, yLeft);
  yLeft += q2Lines.length * lineGap;
  doc.text('a. Renin   b. Epinephrine\nc. Thrombokinase   d. Thrombin', leftColX + 6, yLeft);
  yLeft += 2 * lineGap + 4;

  // Q3
  const q3Lines = doc.splitTextToSize('3. Persons with ‘AB’ blood group are called as “Universal recipients”. This is due to: (2021)', colWidth);
  doc.text(q3Lines, leftColX, yLeft);
  yLeft += q3Lines.length * lineGap;
  const q3Opts = [
    'a. Absence of antigens A and B in plasma',
    'b. Presence of antibodies, anti-A and anti-B, on RBCs',
    'c. Absence of antibodies, anti-A and anti-B, in plasma',
    'd. Absence of antigens A and B on the surface of RBCs'
  ];
  for (const opt of q3Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, leftColX + 6, yLeft);
    yLeft += optL.length * lineGap;
  }
  yLeft += 4;

  // Q4: MATCHING TABLE
  doc.text('4. Match the following columns and select the correct option (2020)', leftColX, yLeft);
  yLeft += lineGap + 2;

  const q4TblY = yLeft;
  const q4RowH = 10;
  const q4Col1W = 105;
  const q4Col2W = colWidth - q4Col1W;

  doc.setFont('helvetica', 'bold');
  doc.text('Column-I', leftColX + 4, yLeft + 7.5);
  doc.text('Column-II', leftColX + q4Col1W + 4, yLeft + 7.5);
  yLeft += q4RowH;

  doc.setFont('helvetica', 'normal');
  const q4Rows = [
    { c1: '1. Eosinophils', c2: '(i) Immune response' },
    { c1: '2. Basophils', c2: '(ii) Phagocytosis' },
    { c1: '3. Neutrophils', c2: '(iii) Release destructive enzymes' },
    { c1: '4. Lymphocytes', c2: '(iv) Release granules with histamine' }
  ];
  for (const r of q4Rows) {
    doc.text(r.c1, leftColX + 4, yLeft + 7.5);
    const c2Lines = doc.splitTextToSize(r.c2, q4Col2W - 6);
    doc.text(c2Lines, leftColX + q4Col1W + 4, yLeft + 7.5);
    yLeft += Math.max(1, c2Lines.length) * q4RowH;
  }
  const q4H = yLeft - q4TblY;
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.5);
  doc.rect(leftColX, q4TblY, colWidth, q4H);
  doc.line(leftColX, q4TblY + q4RowH, leftColX + colWidth, q4TblY + q4RowH);
  doc.line(leftColX + q4Col1W, q4TblY, leftColX + q4Col1W, q4TblY + q4H);

  yLeft += 3;
  doc.text('a. (iv) (i) (ii) (iii)   b. (i) (ii) (iv) (iii)\nc. (ii) (i) (iii) (iv)   d. (iii) (iv) (ii) (i)', leftColX + 6, yLeft);
  yLeft += 2 * lineGap + 4;

  // Q5
  const q5Lines = doc.splitTextToSize('5. Which of the following conditions cause erythroblastosis foetalis? (2020-Covid)', colWidth);
  doc.text(q5Lines, leftColX, yLeft);
  yLeft += q5Lines.length * lineGap;
  const q5Opts = [
    'a. Mother Rh–ve and foetus Rh+ve',
    'b. Both mother and foetus Rh–ve',
    'c. Both mother and foetus Rh+ve',
    'd. Mother Rh+ve and foetus Rh–ve'
  ];
  for (const opt of q5Opts) {
    doc.text(opt, leftColX + 6, yLeft);
    yLeft += lineGap;
  }
  yLeft += 4;

  // Q6: MATCHING TABLE
  doc.text('6. Match the items given in Column-I with those in Column-II and select the correct option given below (2018)', leftColX, yLeft);
  yLeft += lineGap * 2 + 1;

  const q6TblY = yLeft;
  const q6Col1W = 100;
  doc.setFont('helvetica', 'bold');
  doc.text('Column-I', leftColX + 4, yLeft + 7.5);
  doc.text('Column-II', leftColX + q6Col1W + 4, yLeft + 7.5);
  yLeft += q4RowH;

  doc.setFont('helvetica', 'normal');
  const q6Rows = [
    { c1: 'A. Fibrinogen', c2: 'i. Osmotic balance' },
    { c1: 'B. Globulin', c2: 'ii. Blood clotting' },
    { c1: 'C. Albumin', c2: 'iii. Defence mechanism' }
  ];
  for (const r of q6Rows) {
    doc.text(r.c1, leftColX + 4, yLeft + 7.5);
    doc.text(r.c2, leftColX + q6Col1W + 4, yLeft + 7.5);
    yLeft += q4RowH;
  }
  const q6H = yLeft - q6TblY;
  doc.rect(leftColX, q6TblY, colWidth, q6H);
  doc.line(leftColX, q6TblY + q4RowH, leftColX + colWidth, q6TblY + q4RowH);
  doc.line(leftColX + q6Col1W, q6TblY, leftColX + q6Col1W, q6TblY + q6H);

  yLeft += 3;
  doc.text('a. A-iii B-ii C-i   b. A-i B-ii C-iii\nc. A-i B-iii C-ii   d. A-ii B-iii C-i', leftColX + 6, yLeft);

  // --- PAGE 1: RIGHT COLUMN (Q7 to Q11) ---
  let yRight = 46;

  // Q7
  const q7Lines = doc.splitTextToSize('7. Adult human RBCs are enucleate. Which of the following statement(s) is/are most appropriate explanation for this feature? (2017-Delhi)\nA. They do not need to reproduce, B. They are somatic cells, C. They do not metabolise, D. All their internal space is available for oxygen transport', colWidth);
  doc.text(q7Lines, rightColX, yRight);
  yRight += q7Lines.length * lineGap;
  doc.text('a. Only (D)   b. Only (A)\nc. (A), (C) and (D)   d. (B) and (C)', rightColX + 6, yRight);
  yRight += 2 * lineGap + 6;

  // Q8: NORMAL TEXT MCQ (MUST NEVER GET A FIGURE OR TABLE)
  const q8Lines = doc.splitTextToSize('8. Serum differs from blood in: (2016 - II)', colWidth);
  doc.text(q8Lines, rightColX, yRight);
  yRight += q8Lines.length * lineGap;
  const q8Opts = [
    'a. Lacking clotting factors',
    'b. Lacking antibodies',
    'c. Lacking globulins',
    'd. Lacking albumins'
  ];
  for (const opt of q8Opts) {
    doc.text(opt, rightColX + 6, yRight);
    yRight += lineGap;
  }
  yRight += 6;

  // Q9
  const q9Lines = doc.splitTextToSize('9. Name the blood cells, whose reduction in number can cause clotting disorder, leading to excessive loss of blood from the body. (2016 - II)', colWidth);
  doc.text(q9Lines, rightColX, yRight);
  yRight += q9Lines.length * lineGap;
  doc.text('a. Neutrophils   b. Thrombocytes\nc. Erythrocytes   d. Leukocytes', rightColX + 6, yRight);
  yRight += 2 * lineGap + 6;

  // Q10
  const q10Lines = doc.splitTextToSize('10. Which one of the following is correct? (2015)', colWidth);
  doc.text(q10Lines, rightColX, yRight);
  yRight += q10Lines.length * lineGap;
  const q10Opts = [
    'a. Lymph = Plasma + RBC + WBC',
    'b. Blood = Plasma + RBC + WBC + Platelets',
    'c. Plasma = Blood – Lymphocytes',
    'd. Serum = Blood + Fibrinogen'
  ];
  for (const opt of q10Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, rightColX + 6, yRight);
    yRight += optL.length * lineGap;
  }
  yRight += 6;

  // Q11
  const q11Lines = doc.splitTextToSize('11. Erythropoiesis starts in: (2015)', colWidth);
  doc.text(q11Lines, rightColX, yRight);
  yRight += q11Lines.length * lineGap;
  doc.text('a. Spleen   b. Red bone marrow\nc. Kidney   d. Liver', rightColX + 6, yRight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CHAPTER 5 Body Fluids and Circulation', leftColX, pageHeight - 15);

  // =========================================================================
  // PAGE 2: Two-Column Layout (Left: Q12-Q18, Right: Q19-Q23)
  // =========================================================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Body Fluids and Circulation 2', leftColX, 28);

  drawColumnDivider(34, pageHeight - 30);

  // --- PAGE 2: LEFT COLUMN (Q12 to Q18) ---
  yLeft = 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  // Q12
  const q12Lines = doc.splitTextToSize('12. If you suspect major deficiency of antibodies in a person, to which of the following would you look for confirmatory evidences? (2015 Re)', colWidth);
  doc.text(q12Lines, leftColX, yLeft);
  yLeft += q12Lines.length * lineGap;
  doc.text('a. Serum albumins   b. Haemocytes\nc. Serum globulins   d. Fibrinogen in plasma', leftColX + 6, yLeft);
  yLeft += 2 * lineGap + 4;

  // Q13
  const q13Lines = doc.splitTextToSize('13. Person with blood group AB is considered as universal recipient because he has: (2014)', colWidth);
  doc.text(q13Lines, leftColX, yLeft);
  yLeft += q13Lines.length * lineGap;
  const q13Opts = [
    'a. Both A and B antigens in the plasma but no antibodies',
    'b. Both A and B antigens on RBC but no antibodies in the plasma',
    'c. Both A and B antibodies in the plasma',
    'd. No antigen on RBC and no antibody in the plasma'
  ];
  for (const opt of q13Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, leftColX + 6, yLeft);
    yLeft += optL.length * lineGap;
  }
  yLeft += 4;

  // Q14
  const q14Lines = doc.splitTextToSize('14. The most abundant intracellular cation is: [OS] (2013)', colWidth);
  doc.text(q14Lines, leftColX, yLeft);
  yLeft += q14Lines.length * lineGap;
  doc.text('a. K+   b. Na+   c. Ca++   d. H+', leftColX + 6, yLeft);
  yLeft += lineGap + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Circulatory Pathways', leftColX, yLeft);
  yLeft += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  // Q15
  const q15Lines = doc.splitTextToSize('15. Which one of the following statements is correct? (2022)', colWidth);
  doc.text(q15Lines, leftColX, yLeft);
  yLeft += q15Lines.length * lineGap;
  const q15Opts = [
    'a. Increased ventricular pressure closes semilunar valves',
    'b. The AVN generates action potential for atrial contraction',
    'c. Tricuspid and bicuspid valves open by atrial contraction',
    'd. Blood moves freely from atrium to ventricle in joint diastole'
  ];
  for (const opt of q15Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, leftColX + 6, yLeft);
    yLeft += optL.length * lineGap;
  }
  yLeft += 4;

  // Q16
  const q16Lines = doc.splitTextToSize('16. The QRS complex in a standard ECG represents: (2020)', colWidth);
  doc.text(q16Lines, leftColX, yLeft);
  yLeft += q16Lines.length * lineGap;
  doc.text('a. Depolarisation of auricles   b. Depolarisation of ventricles\nc. Repolarisation of ventricles   d. Repolarisation of auricles', leftColX + 6, yLeft);
  yLeft += 2 * lineGap + 4;

  // Q17
  const q17Lines = doc.splitTextToSize('17. What would be the heart rate of a person if the cardiac output is 5 L, end-diastolic volume 100 mL and end-systolic volume 50 mL? (2019)', colWidth);
  doc.text(q17Lines, leftColX, yLeft);
  yLeft += q17Lines.length * lineGap;
  doc.text('a. 50 bpm   b. 75 bpm   c. 100 bpm   d. 125 bpm', leftColX + 6, yLeft);
  yLeft += lineGap + 5;

  // Q18: MATCHING TABLE (STRICTLY IN LEFT COLUMN)
  doc.text('18. Match the Column-I with Column-II (2019)', leftColX, yLeft);
  yLeft += lineGap + 2;

  const q18TblY = yLeft;
  const q18Col1W = 105;
  const q18Col2W = colWidth - q18Col1W;

  doc.setFont('helvetica', 'bold');
  doc.text('Column-I', leftColX + 4, yLeft + 7.5);
  doc.text('Column-II', leftColX + q18Col1W + 4, yLeft + 7.5);
  yLeft += q4RowH;

  doc.setFont('helvetica', 'normal');
  const q18Rows = [
    { c1: 'A. P - wave', c2: 'i. Depolarisation of ventricles' },
    { c1: 'B. QRS complex', c2: 'ii. Repolarisation of ventricle' },
    { c1: 'C. T - wave', c2: 'iii. Coronary ischemia' },
    { c1: 'D. Reduction in size of T-wave', c2: 'iv. Depolarisation of atria' },
    { c1: '', c2: 'v. Repolarisation of atria' }
  ];
  for (const r of q18Rows) {
    let c1Count = 0;
    if (r.c1) {
      const c1L = doc.splitTextToSize(r.c1, q18Col1W - 6);
      doc.text(c1L, leftColX + 4, yLeft + 7.5);
      c1Count = c1L.length;
    }
    const c2L = doc.splitTextToSize(r.c2, q18Col2W - 6);
    doc.text(c2L, leftColX + q18Col1W + 4, yLeft + 7.5);
    yLeft += Math.max(1, c1Count, c2L.length) * q4RowH;
  }
  const q18H = yLeft - q18TblY;
  doc.setDrawColor(190, 190, 190);
  doc.rect(leftColX, q18TblY, colWidth, q18H);
  doc.line(leftColX, q18TblY + q4RowH, leftColX + colWidth, q18TblY + q4RowH);
  doc.line(leftColX + q18Col1W, q18TblY, leftColX + q18Col1W, q18TblY + q18H);

  yLeft += 3;
  doc.text('a. A-iv B-i C-ii D-iii   b. A-iv B-i C-ii D-v\nc. A-ii B-i C-v D-iii   d. A-ii B-iii C-v D-iv', leftColX + 6, yLeft);

  // --- PAGE 2: RIGHT COLUMN (Q19 to Q23) ---
  yRight = 40;

  // Q19: MATCHING TABLE (STRICTLY IN RIGHT COLUMN)
  doc.text('19. Match the items given in Column-I with those in Column-II and select the correct option given below: (2018)', rightColX, yRight);
  yRight += lineGap * 2 + 1;

  const q19TblY = yRight;
  const q19Col1W = 95;
  const q19Col2W = colWidth - q19Col1W;

  doc.setFont('helvetica', 'bold');
  doc.text('Column-I', rightColX + 4, yRight + 7.5);
  doc.text('Column-II', rightColX + q19Col1W + 4, yRight + 7.5);
  yRight += q4RowH;

  doc.setFont('helvetica', 'normal');
  const q19Rows = [
    { c1: 'A. Tricuspid valve', c2: 'i. Between left atrium & left ventricle' },
    { c1: 'B. Bicuspid valve', c2: 'ii. Between right ventricle & pulmonary artery' },
    { c1: 'C. Semilunar valve', c2: 'iii. Between right atrium & right ventricle' }
  ];
  for (const r of q19Rows) {
    doc.text(r.c1, rightColX + 4, yRight + 7.5);
    const c2L = doc.splitTextToSize(r.c2, q19Col2W - 6);
    doc.text(c2L, rightColX + q19Col1W + 4, yRight + 7.5);
    yRight += Math.max(1, c2L.length) * q4RowH;
  }
  const q19H = yRight - q19TblY;
  doc.rect(rightColX, q19TblY, colWidth, q19H);
  doc.line(rightColX, q19TblY + q4RowH, rightColX + colWidth, q19TblY + q4RowH);
  doc.line(rightColX + q19Col1W, q19TblY, rightColX + q19Col1W, rightColX + q19TblY + q19H);

  yRight += 3;
  doc.text('a. A-iii B-i C-ii   b. A-i B-iii C-ii\nc. A-i B-ii C-iii   d. A-ii B-i C-iii', rightColX + 6, yRight);
  yRight += 2 * lineGap + 5;

  // Q20
  const q20Lines = doc.splitTextToSize('20. Blood pressure in the mammalian aorta is maximum during: (2015)', colWidth);
  doc.text(q20Lines, rightColX, yRight);
  yRight += q20Lines.length * lineGap;
  doc.text('a. Systole of the left ventricle   b. Diastole of the right atrium\nc. Systole of the left atrium   d. Diastole of the right ventricle', rightColX + 6, yRight);
  yRight += 2 * lineGap + 5;

  // Q21
  const q21Lines = doc.splitTextToSize('21. Which one of the following animals has two separate circulatory pathways? (2015 Re)', colWidth);
  doc.text(q21Lines, rightColX, yRight);
  yRight += q21Lines.length * lineGap;
  doc.text('a. Lizard   b. Whale   c. Shark   d. Frog', rightColX + 6, yRight);
  yRight += lineGap + 5;

  // Q22
  const q22Lines = doc.splitTextToSize('22. Doctors use stethoscope to hear the sounds produced during each cardiac cycle. The second sound is heard when: (2015 Re)', colWidth);
  doc.text(q22Lines, rightColX, yRight);
  yRight += q22Lines.length * lineGap;
  const q22Opts = [
    'a. Ventricular walls vibrate due to blood from atria',
    'b. Semilunar valves close after blood flows into vessels',
    'c. AV node receives signal from SA Node',
    'd. AV valves open up'
  ];
  for (const opt of q22Opts) {
    const optL = doc.splitTextToSize(opt, colWidth - 8);
    doc.text(optL, rightColX + 6, yRight);
    yRight += optL.length * lineGap;
  }
  yRight += 5;

  // Q23: WITH ECG DIAGRAM (STRICTLY IN RIGHT COLUMN)
  const q23Prompt = '23. The diagram given here is the standard ECG of a normal person. The P-wave represents the: (2013)';
  const q23Lines = doc.splitTextToSize(q23Prompt, colWidth);
  doc.text(q23Lines, rightColX, yRight);
  yRight += q23Lines.length * lineGap + 3;

  // Draw ECG Diagram within Right Column width (rightColX to rightColX + colWidth)
  const ecgX = rightColX + 10;
  const ecgY = yRight + 2;
  const ecgW = colWidth - 20;
  const ecgH = 46;

  // ECG Box border
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.6);
  doc.rect(ecgX - 4, ecgY - 4, ecgW + 8, ecgH + 8);

  // Baseline
  doc.setDrawColor(220, 220, 220);
  const baselineY = ecgY + 28;
  doc.line(ecgX - 4, baselineY, ecgX + ecgW + 4, baselineY);

  // ECG Waveform
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(1.3);

  // Trace
  doc.line(ecgX, baselineY, ecgX + 18, baselineY);
  // P wave
  doc.curveTo(ecgX + 26, baselineY - 12, ecgX + 34, baselineY - 12, ecgX + 42, baselineY);
  // PR segment
  doc.line(ecgX + 42, baselineY, ecgX + 60, baselineY);
  // Q
  doc.line(ecgX + 60, baselineY, ecgX + 66, baselineY + 5);
  // R
  doc.line(ecgX + 66, baselineY + 5, ecgX + 75, baselineY - 32);
  // S
  doc.line(ecgX + 75, baselineY - 32, ecgX + 83, baselineY + 10);
  // ST segment
  doc.line(ecgX + 83, baselineY + 10, ecgX + 92, baselineY);
  doc.line(ecgX + 92, baselineY, ecgX + 115, baselineY);
  // T wave
  doc.curveTo(ecgX + 128, baselineY - 18, ecgX + 140, baselineY - 18, ecgX + 152, baselineY);
  // End baseline
  doc.line(ecgX + 152, baselineY, ecgX + ecgW, baselineY);

  // Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('P', ecgX + 31, baselineY - 14);
  doc.text('Q', ecgX + 63, baselineY + 12);
  doc.text('R', ecgX + 72, baselineY - 34);
  doc.text('S', ecgX + 82, baselineY + 16);
  doc.text('T', ecgX + 137, baselineY - 20);

  yRight += ecgH + 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('a. End of systole   b. Contraction of both the atria\nc. Initiation of ventricular contraction   d. Beginning of systole', rightColX + 6, yRight);

  // =========================================================================
  // PAGE 3: Questions 24 to 26 and Answer Key Matrix
  // =========================================================================
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("Chapter & Topicwise NEET PYQ's P 3 W", leftColX, 36);

  doc.setFontSize(10);
  doc.text('Double Circulation & Regulation of Cardiac Activity', leftColX, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let y3 = 72;
  const p3LineGap = 10;

  const page3Questions = [
    {
      num: 24,
      text: 'Which of the following is associated with decrease in cardiac output? (2020-Covid)',
      options: ['a. Parasympathetic neural signals', 'b. Pneumotaxic centre', 'c. Adrenal medullary hormones', 'd. Sympathetic nerves']
    },
    {
      num: 25,
      text: 'The hepatic portal vein drains blood to liver from (2017-Delhi)',
      options: ['a. Heart', 'b. Stomach', 'c. Kidneys', 'd. Intestine']
    }
  ];

  for (const q of page3Questions) {
    const qLines = doc.splitTextToSize(`${q.num}. ${q.text}`, pageWidth - 72);
    doc.text(qLines, leftColX, y3);
    y3 += qLines.length * p3LineGap + 2;
    for (const opt of q.options) {
      doc.text(opt, leftColX + 8, y3);
      y3 += p3LineGap;
    }
    y3 += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Disorders of Circulatory System', leftColX, y3);
  y3 += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const q26Lines = doc.splitTextToSize('26. Blood pressure in the pulmonary artery is: (2016 - I)', pageWidth - 72);
  doc.text(q26Lines, leftColX, y3);
  y3 += q26Lines.length * p3LineGap + 2;
  const q26Options = [
    'a. Same as that in the aorta',
    'b. More than that in the carotid',
    'c. More than that in the pulmonary vein',
    'd. Less than that in the vena cava'
  ];
  for (const opt of q26Options) {
    doc.text(opt, leftColX + 8, y3);
    y3 += p3LineGap;
  }
  y3 += 24;

  // Answer Key Matrix at bottom of Page 3
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17', leftColX, y3);
  y3 += 12;
  doc.text('a d c d a d a a b b b c b a d b c', leftColX, y3);
  y3 += 14;
  doc.text('18 19 20 21 22 23 24 25 26', leftColX, y3);
  y3 += 12;
  doc.text('a a a b b b a d c', leftColX, y3);
  y3 += 16;
  doc.setFont('helvetica', 'bold');
  doc.text('Answer Key', leftColX, y3);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const buf = generateBodyFluidsPdf();
  fs.writeFileSync('Body_Fluids_and_Circulation_PYQs.pdf', buf);
  console.log('Generated canonical Body_Fluids_and_Circulation_PYQs.pdf:', buf.length, 'bytes');
}
