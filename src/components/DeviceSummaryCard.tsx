import React, { useState } from 'react';
import type { Device, GeographicZone, DeviceTypeDefinition, DeviceSubTypeDefinition } from '../types/network';
import { getDeviceDefaultIcon, getDeviceTypeColor, resolveServiceIcon } from '../utils/hardwareIcons';
import {
  Activity,
  Edit3,
  MapPin,
  Server,
  Layers,
  Box,
  Radio,
  Network,
  Cpu,
  Tag,
  Star,
  GitMerge,
  ExternalLink,
  Shield,
  Clock,
  HardDrive,
  Trash2
} from 'lucide-react';

interface DeviceSummaryCardProps {
  device: Device;
  allDevices?: Device[];
  zones?: GeographicZone[];
  types?: DeviceTypeDefinition[];
  subTypes?: DeviceSubTypeDefinition[];
  onEdit: (device: Device) => void;
  onDelete?: (deviceId: string) => void;
  onInitiateMerge?: (device: Device) => void;
  onPing?: (device: Device) => void;
  onSelect?: (device: Device) => void;
  onClose?: () => void;
  variant?: 'panel' | 'card' | 'compact';
  className?: string;
}

export const DeviceSummaryCard: React.FC<DeviceSummaryCardProps> = ({
  device,
  allDevices = [],
  zones = [],
  types = [],
  subTypes = [],
  onEdit,
  onDelete,
  onInitiateMerge,
  onPing,
  onSelect,
  onClose,
  variant = 'card',
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);
  const typeStyle = getDeviceTypeColor(device.deviceType, types);
  const isOnline = device.status === 'online';

  const iconUrl = device.customImage || device.serviceIcon || resolveServiceIcon(device);
  const zone = zones.find((z) => z.id === device.zoneId);
  const parentHost = device.parentHostId
    ? allDevices.find((d) => d.id === device.parentHostId)
    : undefined;
  const switchDevice = device.connectedToSwitchId
    ? allDevices.find((d) => d.id === device.connectedToSwitchId)
    : undefined;

  // Custom subtype / role label
  const customSub = subTypes.find((s) => s.id === device.subType);
  const subTypeLabel = customSub?.name || device.role || device.subType.replace('_', ' ');

  // Format relative last seen
  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Inconnu';
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 1000));
    if (diffSec < 60) return 'À l\'instant';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return `Il y a ${Math.round(diffH / 24)}j`;
  };

  const isDocker = device.deviceType === 'docker';
  const isVm = device.deviceType === 'vm';
  const isCore = Boolean(device.isCore);
  const isMerged = Boolean(device.metadata?.['Statut fusion'] || (device.tags || []).includes('Fusionné'));

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 backdrop-blur-md shadow-lg ${
        typeStyle.bg
      } ${
        isCore
          ? 'border-amber-500/70 shadow-amber-950/20'
          : `${typeStyle.border} shadow-slate-950/40`
      } ${className}`}
    >
      {/* Cœur de réseau Header Banner if Core */}
      {isCore && (
        <div className="px-3 py-1 bg-amber-500/15 border-b border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span>★ Cœur de Réseau (Point Central)</span>
          </span>
          <span className="text-[10px] opacity-80">Routage WAN & Transit</span>
        </div>
      )}

      <div className="p-4 space-y-3.5">
        {/* Row 1: Avatar / Service Logo + Device Name + Online Status + Quick Edit button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Standardized crisp avatar */}
            <div className="relative shrink-0">
              {iconUrl && !imgError ? (
                <div className="w-11 h-11 rounded-xl bg-slate-950/90 border border-slate-700/80 p-1.5 shadow-sm flex items-center justify-center">
                  <img
                    src={iconUrl}
                    alt={device.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shadow-sm">
                  {getDeviceDefaultIcon(device.subType, device.deviceType, subTypes, types)}
                </div>
              )}

              {/* Online/Offline status dot badge */}
              <span
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
                  isOnline ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-slate-500'
                }`}
                title={isOnline ? 'Équipement en ligne' : 'Équipement hors ligne'}
              />
            </div>

            {/* Title & Primary Badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onEdit(device)}
                  title="Cliquer pour éditer la fiche complète"
                  className="font-bold text-sm text-slate-100 hover:text-cyan-300 transition-colors truncate text-left cursor-pointer group-hover:text-cyan-200"
                >
                  {device.name}
                </button>
              </div>

              {/* Subtitle: Type & Role */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${typeStyle.colorHex || '#3b82f6'}20`,
                    color: typeStyle.colorHex || '#3b82f6',
                    border: `1px solid ${typeStyle.colorHex || '#3b82f6'}40`
                  }}
                >
                  {device.deviceType === 'physical'
                    ? 'Physique'
                    : device.deviceType === 'vm'
                    ? 'Machine Virtuelle'
                    : device.deviceType === 'docker'
                    ? 'Docker'
                    : 'IoT'}
                </span>

                <span className="text-slate-400 capitalize font-medium">
                  {subTypeLabel}
                </span>

                {isMerged && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 border border-cyan-600/60 text-cyan-300"
                    title={device.metadata?.['Détail fusion'] || 'Équipement consolidé sans doublon'}
                  >
                    <GitMerge className="w-3 h-3 text-cyan-400" />
                    <span>Fusionné</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Top Right) */}
          <div className="flex items-center gap-1 shrink-0">
            {onPing && (
              <button
                type="button"
                onClick={() => onPing(device)}
                title="Tester la connectivité (Ping / RTT)"
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
              >
                <Activity className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(device)}
              title="Éditer la fiche complète de cet équipement"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Éditer</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Fermer la fiche"
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              >
                <span className="text-base leading-none">&times;</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Network coordinates & Hardware details */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* IP Address */}
          <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
              {isDocker ? 'IP Conteneur / Hôte' : 'Adresse IP'}
            </span>
            <div className="font-mono tabular-nums text-slate-200 font-semibold truncate flex items-center gap-1.5 mt-0.5">
              <span>{device.ip || 'Non assignée'}</span>
              {device.metadata?.['IP Hôte'] && device.metadata['IP Hôte'] !== device.ip && (
                <span className="text-[10px] text-slate-400 font-normal">
                  (Hôte: {device.metadata['IP Hôte']})
                </span>
              )}
            </div>
          </div>

          {/* MAC & Hardware Vendor */}
          <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
              MAC / Constructeur
            </span>
            <div className="font-mono tabular-nums text-slate-200 truncate mt-0.5" title={device.mac}>
              {device.mac || '02:00:00:--:--:--'}
            </div>
            {device.vendor && device.vendor !== 'Générique / Inconnu' && (
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {device.vendor}
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Hierarchy, Zone & Ports */}
        <div className="space-y-1.5 text-xs pt-1 border-t border-slate-800/60">
          {/* Geographic Zone */}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Zone géographique:</span>
            </span>
            {zone ? (
              <span
                className="font-medium px-2 py-0.5 rounded text-[11px] border"
                style={{
                  backgroundColor: `${zone.color || '#f59e0b'}15`,
                  borderColor: `${zone.color || '#f59e0b'}40`,
                  color: zone.color || '#fbbf24'
                }}
              >
                {zone.name}
              </span>
            ) : (
              <span className="text-slate-400 italic text-[11px]">Non assignée</span>
            )}
          </div>

          {/* Parent Host (for VM or Docker) */}
          {(isDocker || isVm) && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{isDocker ? 'Hôte d\'exécution:' : 'Hyperviseur:'}</span>
              </span>
              {parentHost ? (
                <button
                  type="button"
                  onClick={() => onSelect && onSelect(parentHost)}
                  title="Sélectionner l'hôte parent"
                  className="font-medium text-cyan-300 hover:underline flex items-center gap-1 text-[11px] truncate max-w-[160px]"
                >
                  <span className="truncate">{parentHost.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                </button>
              ) : (
                <span className="text-slate-400 italic text-[11px]">
                  {device.metadata?.['Hôte d\'exécution'] || 'Hôte non lié'}
                </span>
              )}
            </div>
          )}

          {/* VLAN & Switch link */}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>VLAN / Port:</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-mono tabular-nums text-slate-300">
                VLAN {device.vlan || 1}
              </span>
              {device.portOrInterface && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-slate-400 truncate max-w-[120px]" title={device.portOrInterface}>
                    {device.portOrInterface}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* OS / System */}
          {device.os && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Système / Image:</span>
              </span>
              <span className="text-slate-200 text-[11px] truncate max-w-[180px]" title={device.os}>
                {device.os}
              </span>
            </div>
          )}

          {/* Open Ports */}
          {device.openPorts && device.openPorts.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Ports ouverts ({device.openPorts.length}):</span>
                {device.latencyMs !== undefined && (
                  <span className="font-mono tabular-nums text-emerald-400">
                    RTT {device.latencyMs} ms
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap max-h-16 overflow-y-auto">
                {device.openPorts.slice(0, 10).map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-slate-950/80 border border-slate-700/80 text-cyan-300 font-semibold"
                  >
                    {p}
                  </span>
                ))}
                {device.openPorts.length > 10 && (
                  <span className="text-[10px] font-mono text-slate-400">
                    +{device.openPorts.length - 10}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Last Seen & Primary Actions (Supprimer, Fusionner, Éditer) */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] gap-2 flex-wrap">
          <span className="text-slate-400 flex items-center gap-1 font-mono text-[10px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatLastSeen(device.lastSeen)}</span>
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {onInitiateMerge && (
              <button
                type="button"
                onClick={() => onInitiateMerge(device)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg transition-colors cursor-pointer"
                title="Fusionner cet équipement avec un autre"
              >
                <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Fusionner</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Confirmer la suppression définitive de l'équipement "${device.name}" (${device.ip}) de l'inventaire ?`)) {
                    onDelete(device.id);
                  }
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 rounded-lg transition-colors cursor-pointer"
                title="Supprimer cet équipement de l'inventaire"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Supprimer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(device)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Éditer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
