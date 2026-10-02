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
  CheckCircle2,
  Clock,
  Compass,
  FileQuestion,
  GraduationCap,
  Layers,
  Loader2,
  Play,
  Sliders,
  Sparkles
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
  const [subject, setSubject] = useState<Subject | 'All'>('All');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [mode, setMode] = useState<'chapterwise' | 'multi_chapter' | 'full_syllabus'>('full_syllabus');

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

  // Filter chapters by current selected subject
  const displayedChapters = availableChapters.filter((c) => {
    if (subject === 'All') return true;
    if (subject.toLowerCase() === 'biology') {
      return (
        c.subject.toLowerCase() === 'biology' ||
        c.subject.toLowerCase() === 'botany' ||
        c.subject.toLowerCase() === 'zoology' ||
        c.chapter_slug === 'biomolecules-b'
      );
    }
    if (subject.toLowerCase() === 'chemistry') {
      return c.subject.toLowerCase() === 'chemistry' && c.chapter_slug !== 'biomolecules-b';
    }
    return c.subject.toLowerCase() === subject.toLowerCase();
  });

  // When mode changes to full_syllabus, clear specific chapter selections
  const handleModeChange = (newMode: 'chapterwise' | 'multi_chapter' | 'full_syllabus') => {
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

  // Adjust question count and time presets
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
      setError('Please select at least one chapter for this test.');
      setIsGenerating(false);
      return;
    }

    try {
      const config: CbtTestConfig = {
        title: `${exam} CBT Exam (${difficulty} · ${questionCount} Questions)`,
        exam,
        subject,
        selectedChapters: mode === 'full_syllabus' ? [] : selectedChapters,
        difficulty,
        questionCount,
        durationMinutes,
        mode
      };

      const session = await generateCbtTestSession(config);
      onStartExam(session);
    } catch (err: any) {
      setError(err.message || 'Failed to assemble test session from database.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 font-sans">
      {/* Title */}
      <div className="pb-4 mb-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create CBT Mock Test</h1>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          Configure a computer-based examination with strict question difficulty segregation.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2 mb-6">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Test Assembly Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateAndStart} className="space-y-6">
        {/* Step 1: Target Exam & Difficulty */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            01. Exam Target & Difficulty Segregation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Exam Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Target Exam</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'NEET' as const, label: 'NEET' },
                  { id: 'JEE Main' as const, label: 'JEE Main' }
                ].map((item) => {
                  const isActive = exam === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExam(item.id)}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                        isActive
                          ? 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-600/30'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Easy', 'Medium', 'Hard'] as const).map((lvl) => {
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                        difficulty === lvl
                          ? lvl === 'Easy'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-500/30'
                            : lvl === 'Medium'
                            ? 'bg-amber-50 border-amber-600 text-amber-900 ring-1 ring-amber-500/30'
                            : 'bg-red-50 border-red-600 text-red-900 ring-1 ring-red-500/30'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Difficulty Rules Explainer Banner */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              {exam === 'NEET' && difficulty === 'Easy' && (
                <span>
                  <strong>NEET Easy Rule:</strong> Tests strictly drawn from NEET questions classified as Easy. No JEE Main questions will be included.
                </span>
              )}
              {exam === 'NEET' && difficulty === 'Medium' && (
                <span>
                  <strong>NEET Medium Rule:</strong> Tests strictly drawn from NEET questions classified as Medium. JEE Main questions are kept segregated.
                </span>
              )}
              {exam === 'NEET' && difficulty === 'Hard' && (
                <span>
                  <strong>NEET Hard Rule:</strong> Tests drawn from NEET Hard questions <em>plus</em> JEE Main Physics and Chemistry questions to provide the deepest conceptual challenge.
                </span>
              )}
              {exam === 'JEE Main' && (
                <span>
                  <strong>JEE Main Standard:</strong> Tests drawn exclusively from canonical JEE Main questions for the selected subject and difficulty.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Subject & Syllabus Scope */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            02. Subject & Chapter Scope
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Subject</label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value as any);
                  setSelectedChapters([]);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:bg-white"
              >
                <option value="All">All Subjects (Four-Subject Standard)</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Botany">Botany</option>
                <option value="Zoology">Zoology</option>
              </select>
            </div>

            {/* Test Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Syllabus Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'full_syllabus', label: 'Full Syllabus' },
                  { id: 'multi_chapter', label: 'Multi Chapter' },
                  { id: 'chapterwise', label: 'Chapterwise' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeChange(m.id as any)}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                      mode === m.id
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Chapter Multi-select List (if not full syllabus) */}
          {mode !== 'full_syllabus' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">
                  Select {mode === 'chapterwise' ? 'Single Chapter' : 'Chapters'} ({selectedChapters.length} chosen)
                </label>
                {selectedChapters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedChapters([])}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {loadingChapters ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-slate-500" />
                  Loading chapters from database...
                </div>
              ) : displayedChapters.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  No chapters registered in question bank yet.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50">
                  {displayedChapters.map((c) => {
                    const isSelected = selectedChapters.includes(c.chapter_slug);
                    return (
                      <button
                        key={`${c.subject}-${c.chapter_slug}`}
                        type="button"
                        onClick={() => toggleChapterSelection(c.chapter_slug)}
                        className={`p-2 rounded text-left text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span className="truncate pr-2">{c.display_name || c.chapter_name}</span>
                        <span className={`text-[10px] tabular-nums ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {c.count} Qs
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Question Volume & Duration */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            03. Exam Volume & Duration Presets
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Number of Questions
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[10, 20, 45, 90].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleCountPreset(count, Math.round(count * 1.5))}
                    className={`py-1.5 text-xs font-semibold rounded border transition ${
                      questionCount === count
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {count} Qs
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={200}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Duration (Minutes)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[15, 30, 60, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-1.5 text-xs font-semibold rounded border transition ${
                      durationMinutes === mins
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={5}
                max={360}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-800 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit & Start Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={onNavigateToLibrary}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline order-2 sm:order-1"
          >
            Review questions in library first
          </button>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition order-1 sm:order-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Assembling CBT Exam...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Computer-Based Test (CBT)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
