/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  Hexagon,
  Layers,
  Menu,
  Play,
  Settings,
  Sliders,
  User,
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
    { id: 'library', label: 'Question Bank' },
    { id: 'create_test', label: 'Mock Studio' }
  ];

  const handleNavClick = (view: MainNavView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Left: Brand + Breadcrumb + Engine Tag */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Minimal Brand Logo */}
            <div
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center space-x-2 cursor-pointer shrink-0"
            >
              <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs shadow-xs">
                <Hexagon className="w-4 h-4 fill-white text-black" />
              </div>
              <span className="text-sm font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
                APEX·CBT
              </span>
            </div>

            {/* Subtle Divider */}
            <div className="hidden sm:block h-4 w-px bg-slate-200" />

            {/* Breadcrumb Path */}
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
              <span className="hover:text-slate-800 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
                Tests
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-900 font-semibold">
                {currentView === 'create_test'
                  ? 'Create CBT Mock'
                  : currentView === 'library'
                  ? 'Question Bank'
                  : 'Overview'}
              </span>
            </div>

            {/* Adaptive Engine Badge */}
            <div className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
              NEET & JEE Adaptive Engine
            </div>
          </div>

          {/* Center/Right: Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <nav className="flex items-center space-x-6 text-xs font-semibold">
              {navItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`transition-colors whitespace-nowrap py-1 relative ${
                      isActive
                        ? 'text-slate-950 font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center space-x-2 pl-4 border-l border-slate-200">
              <button
                type="button"
                onClick={() => handleNavClick('create_test')}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Mock Studio Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>

              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1.5 text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left py-2.5 px-3 rounded-lg font-semibold transition ${
                currentView === item.id
                  ? 'bg-black text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
