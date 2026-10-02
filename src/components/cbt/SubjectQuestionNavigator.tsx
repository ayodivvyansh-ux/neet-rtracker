/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CbtActiveQuestion, QuestionCBTStatus } from '../../types';

interface SubjectQuestionNavigatorProps {
  questions: CbtActiveQuestion[];
  currentIndex: number;
  responses: Record<string, string | null>;
  statuses: Record<string, QuestionCBTStatus>;
  activeTopSection: string;
  activeBiologySubSection: string | null;
  onSelectQuestion: (globalIndex: number) => void;
}

export const SubjectQuestionNavigator: React.FC<SubjectQuestionNavigatorProps> = ({
  questions,
  currentIndex,
  responses,
  statuses,
  activeTopSection,
  activeBiologySubSection,
  onSelectQuestion
}) => {
  const visibleQuestions = questions
    .map((q, globalIndex) => ({ q, globalIndex }))
    .filter(({ q }) => {
      const subj = (q.subject || 'General').toUpperCase();
      if (activeTopSection === 'BIOLOGY') {
        if (activeBiologySubSection) {
          return subj === activeBiologySubSection.toUpperCase();
        }
        return subj === 'BOTANY' || subj === 'ZOOLOGY' || subj === 'BIOLOGY';
      }
      if (activeTopSection === 'PHYSICS') {
        return subj === 'PHYSICS';
      }
      if (activeTopSection === 'CHEMISTRY') {
        return subj === 'CHEMISTRY';
      }
      return subj === activeTopSection.toUpperCase();
    });

  const itemsToRender = visibleQuestions.length > 0
    ? visibleQuestions
    : questions.map((q, globalIndex) => ({ q, globalIndex }));

  return (
    <div className="flex flex-col h-full select-none bg-white">
      {/* Navigator Section Header */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            {activeTopSection === 'BIOLOGY' && activeBiologySubSection
              ? `SECTION: BIOLOGY / ${activeBiologySubSection}`
              : `SECTION: ${activeTopSection}`}
          </span>
          <span className="text-xs font-bold text-slate-900 font-editorial-serif text-sm">
            {itemsToRender.length} Questions in View
          </span>
        </div>
        <div className="text-[10px] font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
          Q{itemsToRender[0]?.globalIndex + 1} - Q{itemsToRender[itemsToRender.length - 1]?.globalIndex + 1}
        </div>
      </div>

      {/* Grid of Question Number Buttons */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
          {itemsToRender.map(({ q, globalIndex }) => {
            const isCurrent = globalIndex === currentIndex;
            const status = statuses[q.id] || 'NOT_VISITED';
            const hasAnswer = Boolean(responses[q.id]);

            let btnClass = 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900';
            let statusSymbol = '';

            if (status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
              btnClass = 'bg-purple-900 text-white border-purple-950 font-bold';
              statusSymbol = '✪';
            } else if (status === 'MARKED_FOR_REVIEW') {
              btnClass = 'bg-purple-50 text-purple-800 border-purple-200 font-bold';
              statusSymbol = '★';
            } else if (hasAnswer || status === 'ANSWERED') {
              btnClass = 'bg-black text-white border-black font-bold shadow-2xs';
              statusSymbol = '●';
            } else if (status === 'NOT_ANSWERED') {
              btnClass = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
              statusSymbol = '○';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectQuestion(globalIndex)}
                className={`relative h-10 rounded-lg text-xs transition flex flex-col items-center justify-center border font-mono ${btnClass} ${
                  isCurrent ? 'ring-2 ring-black ring-offset-2 scale-105 z-10 shadow-sm font-black' : ''
                }`}
                title={`Q${globalIndex + 1} (${q.subject})`}
              >
                <span className="leading-none text-[11px]">{globalIndex + 1}</span>
                {statusSymbol && (
                  <span className="text-[9px] leading-none mt-0.5 opacity-90">{statusSymbol}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
