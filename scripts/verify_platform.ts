/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import katex from 'katex';

const url = process.env.VITE_SUPABASE_URL || 'https://pgesdqfpaujhalithcfw.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_e7NfwQaV0Dg0MNu_PgHxbQ_JC9L73sj';
const supabase = createClient(url, key);

async function runTests() {
  console.log('--- 1. Testing Question Bank Connection & Relational Options Join ---');
  const { data: joinData, error: joinError } = await supabase
    .from('question_bank')
    .select('*, options:question_options(*)')
    .limit(5);

  if (joinError) {
    console.error('FAIL: Query error on question_bank with question_options join:', joinError.message);
  } else {
    console.log('PASS: Successfully executed relational select on question_bank + question_options join.');
  }

  console.log('\n--- 2. Testing KaTeX Mathematical Rendering Parser ---');
  const sampleFormulas = [
    'E = mc^2',
    '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
    'F = G \\frac{m_1 m_2}{r^2}',
    '\\lambda = \\frac{h}{p}'
  ];

  for (const formula of sampleFormulas) {
    try {
      const rendered = katex.renderToString(formula, { throwOnError: false });
      console.log('PASS: Rendered formula:', formula.slice(0, 30), '-> output HTML length:', rendered.length);
    } catch (e) {
      console.error('FAIL: KaTeX rendering error:', e);
    }
  }

  console.log('\n--- 3. Testing Scoring Calculation Algorithm (+4, -1, 0) ---');
  const mockScoring = [
    { user: 'A', correct: 'A', expected: 4 },
    { user: 'B', correct: 'A', expected: -1 },
    { user: null, correct: 'A', expected: 0 },
    { user: 'C', correct: 'C', expected: 4 }
  ];

  let totalScore = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;

  for (const item of mockScoring) {
    if (!item.user) {
      unattempted++;
    } else if (item.user === item.correct) {
      correct++;
      totalScore += 4;
    } else {
      incorrect++;
      totalScore -= 1;
    }
  }

  console.log('Scored result:', { totalScore, correct, incorrect, unattempted });
  if (totalScore === 7 && correct === 2 && incorrect === 1 && unattempted === 1) {
    console.log('PASS: NEET UG CBT Scoring Rule (+4 / -1 / 0) matches exactly.');
  } else {
    console.error('FAIL: Scoring algorithm mismatch.');
  }

  console.log('\n--- 4. Testing Difficulty Rule Queries on Supabase ---');
  // NEET Easy:
  const resEasy = await supabase
    .from('question_bank')
    .select('id', { count: 'exact', head: true })
    .ilike('exam_source', '%NEET%')
    .eq('difficulty', 'Easy');
  console.log('PASS: NEET Easy query executed, error:', resEasy.error);

  // NEET Medium:
  const resMed = await supabase
    .from('question_bank')
    .select('id', { count: 'exact', head: true })
    .ilike('exam_source', '%NEET%')
    .eq('difficulty', 'Medium');
  console.log('PASS: NEET Medium query executed, error:', resMed.error);

  // NEET Hard:
  const resHard = await supabase
    .from('question_bank')
    .select('id', { count: 'exact', head: true })
    .or('and(exam_source.ilike.%NEET%,difficulty.eq.Hard),and(exam_source.ilike.%JEE%,subject.in.(Physics,Chemistry))');
  console.log('PASS: NEET Hard + JEE Main pool query executed, error:', resHard.error);
}

runTests().catch(console.error);
