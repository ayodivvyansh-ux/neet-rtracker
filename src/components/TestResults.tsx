/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CbtQuestionEvaluation, CbtTestResult, CbtTestSession } from '../types';
import { ResultSummary } from './results/ResultSummary';
import { SubjectPerformanceCard } from './results/SubjectPerformanceCard';
import { MistakeQuestionList } from './results/MistakeQuestionList';
import { MathRenderer } from './MathRenderer';
import { QuestionImage } from './QuestionImage';
import { getStandaloneQuestionImages } from '../services/imageService';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  HelpCircle,
  ListFilter,
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
  const [activeTab, setActiveTab] = useState<'mistakes' | 'all'>('mistakes');
  const [expandedAllSolutions, setExpandedAllSolutions] = useState<Record<string, boolean>>({});

  const wrongIds = result.evaluations.filter((q) => q.isAttempted && !q.isCorrect).map((q) => q.id);

  const toggleAllSolution = (id: string) => {
    setExpandedAllSolutions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-sans space-y-8">
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Performance Scorecard & Examination Review
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            {session.title} · Test ID: <span className="font-mono">{session.id}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateToCreateTest}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
          >
            <span>New Test</span>
          </button>

          <button
            type="button"
            onClick={onRetakeFullTest}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Exam</span>
          </button>
        </div>
      </div>

      {/* 2. Hero Scoreboard & Key Metrics */}
      <ResultSummary session={session} result={result} />

      {/* 3. Subject-Wise Performance Hierarchy */}
      <SubjectPerformanceCard evaluations={result.evaluations} result={result} />

      {/* 4. Tab Navigation for Review: Mistake Collection vs All Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('mistakes')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'mistakes'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Mistake Revision Target</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'mistakes'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {result.incorrectCount + result.unattemptedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Full Question Review</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {result.evaluations.length}
              </span>
            </button>
          </div>
        </div>

        {/* 5. Tab Content: Mistakes Collection */}
        {activeTab === 'mistakes' && (
          <MistakeQuestionList
            session={session}
            result={result}
            onRetakeMistakes={onRetakeIncorrectOnly}
          />
        )}

        {/* 6. Tab Content: All Questions Full Review */}
        {activeTab === 'all' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                Complete Exam Review ({result.evaluations.length} Questions)
              </h2>
              <p className="text-xs text-slate-500">
                Chronological list of all questions in this exam session with answers and solutions.
              </p>
            </div>

            <div className="space-y-4">
              {result.evaluations.map((q, idx) => {
                const isCorrect = q.isCorrect;
                const isWrong = q.isAttempted && !q.isCorrect;
                const isUnattempted = !q.isAttempted;
                const isExpanded = expandedAllSolutions[q.id];

                const allImages = Array.isArray(q.images)
                  ? q.images
                  : q.images
                  ? [q.images]
                  : [];
                const standaloneImages = getStandaloneQuestionImages(
                  allImages,
                  q.question_html,
                  q.options
                    ? Object.entries(q.options).map(([k, v]) => ({
                        option_html: q.optionsHtml?.[k] || v
                      }))
                    : []
                );

                let cardBorder = 'border-slate-200 bg-white';
                if (isCorrect) cardBorder = 'border-emerald-200 bg-emerald-50/10';
                if (isWrong) cardBorder = 'border-red-200 bg-red-50/10';
                if (isUnattempted) cardBorder = 'border-amber-200 bg-amber-50/10';

                return (
                  <div key={q.id} className={`rounded-xl border p-5 space-y-4 ${cardBorder}`}>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                          {q.question_code}
                        </span>
                        <span className="text-xs text-slate-600">
                          {q.subject} · {q.chapter_name}
                        </span>
                      </div>

                      <div>
                        {isCorrect && (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Correct (+4 Marks)</span>
                          </span>
                        )}
                        {isWrong && (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-md">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Wrong: ({q.userResponse}) · Correct: ({q.correctOption})</span>
                          </span>
                        )}
                        {isUnattempted && (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Unattempted · Correct: ({q.correctOption})</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-slate-900 leading-relaxed font-normal">
                      <MathRenderer
                        content={q.question_html || q.question_text}
                        images={q.images}
                        questionCode={q.question_code}
                      />
                    </div>

                    {standaloneImages.length > 0 && (
                      <div className="my-3 flex flex-col items-center">
                        {standaloneImages.map((img: any, i: number) => (
                          <QuestionImage
                            key={img.id || i}
                            image={img}
                            questionCode={q.question_code}
                            className="rounded-lg border border-slate-200 shadow-2xs max-w-lg"
                          />
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {['A', 'B', 'C', 'D'].map((optKey) => {
                        const optText = q.options?.[optKey];
                        const optHtml = q.optionsHtml?.[optKey];
                        if (!optText && !optHtml) return null;

                        const isUserPick = q.userResponse === optKey;
                        const isCorrectOpt = q.correctOption === optKey;

                        let style = 'bg-white border-slate-200 text-slate-700';
                        if (isCorrectOpt) {
                          style = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold';
                        } else if (isUserPick) {
                          style = 'bg-red-50 border-red-300 text-red-950 font-semibold';
                        }

                        return (
                          <div
                            key={optKey}
                            className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${style}`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                                isCorrectOpt
                                  ? 'bg-emerald-600 text-white'
                                  : isUserPick
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {optKey}
                            </span>
                            <div className="flex-1 min-w-0">
                              <MathRenderer
                                content={optHtml || optText}
                                images={q.images}
                                questionCode={q.question_code}
                                isOption={true}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(q.solution_text || q.solution_html) && (
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleAllSolution(q.id)}
                          className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                        >
                          <span>{isExpanded ? 'Hide Solution' : 'View Official Solution'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 p-4 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-slate-800 space-y-2">
                            <span className="font-bold text-blue-900 block uppercase tracking-wider text-[10px]">
                              Official Solution & Key Concept:
                            </span>
                            <MathRenderer
                              content={q.solution_html || q.solution_text || ''}
                              images={q.images}
                              questionCode={q.question_code}
                              className="prose prose-xs max-w-none text-slate-800 leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
