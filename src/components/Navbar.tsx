import React from 'react';
import { Moon, Sun, Terminal, Layers, Network, Table, Settings, RefreshCw } from 'lucide-react';

export type ActiveTab = 'topology' | 'hosts' | 'inventory' | 'logs' | 'docker';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isScanning?: boolean;
  scanProgress?: number;
  onTriggerScan?: () => void;
  onCancelScan?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings?: () => void;
  onlineCount: number;
  totalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isScanning = false,
  scanProgress = 0,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onlineCount,
  totalCount
}) => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark Brand with PNG Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-cyan-500/40 bg-slate-900 shadow-sm flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="Logo InkaNetopology"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              InkaNetopology
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap hidden sm:inline">
              <span className="text-emerald-400 font-semibold">{onlineCount}</span>/{totalCount} en ligne
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => onSelectTab('topology')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'topology'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>Topologie Réseau</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('hosts')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'hosts'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hôtes & Dépendances</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-sky-400" />
            <span>Inventaire Équipements</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white shadow-xs font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Journal</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('docker')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'docker'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <span>Docs & Docker</span>
          </button>
        </nav>

        {/* Zone 3: Settings & Theme toggles */}
        <div className="flex items-center gap-1 shrink-0">
          {isScanning && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 rounded-md mr-1">
              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
              <span>Scan {scanProgress}%</span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Basculer thème"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Paramètres de test de présence et de rétention d'inventaire"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
