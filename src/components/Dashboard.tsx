/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  fetchDashboardStats,
  generateCbtTestSession,
  getSavedTestHistory
} from '../services/questionBankService';
import { CbtTestSession, Subject } from '../types';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileQuestion,
  GraduationCap,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';

interface DashboardProps {
  onNavigateToLibrary: () => void;
  onNavigateToCreateTest: () => void;
  onStartExam: (session: CbtTestSession) => void;
  onViewPastResult: (session: CbtTestSession) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToLibrary,
  onNavigateToCreateTest,
  onStartExam,
  onViewPastResult
}) => {
  const [stats, setStats] = useState<{
    totalQuestions: number;
    neetQuestions: number;
    jeeMainQuestions: number;
    totalChapters: number;
    questionsBySubject: Record<string, number>;
  }>({
    totalQuestions: 0,
    neetQuestions: 0,
    jeeMainQuestions: 0,
    totalChapters: 0,
    questionsBySubject: {}
  });

  const [pastTests, setPastTests] = useState<CbtTestSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [quickLaunchLoading, setQuickLaunchLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const data = await fetchDashboardStats();
        setStats(data);
        const history = getSavedTestHistory();
        setPastTests(history);
      } catch (err) {
        console.warn('Dashboard stats error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Quick launch helper
  const handleQuickLaunch = async (
    title: string,
    exam: 'NEET' | 'JEE Main',
    subject: Subject | 'All',
    difficulty: 'Easy' | 'Medium' | 'Hard',
    questionCount: number,
    durationMinutes: number
  ) => {
    setQuickLaunchLoading(title);
    try {
      const session = await generateCbtTestSession({
        title,
        exam,
        subject,
        selectedChapters: [],
        difficulty,
        questionCount,
        durationMinutes,
        mode: 'full_syllabus'
      });
      onStartExam(session);
    } catch (err: any) {
      alert(err.message || 'Could not assemble quick test.');
    } finally {
      setQuickLaunchLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans space-y-8">
      {/* 1. Hero / Overview Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Unified Question Bank Architecture</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              NEET & JEE Main CBT Examination Platform
            </h1>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-normal">
              Practice computer-based mock examinations powered by the canonical Supabase question bank.
              Enforces strict difficulty segregation, dynamic chapter mapping, and comprehensive CBT question palettes.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
            <button
              onClick={onNavigateToCreateTest}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center space-x-2"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Configure New Test</span>
            </button>
            <button
              onClick={onNavigateToLibrary}
              className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Explore Question Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Questions in Bank */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Question Bank Total
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl md:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {loading ? '...' : stats.totalQuestions.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">Qs</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            public.question_bank
          </span>
        </div>

        {/* NEET Questions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            NEET Repository
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl md:text-3xl font-black text-emerald-600 font-mono tabular-nums">
              {loading ? '...' : stats.neetQuestions.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">NEET</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Physics, Chem, Botany, Zoo
          </span>
        </div>

        {/* JEE Main Questions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            JEE Main Repository
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl md:text-3xl font-black text-blue-600 font-mono tabular-nums">
              {loading ? '...' : stats.jeeMainQuestions.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">JEE</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Enters NEET Hard Pool
          </span>
        </div>

        {/* Total Chapters Covered */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Chapters Mapped
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl md:text-3xl font-black text-purple-600 font-mono tabular-nums">
              {loading ? '...' : stats.totalChapters.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">Chapters</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Dynamic database tags
          </span>
        </div>
      </div>

      {/* 3. Quick Launch Test Presets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Quick Launch Examinations</h2>
            <p className="text-xs text-slate-500">
              One-click standard exam presets matching official testing patterns.
            </p>
          </div>
          <button
            onClick={onNavigateToCreateTest}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
          >
            Custom Generator →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Preset 1: Full NEET UG Mock */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                NEET Medium Standard
              </span>
              <h3 className="text-sm font-bold text-slate-900">NEET Standard Practice</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Balanced 20-question test drawn exclusively from NEET medium questions across all subjects.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <FileQuestion className="w-3.5 h-3.5" />
                  <span>20 Questions</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>30 Mins</span>
                </span>
              </div>

              <button
                onClick={() =>
                  handleQuickLaunch(
                    'NEET Standard Practice (20 Qs)',
                    'NEET',
                    'All',
                    'Medium',
                    20,
                    30
                  )
                }
                disabled={quickLaunchLoading === 'NEET Standard Practice (20 Qs)'}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                {quickLaunchLoading === 'NEET Standard Practice (20 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 2: NEET Hard + JEE Main */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block">
                NEET + JEE Hard Pool
              </span>
              <h3 className="text-sm font-bold text-slate-900">High-Yield Hard Challenge</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                NEET Hard questions combined with JEE Main Physics & Chemistry for rigorous revision.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <FileQuestion className="w-3.5 h-3.5" />
                  <span>25 Questions</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>45 Mins</span>
                </span>
              </div>

              <button
                onClick={() =>
                  handleQuickLaunch(
                    'High-Yield Hard Challenge (25 Qs)',
                    'NEET',
                    'All',
                    'Hard',
                    25,
                    45
                  )
                }
                disabled={quickLaunchLoading === 'High-Yield Hard Challenge (25 Qs)'}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                {quickLaunchLoading === 'High-Yield Hard Challenge (25 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 3: Physics Focus */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block">
                Physics Sprint
              </span>
              <h3 className="text-sm font-bold text-slate-900">Physics Mechanics & Optics</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Dedicated 15-question Physics session covering mechanics, kinematics, and modern physics.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <FileQuestion className="w-3.5 h-3.5" />
                  <span>15 Questions</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>25 Mins</span>
                </span>
              </div>

              <button
                onClick={() =>
                  handleQuickLaunch(
                    'Physics Sprint (15 Qs)',
                    'NEET',
                    'Physics',
                    'Medium',
                    15,
                    25
                  )
                }
                disabled={quickLaunchLoading === 'Physics Sprint (15 Qs)'}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                {quickLaunchLoading === 'Physics Sprint (15 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 4: Biology Mastery */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded inline-block">
                Biology Focus
              </span>
              <h3 className="text-sm font-bold text-slate-900">Botany & Zoology Sprint</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Fast-paced biology practice covering genetics, ecology, physiology, and cytology.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <FileQuestion className="w-3.5 h-3.5" />
                  <span>30 Questions</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>30 Mins</span>
                </span>
              </div>

              <button
                onClick={() =>
                  handleQuickLaunch(
                    'Biology Rapid Sprint (30 Qs)',
                    'NEET',
                    'Botany',
                    'Medium',
                    30,
                    30
                  )
                }
                disabled={quickLaunchLoading === 'Biology Rapid Sprint (30 Qs)'}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                {quickLaunchLoading === 'Biology Rapid Sprint (30 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent Test Activity / History */}
      {pastTests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Completed Tests ({pastTests.length})</h2>
            <span className="text-xs text-slate-400 font-medium">Stored locally</span>
          </div>

          <div className="divide-y divide-slate-100">
            {pastTests.slice(0, 5).map((test) => {
              const res = test.result;
              return (
                <div
                  key={test.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block text-xs">{test.title}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{new Date(test.completedAt || test.startedAt).toLocaleDateString()}</span>
                      <span aria-hidden="true">·</span>
                      <span>{test.questions.length} Questions</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{test.difficulty}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 self-end sm:self-center">
                    {res && (
                      <div className="text-right">
                        <span className="font-bold text-slate-900 font-mono tabular-nums block">
                          Score: {res.totalScore} / {res.maxScore}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold block">
                          {res.accuracy}% Accuracy
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => onViewPastResult(test)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition"
                    >
                      View Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
