/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QuestionBankRecord } from '../types';
import { MathRenderer } from './MathRenderer';
import { QuestionImage } from './QuestionImage';
import { getStandaloneQuestionImages } from '../services/imageService';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Code,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Layers,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface QuestionDetailsProps {
  question: QuestionBankRecord;
  onBack: () => void;
  onStartSingleQuestionTest?: (question: QuestionBankRecord) => void;
}

export const QuestionDetails: React.FC<QuestionDetailsProps> = ({
  question,
  onBack,
  onStartSingleQuestionTest
}) => {
  // Correct answer & solution is ONLY revealed in admin/details inspection mode
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [showRawPayload, setShowRawPayload] = useState<boolean>(false);

  const allImages = Array.isArray(question.images)
    ? question.images
    : question.images
    ? [question.images]
    : [];

  // Duplicate Visual Prevention: Only render standalone card if the image is NOT already embedded in question_html!
  const standaloneImages = getStandaloneQuestionImages(
    allImages,
    question.question_html
  );

  const correctOpt = (question.correct_option || '').toUpperCase().trim();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 font-sans">
      {/* Top Bar with Back Navigation */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Question Library</span>
        </button>

        <div className="flex items-center space-x-2">
          {/* Admin toggle for answer visibility */}
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showAnswer
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {showAnswer ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Answer Key</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Admin: Reveal Answer Key</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Metadata Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {question.question_code || question.id}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {question.exam_source || 'Exam Question'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{question.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{question.chapter_name || question.chapter_slug}</span>
              {question.year && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Year {question.year}</span>
                </>
              )}
              {question.paper_slug && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-slate-400">{question.paper_slug}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span
              className={`font-semibold px-2 py-0.5 rounded border ${
                question.difficulty === 'Easy'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : question.difficulty === 'Hard'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {question.difficulty}
            </span>
            {question.question_type && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium">
                {question.question_type}
              </span>
            )}
          </div>
        </div>

        {/* Question Statement */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Question Statement
          </span>
          <div className="text-sm md:text-base text-slate-900 leading-relaxed font-normal">
            <MathRenderer
              text={question.question_text}
              html={question.question_html}
              images={question.images}
              questionCode={question.question_code}
            />
          </div>
        </div>

        {/* Question Diagram / Images if present (only if NOT already embedded) */}
        {standaloneImages.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Diagram / Visual Asset
            </span>
            <div className="space-y-3">
              {standaloneImages.map((img, idx) => (
                <QuestionImage
                  key={idx}
                  image={img}
                  questionCode={question.question_code}
                  alt={`Diagram for ${question.question_code}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Options List / Numerical Answer Input Display */}
        {question.question_type === 'integer' || question.question_type === 'numerical' ? (
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Question Type: Numerical / Integer
            </span>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">Type: Numerical / Integer Answer (No Multiple Choice Options)</span>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  Numeric Entry
                </span>
              </div>
              <p className="text-xs text-slate-500">
                In CBT exams, candidate types their numeric answer directly into the console keypad.
              </p>
              {showAnswer && (
                <div className="pt-2 border-t border-slate-200 flex items-center space-x-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Correct Value: {correctOpt || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Answer Choices
            </span>
            <div className="grid grid-cols-1 gap-3">
              {['A', 'B', 'C', 'D'].map((key) => {
                const optRecord = question.options?.find((o) => o.option_key.toUpperCase() === key);
                const optText = optRecord ? optRecord.option_text : '';
                const optHtml = optRecord ? optRecord.option_html : null;
                const isCorrect = showAnswer && correctOpt === key;

                return (
                  <div
                    key={key}
                    className={`option-card flex items-center space-x-3.5 rounded-xl border transition-all ${
                      isCorrect
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium ring-1 ring-emerald-400'
                        : 'bg-slate-50/50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      {key}
                    </span>
                    <div className="option-content flex-1 text-sm overflow-x-auto">
                      <MathRenderer
                        text={optText}
                        html={optHtml}
                        images={question.images}
                        questionCode={question.question_code}
                        isOption
                      />
                    </div>
                    {isCorrect && (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center space-x-1 shrink-0 bg-emerald-100 px-2 py-0.5 rounded ml-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Correct Answer</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin/Details Solution Box (Protected & togglable) */}
        {showAnswer && (
          <div className="pt-4 border-t border-slate-100 space-y-3 bg-emerald-50/40 -mx-6 -mb-6 p-6 rounded-b-xl border-emerald-200">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>
                Correct {question.question_type === 'integer' || question.question_type === 'numerical' ? 'Value' : 'Option'}:{' '}
                {correctOpt || 'N/A'}
              </span>
            </div>

            {(question.solution_text || question.solution_html) ? (
              <div className="space-y-1.5 text-xs text-slate-800 leading-relaxed bg-white p-4 rounded-lg border border-emerald-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Detailed Solution & Explanation:
                </span>
                <MathRenderer
                  text={question.solution_text}
                  html={question.solution_html}
                  className="text-slate-800"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic bg-white p-3 rounded border border-slate-200">
                No formal solution text provided in database records.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Raw Database Record Inspector */}
      <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
        <button
          type="button"
          onClick={() => setShowRawPayload(!showRawPayload)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <div className="flex items-center space-x-1.5">
            <Code className="w-3.5 h-3.5" />
            <span>Database Record Metadata</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {showRawPayload ? 'Hide ▲' : 'Inspect ▼'}
          </span>
        </button>

        {showRawPayload && (
          <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-mono space-y-2 text-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 text-[10px] block">UUID:</span>
                <span className="break-all">{question.id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Question Code:</span>
                <span>{question.question_code}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Source Name / ID:</span>
                <span>{question.source_name || question.source_question_id || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Source URL:</span>
                {question.source_url ? (
                  <a
                    href={question.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-all inline-flex items-center gap-1"
                  >
                    <span>{question.source_url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span>None</span>
                )}
              </div>
            </div>

            {question.raw_payload && (
              <div className="mt-2">
                <span className="text-slate-400 text-[10px] block mb-1">Raw Payload:</span>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded text-[10px] overflow-auto max-h-48 leading-normal">
                  {JSON.stringify(question.raw_payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
