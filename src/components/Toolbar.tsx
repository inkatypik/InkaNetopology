import React, { useRef } from 'react';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  RotateCcw,
  X,
  SlidersHorizontal,
  LayoutGrid,
  Trash2,
  MapPin,
  Edit2,
  Layers,
  FileImage,
  FileText,
  Settings,
  GitMerge
} from 'lucide-react';
import type { DeviceType, DeviceTypeDefinition } from '../types/network';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: string | 'all';
  onSelectType: (type: any) => void;
  selectedStatus: 'all' | 'online' | 'offline';
  onSelectStatus: (st: 'all' | 'online' | 'offline') => void;
  selectedVlan: number | 'all';
  onSelectVlan: (vlan: number | 'all') => void;
  availableVlans: number[];
  groupByHost: boolean;
  onToggleGroupByHost: () => void;
  counts: Record<string, number>;
  subnet: string;
  onSubnetChange: (sub: string) => void;
  scanMode: 'fast' | 'deep' | 'iot';
  onScanModeChange: (mode: 'fast' | 'deep' | 'iot') => void;
  onOpenAddModal: () => void;
  onAutoLayout?: () => void;
  onMergeContainers?: () => void;
  onExport: () => void;
  onResetTopology: () => void;
  onClearInventory?: () => void;
  onOpenSettings?: () => void;

  // Types & Subtypes / Roles management
  types?: DeviceTypeDefinition[];
  onOpenTypeManager?: () => void;

  // Re-located buttons next to "Grouper par hôte parent":
  showGeographicZones?: boolean;
  onToggleShowGeographicZones?: () => void;
  onOpenZoneManager?: () => void;
  zonesCount?: number;
  allCollapsed?: boolean;
  onToggleAllCollapse?: () => void;
  hasCollapsibleGroups?: boolean;

  // Import / Export additions:
  onImportTopology?: (file: File) => void;
  onExportPng?: () => void;
  onExportPdf?: () => void;
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
  onMergeContainers,
  onExport,
  onResetTopology,
  onClearInventory,
  showGeographicZones = true,
  onToggleShowGeographicZones,
  onOpenZoneManager,
  zonesCount = 0,
  types = [],
  onOpenTypeManager,
  allCollapsed = false,
  onToggleAllCollapse,
  hasCollapsibleGroups = false,
  onImportTopology,
  onExportPng,
  onExportPdf,
  onOpenSettings
}) => {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex items-center gap-1.5 flex-wrap">
          {onAutoLayout && (
            <button
              onClick={onAutoLayout}
              title="Organiser la topologie avec le cœur de réseau au centre et les zones en étoile sans chevauchement ni superposition"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-700/90 hover:bg-cyan-600 border border-cyan-500/40 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Générer le schéma</span>
            </button>
          )}

          {onMergeContainers && (
            <button
              onClick={onMergeContainers}
              title="Fusionner les entités conteneurs ayant l'IP de l'hôte avec celles ayant l'IP conteneur sans doublon"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-700/60 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fusionner conteneurs</span>
            </button>
          )}

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
          </button>

          {onClearInventory && (
            <button
              onClick={onClearInventory}
              title="Vider entièrement l'inventaire pour repartir de zéro (0 équipement)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Vider</span>
            </button>
          )}

          {/* Hidden JSON file input */}
          <input
            type="file"
            ref={jsonFileInputRef}
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onImportTopology) {
                onImportTopology(file);
              }
              e.target.value = '';
            }}
          />

          {onImportTopology && (
            <button
              type="button"
              onClick={() => jsonFileInputRef.current?.click()}
              title="Importer un fichier JSON de topologie (équipements & zones)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/70 rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importer JSON</span>
            </button>
          )}

          <button
            onClick={onExport}
            title="Exporter la topologie complète en JSON"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>JSON</span>
          </button>

          {onExportPng && (
            <button
              onClick={onExportPng}
              title="Exporter la vue topologie au format image PNG"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
            >
              <FileImage className="w-3.5 h-3.5 text-sky-400" />
              <span>PNG</span>
            </button>
          )}

          {onExportPdf && (
            <button
              onClick={onExportPdf}
              title="Exporter le schéma topologique au format PDF"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>PDF</span>
            </button>
          )}

          <button
            onClick={onResetTopology}
            title="Recharger la topologie de démonstration par défaut"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Ouvrir les paramètres système (test de présence régulier, nettoyage automatique d'inventaire)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Paramètres</span>
            </button>
          )}
        </div>
      </div>

      {/* Lower row: Type tabs, Status & VLAN filters, Grouping and Geographic controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/50">
        {/* Dynamic Type Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-950/70 border border-slate-800 rounded-lg overflow-x-auto max-w-full">
          <button
            onClick={() => onSelectType('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              selectedType === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tous <span className="font-mono tabular-nums text-[10px] text-slate-400">({counts.all ?? 0})</span>
          </button>

          {types.length > 0 ? (
            types.map((t) => {
              const isSelected = selectedType === t.id;
              const count = counts[t.id] ?? 0;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectType(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 text-white shadow-xs border'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  style={{
                    borderColor: isSelected ? t.color || '#38bdf8' : 'transparent'
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.color || '#38bdf8' }}
                  />
                  <span>{t.name}</span>
                  <span className="font-mono tabular-nums text-[10px] opacity-75">
                    ({count})
                  </span>
                </button>
              );
            })
          ) : (
            <>
              <button
                onClick={() => onSelectType('physical')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  selectedType === 'physical'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Physique <span className="font-mono tabular-nums text-[10px] text-blue-400">({counts.physical ?? 0})</span>
              </button>

              <button
                onClick={() => onSelectType('vm')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  selectedType === 'vm'
                    ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Virtuel (VM) <span className="font-mono tabular-nums text-[10px] text-indigo-400">({counts.vm ?? 0})</span>
              </button>

              <button
                onClick={() => onSelectType('docker')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  selectedType === 'docker'
                    ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Docker <span className="font-mono tabular-nums text-[10px] text-cyan-400">({counts.docker ?? 0})</span>
              </button>

              <button
                onClick={() => onSelectType('iot')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  selectedType === 'iot'
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                IoT & Capteurs <span className="font-mono tabular-nums text-[10px] text-emerald-400">({counts.iot ?? 0})</span>
              </button>
            </>
          )}
        </div>

        {/* Secondary filters & Grouping and Geographic controls */}
        <div className="flex items-center gap-2 flex-wrap">
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
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              groupByHost
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-700/60'
                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Grouper par hôte parent</span>
          </button>

          {/* Zones géographiques toggle */}
          {onToggleShowGeographicZones && (
            <button
              onClick={onToggleShowGeographicZones}
              title={showGeographicZones ? 'Masquer les délimitations de zones géographiques' : 'Afficher les zones géographiques'}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                showGeographicZones
                  ? 'bg-amber-950/50 text-amber-300 border-amber-600/60 shadow-xs'
                  : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Zones géographiques</span>
            </button>
          )}

          {/* Gérer les zones */}
          {onOpenZoneManager && (
            <button
              onClick={onOpenZoneManager}
              title="Gérer, ajouter ou renommer les zones géographiques (pièces, baies, sous-répartiteurs, sites)"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gérer les zones ({zonesCount})</span>
            </button>
          )}

          {/* Gérer les types & sous-types / rôles */}
          {onOpenTypeManager && (
            <button
              onClick={onOpenTypeManager}
              title="Gérer les types d'équipements, sous-types et rôles métier"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Types & Rôles ({types.length || 4})</span>
            </button>
          )}

          {/* Tout replier / Tout déplier */}
          {onToggleAllCollapse && (
            <button
              onClick={onToggleAllCollapse}
              title={allCollapsed ? 'Déplier tous les groupes hôtes et zones' : 'Replier tous les groupes hôtes et zones'}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{allCollapsed ? 'Tout déplier' : 'Tout replier'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
