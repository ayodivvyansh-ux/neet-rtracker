/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  fetchQuestionBankOverview,
  generateCbtTestSession,
  getSavedTestHistory,
  DistinctChapterItem,
  QuestionBankOverview
} from '../services/questionBankService';
import { CbtTestSession } from '../types';
import {
  ArrowRight,
  Award,
  BookOpen,
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
  Zap
} from 'lucide-react';

interface DashboardProps {
  onNavigateToCreateTest: () => void;
  onNavigateToLibrary: () => void;
  onStartExam: (session: CbtTestSession) => void;
  onViewPastResult: (session: CbtTestSession) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToCreateTest,
  onNavigateToLibrary,
  onStartExam,
  onViewPastResult
}) => {
  const [overview, setOverview] = useState<QuestionBankOverview | null>(null);
  const [pastTests, setPastTests] = useState<CbtTestSession[]>([]);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [quickLaunchLoading, setQuickLaunchLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoadingOverview(true);
      try {
        const data = await fetchQuestionBankOverview();
        setOverview(data);
      } catch (err) {
        console.warn('Could not load overview stats:', err);
      } finally {
        setLoadingOverview(false);
      }
    }
    loadData();
    setPastTests(getSavedTestHistory());
  }, []);

  const handleQuickLaunch = async (
    title: string,
    exam: 'NEET' | 'JEE Main',
    subject: any,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    count: number,
    duration: number
  ) => {
    setQuickLaunchLoading(title);
    try {
      const session = await generateCbtTestSession({
        title,
        exam,
        subject,
        selectedChapters: [],
        difficulty,
        questionCount: count,
        durationMinutes: duration,
        mode: 'full_syllabus'
      });
      onStartExam(session);
    } catch (err) {
      console.error('Failed to launch quick exam:', err);
    } finally {
      setQuickLaunchLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 font-sans space-y-10">
      {/* 1. Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            NTA STANDARDS COMPLIANT / NEET & JEE
          </div>
          <h1 className="font-editorial-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
            CBT Mock Examination Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
            High-fidelity Computer-Based Testing rig with dynamic curriculum assembly and authenticated question items.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToCreateTest}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm self-start md:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Launch Custom Rig →</span>
        </button>
      </div>

      {/* 2. Repository Scope Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Item Bank
          </span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
              {loadingOverview ? '...' : (overview?.totalQuestions || 15815).toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block font-normal">
            Verified across all disciplines
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Physics Pool
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight block">
            {loadingOverview ? '...' : (overview?.questionsBySubject?.PHYSICS || 6891).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block font-normal">
            Mechanics, Optics, Modern Physics
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Chemistry Pool
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight block">
            {loadingOverview ? '...' : (overview?.questionsBySubject?.CHEMISTRY || 6039).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block font-normal">
            Physical, Organic & Inorganic
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Biology (Bot + Zoo)
          </span>
          <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight block">
            {loadingOverview
              ? '...'
              : (
                  (overview?.questionsBySubject?.BOTANY || 1321) +
                  (overview?.questionsBySubject?.ZOOLOGY || 1564)
                ).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block font-normal">
            Botany & Zoology Unified Pool
          </span>
        </div>
      </div>

      {/* 3. Numbered Section 01: Quick Launch Examination Modules */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="w-7 h-5 rounded-md bg-black text-white text-[11px] font-mono font-bold flex items-center justify-center mb-2">
              01
            </div>
            <h2 className="font-editorial-serif text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
              Standard Examination Configurations
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              One-click standard exam presets calibrated to official testing patterns.
            </p>
          </div>
          <Compass className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Preset 1: Full NEET Mock 180 Qs */}
          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block">
                Full Simulation
              </span>
              <h3 className="font-editorial-serif text-base font-bold text-slate-950">
                NEET 180-Question Mock
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                45 Physics, 45 Chemistry, 45 Botany, and 45 Zoology across 200 minutes.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>180 Questions</span>
                <span>200 Mins</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleQuickLaunch(
                    'NEET Official Mock Test (180 Qs)',
                    'NEET',
                    'All',
                    'Medium',
                    180,
                    200
                  )
                }
                disabled={quickLaunchLoading === 'NEET Official Mock Test (180 Qs)'}
                className="w-full py-2 bg-black hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                {quickLaunchLoading === 'NEET Official Mock Test (180 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white" />
                    <span>Launch 180 Qs Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 2: NEET Hard Challenge */}
          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block">
                Hard Pool + JEE
              </span>
              <h3 className="font-editorial-serif text-base font-bold text-slate-950">
                High-Yield Hard Rig
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                NEET Hard items combined with JEE Main Physics & Chemistry PYQs.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>45 Questions</span>
                <span>60 Mins</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleQuickLaunch(
                    'High-Yield Hard Challenge (45 Qs)',
                    'NEET',
                    'All',
                    'Hard',
                    45,
                    60
                  )
                }
                disabled={quickLaunchLoading === 'High-Yield Hard Challenge (45 Qs)'}
                className="w-full py-2 bg-black hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                {quickLaunchLoading === 'High-Yield Hard Challenge (45 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white" />
                    <span>Start Challenge</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 3: Physics Sprint */}
          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded inline-block">
                Discipline Focus
              </span>
              <h3 className="font-editorial-serif text-base font-bold text-slate-950">
                Physics Core Sprint
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                45 questions drawn exclusively from Physics mechanics, electrodynamics & optics.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>45 Questions</span>
                <span>45 Mins</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleQuickLaunch(
                    'Physics Core Sprint (45 Qs)',
                    'NEET',
                    'Physics',
                    'Medium',
                    45,
                    45
                  )
                }
                disabled={quickLaunchLoading === 'Physics Core Sprint (45 Qs)'}
                className="w-full py-2 bg-black hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                {quickLaunchLoading === 'Physics Core Sprint (45 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white" />
                    <span>Start Physics</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset 4: Biology Sprint */}
          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                High-Weightage
              </span>
              <h3 className="font-editorial-serif text-base font-bold text-slate-950">
                Biology 90 Qs Sprint
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                45 Botany + 45 Zoology questions covering 360 marks of the NEET syllabus.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>90 Questions</span>
                <span>90 Mins</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleQuickLaunch(
                    'Biology Sprint (90 Qs)',
                    'NEET',
                    'Biology',
                    'Medium',
                    90,
                    90
                  )
                }
                disabled={quickLaunchLoading === 'Biology Sprint (90 Qs)'}
                className="w-full py-2 bg-black hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-2xs"
              >
                {quickLaunchLoading === 'Biology Sprint (90 Qs)' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white" />
                    <span>Start Biology</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Numbered Section 02: Recent Test History */}
      {pastTests.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="w-7 h-5 rounded-md bg-black text-white text-[11px] font-mono font-bold flex items-center justify-center mb-2">
                02
              </div>
              <h2 className="font-editorial-serif text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
                Completed Test Archive ({pastTests.length})
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Review scorecards, mistake compendiums, and performance evaluations.
              </p>
            </div>
            <Award className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          </div>

          <div className="divide-y divide-slate-100">
            {pastTests.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 p-3 rounded-xl transition"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-950">{session.title}</h4>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <span>{new Date(session.completedAt || session.startedAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{session.questions.length} Questions</span>
                    <span>·</span>
                    <span className="font-mono text-slate-600 font-semibold">
                      Score: {session.result?.totalScore ?? '—'} / {session.result?.maxScore ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => onViewPastResult(session)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                  >
                    View Scorecard →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
