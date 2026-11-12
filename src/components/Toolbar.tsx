import React, { useRef } from 'react';
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
  RefreshCw
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
  onOpenManualMerge?: () => void;
  selectedCount?: number;
  onExport: () => void;
  onResetTopology?: () => void;
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
  onOpenManualMerge,
  selectedCount = 0,
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
    <div className="w-full border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-1.5 transition-all space-y-1.5">
      {/* LIGNE 1 : Recherche, les 3 listes déroulantes côte à côte, et boutons d'organisation du schéma */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Groupe gauche : Recherche + les 3 listes déroulantes côte à côte */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[320px]">
          {/* Champ de recherche */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
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

          {/* Les 3 listes déroulantes positionnées côte à côte */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {/* 1. Liste déroulante des types d'équipements */}
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

            {/* 2. Liste déroulante des statuts */}
            <select
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value as any)}
              title="Filtrer par état de connectivité"
              className="text-xs bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs font-medium"
            >
              <option value="all">Tous statuts</option>
              <option value="online">En ligne</option>
              <option value="offline">Hors ligne</option>
            </select>

            {/* 3. Liste déroulante des VLANs */}
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
        </div>

        {/* Groupe droit Ligne 1 : Actions principales de topologie */}
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
              title="Fusionner automatiquement les doublons multi-identifiants (IP hôte/conteneur, MAC, ports)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fusionner</span>
            </button>
          )}

          {onOpenManualMerge && (
            <button
              type="button"
              onClick={onOpenManualMerge}
              title={
                selectedCount === 2
                  ? 'Fusionner directement les 2 équipements sélectionnés (Ctrl+Clic)'
                  : selectedCount === 1
                  ? '1 équipement sélectionné. Utilisez Ctrl+Clic sur un 2e équipement pour les fusionner ensemble'
                  : 'Sélectionner manuellement deux équipements à fusionner et consolider l\'ensemble des données'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer ${
                selectedCount === 2
                  ? 'text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 ring-2 ring-indigo-400/40 animate-pulse'
                  : 'text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/60'
              }`}
            >
              <GitMerge className={`w-3.5 h-3.5 ${selectedCount === 2 ? 'text-white' : 'text-indigo-400'}`} />
              <span>Fusion manuelle</span>
              {selectedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  selectedCount === 2 ? 'bg-white text-indigo-700 font-bold' : 'bg-indigo-800 text-indigo-200'
                }`}>
                  {selectedCount}/2
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
          </button>

          {/* Bascule Grouper par hôte */}
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
            <span>Hôtes</span>
          </button>

          {/* Bascule Zones géographiques */}
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
              <span>Zones</span>
            </button>
          )}
        </div>
      </div>

      {/* LIGNE 2 : En dessous des listes déroulantes, à côté du champs scope d'ip et du bouton scan : Boutons d'imports, export, vider l'inventaire,... */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/50">
        {/* Sous-groupe gauche : Scope IP et bouton Scan au même niveau */}
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

          {/* Bouton intitulé simplement "Scan" */}
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

        {/* Sous-groupe droit : Import, Export JSON, PNG, PDF, Paramètres, Réinitialiser, Vider l'inventaire */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {onImportTopology && (
            <button
              type="button"
              onClick={() => jsonFileInputRef.current?.click()}
              title="Importer un fichier topologie JSON"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/60 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Importer JSON</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExport}
            title="Exporter la topologie et les équipements en format JSON"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-slate-200 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exporter JSON</span>
          </button>

          {onExportPng && (
            <button
              type="button"
              onClick={onExportPng}
              title="Exporter l'intégralité du schéma en image PNG haute résolution"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <FileImage className="w-3.5 h-3.5 text-sky-400" />
              <span>PNG</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              title="Exporter le schéma réseau au format PDF vectoriel"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>PDF</span>
            </button>
          )}

          {onOpenZoneManager && (
            <button
              type="button"
              onClick={onOpenZoneManager}
              title="Gérer les zones géographiques (bâtiments, baies, étages)"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-amber-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Edit2 className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Zones</span>
              <span className="text-[10px] text-amber-400/80">({zonesCount})</span>
            </button>
          )}

          {onOpenTypeManager && (
            <button
              type="button"
              onClick={onOpenTypeManager}
              title="Configurer les types d'équipements et sous-types/rôles"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-indigo-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">Rôles</span>
            </button>
          )}

          {onToggleAllCollapse && hasCollapsibleGroups && (
            <button
              type="button"
              onClick={onToggleAllCollapse}
              title={allCollapsed ? 'Déplier tous les groupes d’hôtes et zones' : 'Replier tous les groupes d’hôtes et zones'}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Layers className="w-3 h-3 text-cyan-400" />
              <span className="hidden md:inline">{allCollapsed ? 'Déplier' : 'Replier'}</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Paramètres de ping, rétention et détection réseau"
              className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-700/80 transition-colors cursor-pointer shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {onClearInventory && (
            <button
              type="button"
              onClick={onClearInventory}
              title="Vider entièrement l'inventaire des équipements"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-300 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/60 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Vider l'inventaire</span>
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input for JSON import */}
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
  );
};
