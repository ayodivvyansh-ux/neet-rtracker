/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  fetchDistinctChapters,
  generateCbtTestSession,
  DistinctChapterItem,
  formatChapterDisplayName
} from '../services/questionBankService';
import { CbtTestConfig, CbtTestSession, Subject } from '../types';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileQuestion,
  GraduationCap,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  X
} from 'lucide-react';

interface CreateTestProps {
  onStartExam: (session: CbtTestSession) => void;
  onNavigateToLibrary: () => void;
}

export const CreateTest: React.FC<CreateTestProps> = ({
  onStartExam,
  onNavigateToLibrary
}) => {
  // Test configuration state
  const [exam, setExam] = useState<'NEET' | 'JEE Main'>('NEET');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Physics', 'Chemistry', 'Botany', 'Zoology']);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(180);
  const [durationMinutes, setDurationMinutes] = useState<number>(200);
  const [mode, setMode] = useState<'full_syllabus' | 'multi_chapter' | 'chapterwise'>('full_syllabus');

  // Dynamic chapters loaded from database
  const [availableChapters, setAvailableChapters] = useState<DistinctChapterItem[]>([]);
  const [loadingChapters, setLoadingChapters] = useState<boolean>(true);

  // Generation status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load dynamic chapters from Supabase
  useEffect(() => {
    async function loadChapters() {
      setLoadingChapters(true);
      try {
        const chapters = await fetchDistinctChapters();
        setAvailableChapters(chapters);
      } catch (err) {
        console.warn('Could not load chapters:', err);
      } finally {
        setLoadingChapters(false);
      }
    }
    loadChapters();
  }, []);

  const allSubjects = exam === 'NEET' ? ['Physics', 'Chemistry', 'Botany', 'Zoology'] : ['Physics', 'Chemistry', 'Mathematics'];

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subj)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((s) => s !== subj);
      } else {
        return [...prev, subj];
      }
    });
  };

  const handleResetSubjects = () => {
    setSelectedSubjects(allSubjects);
  };

  // Filter chapters by selected subjects
  const displayedChapters = availableChapters.filter((c) => {
    if (selectedSubjects.length === allSubjects.length) return true;
    const cSubj = c.subject.toLowerCase();
    return selectedSubjects.some((s) => {
      const sLower = s.toLowerCase();
      if (sLower === 'botany' && (cSubj === 'botany' || c.chapter_slug === 'biomolecules-b')) return true;
      if (sLower === 'zoology' && cSubj === 'zoology') return true;
      if (sLower === 'physics' && cSubj === 'physics') return true;
      if (sLower === 'chemistry' && cSubj === 'chemistry' && c.chapter_slug !== 'biomolecules-b') return true;
      return cSubj === sLower;
    });
  });

  const handleModeChange = (newMode: 'full_syllabus' | 'multi_chapter' | 'chapterwise') => {
    setMode(newMode);
    if (newMode === 'full_syllabus') {
      setSelectedChapters([]);
    }
  };

  const toggleChapterSelection = (slug: string) => {
    if (mode === 'chapterwise') {
      setSelectedChapters([slug]);
    } else {
      setSelectedChapters((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      );
    }
  };

  const handleCountPreset = (count: number, minutes: number) => {
    setQuestionCount(count);
    setDurationMinutes(minutes);
  };

  // Handle Generate and Launch Exam
  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    // Validation for chapterwise / multi_chapter
    if (mode !== 'full_syllabus' && selectedChapters.length === 0) {
      setError('Please select at least one chapter for this examination scope.');
      setIsGenerating(false);
      return;
    }

    try {
      const primarySubject = selectedSubjects.length === allSubjects.length
        ? 'All'
        : selectedSubjects.length === 1
        ? selectedSubjects[0]
        : selectedSubjects.includes('Botany') && selectedSubjects.includes('Zoology') && selectedSubjects.length === 2
        ? 'Biology'
        : 'All';

      const config: CbtTestConfig = {
        title: `${exam} CBT Exam (${difficulty} · ${questionCount} Questions)`,
        exam,
        subject: primarySubject as any,
        selectedChapters: mode === 'full_syllabus' ? [] : selectedChapters,
        difficulty,
        questionCount,
        durationMinutes,
        mode
      };

      const session = await generateCbtTestSession(config);
      onStartExam(session);
    } catch (err: any) {
      setError(err.message || 'Failed to assemble test session from question bank.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-sans space-y-8">
      {/* 1. Page Header matching Reference Screenshot */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            RIG CONFIGURATION / STANDARD NTA MODE
          </div>
          <h1 className="font-editorial-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
            Create CBT Mock Test
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
            Configure computer-based examination with strict question difficulty segregation and timing controls.
          </p>
        </div>

        {/* Live Bank Pill Badge */}
        <div className="inline-flex items-center space-x-2 bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-700 shrink-0 self-start md:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Bank: <strong className="font-mono text-slate-900 font-bold">15,815</strong> Verified Items</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleCreateAndStart} className="space-y-6">
        {/* PANEL 01: Target Exam & Difficulty Segregation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-6 relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="w-7 h-5 rounded-md bg-black text-white text-[11px] font-mono font-bold flex items-center justify-center mb-2">
                01
              </div>
              <h2 className="font-editorial-serif text-lg sm:text-xl font-bold text-slate-950 tracking-tight">
                Target Exam & Difficulty Segregation
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Calibrate standard grading rubrics, item weightage, and difficulty constraints.
              </p>
            </div>
            <Sliders className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Target Examination */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Target Examination
              </label>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    setExam('NEET');
                    setSelectedSubjects(['Physics', 'Chemistry', 'Botany', 'Zoology']);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    exam === 'NEET'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  NEET UG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExam('JEE Main');
                    setSelectedSubjects(['Physics', 'Chemistry', 'Mathematics']);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    exam === 'JEE Main'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  JEE Main
                </button>
              </div>
            </div>

            {/* Difficulty Calibration Tier */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Difficulty Calibration Tier
              </label>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
                {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      difficulty === lvl
                        ? 'bg-black text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strict Segregation Rule Info Card */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 block">Strict Segregation Rule Active</span>
              <p className="text-[11px] leading-relaxed text-slate-500 font-normal">
                {exam === 'NEET' && difficulty === 'Hard'
                  ? 'High-Yield Hard mode includes rigorous NEET Hard items combined with authentic JEE Main Physics & Chemistry PYQs for deep revision.'
                  : exam === 'NEET'
                  ? 'When calibrating for NEET UG at Medium/Easy tier, the algorithmic engine isolates questions strictly from authenticated NEET archives. Cross-stream JEE items are strictly segregated.'
                  : 'JEE Main mode isolates questions exclusively from verified JEE archives.'}
              </p>
            </div>
          </div>
        </div>

        {/* PANEL 02: Subject & Syllabus Scope */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-6 relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="w-7 h-5 rounded-md bg-black text-white text-[11px] font-mono font-bold flex items-center justify-center mb-2">
                02
              </div>
              <h2 className="font-editorial-serif text-lg sm:text-xl font-bold text-slate-950 tracking-tight">
                Subject & Syllabus Scope
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Select target domain disciplines and chapter-level curriculum boundary.
              </p>
            </div>
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Domain Subjects Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Domain Subjects
                </label>
                <button
                  type="button"
                  onClick={handleResetSubjects}
                  className="text-[11px] font-semibold text-slate-600 hover:text-black underline transition"
                >
                  Reset All
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-xl">
                {allSubjects.map((subj) => {
                  const isSelected = selectedSubjects.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => toggleSubject(subj)}
                      className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? 'bg-white text-slate-950 border-slate-200 shadow-2xs'
                          : 'bg-transparent text-slate-400 border-transparent hover:text-slate-700'
                      }`}
                    >
                      <span>{subj}</span>
                      {isSelected ? (
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-800" />
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">+</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-slate-400 block font-normal">
                Item distribution evenly weighted across {selectedSubjects.length} active domain{selectedSubjects.length > 1 ? 's' : ''}.
              </span>
            </div>

            {/* Syllabus Coverage */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Syllabus Coverage
              </label>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleModeChange('full_syllabus')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'full_syllabus'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Syllabus
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('multi_chapter')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'multi_chapter'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Multi-Chapter
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('chapterwise')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'chapterwise'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chapterwise
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Entire 11th & 12th Unified Curriculum ({availableChapters.length} Chapters)</span>
                <span className="font-mono font-medium text-slate-700">Class XI + XII</span>
              </div>
            </div>
          </div>

          {/* Chapter Selection Grid if Multi-Chapter or Chapterwise */}
          {mode !== 'full_syllabus' && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Select Curriculum Chapters ({selectedChapters.length} selected):
                </span>
                <span className="text-[11px] text-slate-400">
                  {displayedChapters.length} chapters available in active subjects
                </span>
              </div>

              {loadingChapters ? (
                <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading chapter catalog...</span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto p-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border border-slate-200 rounded-xl bg-slate-50/50 p-3">
                  {displayedChapters.map((c) => {
                    const isSelected = selectedChapters.includes(c.chapter_slug);
                    return (
                      <button
                        key={`${c.subject}-${c.chapter_slug}`}
                        type="button"
                        onClick={() => toggleChapterSelection(c.chapter_slug)}
                        className={`text-left p-2.5 rounded-lg text-xs font-medium transition border flex items-center justify-between ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-xs font-bold'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="block truncate">{c.display_name || c.chapter_name}</span>
                          <span
                            className={`text-[10px] block ${
                              isSelected ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {c.subject} · {c.count} items
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL 03: Exam Parameters & Timing */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-6 relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="w-7 h-5 rounded-md bg-black text-white text-[11px] font-mono font-bold flex items-center justify-center mb-2">
                03
              </div>
              <h2 className="font-editorial-serif text-lg sm:text-xl font-bold text-slate-950 tracking-tight">
                Exam Parameters & Timing
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Tune session duration, question quota, and pacing index.
              </p>
            </div>
            <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Number of Questions */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Question Volume Quota
              </label>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 mb-2">
                {[20, 45, 90, 180].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleCountPreset(count, count === 180 ? 200 : Math.round(count * 1.5))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      questionCount === count
                        ? 'bg-black text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {count} Qs
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden font-mono"
                />
                <span className="text-xs text-slate-400">Questions</span>
              </div>
            </div>

            {/* Duration (Minutes) */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Duration & Pacing Limit
              </label>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 mb-2">
                {[30, 45, 90, 200].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                      durationMinutes === mins
                        ? 'bg-black text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Custom:</span>
                <input
                  type="number"
                  min={5}
                  max={360}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden font-mono"
                />
                <span className="text-xs text-slate-400">Minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <button
            type="button"
            onClick={onNavigateToLibrary}
            className="text-xs font-semibold text-slate-500 hover:text-slate-950 underline transition order-2 sm:order-1"
          >
            Review question archives in Question Bank →
          </button>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-8 py-3.5 bg-black hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition order-1 sm:order-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Assembling CBT Exam Rig...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Computer-Based Test (CBT)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
