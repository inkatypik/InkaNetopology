import React, { useState, useMemo } from 'react';
import type { DeviceTypeDefinition, DeviceSubTypeDefinition, Device } from '../types/network';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Server,
  Layers,
  Box,
  Radio,
  Shield,
  Cloud,
  Database,
  Lock,
  Globe,
  HardDrive,
  Cpu,
  Network,
  Activity,
  Camera,
  Thermometer,
  Zap,
  Monitor,
  Printer,
  Wifi,
  HelpCircle,
  Link2,
  Search,
  Tag
} from 'lucide-react';
import { getIconComponentByName } from '../utils/hardwareIcons';

interface TypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  types: DeviceTypeDefinition[];
  subTypes: DeviceSubTypeDefinition[];
  devices: Device[];
  onSaveType: (type: DeviceTypeDefinition) => void;
  onDeleteType: (typeId: string) => void;
  onSaveSubType: (subType: DeviceSubTypeDefinition) => void;
  onDeleteSubType: (subTypeId: string) => void;
  initialTab?: 'types' | 'subtypes';
  focusDeviceId?: string;
}

const AVAILABLE_ICONS = [
  { name: 'Server', label: 'Serveur' },
  { name: 'Layers', label: 'Couches / VM' },
  { name: 'Box', label: 'Conteneur / Box' },
  { name: 'Radio', label: 'Radio / Passerelle' },
  { name: 'Network', label: 'Switch / Réseau' },
  { name: 'Cpu', label: 'Processeur / Calcul' },
  { name: 'Shield', label: 'Sécurité / Pare-feu' },
  { name: 'Cloud', label: 'Cloud / Distant' },
  { name: 'Database', label: 'Base de Données' },
  { name: 'HardDrive', label: 'Disque / NAS' },
  { name: 'Wifi', label: 'Wi-Fi / Borne' },
  { name: 'Monitor', label: 'Poste / Écran' },
  { name: 'Printer', label: 'Imprimante' },
  { name: 'Camera', label: 'Caméra' },
  { name: 'Activity', label: 'Activité / Capteur' },
  { name: 'Thermometer', label: 'Température' },
  { name: 'Zap', label: 'Prise / Énergie' },
  { name: 'Lock', label: 'Verrou / Accès' },
  { name: 'Globe', label: 'Internet / WAN' }
];

const PRESET_COLORS = [
  '#3b82f6', // Bleu
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Émeraude
  '#f59e0b', // Ambre
  '#ec4899', // Rose
  '#8b5cf6', // Violet
  '#ef4444', // Rouge
  '#14b8a6', // Sarcelle
  '#64748b'  // Ardoise
];

export const TypeManagerModal: React.FC<TypeManagerModalProps> = ({
  isOpen,
  onClose,
  types,
  subTypes,
  devices,
  onSaveType,
  onDeleteType,
  onSaveSubType,
  onDeleteSubType,
  initialTab = 'types',
  focusDeviceId
}) => {
  const [activeTab, setActiveTab] = useState<'types' | 'subtypes'>(initialTab);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEquipment, setFilterEquipment] = useState<string>(focusDeviceId || 'all');

  // New Type Form state
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#3b82f6');
  const [newTypeIcon, setNewTypeIcon] = useState('Server');
  const [newTypeDesc, setNewTypeDesc] = useState('');

  // Edit Type Form state
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeColor, setEditTypeColor] = useState('#3b82f6');
  const [editTypeIcon, setEditTypeIcon] = useState('Server');
  const [editTypeDesc, setEditTypeDesc] = useState('');

  // New SubType Form state
  const [isCreatingSubType, setIsCreatingSubType] = useState(Boolean(focusDeviceId));
  const [newSubName, setNewSubName] = useState('');
  const [newSubRole, setNewSubRole] = useState('');
  const [newSubTypeId, setNewSubTypeId] = useState<string>('all');
  const [newSubDeviceId, setNewSubDeviceId] = useState<string>(focusDeviceId || '');
  const [newSubIcon, setNewSubIcon] = useState('Cpu');
  const [newSubDesc, setNewSubDesc] = useState('');

  // Edit SubType Form state
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubRole, setEditSubRole] = useState('');
  const [editSubTypeId, setEditSubTypeId] = useState<string>('all');
  const [editSubDeviceId, setEditSubDeviceId] = useState<string>('');
  const [editSubIcon, setEditSubIcon] = useState('Cpu');
  const [editSubDesc, setEditSubDesc] = useState('');

  // Device counts per type
  const typeDeviceCount = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => {
      map.set(d.deviceType, (map.get(d.deviceType) || 0) + 1);
    });
    return map;
  }, [devices]);

  // Device counts per sub-type
  const subTypeDeviceCount = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => {
      map.set(d.subType, (map.get(d.subType) || 0) + 1);
    });
    return map;
  }, [devices]);

  // Filtered SubTypes
  const filteredSubTypes = useMemo(() => {
    return subTypes.filter((st) => {
      if (filterType !== 'all' && st.typeId && st.typeId !== 'all' && st.typeId !== filterType) {
        return false;
      }
      if (filterEquipment === 'linked' && !st.deviceId) {
        return false;
      }
      if (filterEquipment === 'general' && st.deviceId) {
        return false;
      }
      if (filterEquipment !== 'all' && filterEquipment !== 'linked' && filterEquipment !== 'general' && st.deviceId !== filterEquipment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = st.name.toLowerCase().includes(q);
        const inRole = st.role?.toLowerCase().includes(q);
        const inDesc = st.description?.toLowerCase().includes(q);
        if (!inName && !inRole && !inDesc) return false;
      }
      return true;
    });
  }, [subTypes, filterType, filterEquipment, searchQuery]);

  // Handle Type Creation
  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    const rawId = newTypeName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const typeId = rawId.startsWith('type-') ? rawId : `type-${rawId}-${Date.now().toString(36).slice(-4)}`;

    onSaveType({
      id: typeId,
      name: newTypeName.trim(),
      color: newTypeColor,
      icon: newTypeIcon,
      description: newTypeDesc.trim(),
      isBuiltin: false
    });

    setNewTypeName('');
    setNewTypeDesc('');
    setIsCreatingType(false);
  };

  // Start Edit Type
  const startEditType = (t: DeviceTypeDefinition) => {
    setEditingTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeColor(t.color || '#3b82f6');
    setEditTypeIcon(t.icon || 'Server');
    setEditTypeDesc(t.description || '');
  };

  const handleSaveEditType = (t: DeviceTypeDefinition) => {
    if (!editTypeName.trim()) return;
    onSaveType({
      ...t,
      name: editTypeName.trim(),
      color: editTypeColor,
      icon: editTypeIcon,
      description: editTypeDesc.trim()
    });
    setEditingTypeId(null);
  };

  // Handle SubType Creation
  const handleCreateSubType = () => {
    if (!newSubName.trim()) return;
    const rawId = newSubName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const subId = rawId.startsWith('sub-') ? rawId : `sub-${rawId}-${Date.now().toString(36).slice(-4)}`;

    onSaveSubType({
      id: subId,
      name: newSubName.trim(),
      role: newSubRole.trim() || newSubName.trim(),
      typeId: newSubTypeId || 'all',
      deviceId: newSubDeviceId || undefined,
      icon: newSubIcon,
      description: newSubDesc.trim(),
      isBuiltin: false
    });

    setNewSubName('');
    setNewSubRole('');
    setNewSubDesc('');
    setIsCreatingSubType(false);
  };

  // Start Edit SubType
  const startEditSubType = (st: DeviceSubTypeDefinition) => {
    setEditingSubId(st.id);
    setEditSubName(st.name);
    setEditSubRole(st.role || st.name);
    setEditSubTypeId(st.typeId || 'all');
    setEditSubDeviceId(st.deviceId || '');
    setEditSubIcon(st.icon || 'Cpu');
    setEditSubDesc(st.description || '');
  };

  const handleSaveEditSubType = (st: DeviceSubTypeDefinition) => {
    if (!editSubName.trim()) return;
    onSaveSubType({
      ...st,
      name: editSubName.trim(),
      role: editSubRole.trim() || editSubName.trim(),
      typeId: editSubTypeId || 'all',
      deviceId: editSubDeviceId || undefined,
      icon: editSubIcon,
      description: editSubDesc.trim()
    });
    setEditingSubId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Gestion des Types & Rôles d'Équipements
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Personnalisez la classification réseau, les rôles métier et les liaisons spécifiques aux équipements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('types')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'types'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Types d'Équipements</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {types.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subtypes')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'subtypes'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Sous-Types & Rôles Métier</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {subTypes.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* ================= TAB 1: TYPES D'ÉQUIPEMENTS ================= */}
          {activeTab === 'types' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Catégories Principales d'Équipements
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chaque type dispose d'une couleur et d'une icône distincte appliquée sur la cartographie.
                  </p>
                </div>

                {!isCreatingType && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingType(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Type</span>
                  </button>
                )}
              </div>

              {/* Formulaire de création d'un type */}
              {isCreatingType && (
                <div className="p-4 bg-slate-950 border border-cyan-500/50 rounded-xl space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Ajouter un nouveau type d'équipement
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingType(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Nom du type * (Ex: Cloud, Sécurité, Télécom)
                      </label>
                      <input
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="Ex: Équipement Cloud"
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Icône représentative
                      </label>
                      <select
                        value={newTypeIcon}
                        onChange={(e) => setNewTypeIcon(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                      >
                        {AVAILABLE_ICONS.map((ico) => (
                          <option key={ico.name} value={ico.name}>
                            {ico.label} ({ico.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Couleur d'accentuation
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewTypeColor(col)}
                          style={{ backgroundColor: col }}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            newTypeColor === col ? 'scale-125 border-white shadow-md' : 'border-slate-800 hover:scale-110'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={newTypeColor}
                        onChange={(e) => setNewTypeColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer ml-2"
                        title="Couleur personnalisée"
                      />
                      <span className="text-[11px] font-mono text-slate-400 ml-1">{newTypeColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Description (Optionnelle)
                    </label>
                    <input
                      type="text"
                      value={newTypeDesc}
                      onChange={(e) => setNewTypeDesc(e.target.value)}
                      placeholder="Ex: Serveurs distants hébergés sur AWS, OVH ou Azure"
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingType(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateType}
                      disabled={!newTypeName.trim()}
                      className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Enregistrer le Type
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des types existants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {types.map((type) => {
                  const isEditing = editingTypeId === type.id;
                  const count = typeDeviceCount.get(type.id) || 0;

                  if (isEditing) {
                    return (
                      <div
                        key={type.id}
                        className="p-4 bg-slate-950 border border-cyan-500 rounded-xl space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300">Modifier le type: {type.id}</span>
                          <button
                            type="button"
                            onClick={() => setEditingTypeId(null)}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nom du type</label>
                          <input
                            type="text"
                            value={editTypeName}
                            onChange={(e) => setEditTypeName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Icône</label>
                            <select
                              value={editTypeIcon}
                              onChange={(e) => setEditTypeIcon(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                            >
                              {AVAILABLE_ICONS.map((ico) => (
                                <option key={ico.name} value={ico.name}>
                                  {ico.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Couleur</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={editTypeColor}
                                onChange={(e) => setEditTypeColor(e.target.value)}
                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                              />
                              <span className="text-[10px] font-mono text-slate-300">{editTypeColor}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                          <input
                            type="text"
                            value={editTypeDesc}
                            onChange={(e) => setEditTypeDesc(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingTypeId(null)}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditType(type)}
                            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                          >
                            <Check className="w-3.5 h-3.5" /> Enregistrer
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={type.id}
                      className="p-3.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex items-start justify-between gap-3 transition-colors group/card"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${type.color || '#3b82f6'}15`,
                            borderColor: `${type.color || '#3b82f6'}40`,
                            color: type.color || '#3b82f6'
                          }}
                        >
                          {getIconComponentByName(type.icon, "w-5 h-5")}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {type.name}
                            </span>
                            {type.isBuiltin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                Natif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                            ID: {type.id}
                          </div>
                          {type.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                              {type.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: type.color || '#3b82f6' }}
                              />
                              {count} équipement{count > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/card:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEditType(type)}
                          title="Modifier ce type d'équipement"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Confirmer la suppression du type "${type.name}" ? Les équipements associés seront basculés en type standard.`)) {
                              onDeleteType(type.id);
                            }
                          }}
                          title="Supprimer ce type"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 2: SOUS-TYPES & RÔLES ================= */}
          {activeTab === 'subtypes' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Sous-Types & Rôles Métier
                  </h3>
                  <p className="text-xs text-slate-400">
                    Définissez les rôles opérationnels (Passerelle, Stockage, Serveur DNS...) applicables globalement ou liés à un équipement particulier.
                  </p>
                </div>

                {!isCreatingSubType && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingSubType(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau Sous-Type / Rôle</span>
                  </button>
                )}
              </div>

              {/* Filters bar */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par nom ou rôle..."
                    className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter by parent type */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-hidden"
                  >
                    <option value="all">Tous les types parents</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  {/* Filter by equipment attachment */}
                  <select
                    value={filterEquipment}
                    onChange={(e) => setFilterEquipment(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-hidden"
                  >
                    <option value="all">Toutes les affectations</option>
                    <option value="general">Rôles généraux (sans équipement unique)</option>
                    <option value="linked">Rôles spécifiques à un équipement</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        Équipement: {d.name} ({d.ip})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Formulaire de création d'un sous-type / rôle */}
              {isCreatingSubType && (
                <div className="p-4 bg-slate-950 border border-cyan-500/50 rounded-xl space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Créer un sous-type ou rôle métier
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubType(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Nom / Libellé du sous-type *
                      </label>
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Ex: Contrôleur de Domaine Active Directory"
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Rôle descriptif affiché sur l'équipement
                      </label>
                      <input
                        type="text"
                        value={newSubRole}
                        onChange={(e) => setNewSubRole(e.target.value)}
                        placeholder="Ex: Gestion des identités & DNS Windows"
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Type d'équipement parent
                      </label>
                      <select
                        value={newSubTypeId}
                        onChange={(e) => setNewSubTypeId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                      >
                        <option value="all">Tous les types (Général)</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Lier à un équipement particulier
                      </label>
                      <select
                        value={newSubDeviceId}
                        onChange={(e) => setNewSubDeviceId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                      >
                        <option value="">(Aucun - Rôle général réutilisable)</option>
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.ip})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Icône
                      </label>
                      <select
                        value={newSubIcon}
                        onChange={(e) => setNewSubIcon(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                      >
                        {AVAILABLE_ICONS.map((ico) => (
                          <option key={ico.name} value={ico.name}>
                            {ico.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Description détaillée (Optionnelle)
                    </label>
                    <input
                      type="text"
                      value={newSubDesc}
                      onChange={(e) => setNewSubDesc(e.target.value)}
                      placeholder="Ex: Serveur Windows 2022 avec rôles AD DS, DNS et DHCP"
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubType(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateSubType}
                      disabled={!newSubName.trim()}
                      className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      Enregistrer le Sous-Type / Rôle
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des sous-types existants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSubTypes.map((st) => {
                  const isEditing = editingSubId === st.id;
                  const count = subTypeDeviceCount.get(st.id) || 0;
                  const linkedDevice = st.deviceId ? devices.find((d) => d.id === st.deviceId) : undefined;
                  const parentType = types.find((t) => t.id === st.typeId);

                  if (isEditing) {
                    return (
                      <div
                        key={st.id}
                        className="p-4 bg-slate-950 border border-cyan-500 rounded-xl space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300">Modifier: {st.name}</span>
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nom / Libellé</label>
                          <input
                            type="text"
                            value={editSubName}
                            onChange={(e) => setEditSubName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Rôle descriptif</label>
                          <input
                            type="text"
                            value={editSubRole}
                            onChange={(e) => setEditSubRole(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Type parent</label>
                            <select
                              value={editSubTypeId}
                              onChange={(e) => setEditSubTypeId(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                            >
                              <option value="all">Tous</option>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Icône</label>
                            <select
                              value={editSubIcon}
                              onChange={(e) => setEditSubIcon(e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                            >
                              {AVAILABLE_ICONS.map((ico) => (
                                <option key={ico.name} value={ico.name}>
                                  {ico.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Équipement lié</label>
                          <select
                            value={editSubDeviceId}
                            onChange={(e) => setEditSubDeviceId(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                          >
                            <option value="">(Aucun - Rôle général)</option>
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.ip})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingSubId(null)}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditSubType(st)}
                            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                          >
                            <Check className="w-3.5 h-3.5" /> Enregistrer
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex items-start justify-between gap-3 transition-colors group/subcard"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-cyan-400">
                          {getIconComponentByName(st.icon, "w-4 h-4")}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-slate-100 truncate">
                              {st.name}
                            </span>
                            {st.isBuiltin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                                Natif
                              </span>
                            )}
                          </div>

                          {st.role && (
                            <div className="text-[11px] font-medium text-cyan-300/90 truncate mt-0.5">
                              Rôle: {st.role}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {parentType ? (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] border flex items-center gap-1"
                                style={{
                                  backgroundColor: `${parentType.color || '#3b82f6'}15`,
                                  borderColor: `${parentType.color || '#3b82f6'}40`,
                                  color: parentType.color || '#3b82f6'
                                }}
                              >
                                {parentType.name}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-400">
                                Tous types
                              </span>
                            )}

                            {linkedDevice ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/40 border border-amber-600/40 text-amber-300 flex items-center gap-1 truncate max-w-[170px]" title={`Lié à ${linkedDevice.name}`}>
                                <Link2 className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{linkedDevice.name}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                {count} équipement{count > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/subcard:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEditSubType(st)}
                          title="Modifier ce sous-type / rôle"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Confirmer la suppression du sous-type / rôle "${st.name}" ?`)) {
                              onDeleteSubType(st.id);
                            }
                          }}
                          title="Supprimer ce sous-type / rôle"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {types.length} types et {subTypes.length} rôles enregistrés
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
