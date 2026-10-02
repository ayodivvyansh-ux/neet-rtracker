/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Layers,
  Menu,
  Play,
  Sliders,
  X
} from 'lucide-react';

export type MainNavView = 'dashboard' | 'library' | 'create_test';

interface NavbarProps {
  currentView: MainNavView;
  onNavigate: (view: MainNavView) => void;
  onQuickStartTest?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onQuickStartTest
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const navItems: { id: MainNavView; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'library', label: 'Question Library' },
    { id: 'create_test', label: 'Create Test' }
  ];

  const handleNavClick = (view: MainNavView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Zone 1: Single text element wordmark */}
          <div
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center space-x-2.5 cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
              NEET / JEE CBT Platform
            </span>
          </div>

          {/* Zone 2: Clean text navigation links */}
          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`transition-colors whitespace-nowrap py-1 relative ${
                    isActive
                      ? 'text-slate-900 font-bold border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1-2 primary actions */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => handleNavClick('create_test')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Launch Test</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left py-2 px-3 rounded-md font-semibold transition ${
                currentView === item.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => handleNavClick('create_test')}
              className="w-full py-2 bg-blue-600 text-white rounded-md font-bold text-center flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Launch Test</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
