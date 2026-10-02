/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CBTExamInterface } from './components/CBTExamInterface';
import { CreateTest } from './components/CreateTest';
import { Dashboard } from './components/Dashboard';
import { MainNavView, Navbar } from './components/Navbar';
import { QuestionDetails } from './components/QuestionDetails';
import { QuestionLibrary } from './components/QuestionLibrary';
import { TestResults } from './components/TestResults';
import {
  generateCbtTestSession,
  submitAndScoreCbtTest
} from './services/questionBankService';
import {
  CbtTestConfig,
  CbtTestResult,
  CbtTestSession,
  QuestionBankRecord,
  QuestionCBTStatus
} from './types';

export default function App() {
  // Navigation view state
  const [currentView, setCurrentView] = useState<MainNavView>('dashboard');

  // Currently inspected question for Question Details screen
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionBankRecord | null>(null);

  // Active examination state
  const [activeTestSession, setActiveTestSession] = useState<CbtTestSession | null>(null);

  // Results & scorecard state
  const [activeTestResult, setActiveTestResult] = useState<{
    session: CbtTestSession;
    result: CbtTestResult;
  } | null>(null);

  // Start CBT Examination
  const handleStartExam = (session: CbtTestSession) => {
    setActiveTestResult(null);
    setSelectedQuestion(null);
    setActiveTestSession(session);
  };

  // Submit and Score CBT Exam
  const handleSubmitExam = async (
    userResponses: Record<string, string | null>,
    timeSpentPerQuestion: Record<string, number>,
    questionStatuses: Record<string, QuestionCBTStatus>
  ) => {
    if (!activeTestSession) return;

    try {
      const result = await submitAndScoreCbtTest(
        activeTestSession,
        userResponses,
        timeSpentPerQuestion,
        questionStatuses
      );

      const completedSession: CbtTestSession = {
        ...activeTestSession,
        completedAt: Date.now(),
        isSubmitted: true,
        userResponses,
        timeSpentPerQuestion,
        questionStatuses,
        result
      };

      setActiveTestResult({
        session: completedSession,
        result
      });
      setActiveTestSession(null);
    } catch (err: any) {
      alert(err.message || 'Error evaluating test submission.');
    }
  };

  // Exit Exam without saving
  const handleExitWithoutSaving = () => {
    if (confirm('Are you sure you want to exit the examination? Your active progress will not be saved.')) {
      setActiveTestSession(null);
      setCurrentView('dashboard');
    }
  };

  // Retake full exam
  const handleRetakeFullTest = async () => {
    if (!activeTestResult) return;
    const oldSession = activeTestResult.session;
    try {
      const newSession = await generateCbtTestSession({
        title: `Repeated: ${oldSession.title}`,
        exam: oldSession.exam as any,
        subject: oldSession.subject as any,
        selectedChapters: [],
        difficulty: oldSession.difficulty as any,
        questionCount: oldSession.questions.length,
        durationMinutes: oldSession.durationMinutes,
        mode: oldSession.mode as any
      });
      handleStartExam(newSession);
    } catch (err: any) {
      alert(err.message || 'Failed to generate repeat test.');
    }
  };

  // Retake incorrect questions only
  const handleRetakeIncorrectOnly = (wrongQuestionIds: string[]) => {
    if (!activeTestResult || wrongQuestionIds.length === 0) return;
    const oldSession = activeTestResult.session;
    const filteredQuestions = oldSession.questions.filter((q) => wrongQuestionIds.includes(q.id));

    if (filteredQuestions.length === 0) return;

    const initialResponses: Record<string, string | null> = {};
    const initialStatuses: Record<string, QuestionCBTStatus> = {};
    const initialTime: Record<string, number> = {};

    filteredQuestions.forEach((q, idx) => {
      initialResponses[q.id] = null;
      initialStatuses[q.id] = idx === 0 ? 'NOT_ANSWERED' : 'NOT_VISITED';
      initialTime[q.id] = 0;
    });

    const revisionSession: CbtTestSession = {
      id: `test_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: `Mistakes Revision (${filteredQuestions.length} Questions)`,
      exam: oldSession.exam,
      subject: oldSession.subject,
      difficulty: oldSession.difficulty,
      mode: 'revision',
      questions: filteredQuestions,
      durationMinutes: Math.max(5, filteredQuestions.length * 2),
      startedAt: Date.now(),
      userResponses: initialResponses,
      questionStatuses: initialStatuses,
      timeSpentPerQuestion: initialTime,
      isSubmitted: false
    };

    handleStartExam(revisionSession);
  };

  // 1. SCREEN: Active CBT Exam (Full Viewport NTA Simulator)
  if (activeTestSession) {
    return (
      <CBTExamInterface
        testSession={activeTestSession}
        onSubmitExam={handleSubmitExam}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
    );
  }

  // 2. SCREEN: Test Result & Detailed Question Review
  if (activeTestResult) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <Navbar
          currentView={currentView}
          onNavigate={(view) => {
            setActiveTestResult(null);
            setCurrentView(view);
          }}
        />
        <main className="flex-1 py-6">
          <TestResults
            session={activeTestResult.session}
            result={activeTestResult.result}
            onRetakeFullTest={handleRetakeFullTest}
            onRetakeIncorrectOnly={handleRetakeIncorrectOnly}
            onBackToDashboard={() => {
              setActiveTestResult(null);
              setCurrentView('dashboard');
            }}
            onNavigateToCreateTest={() => {
              setActiveTestResult(null);
              setCurrentView('create_test');
            }}
          />
        </main>
      </div>
    );
  }

  // 3. SCREEN: Question Details
  if (selectedQuestion) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <Navbar
          currentView="library"
          onNavigate={(view) => {
            setSelectedQuestion(null);
            setCurrentView(view);
          }}
        />
        <main className="flex-1 py-6">
          <QuestionDetails
            question={selectedQuestion}
            onBack={() => setSelectedQuestion(null)}
          />
        </main>
      </div>
    );
  }

  // 4. Default Application Views with Navbar
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onQuickStartTest={() => setCurrentView('create_test')}
      />

      <main className="flex-1 py-6">
        {currentView === 'dashboard' && (
          <Dashboard
            onNavigateToLibrary={() => setCurrentView('library')}
            onNavigateToCreateTest={() => setCurrentView('create_test')}
            onStartExam={handleStartExam}
            onViewPastResult={(pastSession) => {
              if (pastSession.result) {
                setActiveTestResult({
                  session: pastSession,
                  result: pastSession.result
                });
              }
            }}
          />
        )}

        {currentView === 'library' && (
          <QuestionLibrary
            onSelectQuestion={(q) => setSelectedQuestion(q)}
          />
        )}

        {currentView === 'create_test' && (
          <CreateTest
            onStartExam={handleStartExam}
            onNavigateToLibrary={() => setCurrentView('library')}
          />
        )}
      </main>
    </div>
  );
}
