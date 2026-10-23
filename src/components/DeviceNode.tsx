import React from 'react';
import type { Device, GeographicZone } from '../types/network';
import { getDeviceDefaultIcon, getDeviceTypeColor } from '../utils/hardwareIcons';
import { Activity, Edit3, Link2, ChevronDown, ChevronRight, Layers, MapPin, Star } from 'lucide-react';

interface DeviceNodeProps {
  device: Device;
  parentDevice?: Device;
  zone?: GeographicZone;
  isCore?: boolean;
  isSelected: boolean;
  onSelect: (device: Device) => void;
  onEdit: (device: Device) => void;
  onPing: (device: Device) => void;
  onQuickLink?: (device: Device) => void;
  isDragging?: boolean;
  childCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: (hostId: string) => void;
}

export const DeviceNode: React.FC<DeviceNodeProps> = ({
  device,
  parentDevice,
  zone,
  isCore,
  isSelected,
  onSelect,
  onEdit,
  onPing,
  onQuickLink,
  isDragging,
  childCount = 0,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const typeStyle = getDeviceTypeColor(device.deviceType);
  const isOnline = device.status === 'online';
  const hasChildren = childCount > 0;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(device);
      }}
      className={`relative w-64 rounded-xl border p-3.5 select-none transition-all duration-200 cursor-move backdrop-blur-md shadow-lg ${
        typeStyle.bg
      } ${
        isSelected
          ? 'ring-2 ring-cyan-400 border-cyan-400 scale-[1.02] z-30 shadow-cyan-900/30'
          : isCore
          ? 'ring-2 ring-amber-400/60 border-amber-500/80 shadow-amber-950/30 z-20'
          : `${typeStyle.border} hover:shadow-cyan-950/20 z-10`
      } ${isDragging ? 'opacity-85 shadow-2xl scale-[1.03]' : ''}`}
    >
      {/* Cœur de réseau Badge */}
      {isCore && (
        <div className="mb-2 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-200 text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-xs">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
          <span>★ Cœur de Réseau (Centre Étoile)</span>
        </div>
      )}
      {/* Upper header: Icon / Custom Image + Status + Device Type */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {device.customImage ? (
            <img
              src={device.customImage}
              alt={device.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-700 bg-slate-800 shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
              {getDeviceDefaultIcon(device.subType, device.deviceType)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Equipment Name is directly clickable to open edit modal */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(device);
              }}
              title={`Cliquer pour éditer la fiche de "${device.name}"`}
              className="text-left group/title flex items-center gap-1.5 cursor-pointer max-w-full hover:opacity-100"
            >
              <h4 className="text-xs font-semibold text-slate-100 group-hover/title:text-cyan-300 group-hover/title:underline truncate max-w-[150px] transition-colors">
                {device.name}
              </h4>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
              <span>{device.ip}</span>
              <span className="text-slate-600">·</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-rose-500'}`} />
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPing(device);
            }}
            title="Tester la connectivité (Ping / Diagnostic)"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onQuickLink) {
                onQuickLink(device);
              } else {
                onEdit(device);
              }
            }}
            title="Modifier l'organisation et les liaisons (Hôte, Switch, Interface)"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            title="Éditer la fiche complète de l'équipement"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Virtualization or Network Parent Attachment Info (Clickable for fast link edit) */}
      {parentDevice && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickLink) {
              onQuickLink(device);
            } else {
              onEdit(device);
            }
          }}
          title="Cliquer pour modifier le rattachement d'hôte"
          className="w-full mb-2 px-2 py-1 bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-cyan-800/80 rounded-md flex items-center justify-between text-[10px] text-slate-300 transition-colors cursor-pointer group/link"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Link2 className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-400">Hôte:</span>
            <span className="font-medium text-slate-200 group-hover/link:text-cyan-300 truncate">
              {parentDevice.name}
            </span>
          </div>
          <span className="text-[9px] text-cyan-400 font-mono opacity-0 group-hover/link:opacity-100 transition-opacity">
            Modifier
          </span>
        </button>
      )}

      {/* Hardware / Vendor & Interface Details */}
      <div className="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Fabricant:</span>
          <span className="text-slate-300 truncate max-w-[120px] font-medium">{device.vendor}</span>
        </div>

        {device.portOrInterface && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Liaison:</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickLink) {
                  onQuickLink(device);
                } else {
                  onEdit(device);
                }
              }}
              title="Cliquer pour modifier la liaison"
              className="text-slate-300 hover:text-cyan-300 font-mono text-[10px] truncate max-w-[120px] hover:underline cursor-pointer"
            >
              {device.portOrInterface}
            </button>
          </div>
        )}

        {device.latencyMs !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Latence:</span>
            <span className="font-mono tabular-nums text-slate-300 text-[10px]">
              {device.latencyMs} ms
            </span>
          </div>
        )}
      </div>

      {/* Geographic Zone Badge */}
      {zone && (
        <div className="mt-2 px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-[9px] text-slate-300">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: zone.color || '#0ea5e9' }}
            />
            <span className="truncate max-w-[170px] text-slate-300 font-medium">
              {zone.name}
            </span>
          </div>
          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-mono">
            {zone.type}
          </span>
        </div>
      )}

      {/* Dynamic Tags */}
      {device.tags && device.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {device.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="text-[9px] px-1.5 py-0.5 rounded-sm bg-slate-800/80 text-slate-300 border border-slate-700/50"
            >
              {tag}
            </span>
          ))}
          {device.tags.length > 3 && (
            <span className="text-[9px] text-slate-500 self-center">
              +{device.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expand / Collapse Control Pill for Host Nodes with Children */}
      {hasChildren && onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(device.id);
          }}
          title={isCollapsed ? `Déplier les ${childCount} conteneurs/VMs masqués` : `Replier les ${childCount} conteneurs/VMs`}
          className={`w-full mt-2.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium flex items-center justify-between transition-all cursor-pointer border shadow-xs ${
            isCollapsed
              ? 'bg-amber-950/40 border-amber-600/50 text-amber-200 hover:bg-amber-900/60'
              : 'bg-cyan-950/40 border-cyan-600/50 text-cyan-200 hover:bg-cyan-900/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="font-semibold">
              {isCollapsed ? `${childCount} machines masquées` : `${childCount} machines rattachées`}
            </span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700/60 font-mono">
            {isCollapsed ? 'Déplier ▾' : 'Replier ▴'}
          </span>
        </button>
      )}
    </div>
  );
};
