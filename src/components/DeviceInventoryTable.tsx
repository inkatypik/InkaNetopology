import React from 'react';
import type { Device } from '../types/network';
import { getDeviceDefaultIcon, getDeviceTypeColor } from '../utils/hardwareIcons';
import { Activity, Edit3, Trash2, Link2, ExternalLink } from 'lucide-react';

interface DeviceInventoryTableProps {
  devices: Device[];
  onSelectDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onDeleteDevice: (id: string) => void;
}

export const DeviceInventoryTable: React.FC<DeviceInventoryTableProps> = ({
  devices,
  onSelectDevice,
  onEditDevice,
  onPingDevice,
  onDeleteDevice
}) => {
  const deviceMap = new Map<string, Device>();
  devices.forEach((d) => deviceMap.set(d.id, d));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl backdrop-blur-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400">
                <th className="py-3 px-4">Équipement & Type</th>
                <th className="py-3 px-4">Adresse IP & MAC</th>
                <th className="py-3 px-4">Fabricant / Modèle</th>
                <th className="py-3 px-4">Rattachement</th>
                <th className="py-3 px-4">Ports & Services</th>
                <th className="py-3 px-4">Emplacement & Tags</th>
                <th className="py-3 px-4 text-right">Statut & RTT</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <Activity className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="text-sm font-semibold text-slate-200">
                        Inventaire vide (0 équipement)
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Aucun équipement n'est actuellement répertorié. Vous pouvez lancer un scan réseau automatique ou ajouter un équipement manuellement.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const typeStyle = getDeviceTypeColor(device.deviceType);
                  const parentHost = device.parentHostId
                    ? deviceMap.get(device.parentHostId)
                    : undefined;
                  const switchLink = device.connectedToSwitchId
                    ? deviceMap.get(device.connectedToSwitchId)
                    : undefined;

                  return (
                    <tr
                      key={device.id}
                      onClick={() => onSelectDevice(device)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* Name & Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {device.customImage ? (
                            <img
                              src={device.customImage}
                              alt=""
                              className="w-7 h-7 rounded-md object-cover border border-slate-700 bg-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                              {getDeviceDefaultIcon(device.subType, device.deviceType)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-200 hover:text-cyan-400 transition-colors">
                              {device.name}
                            </div>
                            <div className="text-[10px] text-slate-400 capitalize">
                              {device.deviceType} · {device.subType.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP & MAC */}
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <div className="text-slate-200">{device.ip}</div>
                        <div className="text-[11px] text-slate-500">{device.mac}</div>
                        {device.vlan && (
                          <div className="text-[10px] text-slate-400">VLAN {device.vlan}</div>
                        )}
                      </td>

                      {/* Vendor & OS */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium">{device.vendor}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {device.os || 'Non détecté'}
                        </div>
                      </td>

                      {/* Attachment (Host or Switch) */}
                      <td className="py-3 px-4">
                        {parentHost ? (
                          <div className="flex items-center gap-1.5 text-indigo-300">
                            <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[130px]" title={parentHost.name}>
                              {parentHost.name}
                            </span>
                          </div>
                        ) : switchLink ? (
                          <div className="text-slate-400 text-[11px]">
                            <span>{switchLink.name}</span>
                            {device.portOrInterface && (
                              <div className="text-[10px] text-slate-500">{device.portOrInterface}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Passerelle racine</span>
                        )}
                      </td>

                      {/* Open Ports */}
                      <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-400">
                        {device.openPorts && device.openPorts.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                            {device.openPorts.slice(0, 3).map((p) => (
                              <span
                                key={p}
                                className="px-1 py-0.5 bg-slate-800/80 rounded border border-slate-700/60 text-[10px]"
                              >
                                {p}
                              </span>
                            ))}
                            {device.openPorts.length > 3 && (
                              <span className="text-[10px] text-slate-500">
                                +{device.openPorts.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Location & Tags */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 text-[11px] truncate max-w-[130px]">
                          {device.location || 'Baie / Non renseigné'}
                        </div>
                        {device.tags && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                            {device.tags.join(' · ')}
                          </div>
                        )}
                      </td>

                      {/* Status & Latency */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              device.status === 'online' ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-slate-200">
                            {device.status === 'online' ? 'En ligne' : 'Hors ligne'}
                          </span>
                        </div>
                        {device.latencyMs !== undefined && (
                          <div className="text-[11px] text-slate-400">{device.latencyMs} ms</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPingDevice(device);
                            }}
                            title="Diagnostiquer / Ping"
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditDevice(device);
                            }}
                            title="Modifier les métadonnées"
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDevice(device.id);
                            }}
                            title="Supprimer l'équipement"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
