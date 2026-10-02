/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface QuestionStatusLegendProps {
  counts: {
    answered: number;
    notAnswered: number;
    notVisited: number;
    marked: number;
    answeredAndMarked: number;
  };
}

export const QuestionStatusLegend: React.FC<QuestionStatusLegendProps> = ({ counts }) => {
  return (
    <div className="p-3.5 bg-slate-50/70 border-t border-slate-200/80 text-[11px] text-slate-600 select-none shrink-0 font-sans">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded bg-black text-white font-bold flex items-center justify-center text-[9px] shrink-0">
            ●
          </span>
          <span className="truncate text-slate-700">Answered ({counts.answered})</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded bg-amber-50 border border-amber-300 text-amber-900 font-bold flex items-center justify-center text-[9px] shrink-0">
            ○
          </span>
          <span className="truncate text-slate-700">Not Answered ({counts.notAnswered})</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded bg-slate-100 border border-slate-300 text-slate-500 font-bold flex items-center justify-center text-[9px] shrink-0">
            ○
          </span>
          <span className="truncate text-slate-700">Not Visited ({counts.notVisited})</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="w-4 h-4 rounded bg-purple-100 border border-purple-300 text-purple-800 font-bold flex items-center justify-center text-[9px] shrink-0">
            ★
          </span>
          <span className="truncate text-slate-700">Marked ({counts.marked})</span>
        </div>

        <div className="flex items-center space-x-1.5 col-span-2 pt-0.5">
          <span className="w-4 h-4 rounded bg-purple-900 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
            ✪
          </span>
          <span className="truncate text-slate-700">Ans. & Marked for Review ({counts.answeredAndMarked})</span>
        </div>
      </div>
    </div>
  );
};
