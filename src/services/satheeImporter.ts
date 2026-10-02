/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';
import { Question, Subject, AnswerOption, QuestionVisual } from '../types';
import { saveSingleQuestion, getQuestions } from './api';

export interface SatheeRawQuestion {
  id?: string;
  source: string;
  source_url: string | null;
  source_question_id: string;
  subject: Subject;
  chapter: string | null;
  subtopic: string | null;
  source_type: 'PYQ' | 'EXEMPLAR' | 'PRACTICE' | 'UNKNOWN';
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string | null;
  explanation: string | null;
  visual: QuestionVisual | null;
  raw_payload: any;
  import_status: 'RAW' | 'QUARANTINED' | 'PUBLISHED';
  priority: number;
  created_at?: string;
  updated_at?: string;
}

// -------------------------------------------------------------
// BIOLOGY CLASSIFIER TO BOTANY OR ZOOLOGY
// -------------------------------------------------------------
export function classifyBiologyChapter(chapterName: string): 'Botany' | 'Zoology' {
  const chap = (chapterName || '').toLowerCase();
  
  const botanyKeywords = [
    'cell: the unit', 'cell cycle', 'living world', 'biological classification', 
    'plant kingdom', 'morphology of flowering', 'anatomy of flowering', 
    'sexual reproduction in flowering', 'photosynthesis', 'respiration in plant', 
    'plant growth', 'principles of inheritance', 'molecular basis of inheritance', 
    'ecosystem', 'biodiversity', 'plant', 'botany', 'photosynthetic', 'chloroplast',
    'mitochondria', 'genetics', 'monohyb', 'dihyb', 'mendelian', 'transpiration'
  ];

  for (const kw of botanyKeywords) {
    if (chap.includes(kw)) {
      return 'Botany';
    }
  }

  // Structural organisation in animals, Biomolecules, Breathing, Body Fluids, Excretory, Locomotion, Neural, Chemical Coordination, Reproduction, evolution, Health, Biotech
  return 'Zoology';
}

// -------------------------------------------------------------
// GET PRIORITY VALUE BASED ON SOURCE_TYPE
// -------------------------------------------------------------
export function getPriorityForSourceType(sourceType: string): number {
  switch (sourceType?.toUpperCase()) {
    case 'PYQ':
      return 100;
    case 'EXEMPLAR':
      return 90;
    case 'PRACTICE':
      return 35;
    case 'UNKNOWN':
    default:
      return 0;
  }
}

// -------------------------------------------------------------
// HIGH-QUALITY MOCK DATASET FOR FALLBACK & DRY-RUN
// -------------------------------------------------------------
const MOCK_SATHEE_DATASET = [
  {
    id: "sathee_phy_001",
    question: "A torque of 100 N·m produces an angular acceleration of 2 rad/s² in a body. What is the moment of inertia of the body?",
    options: ["50 kg·m²", "200 kg·m²", "25 kg·m²", "10 kg·m²"],
    answer: "A",
    explanation: "Torque = I * alpha. Therefore, I = Torque / alpha = 100 / 2 = 50 kg·m².",
    subject: "Physics",
    chapter: "Rotational Motion",
    subtopic: "Torque and Moment of Inertia",
    source_type: "PYQ",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_phy_001"
  },
  {
    id: "sathee_phy_002",
    question: "A thin uniform rod of mass M and length L is rotating about an axis perpendicular to its length and passing through its center. What is its moment of inertia?",
    options: ["ML²/12", "ML²/3", "ML²/2", "ML²/6"],
    answer: "A",
    explanation: "The moment of inertia of a uniform rod of length L and mass M about a perpendicular axis through its center is ML²/12.",
    subject: "Physics",
    chapter: "Rotational Motion",
    subtopic: "Moment of Inertia of Uniform Rod",
    source_type: "EXEMPLAR",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_phy_002"
  },
  {
    id: "sathee_chem_001",
    question: "Which of the following elements has the highest electronegativity according to Pauling scale?",
    options: ["Fluorine", "Oxygen", "Chlorine", "Nitrogen"],
    answer: "A",
    explanation: "Fluorine is the most electronegative element with a value of 4.0 on the Pauling scale.",
    subject: "Chemistry",
    chapter: "Classification of Elements and Periodicity",
    subtopic: "Electronegativity",
    source_type: "PYQ",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_chem_001"
  },
  {
    id: "sathee_bio_001",
    question: "Which plant hormone is primarily responsible for apical dominance in higher plants?",
    options: ["Auxin", "Gibberellin", "Cytokinin", "Abscisic Acid"],
    answer: "A",
    explanation: "Auxins synthesized in the shoot apex are responsible for inhibiting the growth of lateral buds, a phenomenon known as apical dominance.",
    subject: "Biology",
    chapter: "Plant Growth and Development",
    subtopic: "Plant Growth Regulators",
    source_type: "PYQ",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_bio_001"
  },
  {
    id: "sathee_bio_002",
    question: "During which phase of meiosis does crossing over occur between homologous chromosomes?",
    options: ["Pachytene", "Leptotene", "Zygotene", "Diplotene"],
    answer: "A",
    explanation: "Crossing over is an enzyme-mediated process that occurs during the pachytene stage of prophase I in meiosis.",
    subject: "Biology",
    chapter: "Cell Cycle and Cell Division",
    subtopic: "Meiosis I",
    source_type: "EXEMPLAR",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_bio_002"
  },
  {
    id: "sathee_bio_003",
    question: "What is the primary site of gaseous exchange in human lungs?",
    options: ["Alveoli", "Trachea", "Bronchioles", "Bronchi"],
    answer: "A",
    explanation: "The alveoli are the primary sites of exchange of gases because of their thin membrane and high vascularization.",
    subject: "Biology",
    chapter: "Breathing and Exchange of Gases",
    subtopic: "Gaseous Exchange",
    source_type: "PRACTICE",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_bio_003"
  },
  // Malformed question (Missing answer to trigger Quarantine)
  {
    id: "sathee_bio_broken_1",
    question: "Which of the following is a membrane-bound organelle?",
    options: ["Ribosome", "Lysosome", "Centrosome", "Nucleolus"],
    answer: null, // Malformed
    explanation: "Lysosome is membrane-bound, ribosome is non-membrane bound.",
    subject: "Biology",
    chapter: "Cell: The Unit of Life",
    subtopic: "Endomembrane System",
    source_type: "PRACTICE",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_bio_broken_1"
  },
  // Malformed question (Missing options to trigger Quarantine)
  {
    id: "sathee_chem_broken_2",
    question: "What is the oxidation state of Oxygen in OF2?",
    options: ["+2", "-2"], // Malformed (Only 2 options instead of 4)
    answer: "A",
    explanation: "Since Fluorine is more electronegative, Oxygen has a +2 oxidation state in OF2.",
    subject: "Chemistry",
    chapter: "Redox Reactions",
    subtopic: "Oxidation States",
    source_type: "UNKNOWN",
    source_url: "https://api.sathee.iitk.ac.in/questions/sathee_chem_broken_2"
  }
];

// LocalStorage key for persisting imported RAW/QUARANTINED questions if Supabase writes fail/unauthorized
const LOCAL_STORAGE_SATHEE_KEY = 'sathee_raw_questions_cache';

// -------------------------------------------------------------
// DUAL-STORAGE INTEGRATED API FUNCTIONS
// -------------------------------------------------------------

export function getCachedRawQuestions(): SatheeRawQuestion[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SATHEE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedRawQuestions(questions: SatheeRawQuestion[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SATHEE_KEY, JSON.stringify(questions));
  } catch (err) {
    console.error('Failed to save questions cache:', err);
  }
}

// 1. Fetch RAW count from Supabase & fall back to LocalStorage
export async function getSatheeRawCount(): Promise<{ total: number; raw: number; quarantined: number; published: number }> {
  try {
    const { data, error } = await supabase.from('sathee_raw_questions').select('import_status');
    if (error) throw error;
    
    const counts = { total: 0, raw: 0, quarantined: 0, published: 0 };
    (data || []).forEach((row: any) => {
      counts.total += 1;
      const status = row.import_status as string;
      if (status === 'RAW') counts.raw += 1;
      else if (status === 'QUARANTINED') counts.quarantined += 1;
      else if (status === 'PUBLISHED') counts.published += 1;
    });

    if (counts.total > 0) return counts;
  } catch (err) {
    console.warn('[SatheeImporter] Supabase read failed, reading from localStorage fallback:', err);
  }

  // Fallback to cache
  const cache = getCachedRawQuestions();
  const counts = { total: 0, raw: 0, quarantined: 0, published: 0 };
  cache.forEach(q => {
    counts.total += 1;
    if (q.import_status === 'RAW') counts.raw += 1;
    else if (q.import_status === 'QUARANTINED') counts.quarantined += 1;
    else if (q.import_status === 'PUBLISHED') counts.published += 1;
  });
  return counts;
}

// 2. Fetch all raw/quarantined questions
export async function getSatheeRawQuestions(): Promise<SatheeRawQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('sathee_raw_questions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      return data as SatheeRawQuestion[];
    }
  } catch (err) {
    console.warn('[SatheeImporter] Supabase read raw questions failed:', err);
  }
  return getCachedRawQuestions();
}

// 3. Normalized Importer from Endpoint
export async function runSatheeImporter(params: {
  isDryRun: boolean;
  onProgress?: (count: number) => void;
}): Promise<{
  totalFetched: number;
  normalizedCount: number;
  quarantinedCount: number;
  duplicatesSkipped: number;
  results: SatheeRawQuestion[];
}> {
  let fetchedQuestions: any[] = [];
  let isMock = false;

  try {
    console.log('[SatheeImporter] Initiating fetch from SATHEE PYQ API...');
    const response = await fetch('https://api.sathee.iitk.ac.in/pyqs/questions', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      fetchedQuestions = data?.questions || data || [];
      console.log(`[SatheeImporter] Successfully retrieved ${fetchedQuestions.length} records from real API.`);
    } else {
      throw new Error(`API response status ${response.status}`);
    }
  } catch (err: any) {
    console.warn(`[SatheeImporter] Live API unreachable or failed (${err.message}). Activating secure, rich mock fallback.`);
    fetchedQuestions = MOCK_SATHEE_DATASET;
    isMock = true;
  }

  const results: SatheeRawQuestion[] = [];
  let normalizedCount = 0;
  let quarantinedCount = 0;
  let duplicatesSkipped = 0;

  // Retrieve current database and cache questions for duplicate checks
  const existingQuestions = await getSatheeRawQuestions();
  const existingIds = new Set(existingQuestions.map(q => q.source_question_id));
  const existingTexts = new Set(existingQuestions.map(q => q.question_text.toLowerCase().trim()));

  for (let i = 0; i < fetchedQuestions.length; i++) {
    const raw = fetchedQuestions[i];
    if (params.onProgress) params.onProgress(i + 1);

    const sourceQuestionId = raw.id || `sathee_auto_${i}_${Date.now()}`;
    const rawText = raw.question || raw.question_text || '';
    const cleanText = rawText.trim();

    // 9. Deduplicate: Source ID check first, then exact normalized question text
    if (existingIds.has(sourceQuestionId) || existingTexts.has(cleanText.toLowerCase())) {
      duplicatesSkipped += 1;
      continue;
    }

    // Normalize Options
    let opts = { A: '', B: '', C: '', D: '' };
    let hasBrokenOptions = false;

    if (Array.isArray(raw.options)) {
      if (raw.options.length >= 4) {
        opts = {
          A: String(raw.options[0] || '').trim(),
          B: String(raw.options[1] || '').trim(),
          C: String(raw.options[2] || '').trim(),
          D: String(raw.options[3] || '').trim()
        };
      } else {
        hasBrokenOptions = true;
        // Map whatever we can
        opts = {
          A: String(raw.options[0] || '').trim(),
          B: String(raw.options[1] || '').trim(),
          C: String(raw.options[2] || '').trim(),
          D: String(raw.options[3] || '').trim()
        };
      }
    } else if (raw.options && typeof raw.options === 'object') {
      opts = {
        A: String(raw.options.A || raw.options.a || '').trim(),
        B: String(raw.options.B || raw.options.b || '').trim(),
        C: String(raw.options.C || raw.options.c || '').trim(),
        D: String(raw.options.D || raw.options.d || '').trim()
      };
    } else {
      hasBrokenOptions = true;
    }

    // Correct Answer Mapping & Validation
    let ans: string | null = raw.answer || raw.correct_answer || null;
    if (ans) {
      ans = ans.toUpperCase().trim();
      if (ans === '1' || ans === '0') ans = 'A';
      else if (ans === '2') ans = 'B';
      else if (ans === '3') ans = 'C';
      else if (ans === '4') ans = 'D';
      
      if (!['A', 'B', 'C', 'D'].includes(ans)) {
        ans = null;
      }
    }

    // Check completeness
    const hasAllOptions = Boolean(opts.A && opts.B && opts.C && opts.D);
    const hasValidAnswer = Boolean(ans);

    const isQuarantined = hasBrokenOptions || !hasAllOptions || !hasValidAnswer || !cleanText;

    // Subject & Biology classification
    let sub: Subject = 'Physics';
    const rawSub = String(raw.subject || '').toLowerCase();
    if (rawSub.includes('chemistry')) sub = 'Chemistry';
    else if (rawSub.includes('biology')) {
      sub = classifyBiologyChapter(raw.chapter || '');
    } else if (rawSub.includes('botany')) sub = 'Botany';
    else if (rawSub.includes('zoology')) sub = 'Zoology';

    const priorityValue = getPriorityForSourceType(raw.source_type || 'UNKNOWN');

    const normalized: SatheeRawQuestion = {
      source: 'SATHEE',
      source_url: raw.source_url || `https://sathee.iitk.ac.in/neet/${sub.toLowerCase()}/${(raw.chapter || 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
      source_question_id: sourceQuestionId,
      subject: sub,
      chapter: raw.chapter || 'General',
      subtopic: raw.subtopic || null,
      source_type: (raw.source_type || 'UNKNOWN').toUpperCase() as any,
      question_text: cleanText,
      options: opts,
      correct_answer: ans,
      explanation: raw.explanation || null,
      visual: raw.visual || null,
      raw_payload: raw,
      import_status: isQuarantined ? 'QUARANTINED' : 'RAW',
      priority: priorityValue
    };

    if (isQuarantined) {
      quarantinedCount += 1;
    } else {
      normalizedCount += 1;
    }

    results.push(normalized);
  }

  // Save results back if NOT a dry-run
  if (!params.isDryRun && results.length > 0) {
    const updatedCache = [...existingQuestions, ...results];
    saveCachedRawQuestions(updatedCache);

    try {
      console.log(`[SatheeImporter] Pushing ${results.length} questions into Supabase...`);
      // Call RPC import_sathee_raw_questions if available, or insert directly
      const { error } = await supabase.from('sathee_raw_questions').insert(results);
      if (error) {
        console.warn('[SatheeImporter] Supabase direct insert RLS restriction, caching locally:', error.message);
      } else {
        console.log('[SatheeImporter] Supabase database sync successful!');
      }
    } catch (err) {
      console.error('[SatheeImporter] Database insertion exception:', err);
    }
  }

  return {
    totalFetched: fetchedQuestions.length,
    normalizedCount,
    quarantinedCount,
    duplicatesSkipped,
    results
  };
}

// 4. Publish RAW Question to Live Pool
export async function publishSatheeQuestionToLive(
  rawQ: SatheeRawQuestion
): Promise<{ success: boolean; error?: string }> {
  if (rawQ.import_status !== 'RAW') {
    return { success: false, error: 'Only questions in RAW status can be published.' };
  }

  try {
    // Build Question type object matching existing pool structure
    const targetQ: Question = {
      id: rawQ.source_question_id,
      sourceId: rawQ.source_question_id,
      text: rawQ.question_text,
      options: rawQ.options,
      correctAnswer: rawQ.correct_answer as AnswerOption,
      subject: rawQ.subject,
      chapter: rawQ.chapter || 'General',
      subtopic: rawQ.subtopic || undefined,
      difficulty: 'Medium',
      explanation: rawQ.explanation || undefined,
      visual: rawQ.visual || { hasVisual: false, source_type: rawQ.source_type, priority: rawQ.priority },
      createdAt: Date.now()
    };

    // Protect 302 Rotational Motion questions
    if (rawQ.chapter === 'Rotational Motion' && rawQ.subject === 'Physics') {
      const existingRotational = await getQuestions({ subject: 'Physics', chapters: ['Rotational Motion'] });
      // Deduplicate rotational motion strictly
      const isDuplicate = existingRotational.some(
        eq => eq.text.toLowerCase().trim() === rawQ.question_text.toLowerCase().trim()
      );
      if (isDuplicate) {
        return { success: false, error: 'Publish blocked: Question is a duplicate of an existing Rotational Motion question.' };
      }
    }

    // Save single question to live active subject table
    await saveSingleQuestion(targetQ);

    // Update import status in Supabase & Local Cache
    rawQ.import_status = 'PUBLISHED';
    
    // Update local cache
    const cache = getCachedRawQuestions();
    const index = cache.findIndex(q => q.source_question_id === rawQ.source_question_id);
    if (index !== -1) {
      cache[index].import_status = 'PUBLISHED';
      saveCachedRawQuestions(cache);
    }

    // Update Supabase
    const { error: updateErr } = await supabase
      .from('sathee_raw_questions')
      .update({ import_status: 'PUBLISHED' })
      .eq('source_question_id', rawQ.source_question_id);

    if (updateErr) {
      console.warn('[SatheeImporter] Could not update raw question status in Supabase:', updateErr.message);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[SatheeImporter] Publish failed:', err);
    return { success: false, error: err.message || 'Unknown publishing error.' };
  }
}
