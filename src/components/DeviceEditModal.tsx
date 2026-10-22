import React, { useState } from 'react';
import type { Device, DeviceSubType, DeviceType, DeviceStatus } from '../types/network';
import { X, Save, Plus, Trash2, Link2, Image, Activity, Tag, Info, Cpu, Box, Server } from 'lucide-react';
import { PRESET_HARDWARE_IMAGES } from '../utils/hardwareIcons';

interface DeviceEditModalProps {
  device: Device;
  allDevices: Device[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Device) => void;
  onPing: (device: Device) => void;
}

export const DeviceEditModal: React.FC<DeviceEditModalProps> = ({
  device,
  allDevices,
  isOpen,
  onClose,
  onSave,
  onPing
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(device.name);
  const [ip, setIp] = useState(device.ip);
  const [mac, setMac] = useState(device.mac);
  const [vendor, setVendor] = useState(device.vendor);
  const [deviceType, setDeviceType] = useState<DeviceType>(device.deviceType);
  const [subType, setSubType] = useState<DeviceSubType>(device.subType);
  const [status, setStatus] = useState<DeviceStatus>(device.status);
  const [parentHostId, setParentHostId] = useState<string>(device.parentHostId || '');
  const [connectedToSwitchId, setConnectedToSwitchId] = useState<string>(device.connectedToSwitchId || '');
  const [portOrInterface, setPortOrInterface] = useState<string>(device.portOrInterface || '');
  const [vlan, setVlan] = useState<number>(device.vlan || 1);
  const [os, setOs] = useState<string>(device.os || '');
  const [location, setLocation] = useState<string>(device.location || '');
  const [customImage, setCustomImage] = useState<string>(device.customImage || '');
  const [tags, setTags] = useState<string[]>([...(device.tags || [])]);
  const [newTagInput, setNewTagInput] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string>>({ ...(device.metadata || {}) });
  const [newMetaKey, setNewMetaKey] = useState('');
  const [newMetaVal, setNewMetaVal] = useState('');

  // Physical host and hypervisor candidates (excluding itself and docker containers)
  const candidateHosts = allDevices.filter(
    (d) =>
      d.id !== device.id &&
      (d.deviceType === 'physical' || d.subType === 'server' || d.subType === 'nas' || d.subType === 'vm') &&
      d.deviceType !== 'docker'
  );

  // Switch or router candidates
  const candidateSwitches = allDevices.filter(
    (d) => d.id !== device.id && (d.subType === 'switch' || d.subType === 'router' || d.subType === 'access_point')
  );

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleAddMetadata = () => {
    if (newMetaKey.trim() && newMetaVal.trim()) {
      setMetadata({ ...metadata, [newMetaKey.trim()]: newMetaVal.trim() });
      setNewMetaKey('');
      setNewMetaVal('');
    }
  };

  const handleRemoveMetadata = (key: string) => {
    const next = { ...metadata };
    delete next[key];
    setMetadata(next);
  };

  const handleApplyPresetImage = (url: string) => {
    setCustomImage(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Device = {
      ...device,
      name,
      ip,
      mac,
      vendor,
      deviceType,
      subType,
      status,
      parentHostId: parentHostId || undefined,
      connectedToSwitchId: connectedToSwitchId || undefined,
      portOrInterface: portOrInterface || undefined,
      vlan,
      os: os || undefined,
      location: location || undefined,
      customImage: customImage || undefined,
      tags,
      metadata
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Édition & Métadonnées de l'Équipement
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                {device.ip} · {device.mac} · ID: {device.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPing(device)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-lg transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Tester Ping</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* 1. General identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Nom affiché</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Fabricant / Vendeur identifié</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Adresse IP</label>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono tabular-nums text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Adresse MAC</label>
              <input
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-100 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Type d'Équipement</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="physical">Machine Physique (Serveur, Switch, Routeur)</option>
                <option value="vm">Machine Virtuelle (VM)</option>
                <option value="docker">Conteneur Docker</option>
                <option value="iot">Périphérique IoT (Caméra, Capteur, Prise)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Sous-Type / Rôle</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value as DeviceSubType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="router">Passerelle / Routeur</option>
                <option value="switch">Switch Réseau</option>
                <option value="server">Serveur Physique</option>
                <option value="nas">Stockage NAS</option>
                <option value="vm">Machine Virtuelle</option>
                <option value="container">Conteneur Docker</option>
                <option value="camera">Caméra IP / RTSP</option>
                <option value="sensor_presence">Capteur de Présence</option>
                <option value="sensor_temp">Sonde de Température</option>
                <option value="smart_plug">Prise Connectée</option>
                <option value="workstation">Station de Travail</option>
                <option value="other">Autre équipement</option>
              </select>
            </div>
          </div>

          {/* 2. DYNAMIC VIRTUALIZATION DEPENDENCY LINK (Hôte physique) */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Link2 className="w-4 h-4" />
              <span>Relation de Dépendance & Hôte Physique Parent</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Associez cette machine virtuelle ou ce conteneur Docker à son serveur hôte physique pour tracer la dépendance sur la cartographie.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Hôte d'exécution (Serveur physique / Hyperviseur)
                </label>
                <select
                  value={parentHostId}
                  onChange={(e) => {
                    setParentHostId(e.target.value);
                    if (e.target.value) {
                      setConnectedToSwitchId(''); // Detach switch if attached to host
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="">(Aucun hôte - Périphérique autonome)</option>
                  {candidateHosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.ip}) — [{h.deviceType.toUpperCase()} - {h.subType.toUpperCase()}]
                    </option>
                  ))}
                </select>
                {deviceType === 'docker' && !parentHostId && (
                  <span className="text-[10px] text-amber-400 mt-1 block">
                    Conseil : Rattachez ce conteneur Docker à son serveur hôte pour regrouper visuellement les conteneurs.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Liaison réseau / Interface</label>
                <input
                  type="text"
                  value={portOrInterface}
                  onChange={(e) => setPortOrInterface(e.target.value)}
                  placeholder="Ex: vmbr0, docker0, Port 4 (1Gbps), Wi-Fi"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Switch & VLAN & Physical Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Switch de raccordement</label>
              <select
                value={connectedToSwitchId}
                onChange={(e) => setConnectedToSwitchId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              >
                <option value="">(Direct / Non renseigné)</option>
                {candidateSwitches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.ip})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">VLAN ID</label>
              <input
                type="number"
                value={vlan}
                onChange={(e) => setVlan(Number(e.target.value))}
                min={1}
                max={4094}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Emplacement Physique</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Baie RDC U10, Salon, Entrée"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 4. CUSTOM IMAGE & REALISTIC HARDWARE REPRESENTATION */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Image className="w-4 h-4" />
              <span>Représentation Graphique & Image Personnalisée</span>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">URL d'image personnalisée</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={customImage}
                  onChange={(e) => setCustomImage(e.target.value)}
                  placeholder="https://... (URL d'une image réaliste du matériel)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
                {customImage && (
                  <button
                    type="button"
                    onClick={() => setCustomImage('')}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Presets Grid */}
            <div>
              <span className="block text-slate-500 text-[11px] mb-2">
                Ou sélectionner un préréglage de matériel réaliste :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_HARDWARE_IMAGES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPresetImage(preset.previewUrl)}
                    className="p-2 bg-slate-900 border border-slate-800 hover:border-cyan-500 rounded-lg flex flex-col items-center gap-1.5 transition-colors text-center group"
                  >
                    <img
                      src={preset.previewUrl}
                      alt={preset.label}
                      className="w-12 h-12 object-cover rounded-md border border-slate-700 group-hover:border-cyan-400"
                    />
                    <span className="text-[10px] text-slate-300 line-clamp-1">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. CONTEXTUAL TAGS */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Tag className="w-4 h-4" />
              <span>Étiquettes Contextuelles (Tags)</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-200 rounded-md border border-slate-700 text-[11px]"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Nouveau tag (ex: Production, DMZ, Critique, Caméras)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-hidden focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* 6. CONTEXTUAL METADATA (Key-Value) */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-semibold flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Métadonnées Techniques Contextuelles</span>
              </span>
            </div>

            <div className="space-y-1.5">
              {Object.entries(metadata).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                >
                  <span className="font-medium text-slate-400">{key}:</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-sm px-2">
                    {val}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMetadata(key)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new metadata row */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newMetaKey}
                onChange={(e) => setNewMetaKey(e.target.value)}
                placeholder="Clé (ex: CPU, Firmware, Débit)"
                className="w-1/3 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-hidden"
              />
              <input
                type="text"
                value={newMetaVal}
                onChange={(e) => setNewMetaVal(e.target.value)}
                placeholder="Valeur (ex: 8 vCPU, v2.1.0, 1Gbps)"
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddMetadata}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold shadow-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les Modifications</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
