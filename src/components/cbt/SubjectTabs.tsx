/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CbtActiveQuestion } from '../../types';

export interface SubjectSectionInfo {
  id: string;
  name: string;
  count: number;
  attempted: number;
  startIndex: number;
  endIndex: number;
  isBiology?: boolean;
  subsections?: {
    id: string;
    name: string;
    count: number;
    attempted: number;
    startIndex: number;
    endIndex: number;
  }[];
}

interface SubjectTabsProps {
  questions: CbtActiveQuestion[];
  currentIndex: number;
  responses: Record<string, string | null>;
  activeTopSection: string;
  activeBiologySubSection: string | null;
  onSelectSection: (sectionId: string, targetIndex?: number) => void;
  onSelectBiologySubsection: (subId: string, targetIndex?: number) => void;
}

export const SubjectTabs: React.FC<SubjectTabsProps> = ({
  questions,
  currentIndex,
  responses,
  activeTopSection,
  activeBiologySubSection,
  onSelectSection,
  onSelectBiologySubsection
}) => {
  const topSections: SubjectSectionInfo[] = [];

  const subjectList: string[] = [];
  questions.forEach((q) => {
    const s = q.subject || 'General';
    if (!subjectList.includes(s)) {
      subjectList.push(s);
    }
  });

  const hasBotanyOrZoology = subjectList.some(
    (s) => s.toLowerCase() === 'botany' || s.toLowerCase() === 'zoology' || s.toLowerCase() === 'biology'
  );

  if (hasBotanyOrZoology) {
    const physicsIndices = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.subject.toLowerCase() === 'physics');

    const chemistryIndices = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.subject.toLowerCase() === 'chemistry');

    const botanyIndices = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.subject.toLowerCase() === 'botany');

    const zoologyIndices = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.subject.toLowerCase() === 'zoology');

    const biologyGeneralIndices = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.subject.toLowerCase() === 'biology');

    if (physicsIndices.length > 0) {
      const attempted = physicsIndices.filter(({ q }) => Boolean(responses[q.id])).length;
      topSections.push({
        id: 'PHYSICS',
        name: 'PHYSICS',
        count: physicsIndices.length,
        attempted,
        startIndex: physicsIndices[0].idx,
        endIndex: physicsIndices[physicsIndices.length - 1].idx
      });
    }

    if (chemistryIndices.length > 0) {
      const attempted = chemistryIndices.filter(({ q }) => Boolean(responses[q.id])).length;
      topSections.push({
        id: 'CHEMISTRY',
        name: 'CHEMISTRY',
        count: chemistryIndices.length,
        attempted,
        startIndex: chemistryIndices[0].idx,
        endIndex: chemistryIndices[chemistryIndices.length - 1].idx
      });
    }

    const totalBioCount = botanyIndices.length + zoologyIndices.length + biologyGeneralIndices.length;
    if (totalBioCount > 0) {
      const allBioIndices = [...botanyIndices, ...zoologyIndices, ...biologyGeneralIndices].sort((a, b) => a.idx - b.idx);
      const attempted = allBioIndices.filter(({ q }) => Boolean(responses[q.id])).length;

      const subsections: SubjectSectionInfo['subsections'] = [];
      if (botanyIndices.length > 0) {
        subsections.push({
          id: 'BOTANY',
          name: 'BOTANY',
          count: botanyIndices.length,
          attempted: botanyIndices.filter(({ q }) => Boolean(responses[q.id])).length,
          startIndex: botanyIndices[0].idx,
          endIndex: botanyIndices[botanyIndices.length - 1].idx
        });
      }
      if (zoologyIndices.length > 0) {
        subsections.push({
          id: 'ZOOLOGY',
          name: 'ZOOLOGY',
          count: zoologyIndices.length,
          attempted: zoologyIndices.filter(({ q }) => Boolean(responses[q.id])).length,
          startIndex: zoologyIndices[0].idx,
          endIndex: zoologyIndices[zoologyIndices.length - 1].idx
        });
      }

      topSections.push({
        id: 'BIOLOGY',
        name: 'BIOLOGY',
        count: totalBioCount,
        attempted,
        startIndex: allBioIndices[0].idx,
        endIndex: allBioIndices[allBioIndices.length - 1].idx,
        isBiology: true,
        subsections
      });
    }
  } else {
    subjectList.forEach((subj) => {
      const indices = questions.map((q, idx) => ({ q, idx })).filter(({ q }) => q.subject === subj);
      const attempted = indices.filter(({ q }) => Boolean(responses[q.id])).length;
      topSections.push({
        id: subj.toUpperCase(),
        name: subj.toUpperCase(),
        count: indices.length,
        attempted,
        startIndex: indices[0].idx,
        endIndex: indices[indices.length - 1].idx
      });
    });
  }

  const currentBioSection = topSections.find((s) => s.id === 'BIOLOGY');

  return (
    <div className="bg-white border-b border-slate-200/80 select-none">
      {/* 1. Top-Level Subject Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between overflow-x-auto scrollbar-none py-2 gap-3">
        <div className="flex items-center space-x-2 shrink-0">
          {topSections.map((sec, idx) => {
            const isActive = activeTopSection.toUpperCase() === sec.id.toUpperCase();
            const sectionNumber = String(idx + 1).padStart(2, '0');
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelectSection(sec.id, sec.startIndex)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 border ${
                  isActive
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className={`text-[10px] font-mono ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {sectionNumber}
                </span>
                <span>{sec.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-700'
                  }`}
                >
                  {sec.attempted}/{sec.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Progress Indicator */}
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-500 shrink-0 font-medium">
          <span className="uppercase tracking-wider text-[10px] text-slate-400">Total Pacing:</span>
          <span className="font-mono text-slate-900 font-bold">
            {Object.values(responses).filter(Boolean).length}
          </span>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-600">{questions.length} Attempted</span>
        </div>
      </div>

      {/* 2. Biology Subsections (Botany / Zoology) if Biology is Active */}
      {activeTopSection === 'BIOLOGY' && currentBioSection?.subsections && currentBioSection.subsections.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-1.5 flex items-center space-x-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">
            Discipline Sub-Scope:
          </span>
          {currentBioSection.subsections.map((sub) => {
            const isSubActive =
              activeBiologySubSection?.toUpperCase() === sub.id.toUpperCase() ||
              (!activeBiologySubSection && currentBioSection.subsections![0].id === sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectBiologySubsection(sub.id, sub.startIndex)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1.5 border ${
                  isSubActive
                    ? 'bg-black text-white border-black shadow-2xs font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{sub.name}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isSubActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {sub.attempted}/{sub.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
