import React, { useState, useMemo } from 'react';
import type { Device, GeographicZone, DeviceTypeDefinition, DeviceSubTypeDefinition } from '../types/network';
import { getDeviceDefaultIcon, getDeviceTypeColor, resolveServiceIcon } from '../utils/hardwareIcons';
import { Activity, Edit3, Trash2, Link2, ExternalLink, MapPin, ArrowUpDown, ArrowUp, ArrowDown, GitMerge } from 'lucide-react';
import { DeviceSummaryCard } from './DeviceSummaryCard';

interface DeviceInventoryTableProps {
  devices: Device[];
  allDevices?: Device[];
  zones?: GeographicZone[];
  types?: DeviceTypeDefinition[];
  subTypes?: DeviceSubTypeDefinition[];
  selectedDevice?: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onDeleteDevice: (id: string) => void;
  onMergeDuplicates?: () => void;
  onMergeContainers?: () => void;
}

type SortColumn = 'name' | 'ip' | 'vendor' | 'parent' | 'ports' | 'location' | 'status';
type SortDirection = 'asc' | 'desc';

// Helper to convert IPv4 string to numerical integer for accurate ordering (e.g. 192.168.1.2 before 192.168.1.10)
function ipToNumber(ip: string): number {
  if (!ip) return 0;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => {
    const num = parseInt(octet, 10);
    return isNaN(num) ? 0 : (acc << 8) + num;
  }, 0) >>> 0;
}

export const DeviceInventoryTable: React.FC<DeviceInventoryTableProps> = ({
  devices,
  allDevices,
  zones = [],
  types = [],
  subTypes = [],
  selectedDevice,
  onSelectDevice,
  onEditDevice,
  onPingDevice,
  onDeleteDevice,
  onMergeDuplicates,
  onMergeContainers
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('ip');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const deviceMap = useMemo(() => {
    const map = new Map<string, Device>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  const zoneMap = useMemo(() => {
    const map = new Map<string, GeographicZone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    const list = [...devices];
    return list.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
          if (comparison === 0) {
            comparison = a.deviceType.localeCompare(b.deviceType);
          }
          break;

        case 'ip': {
          const numA = ipToNumber(a.ip);
          const numB = ipToNumber(b.ip);
          if (numA !== 0 && numB !== 0) {
            comparison = numA - numB;
          } else if (numA !== 0) {
            comparison = -1;
          } else if (numB !== 0) {
            comparison = 1;
          } else {
            comparison = (a.ip || '').localeCompare(b.ip || '');
          }
          break;
        }

        case 'vendor': {
          const vA = a.vendor || '';
          const vB = b.vendor || '';
          comparison = vA.localeCompare(vB, 'fr', { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = (a.os || '').localeCompare(b.os || '');
          }
          break;
        }

        case 'parent': {
          const parentA = a.parentHostId ? deviceMap.get(a.parentHostId)?.name || '' : (a.connectedToSwitchId ? deviceMap.get(a.connectedToSwitchId)?.name || '' : '');
          const parentB = b.parentHostId ? deviceMap.get(b.parentHostId)?.name || '' : (b.connectedToSwitchId ? deviceMap.get(b.connectedToSwitchId)?.name || '' : '');
          comparison = parentA.localeCompare(parentB, 'fr', { sensitivity: 'base' });
          break;
        }

        case 'ports': {
          const countA = a.openPorts?.length || 0;
          const countB = b.openPorts?.length || 0;
          comparison = countA - countB;
          break;
        }

        case 'location': {
          const locA = a.zoneId ? zoneMap.get(a.zoneId)?.name || a.location || '' : a.location || '';
          const locB = b.zoneId ? zoneMap.get(b.zoneId)?.name || b.location || '' : b.location || '';
          comparison = locA.localeCompare(locB, 'fr', { sensitivity: 'base' });
          break;
        }

        case 'status': {
          // 'online' first, then RTT
          const statusOrder: Record<string, number> = { online: 0, warning: 1, offline: 2 };
          const sA = statusOrder[a.status] ?? 3;
          const sB = statusOrder[b.status] ?? 3;
          if (sA !== sB) {
            comparison = sA - sB;
          } else {
            const rttA = a.latencyMs ?? 9999;
            const rttB = b.latencyMs ?? 9999;
            comparison = rttA - rttB;
          }
          break;
        }

        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [devices, sortColumn, sortDirection, deviceMap, zoneMap]);

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  const mergedCount = useMemo(
    () => devices.filter((d) => d.metadata?.['Statut fusion']).length,
    [devices]
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl backdrop-blur-xs">
        {/* Inventory Summary & Container Fusion Action Bar */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-slate-200">Inventaire Réseau</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
              {devices.length} équipement{devices.length > 1 ? 's' : ''}
            </span>
            {mergedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-medium text-[11px] flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{mergedCount} équipement{mergedCount > 1 ? 's' : ''} fusionné{mergedCount > 1 ? 's' : ''} sans doublon</span>
              </span>
            )}
          </div>

          {(onMergeDuplicates || onMergeContainers) && (
            <button
              type="button"
              onClick={onMergeDuplicates || onMergeContainers}
              title="Détecter et fusionner intelligemment les doublons sur tous les équipements (adresses MAC, IP, noms d'hôtes, ports, services et conteneurs)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/60 rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs ml-auto"
            >
              <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Fusionner les doublons</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 select-none">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Nom et Type d'équipement"
                  >
                    <span>Équipement & Type</span>
                    {renderSortIcon('name')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('ip')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Adresse IP numérique"
                  >
                    <span>Adresse IP & MAC</span>
                    {renderSortIcon('ip')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('vendor')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Fabricant et Modèle"
                  >
                    <span>Fabricant / Modèle</span>
                    {renderSortIcon('vendor')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('parent')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Hôte parent ou Switch"
                  >
                    <span>Rattachement</span>
                    {renderSortIcon('parent')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('ports')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Nombre de ports ouverts"
                  >
                    <span>Ports & Services</span>
                    {renderSortIcon('ports')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('location')}
                    className="group flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer text-left font-semibold"
                    title="Trier par Zone géographique et Emplacement"
                  >
                    <span>Emplacement & Tags</span>
                    {renderSortIcon('location')}
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="group inline-flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer font-semibold ml-auto"
                    title="Trier par Statut (En ligne / Hors ligne) et RTT"
                  >
                    <span>Statut & RTT</span>
                    {renderSortIcon('status')}
                  </button>
                </th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {sortedDevices.length === 0 ? (
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
                sortedDevices.map((device) => {
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
                          {(() => {
                            const iconUrl = device.customImage || device.serviceIcon || resolveServiceIcon(device);
                            if (iconUrl) {
                              return (
                                <img
                                  src={iconUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-md object-contain p-0.5 border border-slate-700 bg-slate-900 shadow-xs"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              );
                            }
                            return (
                              <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">
                                {getDeviceDefaultIcon(device.subType, device.deviceType)}
                              </div>
                            );
                          })()}
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditDevice(device);
                              }}
                              title="Cliquer pour éditer la fiche complète de cet équipement"
                              className="group/name flex items-center gap-1.5 font-semibold text-slate-100 hover:text-cyan-400 transition-colors text-left cursor-pointer"
                            >
                              <span className="group-hover/name:underline underline-offset-2">{device.name}</span>
                              <Edit3 className="w-3 h-3 text-slate-500 opacity-60 group-hover/name:opacity-100 group-hover/name:text-cyan-400 transition-all shrink-0" />
                            </button>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[10px] text-slate-400 capitalize">
                                {device.deviceType} · {device.subType.replace('_', ' ')}
                              </span>
                              {device.metadata?.['Statut fusion'] && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-950/80 border border-cyan-600/60 text-cyan-300 shadow-xs"
                                  title={device.metadata['Détail fusion'] || 'Conteneur consolidé (Hôte + Conteneur)'}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                  <span>Fusionné</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP & MAC (Displays both Container IP and Host IP clearly when consolidated) */}
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <div className="text-slate-200 flex items-center gap-1.5">
                          <span>{device.ip}</span>
                          {device.metadata?.['IP Conteneur'] && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                              Conteneur
                            </span>
                          )}
                        </div>

                        {device.metadata?.['IP Hôte'] && device.metadata['IP Hôte'] !== device.ip && (
                          <div
                            className="text-[10px] text-cyan-300 font-medium flex items-center gap-1 mt-0.5"
                            title="Adresse IP de la machine hôte"
                          >
                            <span className="text-slate-500 font-sans">Hôte:</span>
                            <span className="text-cyan-300 underline decoration-cyan-500/30 underline-offset-2">
                              {device.metadata['IP Hôte']}
                            </span>
                          </div>
                        )}

                        {device.metadata?.['Adresses IP associées'] && (
                          <div
                            className="text-[10px] text-amber-300/90 font-medium flex items-center gap-1 mt-0.5 truncate max-w-[150px]"
                            title={`Historique / adresses IP associées : ${device.metadata['Adresses IP associées']}`}
                          >
                            <span className="text-slate-500 font-sans">IPs:</span>
                            <span className="truncate">{device.metadata['Adresses IP associées']}</span>
                          </div>
                        )}

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
                        {device.metadata?.['Ports exposés'] && (
                          <div
                            className="text-[9px] text-cyan-400/80 mt-0.5 truncate max-w-[140px]"
                            title={`Ports consolidés: ${device.metadata['Ports exposés']}`}
                          >
                            Exp: {device.metadata['Ports exposés']}
                          </div>
                        )}
                      </td>

                      {/* Location & Tags */}
                      <td className="py-3 px-4">
                        {device.zoneId && zoneMap.has(device.zoneId) ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-200 mb-0.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: zoneMap.get(device.zoneId)?.color || '#0ea5e9' }}
                            />
                            <span className="truncate max-w-[130px]" title={zoneMap.get(device.zoneId)?.name}>
                              {zoneMap.get(device.zoneId)?.name}
                            </span>
                          </div>
                        ) : (
                          <div className="text-slate-300 text-[11px] truncate max-w-[130px]">
                            {device.location || 'Non assigné'}
                          </div>
                        )}
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
                        {device.lastSeen && (
                          <div
                            className="text-[10px] text-slate-500 font-sans"
                            title={`Dernière détection: ${new Date(device.lastSeen).toLocaleString()}`}
                          >
                            {(() => {
                              const diffSec = Math.max(0, Math.round((Date.now() - new Date(device.lastSeen).getTime()) / 1000));
                              if (diffSec < 60) return 'Vu à l\'instant';
                              const diffMin = Math.round(diffSec / 60);
                              if (diffMin < 60) return `Vu il y a ${diffMin} min`;
                              const diffH = Math.round(diffMin / 60);
                              if (diffH < 24) return `Vu il y a ${diffH}h`;
                              const diffD = Math.round(diffH / 24);
                              return `Vu il y a ${diffD}j`;
                            })()}
                          </div>
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

      {/* Fiche Équipement standardisée avec accès direct à l'édition */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-150 shadow-2xl">
            <DeviceSummaryCard
              device={selectedDevice}
              allDevices={allDevices || devices}
              zones={zones}
              types={types}
              subTypes={subTypes}
              onEdit={(dev) => {
                onSelectDevice(null);
                onEditDevice(dev);
              }}
              onPing={onPingDevice}
              onSelect={onSelectDevice}
              onClose={() => onSelectDevice(null)}
              className="border-cyan-500/60 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
