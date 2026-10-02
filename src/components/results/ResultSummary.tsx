/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CbtTestResult, CbtTestSession } from '../../types';
import { Award, CheckCircle2, Clock, HelpCircle, Target, XCircle } from 'lucide-react';

interface ResultSummaryProps {
  session: CbtTestSession;
  result: CbtTestResult;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({ session, result }) => {
  const attemptedCount = result.correctCount + result.incorrectCount;
  const mins = Math.floor(result.totalTimeSpentSeconds / 60);
  const secs = result.totalTimeSpentSeconds % 60;
  const timeTakenFormatted = `${mins}m ${secs}s`;

  return (
    <div className="space-y-4">
      {/* 1. Large Hero Scoreboard Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-850 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-left space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>Official Exam Evaluation</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {session.title}
            </h2>
            <p className="text-xs text-slate-400">
              Completed on {new Date(session.completedAt || Date.now()).toLocaleDateString()} · Marking Scheme: +4 Correct, -1 Incorrect, 0 Unattempted
            </p>
          </div>

          {/* Big Score Display */}
          <div className="flex items-center space-x-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl px-6 py-4 backdrop-blur-sm shrink-0">
            <div className="text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Total Score
              </span>
              <div className="flex items-baseline justify-center space-x-1.5">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                  {result.totalScore}
                </span>
                <span className="text-sm font-semibold text-slate-400 font-mono">
                  / {result.maxScore}
                </span>
              </div>
              <span className="text-[10px] text-blue-400 font-medium block mt-0.5">
                {result.maxScore > 0 ? `${Math.round((Math.max(0, result.totalScore) / result.maxScore) * 100)}% of Max Score` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Performance Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Accuracy */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Accuracy</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums block">
              {result.accuracy}%
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Correct / Attempted
            </span>
          </div>
        </div>

        {/* Correct Answers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Correct</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-600 font-mono tabular-nums block">
              {result.correctCount}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              +{result.correctCount * 4} Marks
            </span>
          </div>
        </div>

        {/* Wrong Answers */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Wrong</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-red-600 font-mono tabular-nums block">
              {result.incorrectCount}
            </span>
            <span className="text-[10px] text-red-700 font-medium">
              -{result.incorrectCount} Negative Marks
            </span>
          </div>
        </div>

        {/* Unattempted */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unattempted</span>
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-amber-600 font-mono tabular-nums block">
              {result.unattemptedCount}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              0 Marks Affected
            </span>
          </div>
        </div>

        {/* Total Attempted */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Attempted</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums block">
              {attemptedCount}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              of {session.questions.length} Total Questions
            </span>
          </div>
        </div>

        {/* Time Taken */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Time Taken</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono tabular-nums block">
              {timeTakenFormatted}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Limit: {session.durationMinutes}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
