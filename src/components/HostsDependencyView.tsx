import React, { useState } from 'react';
import type { Device, GeographicZone, DeviceTypeDefinition, DeviceSubTypeDefinition } from '../types/network';
import { Server, Cpu, Box, Plus, Edit3, Activity, Unlink, ExternalLink, MapPin } from 'lucide-react';
import { getDeviceDefaultIcon, getDeviceTypeColor, resolveServiceIcon } from '../utils/hardwareIcons';
import { DeviceSummaryCard } from './DeviceSummaryCard';

interface HostsDependencyViewProps {
  devices: Device[];
  zones?: GeographicZone[];
  types?: DeviceTypeDefinition[];
  subTypes?: DeviceSubTypeDefinition[];
  onUpdateDeviceParent: (deviceId: string, newParentId: string | undefined) => void;
  onEditDevice: (device: Device) => void;
  onOpenAddModal: (presetParentId?: string, presetType?: 'vm' | 'docker') => void;
  onPingDevice: (device: Device) => void;
}

export const HostsDependencyView: React.FC<HostsDependencyViewProps> = ({
  devices,
  zones = [],
  types = [],
  subTypes = [],
  onUpdateDeviceParent,
  onEditDevice,
  onOpenAddModal,
  onPingDevice
}) => {
  // Identify hosts capable of running VMs or Docker containers (physical servers/workstations/NAS or VMs running Docker)
  const physicalHosts = devices.filter(
    (d) =>
      (d.deviceType === 'physical' && (d.subType === 'server' || d.subType === 'workstation' || d.subType === 'nas')) ||
      (d.deviceType === 'vm')
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
            type="button"
            onClick={() => onOpenAddModal(undefined, 'vm')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-700/60 rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Nouvelle VM</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAddModal(undefined, 'docker')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-700/60 rounded-lg transition-all active:scale-95 shadow-xs cursor-pointer whitespace-nowrap"
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
              <div>
                {/* Standardized Host Profile Card Header */}
                <DeviceSummaryCard
                  device={host}
                  allDevices={devices}
                  zones={zones}
                  types={types}
                  subTypes={subTypes}
                  onEdit={onEditDevice}
                  onPing={onPingDevice}
                  className="mb-4"
                />

                {/* Section: Virtual Machines */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/80">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Machines Virtuelles hébergées ({vms.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddModal(host.id, 'vm')}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter VM</span>
                    </button>
                  </div>

                  {vms.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-lg">
                      Aucune machine virtuelle hébergée sur cet hôte.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {vms.map((vm) => {
                        const vmIcon = vm.customImage || vm.serviceIcon || resolveServiceIcon(vm);
                        return (
                          <div
                            key={vm.id}
                            className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-indigo-900/40 rounded-lg hover:border-indigo-700/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center shrink-0 p-1">
                                {vmIcon ? (
                                  <img
                                    src={vmIcon}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  getDeviceDefaultIcon(vm.subType, vm.deviceType, subTypes, types)
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                                  <span>{vm.name}</span>
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      vm.status === 'online' ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`}
                                  />
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                  {vm.ip} · {vm.os || 'Linux / Windows'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                aria-label={`Rattacher ${vm.name} à un autre hôte`}
                                value={vm.parentHostId || ''}
                                onChange={(e) => onUpdateDeviceParent(vm.id, e.target.value || undefined)}
                                className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 focus:outline-hidden cursor-pointer"
                              >
                                <option value="">(Détacher)</option>
                                {physicalHosts.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => onEditDevice(vm)}
                                title="Éditer la fiche équipement de cette VM"
                                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 rounded transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Éditer</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section: Docker Containers */}
                <div className="space-y-2 mt-5">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/80">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5" />
                      <span>Conteneurs Docker hébergés ({containers.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddModal(host.id, 'docker')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
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
                      {containers.map((ct) => {
                        const ctIcon = ct.customImage || ct.serviceIcon || resolveServiceIcon(ct);
                        return (
                          <div
                            key={ct.id}
                            className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-cyan-900/40 rounded-lg hover:border-cyan-700/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center shrink-0 p-1">
                                {ctIcon ? (
                                  <img
                                    src={ctIcon}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  getDeviceDefaultIcon(ct.subType, ct.deviceType, subTypes, types)
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                                  <span>{ct.name}</span>
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      ct.status === 'online' ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`}
                                  />
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-400 truncate">
                                  {ct.portOrInterface || ct.ip}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <select
                                aria-label={`Rattacher ${ct.name} à un autre hôte`}
                                value={ct.parentHostId || ''}
                                onChange={(e) => onUpdateDeviceParent(ct.id, e.target.value || undefined)}
                                className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 focus:outline-hidden cursor-pointer"
                              >
                                <option value="">(Détacher)</option>
                                {physicalHosts.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => onEditDevice(ct)}
                                title="Éditer la fiche équipement de ce conteneur"
                                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/60 rounded transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Éditer</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
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

                <div className="flex items-center gap-1.5">
                  <select
                    aria-label={`Rattacher l'orphelin ${dev.name} à un hôte`}
                    value=""
                    onChange={(e) => onUpdateDeviceParent(dev.id, e.target.value)}
                    className="text-xs bg-slate-900 border border-cyan-800 text-cyan-300 rounded px-2 py-1 cursor-pointer"
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

                  <button
                    type="button"
                    onClick={() => onEditDevice(dev)}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="Éditer la fiche"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
