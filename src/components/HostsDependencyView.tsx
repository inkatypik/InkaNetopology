import React, { useState } from 'react';
import type { Device } from '../types/network';
import { Server, Cpu, Box, ArrowRightLeft, Plus, ExternalLink, Activity, Trash2, Unlink } from 'lucide-react';
import { getDeviceDefaultIcon } from '../utils/hardwareIcons';

interface HostsDependencyViewProps {
  devices: Device[];
  onUpdateDeviceParent: (deviceId: string, newParentId: string | undefined) => void;
  onEditDevice: (device: Device) => void;
  onOpenAddModal: (presetParentId?: string, presetType?: 'vm' | 'docker') => void;
  onPingDevice: (device: Device) => void;
}

export const HostsDependencyView: React.FC<HostsDependencyViewProps> = ({
  devices,
  onUpdateDeviceParent,
  onEditDevice,
  onOpenAddModal,
  onPingDevice
}) => {
  const [selectedChildForMove, setSelectedChildForMove] = useState<Device | null>(null);

  // Identify physical hosts (servers, workstations, or physical machines capable of hosting)
  const physicalHosts = devices.filter(
    (d) => d.deviceType === 'physical' && (d.subType === 'server' || d.subType === 'workstation' || d.subType === 'nas')
  );

  // Group VMs and Containers by parentHostId
  const getChildrenForHost = (hostId: string) => {
    return devices.filter((d) => d.parentHostId === hostId);
  };

  // Find orphaned VMs or Docker containers (those without parentHostId)
  const orphanedVirtualDevices = devices.filter(
    (d) => (d.deviceType === 'vm' || d.deviceType === 'docker') && !d.parentHostId
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Intro & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Gestion des Dépendances & Hôtes de Virtualisation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualisez et modifiez dynamiquement le rattachement des machines virtuelles (VM) et conteneurs Docker à leurs hôtes physiques respectifs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenAddModal(undefined, 'vm')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-700/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Nouvelle VM</span>
          </button>
          <button
            onClick={() => onOpenAddModal(undefined, 'docker')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-700/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <Box className="w-3.5 h-3.5" />
            <span>Nouveau Conteneur</span>
          </button>
        </div>
      </div>

      {/* Grid of Physical Hosts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {physicalHosts.map((host) => {
          const children = getChildrenForHost(host.id);
          const vms = children.filter((c) => c.deviceType === 'vm');
          const containers = children.filter((c) => c.deviceType === 'docker');

          return (
            <div
              key={host.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-lg backdrop-blur-xs flex flex-col justify-between"
            >
              {/* Host Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span>{host.name}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400 mt-0.5">
                        <span>{host.ip}</span>
                        <span>·</span>
                        <span>{host.mac}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onPingDevice(host)}
                      title="Tester RTT / Ping"
                      className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-md transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditDevice(host)}
                      title="Éditer les propriétés de l'hôte"
                      className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Host Hardware specs */}
                <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                  <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Système d'Exploitation</span>
                    <span className="text-slate-200 font-medium truncate block">{host.os || 'Linux'}</span>
                  </div>
                  <div className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Localisation Rack</span>
                    <span className="text-slate-200 font-medium truncate block">{host.location || 'Baie centrale'}</span>
                  </div>
                </div>

                {/* Section: Virtual Machines */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Machines Virtuelles hébergées ({vms.length})</span>
                    </span>
                    <button
                      onClick={() => onOpenAddModal(host.id, 'vm')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter VM</span>
                    </button>
                  </div>

                  {vms.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg">
                      Aucune machine virtuelle rattachée à cet hôte.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {vms.map((vm) => (
                        <div
                          key={vm.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-indigo-900/40 rounded-lg hover:border-indigo-700/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                              {getDeviceDefaultIcon(vm.subType, vm.deviceType)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200">{vm.name}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                {vm.ip} · {vm.os || 'Debian'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Reassign / Move dropdown */}
                            <select
                              aria-label={`Rattacher ${vm.name} à un autre hôte`}
                              value={vm.parentHostId || ''}
                              onChange={(e) => onUpdateDeviceParent(vm.id, e.target.value || undefined)}
                              className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 focus:outline-hidden"
                            >
                              <option value="">(Détacher)</option>
                              {physicalHosts.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => onEditDevice(vm)}
                              title="Inspecter / Modifier"
                              className="p-1 text-slate-400 hover:text-slate-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Docker Containers */}
                <div className="space-y-2 mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5" />
                      <span>Conteneurs Docker hébergés ({containers.length})</span>
                    </span>
                    <button
                      onClick={() => onOpenAddModal(host.id, 'docker')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter Conteneur</span>
                    </button>
                  </div>

                  {containers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg">
                      Aucun conteneur Docker rattaché à cet hôte.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {containers.map((ct) => (
                        <div
                          key={ct.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-cyan-900/40 rounded-lg hover:border-cyan-700/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                              {getDeviceDefaultIcon(ct.subType, ct.deviceType)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200">{ct.name}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                {ct.portOrInterface || ct.ip}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Rattacher ${ct.name} à un autre hôte`}
                              value={ct.parentHostId || ''}
                              onChange={(e) => onUpdateDeviceParent(ct.id, e.target.value || undefined)}
                              className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 focus:outline-hidden"
                            >
                              <option value="">(Détacher)</option>
                              {physicalHosts.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => onEditDevice(ct)}
                              title="Inspecter / Modifier"
                              className="p-1 text-slate-400 hover:text-slate-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Host footer summary */}
              <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Total charges virtuelles:</span>
                <span className="font-mono tabular-nums text-slate-200 font-semibold">
                  {vms.length} VMs · {containers.length} Conteneurs
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Orphaned Virtual Devices Section (if any) */}
      {orphanedVirtualDevices.length > 0 && (
        <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
            <Unlink className="w-4 h-4" />
            <span>Machines ou Conteneurs orphelins (sans hôte physique attitré)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {orphanedVirtualDevices.map((dev) => (
              <div
                key={dev.id}
                className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">{dev.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">{dev.ip}</div>
                </div>

                <select
                  aria-label={`Rattacher l'orphelin ${dev.name} à un hôte`}
                  value=""
                  onChange={(e) => onUpdateDeviceParent(dev.id, e.target.value)}
                  className="text-xs bg-slate-900 border border-cyan-800 text-cyan-300 rounded px-2 py-1"
                >
                  <option value="" disabled>
                    Rattacher à...
                  </option>
                  {physicalHosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
