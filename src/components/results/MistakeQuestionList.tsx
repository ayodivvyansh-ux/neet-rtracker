/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CbtQuestionEvaluation, CbtTestResult, CbtTestSession } from '../../types';
import { MathRenderer } from '../MathRenderer';
import { QuestionImage } from '../QuestionImage';
import { getStandaloneQuestionImages } from '../../services/imageService';
import { generateMistakeRevisionPdf } from '../../services/mistakePdfGenerator';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  XCircle
} from 'lucide-react';

interface MistakeQuestionListProps {
  session: CbtTestSession;
  result: CbtTestResult;
  onRetakeMistakes: (wrongIds: string[]) => void;
}

export const MistakeQuestionList: React.FC<MistakeQuestionListProps> = ({
  session,
  result,
  onRetakeMistakes
}) => {
  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Filter only wrong and unattempted questions
  const allMistakes = result.evaluations.filter((q) => !q.isCorrect);
  const wrongMistakes = allMistakes.filter((q) => q.isAttempted && !q.isCorrect);
  const unattemptedMistakes = allMistakes.filter((q) => !q.isAttempted);

  const displayedMistakes = allMistakes.filter((q) => {
    // 1. Type filter
    if (filterType === 'wrong' && !q.isAttempted) return false;
    if (filterType === 'unattempted' && q.isAttempted) return false;

    // 2. Subject filter
    if (subjectFilter !== 'all') {
      const qSubj = (q.subject || '').toLowerCase();
      const targetSubj = subjectFilter.toLowerCase();
      if (targetSubj === 'biology') {
        return qSubj === 'botany' || qSubj === 'zoology' || qSubj === 'biology';
      }
      return qSubj === targetSubj;
    }

    return true;
  });

  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await generateMistakeRevisionPdf(session, result);
    } catch (err) {
      console.error('Failed to generate mistake revision PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const distinctSubjects = Array.from(
    new Set(allMistakes.map((m) => m.subject || 'General'))
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Mistake Revision Collection ({allMistakes.length} Target Questions)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Exclusively aggregates every incorrect and skipped question for targeted review.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {wrongMistakes.length > 0 && (
            <button
              type="button"
              onClick={() => onRetakeMistakes(wrongMistakes.map((w) => w.id))}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold hover:bg-amber-100 transition shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake {wrongMistakes.length} Wrong</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || allMistakes.length === 0}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Revision Sheet (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Type Filter */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Mistakes ({allMistakes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('wrong')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              filterType === 'wrong'
                ? 'bg-white text-red-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Wrong Answers ({wrongMistakes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('unattempted')}
            className={`px-3 py-1 rounded-md font-semibold transition ${
              filterType === 'unattempted'
                ? 'bg-white text-amber-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Unattempted ({unattemptedMistakes.length})
          </button>
        </div>

        {/* Subject Filter */}
        {distinctSubjects.length > 1 && (
          <div className="flex items-center space-x-1">
            <span className="text-slate-400 text-xs font-medium mr-1">Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="all">All Subjects</option>
              {distinctSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Question Card List */}
      {displayedMistakes.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No questions in this filter view.</p>
          <p className="text-xs text-slate-400">All questions in this selection were answered accurately!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedMistakes.map((q, idx) => {
            const isWrong = q.isAttempted && !q.isCorrect;
            const isExpanded = expandedSolutions[q.id];
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

            return (
              <div
                key={q.id}
                className={`rounded-xl border transition p-5 space-y-4 ${
                  isWrong
                    ? 'border-red-200 bg-red-50/20'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                {/* Top Info Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      Q{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {q.question_code}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      {q.subject} · {q.chapter_name}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isWrong ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-md">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Wrong: Selected ({q.userResponse}) · Correct: ({q.correctOption})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Unattempted · Correct: ({q.correctOption})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Content */}
                <div className="text-sm text-slate-900 leading-relaxed font-normal">
                  <MathRenderer
                    content={q.question_html || q.question_text}
                    images={q.images}
                    questionCode={q.question_code}
                    className="prose prose-sm max-w-none text-slate-900"
                  />
                </div>

                {/* Standalone Diagram if present */}
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

                {/* Option Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {['A', 'B', 'C', 'D'].map((optKey) => {
                    const optText = q.options?.[optKey];
                    const optHtml = q.optionsHtml?.[optKey];
                    if (!optText && !optHtml) return null;

                    const isUserPick = q.userResponse === optKey;
                    const isCorrect = q.correctOption === optKey;

                    let cardStyle = 'bg-white border-slate-200 text-slate-700';
                    let badge = null;

                    if (isCorrect) {
                      cardStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-2xs';
                      badge = (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded ml-auto flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Correct Answer</span>
                        </span>
                      );
                    } else if (isUserPick) {
                      cardStyle = 'bg-red-50 border-red-300 text-red-950 font-semibold shadow-2xs';
                      badge = (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded ml-auto flex items-center space-x-1">
                          <X className="w-3 h-3" />
                          <span>Your Selection</span>
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optKey}
                        className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 transition ${cardStyle}`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                            isCorrect
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
                        {badge}
                      </div>
                    );
                  })}
                </div>

                {/* Solution / Explanation Accordion */}
                {(q.solution_text || q.solution_html) && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => toggleSolution(q.id)}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                      <span>{isExpanded ? 'Hide Official Solution' : 'View Official Solution & Key Concept'}</span>
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
      )}
    </div>
  );
};
