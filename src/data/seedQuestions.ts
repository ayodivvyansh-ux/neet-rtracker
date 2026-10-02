/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from '../types';

export const SEED_QUESTIONS: Question[] = [
  // =========================================================================
  // 1. PHYSICS QUESTIONS (physics_questions)
  // =========================================================================
  {
    id: 'PHY-001',
    text: 'A ball is projected vertically upwards with a velocity of 20 m/s from the top of a tower of height 25 m. How long will it take for the ball to hit the ground? (Take g = 10 m/s²)',
    options: {
      A: '2 seconds',
      B: '3 seconds',
      C: '5 seconds',
      D: '6 seconds'
    },
    correctAnswer: 'C',
    subject: 'Physics',
    chapter: 'Motion in a Straight Line',
    subtopic: 'Motion under gravity',
    difficulty: 'Medium',
    sourcePdf: 'NEET_2023_Official_Paper.pdf',
    pageNumber: 2,
    explanation: 'Using s = ut + 0.5at² with displacement s = -25 m, u = +20 m/s, a = -10 m/s²: -25 = 20t - 5t² => 5t² - 20t - 25 = 0 => t² - 4t - 5 = 0 => (t - 5)(t + 1) = 0. Thus t = 5 s.',
    createdAt: 1700000001000
  },
  {
    id: 'PHY-002',
    text: 'A block of mass 5 kg is resting on a rough horizontal surface with coefficient of static friction μs = 0.4. What is the minimum horizontal force required to just start the motion? (g = 10 m/s²)',
    options: {
      A: '10 N',
      B: '20 N',
      C: '25 N',
      D: '50 N'
    },
    correctAnswer: 'B',
    subject: 'Physics',
    chapter: 'Laws of Motion',
    subtopic: 'Friction',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2022_Physics.pdf',
    pageNumber: 4,
    explanation: 'Limiting static friction fs = μs * N = μs * m * g = 0.4 * 5 * 10 = 20 N.',
    createdAt: 1700000002000
  },
  {
    id: 'PHY-003',
    text: 'The equivalent resistance between points A and B for two identical resistors each of resistance 10 Ω connected in parallel is:',
    options: {
      A: '5 Ω',
      B: '10 Ω',
      C: '20 Ω',
      D: '2.5 Ω'
    },
    correctAnswer: 'A',
    subject: 'Physics',
    chapter: 'Current Electricity',
    subtopic: 'Combination of Resistors',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2021_Mock_Physics.pdf',
    pageNumber: 8,
    explanation: 'Req = (R1 * R2) / (R1 + R2) = (10 * 10) / (10 + 10) = 100 / 20 = 5 Ω.',
    createdAt: 1700000003000
  },

  // =========================================================================
  // 2. CHEMISTRY QUESTIONS (chemistry_questions)
  // =========================================================================
  {
    id: 'CHEM-001',
    text: 'Which of the following compounds exhibits both Frenkel and Schottky defects in crystalline solid state?',
    options: {
      A: 'NaCl',
      B: 'AgBr',
      C: 'CsCl',
      D: 'KCl'
    },
    correctAnswer: 'B',
    subject: 'Chemistry',
    chapter: 'Some Basic Concepts of Chemistry',
    subtopic: 'Solid State Defect',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2023_Chemistry.pdf',
    pageNumber: 12,
    explanation: 'Silver bromide (AgBr) is a classic compound that exhibits both Schottky and Frenkel defects due to the intermediate radius ratio.',
    createdAt: 1700000004000
  },
  {
    id: 'CHEM-002',
    text: 'According to IUPAC nomenclature, what is the systematic name for CH3-CH(OH)-CH2-CHO?',
    options: {
      A: '3-Hydroxybutanal',
      B: '2-Hydroxybutanal',
      C: '3-Hydroxybutanone',
      D: '1-Oxobutanol'
    },
    correctAnswer: 'A',
    subject: 'Chemistry',
    chapter: 'Aldehydes, Ketones and Carboxylic Acids',
    subtopic: 'IUPAC Nomenclature',
    difficulty: 'Medium',
    sourcePdf: 'NEET_2023_Chemistry.pdf',
    pageNumber: 15,
    explanation: 'The aldehyde group (-CHO) has higher priority and receives carbon-1. The hydroxyl group (-OH) is at carbon-3, giving 3-hydroxybutanal.',
    createdAt: 1700000005000
  },
  {
    id: 'CHEM-003',
    text: 'What is the pH of a 0.001 M HCl aqueous solution at 25°C?',
    options: {
      A: '1',
      B: '2',
      C: '3',
      D: '11'
    },
    correctAnswer: 'C',
    subject: 'Chemistry',
    chapter: 'Equilibrium',
    subtopic: 'Ionic Equilibrium & pH',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2022_Chemistry.pdf',
    pageNumber: 9,
    explanation: '[H+] = 0.001 M = 10^-3 M. pH = -log10[H+] = -log10(10^-3) = 3.',
    createdAt: 1700000006000
  },

  // =========================================================================
  // 3. BOTANY QUESTIONS (botany_questions)
  // =========================================================================
  {
    id: 'BOT-001',
    text: 'During photosynthesis in C4 plants, the primary carbon dioxide fixation is catalyzed by which enzyme?',
    options: {
      A: 'RuBisCO',
      B: 'PEP carboxylase',
      C: 'Carbonic anhydrase',
      D: 'Pyruvate kinase'
    },
    correctAnswer: 'B',
    subject: 'Botany',
    chapter: 'Photosynthesis in Higher Plants',
    subtopic: 'C4 Pathway',
    difficulty: 'Medium',
    sourcePdf: 'NEET_2023_Botany.pdf',
    pageNumber: 21,
    explanation: 'In C4 plants, primary CO2 fixation occurs in the mesophyll cells and is catalyzed by Phosphoenolpyruvate (PEP) carboxylase.',
    createdAt: 1700000007000
  },
  {
    id: 'BOT-002',
    text: 'Which plant hormone is primarily responsible for promoting apical dominance and cell elongation in shoots?',
    options: {
      A: 'Auxin',
      B: 'Gibberellin',
      C: 'Cytokinin',
      D: 'Abscisic Acid'
    },
    correctAnswer: 'A',
    subject: 'Botany',
    chapter: 'Plant Growth and Development',
    subtopic: 'Phytohormones',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2022_Botany.pdf',
    pageNumber: 17,
    explanation: 'Auxin (such as IAA) produced in the shoot apex is primarily responsible for apical dominance and cell elongation.',
    createdAt: 1700000008000
  },
  {
    id: 'BOT-003',
    text: 'In angiosperms, double fertilization results in the formation of:',
    options: {
      A: 'Diploid zygote and triploid primary endosperm nucleus (PEN)',
      B: 'Triploid zygote and diploid PEN',
      C: 'Haploid zygote and diploid PEN',
      D: 'Diploid zygote and haploid PEN'
    },
    correctAnswer: 'A',
    subject: 'Botany',
    chapter: 'Sexual Reproduction in Flowering Plants',
    subtopic: 'Double Fertilization',
    difficulty: 'Medium',
    sourcePdf: 'NEET_2021_Botany.pdf',
    pageNumber: 25,
    explanation: 'Syngamy forms the diploid zygote (2n) while triple fusion of one male gamete with secondary nucleus produces the triploid PEN (3n).',
    createdAt: 1700000009000
  },

  // =========================================================================
  // 4. ZOOLOGY QUESTIONS (zoology_questions)
  // =========================================================================
  {
    id: 'ZOO-001',
    text: 'Which cells in the human testes are responsible for the secretion of testosterone under the influence of LH (ICSH)?',
    options: {
      A: 'Sertoli cells',
      B: 'Leydig (Interstitial) cells',
      C: 'Spermatogonia',
      D: 'Primary spermatocytes'
    },
    correctAnswer: 'B',
    subject: 'Zoology',
    chapter: 'Human Reproduction',
    subtopic: 'Male Reproductive System',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2023_Zoology.pdf',
    pageNumber: 30,
    explanation: 'Leydig cells (interstitial cells) located in the interstitial spaces of the testes synthesize and secrete testicular hormones called androgens (testosterone).',
    createdAt: 1700000010000
  },
  {
    id: 'ZOO-002',
    text: 'The opening of the hepatopancreatic duct into the duodenum is guarded by which sphincter?',
    options: {
      A: 'Sphincter of Boyden',
      B: 'Sphincter of Oddi',
      C: 'Pyloric sphincter',
      D: 'Gastroesophageal sphincter'
    },
    correctAnswer: 'B',
    subject: 'Zoology',
    chapter: 'Body Fluids and Circulation',
    subtopic: 'Human Physiology',
    difficulty: 'Easy',
    sourcePdf: 'NEET_2022_Zoology.pdf',
    pageNumber: 34,
    explanation: 'The bile duct and the pancreatic duct open together into the duodenum as the common hepato-pancreatic duct which is guarded by the Sphincter of Oddi.',
    createdAt: 1700000011000
  },
  {
    id: 'ZOO-003',
    text: 'Restriction endonucleases are molecular scissors that cut DNA at specific palindromic recognition sequences. What type of cut produces "sticky ends"?',
    options: {
      A: 'Staggered cuts away from the center of the palindrome',
      B: 'Blunt cuts right in the center',
      C: 'Single strand exonuclease digestion',
      D: 'Random fragmentation'
    },
    correctAnswer: 'A',
    subject: 'Zoology',
    chapter: 'Biotechnology: Principles and Processes',
    subtopic: 'Restriction Enzymes',
    difficulty: 'Medium',
    sourcePdf: 'NEET_2023_Zoology.pdf',
    pageNumber: 39,
    explanation: 'Restriction enzymes cut the two strands of DNA a little away from the center of the palindrome sites, leaving single-stranded overhanging portions called sticky ends.',
    createdAt: 1700000012000
  }
];
