import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Activity,
  Trash2,
  ShieldCheck,
  Clock,
  Radio,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import type { AppSettings, Device } from '../types/network';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>;
  onTriggerPresenceCheck: () => Promise<{ checkedCount: number; onlineCount: number; offlineCount: number } | null>;
  onTriggerPrune: () => Promise<{ prunedCount: number; prunedDevices: string[] } | null>;
  devices: Device[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onTriggerPresenceCheck,
  onTriggerPrune,
  devices
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPresence, setIsCheckingPresence] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [presenceResult, setPresenceResult] = useState<string | null>(null);
  const [pruneResult, setPruneResult] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await onSaveSettings(formData);
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  const handleRunPresenceCheck = async () => {
    setIsCheckingPresence(true);
    setPresenceResult(null);
    try {
      const res = await onTriggerPresenceCheck();
      if (res) {
        setPresenceResult(`${res.onlineCount} actif(s), ${res.offlineCount} hors-ligne sur ${res.checkedCount} équipement(s) vérifié(s).`);
      }
    } catch {
      setPresenceResult('Erreur lors du test de présence.');
    } finally {
      setIsCheckingPresence(false);
    }
  };

  const handleRunPrune = async () => {
    setIsPruning(true);
    setPruneResult(null);
    try {
      const res = await onTriggerPrune();
      if (res) {
        if (res.prunedCount > 0) {
          setPruneResult(`${res.prunedCount} équipement(s) inactif(s) purgé(s) de l'inventaire.`);
        } else {
          setPruneResult('Aucun équipement inactif ne dépasse la durée de rétention actuelle.');
        }
      }
    } catch {
      setPruneResult('Erreur lors du nettoyage de l\'inventaire.');
    } finally {
      setIsPruning(false);
    }
  };

  // Calculate count of devices currently exceeding the threshold
  const nowMs = Date.now();
  const maxAgeMs = formData.maxInactiveAgeHours * 60 * 60 * 1000;
  const inactiveCandidateCount = devices.filter((d) => {
    if (formData.protectCoreDevices && d.isCore) return false;
    const lastSeenTime = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
    return (nowMs - lastSeenTime) > maxAgeMs;
  }).length;

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Jamais exécuté';
    try {
      const date = new Date(isoString);
      const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return `Il y a ${diffSec}s (${date.toLocaleTimeString()})`;
      const diffMin = Math.round(diffSec / 60);
      if (diffMin < 60) return `Il y a ${diffMin} min (${date.toLocaleTimeString()})`;
      const diffHours = Math.round(diffMin / 60);
      return `Il y a ${diffHours}h (${date.toLocaleDateString()} ${date.toLocaleTimeString()})`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Paramètres Système & Réseau</h2>
              <p className="text-xs text-slate-400">Maintien de présence régulier et rétention d'inventaire</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Network Presence Keepalive */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Test de Présence Régulier (Keepalive)</h3>
                  <p className="text-xs text-slate-400">Vérifie périodiquement la présence réelle des équipements (ping ICMP / ports ouverts)</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={formData.presenceCheckEnabled}
                  onChange={(e) => setFormData({ ...formData, presenceCheckEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {formData.presenceCheckEnabled && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Fréquence du test</span>
                    </label>
                    <select
                      value={formData.presenceCheckIntervalMinutes}
                      onChange={(e) => setFormData({ ...formData, presenceCheckIntervalMinutes: Number(e.target.value) })}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value={1}>Toutes les 1 minute (Test intensif)</option>
                      <option value={2}>Toutes les 2 minutes</option>
                      <option value={5}>Toutes les 5 minutes (Recommandé)</option>
                      <option value={10}>Toutes les 10 minutes</option>
                      <option value={15}>Toutes les 15 minutes</option>
                      <option value={30}>Toutes les 30 minutes</option>
                      <option value={60}>Toutes les 60 minutes (1 heure)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dernier test exécuté</span>
                    </label>
                    <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                      {formatRelativeTime(formData.lastPresenceCheckTime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    Actualise l'état En ligne / Hors ligne et la latence
                  </span>
                  <button
                    type="button"
                    onClick={handleRunPresenceCheck}
                    disabled={isCheckingPresence}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingPresence ? 'animate-spin' : ''}`} />
                    <span>{isCheckingPresence ? 'Test en cours...' : 'Tester maintenant'}</span>
                  </button>
                </div>

                {presenceResult && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{presenceResult}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Inactive Equipment Auto-Prune */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Nettoyage Automatique de l'Inventaire</h3>
                  <p className="text-xs text-slate-400">Supprime le matériel non vu sur le réseau depuis plus de la durée réglable</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={formData.autoPruneEnabled}
                  onChange={(e) => setFormData({ ...formData, autoPruneEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {formData.autoPruneEnabled && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                      <span>Délai d'inactivité avant suppression</span>
                    </label>
                    <select
                      value={formData.maxInactiveAgeHours}
                      onChange={(e) => setFormData({ ...formData, maxInactiveAgeHours: Number(e.target.value) })}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value={1}>1 heure (Test rapide)</option>
                      <option value={6}>6 heures</option>
                      <option value={12}>12 heures</option>
                      <option value={24}>24 heures (1 jour - Recommandé)</option>
                      <option value={48}>48 heures (2 jours)</option>
                      <option value={72}>72 heures (3 jours)</option>
                      <option value={168}>7 jours (1 semaine)</option>
                      <option value={336}>14 jours (2 semaines)</option>
                      <option value={720}>30 jours (1 mois)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Protection Cœur de réseau</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.protectCoreDevices}
                        onChange={(e) => setFormData({ ...formData, protectCoreDevices: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-xs text-slate-300">Ne jamais supprimer les routeurs/cœurs</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Équipements inactifs éligibles :{' '}
                      <span className={`font-mono font-semibold ${inactiveCandidateCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {inactiveCandidateCount}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      (Dernier nettoyage: {formatRelativeTime(formData.lastPruneTime)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunPrune}
                    disabled={isPruning || devices.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isPruning ? 'animate-spin' : ''}`} />
                    <span>{isPruning ? 'Nettoyage...' : 'Purger maintenant'}</span>
                  </button>
                </div>

                {pruneResult && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{pruneResult}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Default Subnet & Network Configuration */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <h3 className="text-sm font-semibold text-white">Sous-réseau de Scan par Défaut</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={formData.defaultSubnet}
                onChange={(e) => setFormData({ ...formData, defaultSubnet: e.target.value })}
                placeholder="ex: 192.168.1.0/24"
                className="w-64 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-400">Plage CIDR pré-remplie au démarrage de l'application</span>
            </div>
          </div>

          {/* Footer Save & Cancel Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-lg shadow-cyan-950 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
