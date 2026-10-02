/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  fetchDistinctChapters,
  fetchDistinctExams,
  fetchDistinctYears,
  fetchQuestionBankList
} from '../services/questionBankService';
import { QuestionBankFilterParams, QuestionBankRecord } from '../types';
import { MathRenderer } from './MathRenderer';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';

interface QuestionLibraryProps {
  onSelectQuestion: (question: QuestionBankRecord) => void;
}

export const QuestionLibrary: React.FC<QuestionLibraryProps> = ({ onSelectQuestion }) => {
  // Questions and pagination state
  const [questions, setQuestions] = useState<QuestionBankRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic filter option lists from Supabase
  const [examOptions, setExamOptions] = useState<string[]>(['NEET', 'JEE Main']);
  const [chapterOptions, setChapterOptions] = useState<{ chapter_slug: string; chapter_name: string; subject: string }[]>([]);
  const [yearOptions, setYearOptions] = useState<number[]>([]);

  // Selected filter states
  const [selectedExam, setSelectedExam] = useState<string>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedChapter, setSelectedChapter] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Debounce search query input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load dynamic filter values on initial mount
  useEffect(() => {
    async function loadDynamicFilters() {
      try {
        const [exams, chapters, years] = await Promise.all([
          fetchDistinctExams(),
          fetchDistinctChapters(),
          fetchDistinctYears()
        ]);
        if (exams.length > 0) setExamOptions(exams);
        setChapterOptions(chapters);
        setYearOptions(years);
      } catch (err) {
        console.warn('Could not load dynamic filters:', err);
      }
    }
    loadDynamicFilters();
  }, []);

  // Filter chapters whenever Subject changes
  const filteredChapters = chapterOptions.filter((c) => {
    if (selectedSubject === 'All') return true;
    return c.subject.toLowerCase() === selectedSubject.toLowerCase();
  });

  // Query Supabase whenever filters or pagination changes
  useEffect(() => {
    let isCancelled = false;

    async function loadQuestions() {
      setLoading(true);
      setError(null);
      try {
        const params: QuestionBankFilterParams = {
          exam_source: selectedExam,
          subject: selectedSubject,
          chapter_slug: selectedChapter !== 'All' ? selectedChapter : undefined,
          year: selectedYear !== 'All' ? selectedYear : undefined,
          difficulty: selectedDifficulty !== 'All' ? (selectedDifficulty as any) : undefined,
          search: debouncedSearch.trim() || undefined,
          page,
          pageSize
        };

        const res = await fetchQuestionBankList(params);
        if (!isCancelled) {
          setQuestions(res.questions);
          setTotalCount(res.totalCount);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load questions from database.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadQuestions();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedExam,
    selectedSubject,
    selectedChapter,
    selectedYear,
    selectedDifficulty,
    debouncedSearch,
    page,
    pageSize
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resetFilters = () => {
    setSelectedExam('All');
    setSelectedSubject('All');
    setSelectedChapter('All');
    setSelectedYear('All');
    setSelectedDifficulty('All');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasActiveFilters =
    selectedExam !== 'All' ||
    selectedSubject !== 'All' ||
    selectedChapter !== 'All' ||
    selectedYear !== 'All' ||
    selectedDifficulty !== 'All' ||
    debouncedSearch.trim() !== '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Question Library</h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Search, filter, and inspect canonical exam questions directly from the unified database.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-500">
            Total Available:{' '}
            <strong className="text-slate-800 font-semibold font-mono tabular-nums">
              {totalCount.toLocaleString()}
            </strong>{' '}
            questions
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 bg-white hover:bg-slate-50 transition"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Matrix Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by question code (e.g. NEET-PHY-GRAV-2025-001) or statement text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-400 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Multi-Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Exam Source Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Exam Source</label>
            <select
              value={selectedExam}
              onChange={(e) => {
                setSelectedExam(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-hidden focus:bg-white"
            >
              <option value="All">All Exams</option>
              {examOptions.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapter('All');
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-hidden focus:bg-white"
            >
              <option value="All">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Botany">Botany</option>
              <option value="Zoology">Zoology</option>
            </select>
          </div>

          {/* Dynamic Chapter Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Chapter {filteredChapters.length > 0 && `(${filteredChapters.length})`}
            </label>
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-hidden focus:bg-white truncate"
            >
              <option value="All">All Chapters</option>
              {filteredChapters.map((c) => (
                <option key={c.chapter_slug} value={c.chapter_slug}>
                  {c.chapter_name}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Year Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-hidden focus:bg-white"
            >
              <option value="All">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Difficulty</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-hidden focus:bg-white"
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2 mb-6">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Questions Ledger / Results View */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-500" />
          <p className="text-xs font-medium">Fetching question records from database...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Questions Match Current Criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {totalCount === 0
              ? 'The question bank table is currently waiting for records to be imported or seeded.'
              : 'Try clearing some search terms or adjusting the exam and difficulty filters above.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition"
            >
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const hasVisual = Array.isArray(q.images)
              ? q.images.length > 0
              : Boolean(q.images);

            return (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q)}
                className="group bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Code, Metadata, and Text Preview */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50/70 border border-blue-200 px-2 py-0.5 rounded">
                      {q.question_code || q.id}
                    </span>

                    <span className="text-xs font-semibold text-slate-700">
                      {q.exam_source || 'NEET'}
                    </span>

                    <span className="text-xs text-slate-400">·</span>

                    <span className="text-xs font-medium text-slate-600">{q.subject}</span>

                    <span className="text-xs text-slate-400">·</span>

                    <span className="text-xs text-slate-500 truncate max-w-xs">
                      {q.chapter_name || q.chapter_slug}
                    </span>

                    {q.year && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">Year {q.year}</span>
                      </>
                    )}

                    {q.paper_slug && (
                      <>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {q.paper_slug}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Question Text preview with KaTeX */}
                  <div className="text-xs text-slate-800 line-clamp-2 leading-relaxed pt-1 font-normal">
                    <MathRenderer
                      text={q.question_text}
                      html={q.question_html}
                      images={q.images}
                      questionCode={q.question_code}
                    />
                  </div>
                </div>

                {/* Right: Badges, Visual indicator & Click affordance */}
                <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                  {hasVisual && (
                    <span
                      className="inline-flex items-center space-x-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded"
                      title="Contains diagram or visual asset"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Diagram</span>
                    </span>
                  )}

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      q.difficulty === 'Easy'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : q.difficulty === 'Hard'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  <span className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && !loading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-800">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-800">
              {Math.min(page * pageSize, totalCount)}
            </span>{' '}
            of <span className="font-semibold text-slate-800">{totalCount.toLocaleString()}</span>{' '}
            records
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="ml-2 p-1.5 bg-white border border-slate-200 rounded text-slate-700 font-medium focus:outline-hidden"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
