import React from 'react';
import { Search, Plus, Filter, Download, RotateCcw, X, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import type { DeviceType } from '../types/network';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: DeviceType | 'all';
  onSelectType: (type: DeviceType | 'all') => void;
  selectedStatus: 'all' | 'online' | 'offline';
  onSelectStatus: (st: 'all' | 'online' | 'offline') => void;
  selectedVlan: number | 'all';
  onSelectVlan: (vlan: number | 'all') => void;
  availableVlans: number[];
  groupByHost: boolean;
  onToggleGroupByHost: () => void;
  counts: {
    all: number;
    physical: number;
    vm: number;
    docker: number;
    iot: number;
  };
  subnet: string;
  onSubnetChange: (sub: string) => void;
  scanMode: 'fast' | 'deep' | 'iot';
  onScanModeChange: (mode: 'fast' | 'deep' | 'iot') => void;
  onOpenAddModal: () => void;
  onAutoLayout?: () => void;
  onExport: () => void;
  onResetTopology: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onSelectType,
  selectedStatus,
  onSelectStatus,
  selectedVlan,
  onSelectVlan,
  availableVlans,
  groupByHost,
  onToggleGroupByHost,
  counts,
  subnet,
  onSubnetChange,
  scanMode,
  onScanModeChange,
  onOpenAddModal,
  onAutoLayout,
  onExport,
  onResetTopology
}) => {
  return (
    <div className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs py-3 px-4 sm:px-6 lg:px-8 space-y-3">
      {/* Upper row: Search, Subnet CIDR, Scan mode, Add device */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher par nom, IP, MAC, tag, fabricant, OS..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Subnet & Scan parameters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/60 border border-slate-800 rounded-lg">
            <span className="text-[11px] text-slate-400 font-medium">Sous-réseau:</span>
            <input
              type="text"
              value={subnet}
              onChange={(e) => onSubnetChange(e.target.value)}
              className="w-28 text-xs font-mono tabular-nums text-slate-200 bg-transparent border-none p-0 focus:outline-hidden"
              placeholder="192.168.1.0/24"
            />
          </div>

          <select
            value={scanMode}
            onChange={(e) => onScanModeChange(e.target.value as any)}
            className="text-xs bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="fast">Découverte Rapide (ARP/ICMP)</option>
            <option value="deep">Scan Approfondi (Ports & OS)</option>
            <option value="iot">Audit Spécialisé IoT & Domotique</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onAutoLayout && (
            <button
              onClick={onAutoLayout}
              title="Organiser et générer automatiquement le schéma hiérarchique"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-700/90 hover:bg-cyan-600 border border-cyan-500/40 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Générer le schéma</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter Équipement</span>
          </button>

          <button
            onClick={onExport}
            title="Exporter la topologie en JSON"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onResetTopology}
            title="Réinitialiser la topologie"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lower row: Type tabs, Status & VLAN filters, Grouping toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/50">
        {/* Dynamic Type Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-950/70 border border-slate-800 rounded-lg">
          <button
            onClick={() => onSelectType('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tous <span className="font-mono tabular-nums text-[10px] text-slate-400">({counts.all})</span>
          </button>

          <button
            onClick={() => onSelectType('physical')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === 'physical'
                ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Physique <span className="font-mono tabular-nums text-[10px] text-blue-400">({counts.physical})</span>
          </button>

          <button
            onClick={() => onSelectType('vm')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === 'vm'
                ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Virtuel (VM) <span className="font-mono tabular-nums text-[10px] text-indigo-400">({counts.vm})</span>
          </button>

          <button
            onClick={() => onSelectType('docker')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === 'docker'
                ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Docker <span className="font-mono tabular-nums text-[10px] text-cyan-400">({counts.docker})</span>
          </button>

          <button
            onClick={() => onSelectType('iot')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              selectedType === 'iot'
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            IoT & Capteurs <span className="font-mono tabular-nums text-[10px] text-emerald-400">({counts.iot})</span>
          </button>
        </div>

        {/* Secondary filters & Grouping */}
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value as any)}
            className="text-xs bg-slate-950/70 border border-slate-800 rounded-lg text-slate-300 px-2.5 py-1 focus:outline-hidden"
          >
            <option value="all">Tous statuts</option>
            <option value="online">En ligne uniquement</option>
            <option value="offline">Hors ligne</option>
          </select>

          {/* VLAN filter */}
          <select
            value={selectedVlan}
            onChange={(e) => onSelectVlan(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs bg-slate-950/70 border border-slate-800 rounded-lg text-slate-300 px-2.5 py-1 focus:outline-hidden"
          >
            <option value="all">Tous les VLANs</option>
            {availableVlans.map((vlan) => (
              <option key={vlan} value={vlan}>
                VLAN {vlan} {vlan === 1 ? '(Défaut)' : vlan === 10 ? '(Serveurs)' : vlan === 20 ? '(IoT)' : ''}
              </option>
            ))}
          </select>

          {/* Grouping toggle */}
          <button
            onClick={onToggleGroupByHost}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              groupByHost
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-700/60'
                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Grouper par hôte parent</span>
          </button>
        </div>
      </div>
    </div>
  );
};
