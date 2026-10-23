import React, { useState } from 'react';
import type { GeographicZone, ZoneType, Device } from '../types/network';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  MapPin,
  Server,
  Layers,
  Home,
  Building2,
  HelpCircle
} from 'lucide-react';

interface ZoneManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: GeographicZone[];
  devices: Device[];
  onSaveZone: (zone: GeographicZone) => void;
  onDeleteZone: (zoneId: string) => void;
}

export const ZONE_TYPE_LABELS: Record<ZoneType, { label: string; icon: React.ReactNode }> = {
  baie: {
    label: 'Baie / Rack serveur',
    icon: <Server className="w-3.5 h-3.5 text-sky-400" />
  },
  sous_repartiteur: {
    label: 'Sous-répartiteur (SR)',
    icon: <Layers className="w-3.5 h-3.5 text-emerald-400" />
  },
  piece: {
    label: 'Pièce / Salle',
    icon: <Home className="w-3.5 h-3.5 text-amber-400" />
  },
  site: {
    label: 'Site / Bâtiment',
    icon: <Building2 className="w-3.5 h-3.5 text-purple-400" />
  },
  autre: {
    label: 'Autre zone',
    icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
  }
};

export const PRESET_COLORS = [
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#14b8a6'  // Teal
];

export const ZoneManagerModal: React.FC<ZoneManagerModalProps> = ({
  isOpen,
  onClose,
  zones,
  devices,
  onSaveZone,
  onDeleteZone
}) => {
  if (!isOpen) return null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<ZoneType>('piece');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#0ea5e9');

  // New zone form state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ZoneType>('piece');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#0ea5e9');

  const startEdit = (z: GeographicZone) => {
    setEditingId(z.id);
    setEditName(z.name);
    setEditType(z.type);
    setEditDesc(z.description || '');
    setEditColor(z.color || '#0ea5e9');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (z: GeographicZone) => {
    if (!editName.trim()) return;
    onSaveZone({
      ...z,
      name: editName.trim(),
      type: editType,
      description: editDesc.trim() || undefined,
      color: editColor
    });
    setEditingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created: GeographicZone = {
      id: `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: newName.trim(),
      type: newType,
      description: newDesc.trim() || undefined,
      color: newColor
    };
    onSaveZone(created);
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  // Device counts per zone
  const getDeviceCount = (zoneId: string) => {
    return devices.filter((d) => d.zoneId === zoneId).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Gestion des Zones Géographiques
              </h3>
              <p className="text-xs text-slate-400">
                Classez vos équipements par pièces, baies de serveurs, sous-répartiteurs et sites.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Action button to add new zone */}
          {!isCreating && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Zones répertoriées ({zones.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer une nouvelle zone</span>
              </button>
            </div>
          )}

          {/* New Zone Inline Form */}
          {isCreating && (
            <form
              onSubmit={handleCreate}
              className="p-4 bg-slate-800/60 border border-cyan-500/40 rounded-xl space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Nouvelle zone géographique
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Nom de la zone *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Baie Principale, Bureau R&D..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Type de zone
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ZoneType)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="baie">Baie / Rack serveur</option>
                    <option value="sous_repartiteur">Sous-répartiteur (SR)</option>
                    <option value="piece">Pièce / Salle</option>
                    <option value="site">Site / Bâtiment</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Description / Détails (optionnel)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: Armoire 42U avec PDU supervisé, 2e étage..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Couleur du badge
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewColor(col)}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                        newColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Enregistrer la zone
                </button>
              </div>
            </form>
          )}

          {/* List of Zones */}
          <div className="space-y-2">
            {zones.map((zone) => {
              const isEditing = editingId === zone.id;
              const count = getDeviceCount(zone.id);

              if (isEditing) {
                return (
                  <div
                    key={zone.id}
                    className="p-3.5 bg-slate-800/80 border border-cyan-500/50 rounded-xl space-y-3 animate-in fade-in"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Nom de la zone
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-cyan-400"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Type
                        </label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as ZoneType)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-cyan-400"
                        >
                          <option value="baie">Baie / Rack serveur</option>
                          <option value="sous_repartiteur">Sous-répartiteur (SR)</option>
                          <option value="piece">Pièce / Salle</option>
                          <option value="site">Site / Bâtiment</option>
                          <option value="autre">Autre</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Couleur
                      </label>
                      <div className="flex items-center gap-2">
                        {PRESET_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setEditColor(col)}
                            className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${
                              editColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-700/60">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(zone)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Enregistrer</span>
                      </button>
                    </div>
                  </div>
                );
              }

              const typeInfo = ZONE_TYPE_LABELS[zone.type] || ZONE_TYPE_LABELS.autre;

              return (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: zone.color || '#0ea5e9' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold text-slate-100 truncate">
                          {zone.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400/90 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/50">
                          {count} équipement{count > 1 ? 's' : ''}
                        </span>
                      </div>
                      {zone.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {zone.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => startEdit(zone)}
                      title="Modifier ou renommer cette zone"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer la zone "${zone.name}" ? Les équipements resteront dans l'inventaire.`)) {
                          onDeleteZone(zone.id);
                        }
                      }}
                      title="Supprimer cette zone"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
