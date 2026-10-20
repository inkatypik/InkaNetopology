import React, { useState, useRef, useEffect } from 'react';
import type { NetworkLog, LogLevel, LogCategory } from '../types/network';
import { Terminal, Trash2, Pause, Play, Search, Copy, Check, Filter } from 'lucide-react';

interface LiveLogViewerProps {
  logs: NetworkLog[];
  onClearLogs: () => void;
  isConnected: boolean;
}

export const LiveLogViewer: React.FC<LiveLogViewerProps> = ({
  logs,
  onClearLogs,
  isConnected
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchIp = log.ip?.toLowerCase().includes(q);
      const matchCat = log.category.toLowerCase().includes(q);
      if (!matchMsg && !matchIp && !matchCat) return false;
    }
    return true;
  });

  const handleCopyLog = (log: NetworkLog) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.category}] ${log.ip ? `(${log.ip}) ` : ''}${log.message}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'DISCOVERY':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      case 'ALERT':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      case 'INFO':
      default:
        return 'text-slate-400 bg-slate-800/50 border-slate-700/60';
    }
  };

  const getCategoryColor = (cat: LogCategory) => {
    switch (cat) {
      case 'DOCKER':
        return 'text-cyan-400';
      case 'VM':
        return 'text-indigo-400';
      case 'IOT':
        return 'text-emerald-400';
      case 'ARP':
        return 'text-sky-400';
      case 'PORT':
        return 'text-purple-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Top Header & Diagnostics status */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">Journal Réseau & Télémétrie en Direct</h2>
              <span className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{isConnected ? 'Flux SSE Connecté' : 'Mode Polling'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Événements ARP, scans de ports, détection de conteneurs Docker, machines virtuelles et balises IoT.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              autoScroll
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoScroll ? 'Défilement auto' : 'En pause'}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/60 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Effacer</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs">
        {/* Search inside logs */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les messages du journal..."
            className="w-full pl-8 pr-3 py-1 bg-slate-950/80 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 text-xs"
          />
        </div>

        {/* Level & Category Selectors */}
        <div className="flex items-center gap-2">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-md text-slate-300 px-2 py-1 text-xs"
          >
            <option value="all">Tous les niveaux</option>
            <option value="DISCOVERY">Découvertes (DISCOVERY)</option>
            <option value="INFO">Informations (INFO)</option>
            <option value="WARN">Avertissements (WARN)</option>
            <option value="ALERT">Alertes (ALERT)</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-md text-slate-300 px-2 py-1 text-xs"
          >
            <option value="all">Toutes les catégories</option>
            <option value="ARP">ARP / Broadcast</option>
            <option value="PORT">Ports & Services</option>
            <option value="DOCKER">Conteneurs Docker</option>
            <option value="VM">Machines Virtuelles</option>
            <option value="IOT">IoT & Domotique</option>
            <option value="SYSTEM">Système</option>
          </select>

          <span className="text-[11px] font-mono tabular-nums text-slate-500 ml-2">
            {filteredLogs.length} entrées
          </span>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={scrollContainerRef}
        className="w-full h-[540px] bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-y-auto font-mono text-xs shadow-2xl space-y-1.5"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            Aucun événement journalisé pour les critères sélectionnés.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleTimeString('fr-FR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 3
            });

            return (
              <div
                key={log.id}
                className="group flex items-start justify-between gap-3 py-1 px-2 rounded-md hover:bg-slate-900/60 transition-colors"
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  {/* Timestamp */}
                  <span className="text-slate-500 shrink-0 tabular-nums">{dateStr}</span>

                  {/* Level Tag */}
                  <span
                    className={`px-1.5 py-0.5 rounded-xs text-[10px] font-semibold border shrink-0 ${getLevelBadge(
                      log.level
                    )}`}
                  >
                    {log.level}
                  </span>

                  {/* Category */}
                  <span
                    className={`font-semibold shrink-0 text-[11px] ${getCategoryColor(
                      log.category
                    )}`}
                  >
                    [{log.category}]
                  </span>

                  {/* IP (if present) */}
                  {log.ip && (
                    <span className="text-slate-400 shrink-0 font-medium">{log.ip} :</span>
                  )}

                  {/* Message */}
                  <span className="text-slate-300 break-words flex-1">{log.message}</span>
                </div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopyLog(log)}
                  title="Copier la ligne de journal"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-200 transition-opacity"
                >
                  {copiedId === log.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
