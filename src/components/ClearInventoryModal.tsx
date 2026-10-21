import React from 'react';
import { Trash2, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface ClearInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => void;
  deviceCount: number;
}

export const ClearInventoryModal: React.FC<ClearInventoryModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  deviceCount
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Vider entièrement l'inventaire
            </h3>
            <p className="text-xs text-rose-300 font-medium mt-0.5">
              Suppression de tous les équipements ({deviceCount} au total)
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-2.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <p className="font-medium">
              Cette action est irréversible et efface la base de données locale (<code className="font-mono text-cyan-300">data/devices.json</code>).
            </p>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Tous les routeurs, commutateurs, serveurs, conteneurs, machines virtuelles et objets connectés seront supprimés pour laisser place à un inventaire totalement vierge (0 équipement).
          </p>
          <p className="text-slate-400 leading-relaxed">
            Vous pourrez ensuite lancer un scan réseau propre sur votre sous-réseau pour ne cartographier que vos équipements réels.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmClear();
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-lg shadow-sm transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Oui, vider l'inventaire</span>
          </button>
        </div>
      </div>
    </div>
  );
};
