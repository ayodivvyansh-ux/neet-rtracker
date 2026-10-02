/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subject } from '../types';

export interface ChapterInfo {
  name: string;
  subject: Subject;
  classLevel: '11th' | '12th';
  unit?: string;
}

export const NEET_CHAPTERS: Record<Subject, ChapterInfo[]> = {
  Physics: [
    // Class 11th
    { name: 'Units and Measurements', subject: 'Physics', classLevel: '11th', unit: 'Physical World & Measurement' },
    { name: 'Motion in a Straight Line', subject: 'Physics', classLevel: '11th', unit: 'Kinematics' },
    { name: 'Motion in a Plane', subject: 'Physics', classLevel: '11th', unit: 'Kinematics' },
    { name: 'Laws of Motion', subject: 'Physics', classLevel: '11th', unit: 'Laws of Motion' },
    { name: 'Work, Energy and Power', subject: 'Physics', classLevel: '11th', unit: 'Work, Energy & Power' },
    { name: 'Center of Mass', subject: 'Physics', classLevel: '11th', unit: 'Rotational Motion' },
    { name: 'Rotational Motion', subject: 'Physics', classLevel: '11th', unit: 'Rotational Motion' },
    { name: 'Gravitation', subject: 'Physics', classLevel: '11th', unit: 'Gravitation' },
    { name: 'Mechanical Properties of Solids', subject: 'Physics', classLevel: '11th', unit: 'Properties of Bulk Matter' },
    { name: 'Mechanical Properties of Fluids', subject: 'Physics', classLevel: '11th', unit: 'Properties of Bulk Matter' },
    { name: 'Thermal Properties of Matter', subject: 'Physics', classLevel: '11th', unit: 'Thermodynamics & Heat' },
    { name: 'Thermodynamics', subject: 'Physics', classLevel: '11th', unit: 'Thermodynamics & Heat' },
    { name: 'Kinetic Theory of Gases', subject: 'Physics', classLevel: '11th', unit: 'Kinetic Theory' },
    { name: 'Oscillations', subject: 'Physics', classLevel: '11th', unit: 'Oscillations & Waves' },
    { name: 'Waves', subject: 'Physics', classLevel: '11th', unit: 'Oscillations & Waves' },
    // Class 12th
    { name: 'Electric Charges and Fields', subject: 'Physics', classLevel: '12th', unit: 'Electrostatics' },
    { name: 'Electrostatic Potential and Capacitance', subject: 'Physics', classLevel: '12th', unit: 'Electrostatics' },
    { name: 'Current Electricity', subject: 'Physics', classLevel: '12th', unit: 'Current Electricity' },
    { name: 'Moving Charges and Magnetism', subject: 'Physics', classLevel: '12th', unit: 'Magnetic Effects of Current' },
    { name: 'Magnetism and Matter', subject: 'Physics', classLevel: '12th', unit: 'Magnetism' },
    { name: 'Electromagnetic Induction', subject: 'Physics', classLevel: '12th', unit: 'Electromagnetic Induction & AC' },
    { name: 'Alternating Current', subject: 'Physics', classLevel: '12th', unit: 'Electromagnetic Induction & AC' },
    { name: 'Electromagnetic Waves', subject: 'Physics', classLevel: '12th', unit: 'EM Waves' },
    { name: 'Ray Optics and Optical Instruments', subject: 'Physics', classLevel: '12th', unit: 'Optics' },
    { name: 'Wave Optics', subject: 'Physics', classLevel: '12th', unit: 'Optics' },
    { name: 'Dual Nature of Radiation and Matter', subject: 'Physics', classLevel: '12th', unit: 'Modern Physics' },
    { name: 'Atoms', subject: 'Physics', classLevel: '12th', unit: 'Modern Physics' },
    { name: 'Nuclei', subject: 'Physics', classLevel: '12th', unit: 'Modern Physics' },
    { name: 'Semiconductor Electronics: Materials and Devices', subject: 'Physics', classLevel: '12th', unit: 'Electronic Devices' },
    { name: 'Experimental Skills', subject: 'Physics', classLevel: '12th', unit: 'Practical Physics' }
  ],

  Chemistry: [
    // Class 11th
    { name: 'Some Basic Concepts of Chemistry', subject: 'Chemistry', classLevel: '11th', unit: 'Physical Chemistry' },
    { name: 'Structure of Atom', subject: 'Chemistry', classLevel: '11th', unit: 'Physical Chemistry' },
    { name: 'Classification of Elements and Periodicity in Properties', subject: 'Chemistry', classLevel: '11th', unit: 'Inorganic Chemistry' },
    { name: 'Chemical Bonding and Molecular Structure', subject: 'Chemistry', classLevel: '11th', unit: 'Inorganic Chemistry' },
    { name: 'Chemical Thermodynamics', subject: 'Chemistry', classLevel: '11th', unit: 'Physical Chemistry' },
    { name: 'Equilibrium', subject: 'Chemistry', classLevel: '11th', unit: 'Physical Chemistry' },
    { name: 'Redox Reactions', subject: 'Chemistry', classLevel: '11th', unit: 'Physical Chemistry' },
    { name: 'Organic Chemistry: Some Basic Principles and Techniques', subject: 'Chemistry', classLevel: '11th', unit: 'Organic Chemistry' },
    { name: 'Hydrocarbons', subject: 'Chemistry', classLevel: '11th', unit: 'Organic Chemistry' },
    // Class 12th
    { name: 'Solutions', subject: 'Chemistry', classLevel: '12th', unit: 'Physical Chemistry' },
    { name: 'Electrochemistry', subject: 'Chemistry', classLevel: '12th', unit: 'Physical Chemistry' },
    { name: 'Chemical Kinetics', subject: 'Chemistry', classLevel: '12th', unit: 'Physical Chemistry' },
    { name: 'The d- and f-Block Elements', subject: 'Chemistry', classLevel: '12th', unit: 'Inorganic Chemistry' },
    { name: 'Coordination Compounds', subject: 'Chemistry', classLevel: '12th', unit: 'Inorganic Chemistry' },
    { name: 'Haloalkanes and Haloarenes', subject: 'Chemistry', classLevel: '12th', unit: 'Organic Chemistry' },
    { name: 'Alcohols, Phenols and Ethers', subject: 'Chemistry', classLevel: '12th', unit: 'Organic Chemistry' },
    { name: 'Aldehydes, Ketones and Carboxylic Acids', subject: 'Chemistry', classLevel: '12th', unit: 'Organic Chemistry' },
    { name: 'Amines', subject: 'Chemistry', classLevel: '12th', unit: 'Organic Chemistry' },
    { name: 'Biomolecules (Chem)', subject: 'Chemistry', classLevel: '12th', unit: 'Organic Chemistry' },
    { name: 'Principles Related to Practical Chemistry', subject: 'Chemistry', classLevel: '12th', unit: 'Practical Chemistry' }
  ],

  Botany: [
    // Class 11th Botany
    { name: 'The Living World', subject: 'Botany', classLevel: '11th', unit: 'Diversity in Living World' },
    { name: 'Biological Classification', subject: 'Botany', classLevel: '11th', unit: 'Diversity in Living World' },
    { name: 'Plant Kingdom', subject: 'Botany', classLevel: '11th', unit: 'Diversity in Living World' },
    { name: 'Morphology of Flowering Plants', subject: 'Botany', classLevel: '11th', unit: 'Structural Organisation' },
    { name: 'Anatomy of Flowering Plants', subject: 'Botany', classLevel: '11th', unit: 'Structural Organisation' },
    { name: 'Cell: The Unit of Life (Botany)', subject: 'Botany', classLevel: '11th', unit: 'Cell Structure and Function' },
    { name: 'Cell Cycle and Cell Division (Botany)', subject: 'Botany', classLevel: '11th', unit: 'Cell Structure and Function' },
    { name: 'Photosynthesis in Higher Plants', subject: 'Botany', classLevel: '11th', unit: 'Plant Physiology' },
    { name: 'Respiration in Plants', subject: 'Botany', classLevel: '11th', unit: 'Plant Physiology' },
    { name: 'Plant Growth and Development', subject: 'Botany', classLevel: '11th', unit: 'Plant Physiology' },
    // Class 12th Botany
    { name: 'Sexual Reproduction in Flowering Plants', subject: 'Botany', classLevel: '12th', unit: 'Reproduction' },
    { name: 'Principles of Inheritance and Variation', subject: 'Botany', classLevel: '12th', unit: 'Genetics and Evolution' },
    { name: 'Molecular Basis of Inheritance', subject: 'Botany', classLevel: '12th', unit: 'Genetics and Evolution' },
    { name: 'Microbes in Human Welfare', subject: 'Botany', classLevel: '12th', unit: 'Biology in Human Welfare' },
    { name: 'Organisms and Populations', subject: 'Botany', classLevel: '12th', unit: 'Ecology & Environment' },
    { name: 'Ecosystem', subject: 'Botany', classLevel: '12th', unit: 'Ecology & Environment' },
    { name: 'Biodiversity and Conservation', subject: 'Botany', classLevel: '12th', unit: 'Ecology & Environment' }
  ],

  Zoology: [
    // Class 11th Zoology
    { name: 'Animal Kingdom', subject: 'Zoology', classLevel: '11th', unit: 'Diversity in Living World' },
    { name: 'Structural Organisation in Animals', subject: 'Zoology', classLevel: '11th', unit: 'Structural Organisation' },
    { name: 'Biomolecules (Bio)', subject: 'Zoology', classLevel: '11th', unit: 'Cell Structure and Function' },
    { name: 'Breathing and Exchange of Gases', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    { name: 'Body Fluids and Circulation', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    { name: 'Excretory Products and their Elimination', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    { name: 'Locomotion and Movement', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    { name: 'Neural Control and Coordination', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    { name: 'Chemical Coordination and Integration', subject: 'Zoology', classLevel: '11th', unit: 'Human Physiology' },
    // Class 12th Zoology
    { name: 'Human Reproduction', subject: 'Zoology', classLevel: '12th', unit: 'Reproduction' },
    { name: 'Reproductive Health', subject: 'Zoology', classLevel: '12th', unit: 'Reproduction' },
    { name: 'Evolution', subject: 'Zoology', classLevel: '12th', unit: 'Genetics and Evolution' },
    { name: 'Human Health and Disease', subject: 'Zoology', classLevel: '12th', unit: 'Biology in Human Welfare' },
    { name: 'Biotechnology: Principles and Processes', subject: 'Zoology', classLevel: '12th', unit: 'Biotechnology' },
    { name: 'Biotechnology and its Applications', subject: 'Zoology', classLevel: '12th', unit: 'Biotechnology' }
  ]
};
