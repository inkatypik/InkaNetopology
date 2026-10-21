import React from 'react';
import { Radar, Moon, Sun, RefreshCw, Terminal, Layers, Network, Table, Square } from 'lucide-react';

export type ActiveTab = 'topology' | 'hosts' | 'inventory' | 'logs' | 'docker';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isScanning: boolean;
  scanProgress?: number;
  onTriggerScan: () => void;
  onCancelScan?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onlineCount: number;
  totalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isScanning,
  scanProgress = 0,
  onTriggerScan,
  onCancelScan,
  isDark,
  onToggleTheme,
  onlineCount,
  totalCount
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <Radar className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              InkaNetopology
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap">
              {onlineCount}/{totalCount} connectés
            </span>
          </div>
        </div>

        {/* Zone 2: 4-5 single-line clean nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onSelectTab('topology')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'topology'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Topologie Réseau</span>
          </button>

          <button
            onClick={() => onSelectTab('hosts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'hosts'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hôtes & Dépendances</span>
          </button>

          <button
            onClick={() => onSelectTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'inventory'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Inventaire Équipements</span>
          </button>

          <button
            onClick={() => onSelectTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Journal Temps Réel</span>
          </button>

          <button
            onClick={() => onSelectTab('docker')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'docker'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <span>Documentation & Docker</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA + Theme toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleTheme}
            aria-label="Basculer thème"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {isScanning ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span className="font-mono">{scanProgress}%</span>
              </div>
              {onCancelScan && (
                <button
                  onClick={onCancelScan}
                  title="Interrompre immédiatement le scan en cours"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Arrêter le scan</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onTriggerScan}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-all duration-200 bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scanner le réseau</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
