import React, { useState, useEffect } from 'react';
import type { Device, DeviceType } from '../types/network';
import { X, Save, Link2, Server, Network, Tag, Box, Cpu, Radio, Shield } from 'lucide-react';
import { getDeviceDefaultIcon } from '../utils/hardwareIcons';

interface QuickLinkModalProps {
  device: Device | null;
  allDevices: Device[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Device) => void;
}

export const QuickLinkModal: React.FC<QuickLinkModalProps> = ({
  device,
  allDevices,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen || !device) return null;

  const [deviceType, setDeviceType] = useState<DeviceType>(device.deviceType);
  const [parentHostId, setParentHostId] = useState<string>(device.parentHostId || '');
  const [connectedToSwitchId, setConnectedToSwitchId] = useState<string>(device.connectedToSwitchId || '');
  const [portOrInterface, setPortOrInterface] = useState<string>(device.portOrInterface || '');
  const [vlan, setVlan] = useState<number>(device.vlan || 1);

  // Sync state whenever active device changes
  useEffect(() => {
    setDeviceType(device.deviceType);
    setParentHostId(device.parentHostId || '');
    setConnectedToSwitchId(device.connectedToSwitchId || '');
    setPortOrInterface(device.portOrInterface || '');
    setVlan(device.vlan || 1);
  }, [device]);

  // Candidate physical hosts (hypervisors, servers, NAS)
  const candidateHosts = allDevices.filter(
    (d) =>
      d.id !== device.id &&
      (d.deviceType === 'physical' || d.subType === 'server' || d.subType === 'nas' || d.subType === 'vm') &&
      d.deviceType !== 'docker'
  );

  // Candidate switches / routers
  const candidateSwitches = allDevices.filter(
    (d) => d.id !== device.id && (d.subType === 'switch' || d.subType === 'router' || d.subType === 'access_point' || d.deviceType === 'physical')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Device = {
      ...device,
      deviceType,
      parentHostId: parentHostId.trim() ? parentHostId : undefined,
      connectedToSwitchId: connectedToSwitchId.trim() ? connectedToSwitchId : undefined,
      portOrInterface: portOrInterface.trim() ? portOrInterface : undefined,
      vlan: vlan || 1
    };
    onSave(updated);
    onClose();
  };

  const interfacePresets = [
    'eth0',
    'eth1',
    'docker0',
    'veth-docker',
    'Port 1 (Giga)',
    'Port 4 (PoE)',
    'Port 12 (Trunk)',
    'Port 24 (Uplink)',
    'Wi-Fi 5GHz',
    'SFP+ 10G'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Modifier l'organisation & les liaisons
              </h3>
              <p className="text-xs text-slate-400">
                {device.name} · <span className="font-mono text-cyan-400">{device.ip}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Device Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Type d'équipement & rôle dans l'organisation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'physical' as DeviceType, label: 'Physique', icon: Server, desc: 'Serveur / Hôte' },
                { type: 'vm' as DeviceType, label: 'Virtuelle', icon: Box, desc: 'Machine VM' },
                { type: 'docker' as DeviceType, label: 'Docker', icon: Cpu, desc: 'Conteneur' },
                { type: 'iot' as DeviceType, label: 'IoT', icon: Radio, desc: 'Objet / WiFi' }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = deviceType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setDeviceType(item.type)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/70 border-cyan-400 ring-1 ring-cyan-400 text-white shadow-md'
                        : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parent Host Selector (Virtualization & Docker binding) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" />
                <span>Rattachement à un Hôte (Hyperviseur / Serveur Docker)</span>
              </label>
              <span className="text-[10px] text-slate-400">Pour VM & Conteneurs</span>
            </div>
            <select
              value={parentHostId}
              onChange={(e) => setParentHostId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-cyan-400"
            >
              <option value="">-- Aucun hôte (Machine indépendante / Serveur autonome) --</option>
              {candidateHosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.ip}) - {h.vendor} [{h.deviceType}]
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              Détermine dans quel groupe visuel l'équipement sera regroupé et relié en pointillé sur le schéma.
            </p>
          </div>

          {/* Switch Connection Selector */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5" />
                <span>Connexion Switch / Routeur Réseau</span>
              </label>
              <span className="text-[10px] text-slate-400">Liaison physique</span>
            </div>
            <select
              value={connectedToSwitchId}
              onChange={(e) => setConnectedToSwitchId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-sky-400"
            >
              <option value="">-- Liaison par défaut (Passerelle / Switch principal) --</option>
              {candidateSwitches.map((sw) => (
                <option key={sw.id} value={sw.id}>
                  {sw.name} ({sw.ip}) - {sw.vendor}
                </option>
              ))}
            </select>
          </div>

          {/* Port / Interface & VLAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Port ou interface réseau
              </label>
              <input
                type="text"
                value={portOrInterface}
                onChange={(e) => setPortOrInterface(e.target.value)}
                placeholder="ex: Port 4, eth0, docker0"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-cyan-400 font-mono"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {interfacePresets.slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPortOrInterface(p)}
                    className="px-1.5 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 cursor-pointer font-mono"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                VLAN réseau
              </label>
              <input
                type="number"
                min="1"
                max="4094"
                value={vlan}
                onChange={(e) => setVlan(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-cyan-400 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-2">
                Identifiant VLAN IEEE 802.1Q (1 à 4094).
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer la liaison</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
