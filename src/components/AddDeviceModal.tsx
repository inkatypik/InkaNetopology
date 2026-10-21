import React, { useState, useEffect } from 'react';
import type { Device, DeviceSubType, DeviceType } from '../types/network';
import { X, Plus, Server, Cpu, Box, Radio } from 'lucide-react';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newDevice: Partial<Device>) => void;
  allDevices: Device[];
  presetParentId?: string;
  presetType?: DeviceType;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  allDevices,
  presetParentId,
  presetType
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [mac, setMac] = useState('');
  const [vendor, setVendor] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>(presetType || 'physical');
  const [subType, setSubType] = useState<DeviceSubType>('server');
  const [parentHostId, setParentHostId] = useState<string>(presetParentId || '');
  const [portOrInterface, setPortOrInterface] = useState('');
  const [vlan, setVlan] = useState(1);
  const [os, setOs] = useState('');
  const [location, setLocation] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (presetType) {
      setDeviceType(presetType);
      if (presetType === 'docker') setSubType('container');
      if (presetType === 'vm') setSubType('vm');
    }
    if (presetParentId) {
      setParentHostId(presetParentId);
    }
  }, [presetType, presetParentId]);

  const candidateHosts = allDevices.filter((d) => d.deviceType === 'physical');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rootSwitchOrRouter =
      allDevices.find((d) => d.subType === 'switch') ||
      allDevices.find((d) => d.subType === 'router') ||
      allDevices[0];

    onAdd({
      name,
      ip,
      mac: mac || '02:00:00:' + Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':'),
      vendor: vendor || (deviceType === 'docker' ? 'Docker Inc.' : deviceType === 'vm' ? 'QEMU / KVM' : 'Générique'),
      deviceType,
      subType,
      status: 'online',
      parentHostId: parentHostId || undefined,
      connectedToSwitchId: (deviceType === 'physical' || deviceType === 'iot') && rootSwitchOrRouter ? rootSwitchOrRouter.id : undefined,
      portOrInterface: portOrInterface || undefined,
      vlan,
      os: os || undefined,
      location: location || undefined,
      tags,
      metadata: {}
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Ajouter un Équipement Réseau</h3>
              <p className="text-[11px] text-slate-400">
                Définissez les caractéristiques physiques ou virtuelles du nœud.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Nom de l'équipement *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Serveur Backup, VM-Web, Cam-Garage"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Adresse IP *</label>
              <input
                type="text"
                required
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="Ex: 192.168.1.80"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono tabular-nums text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Type d'Équipement</label>
              <select
                value={deviceType}
                onChange={(e) => {
                  const val = e.target.value as DeviceType;
                  setDeviceType(val);
                  if (val === 'docker') setSubType('container');
                  if (val === 'vm') setSubType('vm');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="physical">Machine Physique</option>
                <option value="vm">Machine Virtuelle (VM)</option>
                <option value="docker">Conteneur Docker</option>
                <option value="iot">Périphérique IoT</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Sous-Type / Rôle</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value as DeviceSubType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="server">Serveur</option>
                <option value="switch">Switch</option>
                <option value="router">Routeur / Passerelle</option>
                <option value="nas">NAS</option>
                <option value="vm">Machine Virtuelle</option>
                <option value="container">Conteneur Docker</option>
                <option value="camera">Caméra IP</option>
                <option value="sensor_presence">Capteur de Présence</option>
                <option value="sensor_temp">Sonde de Température</option>
                <option value="smart_plug">Prise Connectée</option>
                <option value="workstation">Station de travail</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {(deviceType === 'vm' || deviceType === 'docker') && (
            <div className="p-3 bg-slate-950/80 border border-cyan-900/50 rounded-xl space-y-2">
              <label className="block text-cyan-300 font-medium">
                Rattacher à un hôte physique d'exécution
              </label>
              <select
                value={parentHostId}
                onChange={(e) => setParentHostId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
              >
                <option value="">(Aucun pour l'instant)</option>
                {candidateHosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.ip})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Fabricant</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Ex: Ubiquiti, Dell, Synology, ESP32"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Système d'exploitation</label>
              <input
                type="text"
                value={os}
                onChange={(e) => setOs(e.target.value)}
                placeholder="Ex: Debian 12, Alpine, DSM"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">VLAN</label>
              <input
                type="number"
                value={vlan}
                onChange={(e) => setVlan(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Emplacement</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Baie Rack U5, Salon"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Production, Critique, IoT, DMZ"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium"
            >
              Ajouter à la topologie
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
