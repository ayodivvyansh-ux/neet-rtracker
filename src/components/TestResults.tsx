/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CbtQuestionEvaluation, CbtTestResult, CbtTestSession } from '../types';
import { MathRenderer } from './MathRenderer';
import { QuestionImage } from './QuestionImage';
import { getStandaloneQuestionImages } from '../services/imageService';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  HelpCircle,
  PieChart,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
  XCircle
} from 'lucide-react';

interface TestResultsProps {
  session: CbtTestSession;
  result: CbtTestResult;
  onRetakeFullTest: () => void;
  onRetakeIncorrectOnly: (wrongQuestionIds: string[]) => void;
  onBackToDashboard: () => void;
  onNavigateToCreateTest: () => void;
}

export const TestResults: React.FC<TestResultsProps> = ({
  session,
  result,
  onRetakeFullTest,
  onRetakeIncorrectOnly,
  onBackToDashboard,
  onNavigateToCreateTest
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});

  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredEvaluations = result.evaluations.filter((q) => {
    if (filterMode === 'correct') return q.isCorrect;
    if (filterMode === 'incorrect') return q.isAttempted && !q.isCorrect;
    if (filterMode === 'unattempted') return !q.isAttempted;
    return true;
  });

  const wrongIds = result.evaluations.filter((q) => q.isAttempted && !q.isCorrect).map((q) => q.id);

  // Format time taken
  const mins = Math.floor(result.totalTimeSpentSeconds / 60);
  const secs = result.totalTimeSpentSeconds % 60;
  const timeTakenFormatted = `${mins}m ${secs}s`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 font-sans space-y-6">
      {/* 1. Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Examination Scorecard & Review</h1>
          <p className="text-xs text-slate-500 font-normal">
            {session.title} · Completed on {new Date(session.completedAt || Date.now()).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {wrongIds.length > 0 && (
            <button
              onClick={() => onRetakeIncorrectOnly(wrongIds)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake {wrongIds.length} Mistakes</span>
            </button>
          )}

          <button
            onClick={onRetakeFullTest}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Exam</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Metric Scoreboard Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Total Score */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Score
            </span>
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {result.totalScore}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ {result.maxScore}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              Marking (+4 / -1)
            </span>
          </div>

          {/* Accuracy */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Accuracy
            </span>
            <span className="text-2xl font-black text-blue-600 tabular-nums block">
              {result.accuracy}%
            </span>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              Correct / Attempted
            </span>
          </div>

          {/* Correct */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Correct
            </span>
            <span className="text-2xl font-black text-emerald-600 tabular-nums block">
              {result.correctCount}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium block mt-1">
              +{result.correctCount * 4} Marks
            </span>
          </div>

          {/* Incorrect */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Incorrect
            </span>
            <span className="text-2xl font-black text-red-600 tabular-nums block">
              {result.incorrectCount}
            </span>
            <span className="text-[10px] text-red-700 font-medium block mt-1">
              -{result.incorrectCount} Marks
            </span>
          </div>

          {/* Unattempted */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Unattempted
            </span>
            <span className="text-2xl font-black text-slate-500 tabular-nums block">
              {result.unattemptedCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              0 Marks
            </span>
          </div>

          {/* Time Taken */}
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Time Taken
            </span>
            <span className="text-xl font-bold text-slate-800 tabular-nums block">
              {timeTakenFormatted}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">
              Limit: {session.durationMinutes}m
            </span>
          </div>
        </div>
      </div>

      {/* 3. Subject-wise Performance Matrix */}
      {Object.keys(result.subjectWise).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Subject-wise Performance Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200 text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3 text-center">Correct (+4)</th>
                  <th className="py-2.5 px-3 text-center">Incorrect (-1)</th>
                  <th className="py-2.5 px-3 text-center">Unattempted</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(result.subjectWise).map(([subj, stats]) => (
                  <tr key={subj} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{subj}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600 font-mono">
                      {stats.correct}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-red-600 font-mono">
                      {stats.incorrect}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {stats.unattempted}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                      {stats.score}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      {stats.maxScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Question-by-Question Review Section */}
      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">
            Question-by-Question Review ({filteredEvaluations.length} Questions)
          </h2>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md transition ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({result.evaluations.length})
            </button>
            <button
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1 rounded-md transition ${
                filterMode === 'correct'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Correct ({result.correctCount})
            </button>
            <button
              onClick={() => setFilterMode('incorrect')}
              className={`px-3 py-1 rounded-md transition ${
                filterMode === 'incorrect'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incorrect ({result.incorrectCount})
            </button>
            <button
              onClick={() => setFilterMode('unattempted')}
              className={`px-3 py-1 rounded-md transition ${
                filterMode === 'unattempted'
                  ? 'bg-slate-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unattempted ({result.unattemptedCount})
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <div className="space-y-4">
          {filteredEvaluations.map((q, idx) => {
            const hasSolution = Boolean(q.solution_text || q.solution_html);
            const isSolutionOpen = Boolean(expandedSolutions[q.id]);
            const imagesList = Array.isArray(q.images)
              ? q.images
              : q.images
              ? [q.images]
              : [];
            const standaloneImages = getStandaloneQuestionImages(imagesList, q.question_html);

            return (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4"
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-800">
                      Q{idx + 1}.
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {q.question_code}
                    </span>
                    <span className="text-xs text-slate-500">{q.subject}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 truncate max-w-xs">{q.chapter_name}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status Pill */}
                    {q.isCorrect ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Correct (+4)</span>
                      </span>
                    ) : q.isAttempted ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-red-800 bg-red-50 border border-red-300 px-2.5 py-0.5 rounded">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Incorrect (-1)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded">
                        <span>Unattempted (0)</span>
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Time: {q.timeSpentSeconds}s
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-sm text-slate-900 leading-relaxed font-normal">
                  <MathRenderer
                    text={q.question_text}
                    html={q.question_html}
                    images={q.images}
                    questionCode={q.question_code}
                  />
                </div>

                {/* Standalone Diagrams (only if not already embedded in question HTML) */}
                {standaloneImages.length > 0 && (
                  <div className="space-y-2 py-1">
                    {standaloneImages.map((img, i) => (
                      <QuestionImage
                        key={i}
                        image={img}
                        questionCode={q.question_code}
                        alt={`Diagram for ${q.question_code}`}
                      />
                    ))}
                  </div>
                )}

                {/* Answer Choices Matrix (Single Choice) or Numerical Result Card */}
                {q.question_type === 'integer' || q.question_type === 'numerical' ? (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-slate-500 block text-[10px]">
                      Numerical Answer Review
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Your Entered Answer:</span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            !q.isAttempted
                              ? 'text-slate-400 italic'
                              : q.isCorrect
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {q.userResponse ? q.userResponse : 'Unattempted'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-emerald-800 block text-[11px] font-medium">Correct Value:</span>
                        <span className="font-mono font-bold text-sm text-emerald-950">
                          {q.correctOption}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {['A', 'B', 'C', 'D'].map((key) => {
                      const optText = q.options[key] || '';
                      const optHtml = q.optionsHtml?.[key] || null;
                      const isUserPick = q.userResponse === key;
                      const isActualCorrect = q.correctOption === key;

                      let cardClass = 'bg-slate-50 border-slate-200 text-slate-800';

                      if (isActualCorrect) {
                        cardClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium ring-1 ring-emerald-400';
                      } else if (isUserPick && !q.isCorrect) {
                        cardClass = 'bg-red-50 border-red-300 text-red-950 font-medium ring-1 ring-red-400';
                      }

                      return (
                        <div
                          key={key}
                          className={`option-card flex items-center space-x-3 rounded-xl border text-xs transition-all ${cardClass}`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              isActualCorrect
                                ? 'bg-emerald-600 text-white'
                                : isUserPick && !q.isCorrect
                                ? 'bg-red-600 text-white'
                                : 'bg-white border border-slate-300 text-slate-700'
                            }`}
                          >
                            {key}
                          </span>

                          <div className="option-content flex-1 overflow-x-auto">
                            <MathRenderer
                              text={optText}
                              html={optHtml}
                              images={q.images}
                              questionCode={q.question_code}
                              isOption
                            />
                          </div>

                          {isActualCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0 ml-1.5">
                              Correct
                            </span>
                          )}

                          {isUserPick && !isActualCorrect && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded shrink-0 ml-1.5">
                              Your Choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Solution Toggle & Details */}
                {hasSolution ? (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleSolution(q.id)}
                      className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isSolutionOpen ? 'Hide Detailed Solution' : 'View Detailed Solution & Explanation'}</span>
                    </button>

                    {isSolutionOpen && (
                      <div className="mt-3 p-4 bg-blue-50/50 rounded-lg border border-blue-200 text-xs text-slate-800 leading-relaxed space-y-1">
                        <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider mb-1">
                          Explanation & Derivation:
                        </span>
                        <MathRenderer
                          text={q.solution_text}
                          html={q.solution_html}
                          images={q.images}
                          questionCode={q.question_code}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic pt-1">
                    No detailed explanation recorded in database.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
