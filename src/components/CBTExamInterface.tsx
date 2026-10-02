/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CbtActiveQuestion,
  CbtTestSession,
  QuestionCBTStatus
} from '../types';
import { MathRenderer } from './MathRenderer';
import { QuestionImage } from './QuestionImage';
import { getStandaloneQuestionImages } from '../services/imageService';
import { SubjectTabs } from './cbt/SubjectTabs';
import { SubjectQuestionNavigator } from './cbt/SubjectQuestionNavigator';
import { QuestionStatusLegend } from './cbt/QuestionStatusLegend';
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
  Hexagon,
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

  // Section Tracking
  const [activeTopSection, setActiveTopSection] = useState<string>('PHYSICS');
  const [activeBiologySubSection, setActiveBiologySubSection] = useState<string | null>('BOTANY');

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

  // 1. Synchronize active section tab with active question subject
  useEffect(() => {
    if (!activeQuestion) return;
    const subj = (activeQuestion.subject || 'General').toUpperCase();
    if (subj === 'PHYSICS') {
      setActiveTopSection('PHYSICS');
    } else if (subj === 'CHEMISTRY') {
      setActiveTopSection('CHEMISTRY');
    } else if (subj === 'BOTANY' || subj === 'ZOOLOGY' || subj === 'BIOLOGY') {
      setActiveTopSection('BIOLOGY');
      if (subj === 'BOTANY') {
        setActiveBiologySubSection('BOTANY');
      } else if (subj === 'ZOOLOGY') {
        setActiveBiologySubSection('ZOOLOGY');
      }
    } else {
      setActiveTopSection(subj);
    }
  }, [currentIndex, activeQuestion?.id]);

  // 2. Timer countdown & auto-submit
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

  // 3. Mark visited when index changes
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

  // 4. Stable Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Handlers for subject section selection
  const handleSelectSection = (sectionId: string, targetIndex?: number) => {
    setActiveTopSection(sectionId);
    if (sectionId === 'BIOLOGY') {
      const bioIndex = questions.findIndex(
        (q) =>
          q.subject.toLowerCase() === 'botany' ||
          q.subject.toLowerCase() === 'zoology' ||
          q.subject.toLowerCase() === 'biology'
      );
      if (bioIndex >= 0) {
        setCurrentIndex(bioIndex);
        const sub = questions[bioIndex].subject.toUpperCase();
        if (sub === 'BOTANY' || sub === 'ZOOLOGY') {
          setActiveBiologySubSection(sub);
        }
      }
    } else if (typeof targetIndex === 'number' && targetIndex >= 0) {
      setCurrentIndex(targetIndex);
    } else {
      const secIndex = questions.findIndex(
        (q) => q.subject.toUpperCase() === sectionId.toUpperCase()
      );
      if (secIndex >= 0) setCurrentIndex(secIndex);
    }
  };

  const handleSelectBiologySubsection = (subId: string, targetIndex?: number) => {
    setActiveTopSection('BIOLOGY');
    setActiveBiologySubSection(subId);
    if (typeof targetIndex === 'number' && targetIndex >= 0) {
      setCurrentIndex(targetIndex);
    } else {
      const subIndex = questions.findIndex(
        (q) => q.subject.toUpperCase() === subId.toUpperCase()
      );
      if (subIndex >= 0) setCurrentIndex(subIndex);
    }
  };

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

  const standaloneImages = getStandaloneQuestionImages(
    allImages,
    activeQuestion?.question_html,
    activeQuestion?.options
      ? Object.entries(activeQuestion.options).map(([k, v]) => ({
          option_html: activeQuestion.optionsHtml?.[k] || v
        }))
      : []
  );

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col font-sans select-none">
      {/* 1. Official CBT Header */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs shadow-xs">
            <Hexagon className="w-4 h-4 fill-white text-black" />
          </div>
          <div>
            <h1 className="font-editorial-serif text-base sm:text-lg font-bold text-slate-950 tracking-tight leading-tight">
              {testSession.title}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="font-mono text-slate-900 font-semibold">{activeQuestion?.question_code}</span>
              <span>·</span>
              <span>{activeQuestion?.subject}</span>
              <span>·</span>
              <span className="truncate max-w-[220px]">{activeQuestion?.chapter_name}</span>
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Live Exam Timer */}
          <div
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border font-mono font-bold text-xs tracking-wider ${
              isTimeCritical
                ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                : 'bg-slate-100 text-slate-900 border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Time Left: {timeFormatted}</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="text-[11px] leading-tight text-right">
              <span className="block font-bold text-slate-900">Candidate</span>
              <span className="text-slate-400 text-[10px] font-mono">Roll: NEET-UG</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Top-Level Subject Navigation Tabs */}
      <SubjectTabs
        questions={questions}
        currentIndex={currentIndex}
        responses={responses}
        activeTopSection={activeTopSection}
        activeBiologySubSection={activeBiologySubSection}
        onSelectSection={handleSelectSection}
        onSelectBiologySubsection={handleSelectBiologySubsection}
      />

      {/* 3. Main Stage & Question Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT: Question Stage (75% on Desktop) */}
        <main className="flex-1 flex flex-col bg-white overflow-y-auto border-r border-slate-200/80">
          {/* Sub-bar: Question metadata and score marking */}
          <div className="bg-slate-50/70 border-b border-slate-200/80 px-6 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900 font-editorial-serif text-sm">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                {activeQuestion?.question_code}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({activeQuestion?.difficulty})
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-mono">
                +4.00 Marks
              </span>
              <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px] font-mono">
                -1.00 Marks
              </span>
              <button
                type="button"
                onClick={() => setIsPaletteOpenMobile(!isPaletteOpenMobile)}
                className="lg:hidden p-1 px-2.5 bg-black text-white rounded-md font-semibold text-xs"
              >
                Navigator
              </button>
            </div>
          </div>

          {/* Question Text & Diagram Container */}
          <div className="flex-1 p-6 sm:p-8 max-w-4xl w-full mx-auto space-y-6">
            <div className="text-base text-slate-950 leading-relaxed font-normal">
              <MathRenderer
                content={activeQuestion?.question_html || activeQuestion?.question_text}
                images={activeQuestion?.images}
                questionCode={activeQuestion?.question_code}
                className="prose prose-slate max-w-none text-slate-950"
              />
            </div>

            {/* Standalone Question Diagram / Visual Assets */}
            {standaloneImages.length > 0 && (
              <div className="space-y-3 py-1">
                {standaloneImages.map((img, idx) => (
                  <QuestionImage
                    key={idx}
                    image={img}
                    questionCode={activeQuestion?.question_code}
                  />
                ))}
              </div>
            )}

            {/* Options Matrix (Single Choice) or Numerical Answer Input */}
            {activeQuestion?.question_type === 'integer' || activeQuestion?.question_type === 'numerical' ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Numerical / Decimal Answer Entry:
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    Type or use Keypad
                  </span>
                </div>

                <div className="max-w-md space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currentSelection || ''}
                      onChange={(e) => handleNumericalInput(e.target.value)}
                      placeholder="Enter integer / decimal answer..."
                      className="flex-1 px-4 py-3 text-lg font-mono font-semibold border-2 border-slate-300 focus:border-black focus:outline-hidden rounded-xl bg-white shadow-xs"
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

                  {/* Virtual Keypad */}
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
                            className="p-2.5 text-sm font-bold font-mono text-slate-800 bg-white hover:bg-black hover:text-white border border-slate-300 rounded-lg shadow-xs transition-all active:scale-95"
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
                        className={`option-card flex items-center space-x-3.5 rounded-xl border cursor-pointer transition-all p-3.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="shrink-0 flex items-center justify-center">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-white bg-white'
                                : 'border-slate-400 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                          </div>
                        </div>

                        <span
                          className={`w-6 h-6 rounded-md font-bold flex items-center justify-center text-xs shrink-0 ${
                            isSelected
                              ? 'bg-white text-black font-mono'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 font-mono'
                          }`}
                        >
                          {key}
                        </span>

                        <div className={`flex-1 text-sm font-medium leading-normal min-w-0 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          <MathRenderer
                            content={optHtml || optText}
                            images={activeQuestion?.images}
                            questionCode={activeQuestion?.question_code}
                            isOption={true}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <footer className="bg-slate-50/80 border-t border-slate-200/80 p-4 px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-semibold text-xs rounded-lg transition flex items-center space-x-1.5"
              >
                <Flag className="w-3.5 h-3.5 text-purple-700" />
                <span>Mark for Review & Next</span>
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                disabled={!currentSelection}
                className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Response</span>
              </button>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-6 py-2 bg-black hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center space-x-1.5"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </footer>
        </main>

        {/* RIGHT: Section-Aware Question Navigator Palette (25% on Desktop) */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 w-80 bg-white border-l border-slate-200 shadow-2xl lg:shadow-none lg:static lg:w-80 flex flex-col transition-transform duration-200 ease-in-out ${
            isPaletteOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 bg-black text-white flex items-center justify-between lg:hidden shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider">
              Question Navigator
            </span>
            <button
              onClick={() => setIsPaletteOpenMobile(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section Navigator Component */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <SubjectQuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              responses={responses}
              statuses={statuses}
              activeTopSection={activeTopSection}
              activeBiologySubSection={activeBiologySubSection}
              onSelectQuestion={handleJumpToQuestion}
            />
          </div>

          {/* Palette Legend */}
          <QuestionStatusLegend counts={statusCounts} />

          {/* Submit Actions */}
          <div className="p-3.5 border-t border-slate-200/80 bg-white flex flex-col space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full py-2.5 bg-black hover:bg-slate-900 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center space-x-1.5"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-editorial-serif text-lg font-bold text-slate-950">Confirm Exam Submission</h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Are you sure you want to finish and submit your examination? Once submitted, your scorecard and mistake revision compendium will be finalized.
            </p>

            {/* Summary Statistics Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-2 p-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <span>Total Questions</span>
                <span className="font-mono text-right font-bold">{questions.length}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-slate-900 bg-white font-semibold">
                <span>Answered</span>
                <span className="font-mono text-right font-bold">{statusCounts.answered}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-amber-900 bg-amber-50/40 font-semibold">
                <span>Not Answered</span>
                <span className="font-mono text-right font-bold">{statusCounts.notAnswered}</span>
              </div>
              <div className="grid grid-cols-2 p-2.5 border-b border-slate-100 text-purple-900 bg-purple-50/40 font-semibold">
                <span>Marked for Review</span>
                <span className="font-mono text-right font-bold">
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
                className="px-5 py-2 bg-black hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-xs"
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
