'use client';

import React from 'react';
import GagaSidebar from '@/components/gaga-sidebar';
import GagaAuthGate from '@/components/gaga-auth-gate';
import AutoRetouchLauncher from '@/components/apps/AutoRetouchLauncher';
import { Sparkles } from 'lucide-react';

export default function AutoRetouchPage() {
  return (
    <GagaAuthGate>
      <div className="flex h-screen bg-[#07080a] text-white overflow-hidden font-sans selection:bg-lime-400 selection:text-black">
        <GagaSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Top Bar Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c0d12]/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-lime-500/10 border border-lime-500/25 flex items-center justify-center text-lime-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wide">
                  Auto Retouch Studio
                </h1>
                <p className="text-[11px] text-gray-400">
                  International e-commerce studio standard pure white background & reflection polish
                </p>
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <AutoRetouchLauncher />
          </main>
        </div>
      </div>
    </GagaAuthGate>
  );
}
