/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  CbtActiveQuestion,
  CbtTestSession,
  QuestionCBTStatus
} from '../types';
import { MathRenderer } from './MathRenderer';
import { QuestionImage } from './QuestionImage';
import { getStandaloneQuestionImages } from '../services/imageService';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  HelpCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  User,
  X
} from 'lucide-react';

interface CBTExamInterfaceProps {
  testSession: CbtTestSession;
  onSubmitExam: (
    userResponses: Record<string, string | null>,
    timeSpentPerQuestion: Record<string, number>,
    questionStatuses: Record<string, QuestionCBTStatus>
  ) => void;
  onExitWithoutSaving: () => void;
}

export const CBTExamInterface: React.FC<CBTExamInterfaceProps> = ({
  testSession,
  onSubmitExam,
  onExitWithoutSaving
}) => {
  const questions = testSession.questions;
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // User responses { [questionId]: 'A' | 'B' | 'C' | 'D' | null }
  const [responses, setResponses] = useState<Record<string, string | null>>(testSession.userResponses || {});

  // Question statuses { [questionId]: QuestionCBTStatus }
  const [statuses, setStatuses] = useState<Record<string, QuestionCBTStatus>>(() => {
    const initial: Record<string, QuestionCBTStatus> = { ...testSession.questionStatuses };
    if (questions[0] && initial[questions[0].id] === 'NOT_VISITED') {
      initial[questions[0].id] = 'NOT_ANSWERED';
    }
    return initial;
  });

  // Time tracking
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>(testSession.timeSpentPerQuestion || {});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(testSession.durationMinutes * 60);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isPaletteOpenMobile, setIsPaletteOpenMobile] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const activeQuestion = questions[currentIndex] || questions[0];

  // 1. Timer countdown & auto-submit
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });

      // Track active question seconds
      if (activeQuestion) {
        setTimeSpent((prev) => ({
          ...prev,
          [activeQuestion.id]: (prev[activeQuestion.id] || 0) + 1
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuestion?.id]);

  // 2. Mark visited when index changes
  useEffect(() => {
    if (!activeQuestion) return;
    setStatuses((prev) => {
      const currentStatus = prev[activeQuestion.id];
      if (!currentStatus || currentStatus === 'NOT_VISITED') {
        return {
          ...prev,
          [activeQuestion.id]: responses[activeQuestion.id] ? 'ANSWERED' : 'NOT_ANSWERED'
        };
      }
      return prev;
    });
  }, [currentIndex, activeQuestion?.id]);

  // 3. Stable Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside input or modal
      if (isSubmitModalOpen || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p') {
        handlePrevious();
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        let opt = e.key.toUpperCase();
        if (opt === '1') opt = 'A';
        if (opt === '2') opt = 'B';
        if (opt === '3') opt = 'C';
        if (opt === '4') opt = 'D';
        handleOptionSelect(opt);
      } else if (e.key.toLowerCase() === 'c') {
        handleClearResponse();
      } else if (e.key.toLowerCase() === 'm') {
        handleSaveAndMarkForReview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, responses, activeQuestion?.id, isSubmitModalOpen]);

  // Option selection
  const handleOptionSelect = (optionKey: string) => {
    if (!activeQuestion) return;
    const currentAnswer = responses[activeQuestion.id];
    const newAnswer = currentAnswer === optionKey ? null : optionKey;

    setResponses((prev) => ({
      ...prev,
      [activeQuestion.id]: newAnswer
    }));

    setStatuses((prev) => {
      const isMarked =
        prev[activeQuestion.id] === 'MARKED_FOR_REVIEW' ||
        prev[activeQuestion.id] === 'ANSWERED_AND_MARKED_FOR_REVIEW';

      if (newAnswer) {
        return {
          ...prev,
          [activeQuestion.id]: isMarked ? 'ANSWERED_AND_MARKED_FOR_REVIEW' : 'ANSWERED'
        };
      } else {
        return {
          ...prev,
          [activeQuestion.id]: isMarked ? 'MARKED_FOR_REVIEW' : 'NOT_ANSWERED'
        };
      }
    });
  };

  const handleNumericalInput = (val: string) => {
    if (!activeQuestion) return;
    const cleanVal = val.trim();
    setResponses((prev) => ({
      ...prev,
      [activeQuestion.id]: cleanVal ? cleanVal : null
    }));

    setStatuses((prev) => {
      const isMarked =
        prev[activeQuestion.id] === 'MARKED_FOR_REVIEW' ||
        prev[activeQuestion.id] === 'ANSWERED_AND_MARKED_FOR_REVIEW';

      if (cleanVal) {
        return {
          ...prev,
          [activeQuestion.id]: isMarked ? 'ANSWERED_AND_MARKED_FOR_REVIEW' : 'ANSWERED'
        };
      } else {
        return {
          ...prev,
          [activeQuestion.id]: isMarked ? 'MARKED_FOR_REVIEW' : 'NOT_ANSWERED'
        };
      }
    });
  };

  const handleKeypadPress = (char: string) => {
    const current = responses[activeQuestion?.id || ''] || '';
    if (char === 'CLEAR') {
      handleNumericalInput('');
    } else if (char === 'BACKSPACE') {
      handleNumericalInput(current.slice(0, -1));
    } else {
      if (current.length < 12) {
        handleNumericalInput(current + char);
      }
    }
  };

  const handleClearResponse = () => {
    if (!activeQuestion) return;
    setResponses((prev) => ({
      ...prev,
      [activeQuestion.id]: null
    }));

    setStatuses((prev) => {
      const isMarked =
        prev[activeQuestion.id] === 'MARKED_FOR_REVIEW' ||
        prev[activeQuestion.id] === 'ANSWERED_AND_MARKED_FOR_REVIEW';
      return {
        ...prev,
        [activeQuestion.id]: isMarked ? 'MARKED_FOR_REVIEW' : 'NOT_ANSWERED'
      };
    });
  };

  const handleSaveAndNext = () => {
    if (!activeQuestion) return;
    // ensure status is Answered or Not Answered
    const hasAnswer = Boolean(responses[activeQuestion.id]);
    setStatuses((prev) => ({
      ...prev,
      [activeQuestion.id]: hasAnswer ? 'ANSWERED' : 'NOT_ANSWERED'
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSaveAndMarkForReview = () => {
    if (!activeQuestion) return;
    const hasAnswer = Boolean(responses[activeQuestion.id]);
    setStatuses((prev) => ({
      ...prev,
      [activeQuestion.id]: hasAnswer
        ? 'ANSWERED_AND_MARKED_FOR_REVIEW'
        : 'MARKED_FOR_REVIEW'
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    setIsPaletteOpenMobile(false);
  };

  const handleFinalSubmit = () => {
    setIsSubmitModalOpen(false);
    onSubmitExam(responses, timeSpent, statuses);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Status counts for palette legend
  const statusCounts = {
    answered: Object.values(statuses).filter((s) => s === 'ANSWERED').length,
    notAnswered: Object.values(statuses).filter((s) => s === 'NOT_ANSWERED').length,
    notVisited: questions.length - Object.values(statuses).filter((s) => s !== 'NOT_VISITED').length,
    marked: Object.values(statuses).filter((s) => s === 'MARKED_FOR_REVIEW').length,
    answeredAndMarked: Object.values(statuses).filter((s) => s === 'ANSWERED_AND_MARKED_FOR_REVIEW').length
  };

  // Format countdown clock
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${hours > 0 ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = remainingSeconds <= 300; // < 5 mins

  const currentSelection = responses[activeQuestion?.id] || null;
  const allImages = Array.isArray(activeQuestion?.images)
    ? activeQuestion.images
    : activeQuestion?.images
    ? [activeQuestion.images]
    : [];

  // Duplicate Visual Prevention: Only render standalone card if the image is NOT already embedded in question_html!
  const standaloneImages = getStandaloneQuestionImages(
    allImages,
    activeQuestion?.question_html
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* 1. Official CBT Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2.5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded">
            CBT
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-tight">
              {testSession.title}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono text-blue-400 font-semibold">{activeQuestion?.question_code}</span>
              <span aria-hidden="true">·</span>
              <span>{activeQuestion?.subject}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[200px]">{activeQuestion?.chapter_name}</span>
            </div>
          </div>
        </div>

        {/* Right Header Area: Timer, Candidate, Controls */}
        <div className="flex items-center space-x-4">
          {/* Live Exam Timer */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md border font-mono font-bold text-xs tracking-wider ${
              isTimeCritical
                ? 'bg-red-950 text-red-400 border-red-800 animate-pulse'
                : 'bg-slate-800 text-emerald-400 border-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Time Left: {timeFormatted}</span>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Candidate Profile Widget */}
          <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-slate-700">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="text-[11px] leading-tight text-right">
              <span className="block font-semibold text-slate-200">Candidate</span>
              <span className="text-slate-400 text-[10px]">Roll: 2026-NEET</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Stage & Question Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT: Question Stage (75% on Desktop) */}
        <main className="flex-1 flex flex-col bg-white overflow-y-auto">
          {/* Sub-bar: Subject & Question Navigation index */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                {activeQuestion?.question_code}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({activeQuestion?.difficulty})
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                +4.00
              </span>
              <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                -1.00
              </span>
              <button
                type="button"
                onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
                className="lg:hidden p-1 px-2.5 bg-slate-200 text-slate-800 rounded font-semibold text-xs"
              >
                Palette
              </button>
            </div>
          </div>

          {/* Question Text & Diagram Container */}
          <div className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
            {/* Question Text rendered with KaTeX & embedded image transformation */}
            <div className="text-base text-slate-900 leading-relaxed font-normal">
              <MathRenderer
                text={activeQuestion?.question_text}
                html={activeQuestion?.question_html}
                images={activeQuestion?.images}
                questionCode={activeQuestion?.question_code}
              />
            </div>

            {/* Standalone Question Diagram / Visual Assets (only if NOT already embedded in question statement) */}
            {standaloneImages.length > 0 && (
              <div className="space-y-3 py-1">
                {standaloneImages.map((img, idx) => (
                  <QuestionImage
                    key={idx}
                    image={img}
                    questionCode={activeQuestion?.question_code}
                    alt={`Diagram for ${activeQuestion?.question_code}`}
                  />
                ))}
              </div>
            )}

            {/* Options Matrix (Single Choice) or Numerical Answer Input */}
            {activeQuestion?.question_type === 'integer' || activeQuestion?.question_type === 'numerical' ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Numerical / Integer Answer Entry:
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    Type or use Keypad
                  </span>
                </div>

                {/* Display / Input Area */}
                <div className="max-w-md space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currentSelection || ''}
                      onChange={(e) => handleNumericalInput(e.target.value)}
                      placeholder="Enter integer / decimal answer..."
                      className="flex-1 px-4 py-3 text-lg font-mono font-semibold border-2 border-slate-300 focus:border-blue-600 focus:outline-none rounded-xl bg-white shadow-xs"
                    />
                    {currentSelection && (
                      <button
                        type="button"
                        onClick={handleClearResponse}
                        className="px-3 py-3 text-xs font-bold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-xl transition-all"
                        title="Clear response"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Authentic NTA CBT On-screen Virtual Keypad */}
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                      Virtual Console Keypad
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['7', '8', '9', 'BACKSPACE', '4', '5', '6', 'CLEAR', '1', '2', '3', '-', '0', '.'].map((key) => {
                        if (key === 'BACKSPACE') {
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleKeypadPress('BACKSPACE')}
                              className="p-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-all active:scale-95"
                            >
                              ⌫
                            </button>
                          );
                        }
                        if (key === 'CLEAR') {
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleKeypadPress('CLEAR')}
                              className="p-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shadow-xs transition-all active:scale-95"
                            >
                              Clear
                            </button>
                          );
                        }
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleKeypadPress(key)}
                            className="p-2.5 text-sm font-bold font-mono text-slate-800 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-300 rounded-lg shadow-xs transition-all active:scale-95"
                          >
                            {key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Select One Option:
                </span>
                <div className="grid grid-cols-1 gap-3">
                  {['A', 'B', 'C', 'D'].map((key) => {
                    const optText = activeQuestion?.options[key] || '';
                    const optHtml = activeQuestion?.optionsHtml?.[key] || null;
                    const isSelected = currentSelection === key;

                    return (
                      <label
                        key={key}
                        onClick={() => handleOptionSelect(key)}
                        className={`option-card flex items-center space-x-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-600 shadow-xs ring-1 ring-blue-600'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        {/* Radio Circle */}
                        <div className="shrink-0 flex items-center justify-center">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-400 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </div>

                        {/* Option Key Badge */}
                        <span
                          className={`text-xs font-bold w-5 text-center shrink-0 ${
                            isSelected ? 'text-blue-700' : 'text-slate-500'
                          }`}
                        >
                          {key}
                        </span>

                        {/* Option Statement with KaTeX */}
                        <div className="option-content flex-1 text-sm overflow-x-auto">
                          <MathRenderer
                            text={optText}
                            html={optHtml}
                            images={activeQuestion?.images}
                            questionCode={activeQuestion?.question_code}
                            isOption
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Bottom Action Bar */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left Actions: Clear & Mark for Review */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-purple-700 border border-purple-300 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
              >
                <Flag className="w-3.5 h-3.5 text-purple-600" />
                <span>Mark for Review & Next</span>
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                disabled={!currentSelection}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40 transition"
              >
                Clear Response
              </button>
            </div>

            {/* Right Actions: Prev, Save & Next, Submit */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40 transition flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs ml-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Test</span>
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT: Authentic CBT Question Palette (25% on Desktop) */}
        <aside
          className={`lg:w-80 border-l border-slate-200 bg-slate-50 flex flex-col shrink-0 ${
            isPaletteOpenMobile
              ? 'fixed inset-0 z-40 bg-white overflow-y-auto'
              : 'hidden lg:flex'
          }`}
        >
          {/* Palette Header */}
          <div className="bg-slate-100 border-b border-slate-200 p-3.5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Question Palette
            </span>
            <button
              onClick={() => setIsPaletteOpenMobile(false)}
              className="lg:hidden text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Palette Legend Cards */}
          <div className="p-3 border-b border-slate-200 bg-white grid grid-cols-2 gap-2 text-[10px] text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-xs bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                {statusCounts.answered}
              </span>
              <span>Answered</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-xs bg-red-600 text-white font-bold flex items-center justify-center text-[10px]">
                {statusCounts.notAnswered}
              </span>
              <span>Not Answered</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-xs bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                {statusCounts.notVisited}
              </span>
              <span>Not Visited</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-xs bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                {statusCounts.marked}
              </span>
              <span>Marked for Review</span>
            </div>

            <div className="col-span-2 flex items-center space-x-1.5 pt-0.5">
              <div className="relative w-5 h-5 rounded-xs bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                {statusCounts.answeredAndMarked}
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
              </div>
              <span className="truncate">Answered & Marked for Review</span>
            </div>
          </div>

          {/* Question Numbers Grid */}
          <div className="flex-1 p-3.5 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const status = statuses[q.id] || 'NOT_VISITED';
                const isCurrent = currentIndex === idx;

                let btnClass = 'bg-slate-200 text-slate-700 hover:bg-slate-300'; // NOT_VISITED

                if (status === 'ANSWERED') {
                  btnClass = 'bg-emerald-600 text-white hover:bg-emerald-700';
                } else if (status === 'NOT_ANSWERED') {
                  btnClass = 'bg-red-600 text-white hover:bg-red-700';
                } else if (status === 'MARKED_FOR_REVIEW') {
                  btnClass = 'bg-purple-600 text-white hover:bg-purple-700';
                } else if (status === 'ANSWERED_AND_MARKED_FOR_REVIEW') {
                  btnClass = 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-emerald-400';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`relative w-full aspect-square rounded text-xs font-bold transition flex items-center justify-center ${btnClass} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {status === 'ANSWERED_AND_MARKED_FOR_REVIEW' && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Palette Footer Actions */}
          <div className="p-3 border-t border-slate-200 bg-white flex flex-col space-y-2">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center space-x-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Examination</span>
            </button>

            <button
              type="button"
              onClick={onExitWithoutSaving}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded text-[11px] transition text-center"
            >
              Exit Exam Without Saving
            </button>
          </div>
        </aside>
      </div>

      {/* 4. Final Submission Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Confirm Exam Submission</h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to finish and submit your examination? Once submitted, you cannot change your answers.
            </p>

            {/* Summary Statistics Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-2 p-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <span>Total Questions</span>
                <span className="font-mono text-right">{questions.length}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-emerald-800 bg-emerald-50/40 font-semibold">
                <span>Answered</span>
                <span className="font-mono text-right">{statusCounts.answered}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-red-800 bg-red-50/40 font-semibold">
                <span>Not Answered</span>
                <span className="font-mono text-right">{statusCounts.notAnswered}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-purple-800 bg-purple-50/40 font-semibold">
                <span>Marked for Review</span>
                <span className="font-mono text-right">
                  {statusCounts.marked + statusCounts.answeredAndMarked}
                </span>
              </div>
              <div className="grid grid-cols-2 p-2.5 text-slate-600">
                <span>Not Visited</span>
                <span className="font-mono text-right">{statusCounts.notVisited}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Yes, Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
