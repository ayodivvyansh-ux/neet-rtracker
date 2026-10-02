/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CbtQuestionEvaluation, CbtTestResult } from '../../types';
import { BookOpen, Check, HelpCircle, Layers, Target, X } from 'lucide-react';

interface SubjectStats {
  subjectName: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  maxScore: number;
  accuracy: number;
}

interface SubjectPerformanceCardProps {
  evaluations: CbtQuestionEvaluation[];
  result: CbtTestResult;
}

function calculateSubjectStats(name: string, evals: CbtQuestionEvaluation[]): SubjectStats {
  const total = evals.length;
  const correct = evals.filter((e) => e.isCorrect).length;
  const wrong = evals.filter((e) => e.isAttempted && !e.isCorrect).length;
  const unattempted = evals.filter((e) => !e.isAttempted).length;
  const attempted = correct + wrong;
  const score = correct * 4 - wrong * 1;
  const maxScore = total * 4;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

  return {
    subjectName: name,
    total,
    attempted,
    correct,
    wrong,
    unattempted,
    score,
    maxScore,
    accuracy
  };
}

export const SubjectPerformanceCard: React.FC<SubjectPerformanceCardProps> = ({
  evaluations,
  result
}) => {
  // 1. Group evaluations by Subject
  const physicsEvals = evaluations.filter((e) => e.subject.toLowerCase() === 'physics');
  const chemistryEvals = evaluations.filter((e) => e.subject.toLowerCase() === 'chemistry');
  const botanyEvals = evaluations.filter((e) => e.subject.toLowerCase() === 'botany');
  const zoologyEvals = evaluations.filter((e) => e.subject.toLowerCase() === 'zoology');
  const biologyEvals = evaluations.filter(
    (e) =>
      e.subject.toLowerCase() === 'botany' ||
      e.subject.toLowerCase() === 'zoology' ||
      e.subject.toLowerCase() === 'biology'
  );

  const physicsStats = physicsEvals.length > 0 ? calculateSubjectStats('Physics', physicsEvals) : null;
  const chemistryStats = chemistryEvals.length > 0 ? calculateSubjectStats('Chemistry', chemistryEvals) : null;
  const biologyStats = biologyEvals.length > 0 ? calculateSubjectStats('Biology', biologyEvals) : null;
  const botanyStats = botanyEvals.length > 0 ? calculateSubjectStats('Botany', botanyEvals) : null;
  const zoologyStats = zoologyEvals.length > 0 ? calculateSubjectStats('Zoology', zoologyEvals) : null;

  const renderMetricRow = (stats: SubjectStats, isSubcard: boolean = false) => (
    <div
      key={stats.subjectName}
      className={`bg-white rounded-xl border ${
        isSubcard ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 shadow-xs'
      } p-5 space-y-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              stats.subjectName === 'Physics'
                ? 'bg-blue-600'
                : stats.subjectName === 'Chemistry'
                ? 'bg-amber-500'
                : 'bg-emerald-600'
            }`}
          />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {stats.subjectName.toUpperCase()}
          </h3>
          <span className="text-xs text-slate-400 font-medium">({stats.total} Questions)</span>
        </div>

        {/* Subject Score */}
        <div className="text-right">
          <span className="text-sm font-black text-slate-900 font-mono">
            {stats.score}
          </span>
          <span className="text-xs text-slate-400 font-mono"> / {stats.maxScore}</span>
        </div>
      </div>

      {/* Progress / Accuracy Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Accuracy</span>
          <span className="font-bold text-slate-900 font-mono">{stats.accuracy}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${(stats.correct / Math.max(1, stats.total)) * 100}%` }}
            title={`Correct: ${stats.correct}`}
          />
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${(stats.wrong / Math.max(1, stats.total)) * 100}%` }}
            title={`Wrong: ${stats.wrong}`}
          />
          <div
            className="bg-amber-300 h-full transition-all"
            style={{ width: `${(stats.unattempted / Math.max(1, stats.total)) * 100}%` }}
            title={`Unattempted: ${stats.unattempted}`}
          />
        </div>
      </div>

      {/* Breakdown Metrics */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-[11px]">
        <div>
          <span className="text-slate-400 block mb-0.5">Attempted</span>
          <span className="font-bold text-slate-800 font-mono">{stats.attempted}</span>
        </div>
        <div>
          <span className="text-emerald-700 block mb-0.5">Correct</span>
          <span className="font-bold text-emerald-600 font-mono">+{stats.correct}</span>
        </div>
        <div>
          <span className="text-red-700 block mb-0.5">Wrong</span>
          <span className="font-bold text-red-600 font-mono">-{stats.wrong}</span>
        </div>
        <div>
          <span className="text-amber-700 block mb-0.5">Unattempted</span>
          <span className="font-bold text-amber-600 font-mono">{stats.unattempted}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Subject-Wise Performance Breakdown</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {physicsStats && renderMetricRow(physicsStats)}
        {chemistryStats && renderMetricRow(chemistryStats)}
        {biologyStats && renderMetricRow(biologyStats)}
      </div>

      {/* Biology Subsections (Botany & Zoology) if both are present in the test */}
      {biologyStats && (botanyStats || zoologyStats) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Biology Sub-Discipline Breakdown (Botany & Zoology)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {botanyStats && renderMetricRow(botanyStats, true)}
            {zoologyStats && renderMetricRow(zoologyStats, true)}
          </div>
        </div>
      )}
    </div>
  );
};
