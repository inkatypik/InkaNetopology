import React, { useRef, useState } from 'react';
import {
  Search,
  Plus,
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
  GitMerge,
  RefreshCw,
  MoreHorizontal,
  Check
} from 'lucide-react';
import type { DeviceTypeDefinition } from '../types/network';

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

  // Real-time scan controls on the same level as Scope IP
  isScanning?: boolean;
  scanProgress?: number;
  onTriggerScan?: () => void;
  onCancelScan?: () => void;

  onOpenAddModal: () => void;
  onAutoLayout?: () => void;
  onMergeDuplicates?: () => void;
  onMergeContainers?: () => void;
  onExport: () => void;
  onResetTopology: () => void;
  onClearInventory?: () => void;
  onOpenSettings?: () => void;

  // Types & Subtypes / Roles management
  types?: DeviceTypeDefinition[];
  onOpenTypeManager?: () => void;

  // Geographic Zones & Grouping
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
  isScanning = false,
  scanProgress = 0,
  onTriggerScan,
  onCancelScan,
  onOpenAddModal,
  onAutoLayout,
  onMergeDuplicates,
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
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  return (
    <div className="w-full border-b border-slate-800/80 bg-slate-900/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left cluster: Search input + Scope IP & Scan Button */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher nom, IP, MAC, port..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Scope IP Input & Scan Button on the EXACT SAME LEVEL */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-950/80 border border-slate-700/80 rounded-lg shadow-xs">
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Scope IP:</span>
              <input
                type="text"
                value={subnet}
                onChange={(e) => onSubnetChange(e.target.value)}
                className="w-28 text-xs font-mono tabular-nums text-slate-200 bg-transparent border-none p-0 focus:outline-hidden"
                placeholder="192.168.1.0/24"
              />
            </div>

            {/* Simply titled "Scan" button */}
            {isScanning ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-950/90 text-cyan-300 border border-cyan-600/70 shadow-xs cursor-wait whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span className="font-mono">Scan ({scanProgress}%)</span>
                </button>
                {onCancelScan && (
                  <button
                    type="button"
                    onClick={onCancelScan}
                    title="Arrêter le scan en cours"
                    className="p-1 text-xs font-semibold rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700/60 hover:bg-rose-900 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onTriggerScan}
                title="Lancer le scan réseau sur ce scope d'adresse IP"
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Scan</span>
              </button>
            )}
          </div>
        </div>

        {/* Center cluster: The 3 dropdown lists placed side-by-side */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {/* 1. Equipment Types dropdown list */}
          <select
            value={selectedType}
            onChange={(e) => onSelectType(e.target.value)}
            title="Filtrer par type d'équipement"
            className="text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs font-medium"
          >
            <option value="all">Tous les équipements ({counts.all ?? 0})</option>
            {types.length > 0 ? (
              types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({counts[t.id] ?? 0})
                </option>
              ))
            ) : (
              <>
                <option value="physical">Machines Physiques ({counts.physical ?? 0})</option>
                <option value="vm">Machines Virtuelles ({counts.vm ?? 0})</option>
                <option value="docker">Conteneurs Docker ({counts.docker ?? 0})</option>
                <option value="iot">Périphériques IoT ({counts.iot ?? 0})</option>
              </>
            )}
          </select>

          {/* 2. Status dropdown list */}
          <select
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value as any)}
            title="Filtrer par état de connectivité"
            className="text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs font-medium"
          >
            <option value="all">Tous statuts</option>
            <option value="online">En ligne uniquement</option>
            <option value="offline">Hors ligne</option>
          </select>

          {/* 3. VLANs dropdown list */}
          <select
            value={selectedVlan}
            onChange={(e) => onSelectVlan(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            title="Filtrer par VLAN"
            className="text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs font-medium"
          >
            <option value="all">Tous les VLANs</option>
            {availableVlans.map((vlan) => (
              <option key={vlan} value={vlan}>
                VLAN {vlan} {vlan === 1 ? '(Défaut)' : vlan === 10 ? '(Serveurs)' : vlan === 20 ? '(IoT)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Right cluster: Primary Actions + Secondary Tools Menu */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {onAutoLayout && (
            <button
              type="button"
              onClick={onAutoLayout}
              title="Organiser la topologie avec le cœur de réseau au centre et les zones en étoile sans chevauchement"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-600 border border-cyan-500/50 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Générer le schéma</span>
            </button>
          )}

          {(onMergeDuplicates || onMergeContainers) && (
            <button
              type="button"
              onClick={onMergeDuplicates || onMergeContainers}
              title="Fusionner les doublons multi-identifiants (IP hôte/conteneur, MAC, ports)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fusionner</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
          </button>

          {/* Quick toggle: Grouper par hôte */}
          <button
            type="button"
            onClick={onToggleGroupByHost}
            title={groupByHost ? 'Désactiver le groupement par hôte' : 'Grouper les conteneurs et VMs sous leur hôte parent'}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer shadow-xs ${
              groupByHost
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-600/80 font-semibold'
                : 'bg-slate-950/70 text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden xl:inline">Hôtes</span>
          </button>

          {/* Quick toggle: Zones géographiques */}
          {onToggleShowGeographicZones && (
            <button
              type="button"
              onClick={onToggleShowGeographicZones}
              title={showGeographicZones ? 'Masquer les zones géographiques' : 'Afficher les zones géographiques'}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer shadow-xs ${
                showGeographicZones
                  ? 'bg-amber-950/60 text-amber-300 border-amber-600/70 font-semibold'
                  : 'bg-slate-950/70 text-slate-400 border-slate-700/80 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3 h-3 text-amber-400" />
              <span className="hidden xl:inline">Zones</span>
            </button>
          )}

          {/* Compact More Tools Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              title="Outils avancés (Zones, Rôles, Déplier, Import/Export, Paramètres)"
              className="p-1 text-slate-400 hover:text-slate-200 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isToolsMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsToolsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-60 z-40 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-2 backdrop-blur-md space-y-1 text-xs">
                  {onOpenZoneManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenZoneManager();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Gérer les zones</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">({zonesCount})</span>
                    </button>
                  )}

                  {onOpenTypeManager && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenTypeManager();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Types & Rôles</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">({types.length || 4})</span>
                    </button>
                  )}

                  {onToggleAllCollapse && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onToggleAllCollapse();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{allCollapsed ? 'Tout déplier' : 'Tout replier'}</span>
                    </button>
                  )}

                  <div className="h-px bg-slate-800 my-1" />

                  {onImportTopology && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        jsonFileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-emerald-300 hover:bg-emerald-950/50 text-left cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Importer JSON</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      onExport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Exporter JSON</span>
                  </button>

                  {onExportPng && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onExportPng();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <FileImage className="w-3.5 h-3.5 text-sky-400" />
                      <span>Exporter Image PNG</span>
                    </button>
                  )}

                  {onExportPdf && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onExportPdf();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Exporter Schéma PDF</span>
                    </button>
                  )}

                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Paramètres système</span>
                    </button>
                  )}

                  <div className="h-px bg-slate-800 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      onResetTopology();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 text-left cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Réinitialiser démo</span>
                  </button>

                  {onClearInventory && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onClearInventory();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-950/60 text-left cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Vider l'inventaire</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Hidden JSON file input for imports */}
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
        </div>
      </div>
    </div>
  );
};
