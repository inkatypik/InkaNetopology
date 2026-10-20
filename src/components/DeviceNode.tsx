import React from 'react';
import type { Device } from '../types/network';
import { getDeviceDefaultIcon, getDeviceTypeColor } from '../utils/hardwareIcons';
import { Activity, Edit3, Link2, MoreHorizontal, Radio } from 'lucide-react';

interface DeviceNodeProps {
  device: Device;
  parentDevice?: Device;
  isSelected: boolean;
  onSelect: (device: Device) => void;
  onEdit: (device: Device) => void;
  onPing: (device: Device) => void;
  isDragging?: boolean;
}

export const DeviceNode: React.FC<DeviceNodeProps> = ({
  device,
  parentDevice,
  isSelected,
  onSelect,
  onEdit,
  onPing,
  isDragging
}) => {
  const typeStyle = getDeviceTypeColor(device.deviceType);
  const isOnline = device.status === 'online';

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
          ? 'ring-2 ring-cyan-400 border-cyan-400 scale-[1.02] z-30'
          : `${typeStyle.border} hover:shadow-cyan-950/20 z-10`
      } ${isDragging ? 'opacity-85 shadow-2xl' : ''}`}
    >
      {/* Upper header: Icon / Custom Image + Status + Device Type */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          {device.customImage ? (
            <img
              src={device.customImage}
              alt={device.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-700 bg-slate-800"
              onError={(e) => {
                // fallback if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
              {getDeviceDefaultIcon(device.subType, device.deviceType)}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-100 truncate max-w-[130px]" title={device.name}>
              {device.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400">
              <span>{device.ip}</span>
              <span className="text-slate-600">·</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPing(device);
            }}
            title="Tester la connectivité (Ping / Diagnostic)"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            title="Éditer l'équipement et ses relations"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Virtualization or Network Parent Attachment Info */}
      {parentDevice && (
        <div className="mb-2 px-2 py-1 bg-slate-950/70 border border-slate-800 rounded-md flex items-center gap-1.5 text-[10px] text-slate-300">
          <Link2 className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="text-slate-400">Hôte:</span>
          <span className="font-medium text-slate-200 truncate">{parentDevice.name}</span>
        </div>
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
            <span className="text-slate-300 font-mono text-[10px] truncate max-w-[120px]">
              {device.portOrInterface}
            </span>
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
    </div>
  );
};
