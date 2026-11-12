import React, { useState, useMemo, useEffect } from 'react';
import type { Device } from '../types/network';
import { GitMerge, X, Check, Search, ArrowRight, ShieldCheck, Tag, Cpu, Network, Info } from 'lucide-react';
import { getDeviceDefaultIcon, getDeviceTypeColor, resolveServiceIcon } from '../utils/hardwareIcons';

interface ManualMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  preselectedDevice?: Device | null;
  preselectedDevices?: Device[] | null;
  onMerge: (sourceId: string, targetId: string, preferredName?: string, primaryIpChoice?: string) => Promise<void>;
}

export const ManualMergeModal: React.FC<ManualMergeModalProps> = ({
  isOpen,
  onClose,
  devices,
  preselectedDevice,
  preselectedDevices,
  onMerge
}) => {
  const [selectedAId, setSelectedAId] = useState<string>('');
  const [selectedBId, setSelectedBId] = useState<string>('');
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');
  const [preferredName, setPreferredName] = useState<string>('');
  const [primaryIpChoice, setPrimaryIpChoice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or update selection when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedDevices && preselectedDevices.length >= 2) {
        setSelectedAId(preselectedDevices[0].id);
        setSelectedBId(preselectedDevices[1].id);
      } else if (preselectedDevice) {
        setSelectedAId(preselectedDevice.id);
        // If candidate provided in preselectedDevices as 2nd element
        if (preselectedDevices && preselectedDevices.length === 1 && preselectedDevices[0].id !== preselectedDevice.id) {
          setSelectedBId(preselectedDevices[0].id);
        } else {
          // If a candidate with same IP or shared host exists, auto-suggest
          const candidateB = devices.find(
            (d) =>
              d.id !== preselectedDevice.id &&
              (d.ip === preselectedDevice.ip ||
                d.name.toLowerCase().includes(preselectedDevice.name.toLowerCase()) ||
                (d.metadata && d.metadata['IP Hôte'] === preselectedDevice.ip))
          );
          if (candidateB) setSelectedBId(candidateB.id);
          else setSelectedBId('');
        }
      } else {
        setSelectedAId(devices[0]?.id || '');
        setSelectedBId(devices[1]?.id || '');
      }
      setErrorMessage(null);
    }
  }, [isOpen, preselectedDevice, preselectedDevices, devices]);

  const devA = useMemo(() => devices.find((d) => d.id === selectedAId), [devices, selectedAId]);
  const devB = useMemo(() => devices.find((d) => d.id === selectedBId), [devices, selectedBId]);

  // Sync preferred name & IP choice when devA or devB change
  useEffect(() => {
    if (devA && devB) {
      // Pick best name
      if (devA.isCustomName) setPreferredName(devA.name);
      else if (devB.isCustomName) setPreferredName(devB.name);
      else if (devA.name.startsWith('Équipement') && !devB.name.startsWith('Équipement')) setPreferredName(devB.name);
      else setPreferredName(devA.name);

      // Pick best primary IP (LAN IP over container 172.x IP)
      const isInternal = (ip: string) => /^172\.(1[7-9]|2[0-9]|3[0-1])\./.test(ip) || ip === '127.0.0.1';
      if (isInternal(devA.ip) && !isInternal(devB.ip)) {
        setPrimaryIpChoice(devB.ip);
      } else {
        setPrimaryIpChoice(devA.ip);
      }
    }
  }, [devA, devB]);

  const filteredDevicesA = useMemo(() => {
    const q = searchA.toLowerCase().trim();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.mac.toLowerCase().includes(q) ||
        d.vendor?.toLowerCase().includes(q)
    );
  }, [devices, searchA]);

  const filteredDevicesB = useMemo(() => {
    const q = searchB.toLowerCase().trim();
    if (!q) return devices.filter((d) => d.id !== selectedAId);
    return devices.filter(
      (d) =>
        d.id !== selectedAId &&
        (d.name.toLowerCase().includes(q) ||
          d.ip.toLowerCase().includes(q) ||
          d.mac.toLowerCase().includes(q) ||
          d.vendor?.toLowerCase().includes(q))
    );
  }, [devices, searchB, selectedAId]);

  // Merged preview computation
  const mergedPreview = useMemo(() => {
    if (!devA || !devB) return null;

    const mergedPorts = Array.from(new Set([...(devA.openPorts || []), ...(devB.openPorts || [])])).sort((a, b) => a - b);
    const mergedTags = Array.from(new Set([...(devA.tags || []), ...(devB.tags || []), 'Fusionné']));

    // Strictly preserve custom image if either has chosen one!
    let customImage: string | undefined;
    let isCustomImage = false;
    if (devA.isCustomImage && devA.customImage) {
      customImage = devA.customImage;
      isCustomImage = true;
    } else if (devB.isCustomImage && devB.customImage) {
      customImage = devB.customImage;
      isCustomImage = true;
    } else {
      customImage = devA.customImage || devB.customImage || undefined;
      isCustomImage = Boolean(devA.isCustomImage || devB.isCustomImage);
    }

    const serviceIcon = devA.serviceIcon || devB.serviceIcon || resolveServiceIcon(devA) || resolveServiceIcon(devB);
    const resolvedIcon = customImage || serviceIcon;

    const secondaryIp = primaryIpChoice === devA.ip ? devB.ip : devA.ip;
    const bestMac = (!devA.mac || devA.mac.startsWith('02:00')) && devB.mac && !devB.mac.startsWith('02:00') ? devB.mac : devA.mac;

    return {
      name: preferredName || devA.name,
      primaryIp: primaryIpChoice || devA.ip,
      secondaryIp: secondaryIp !== (primaryIpChoice || devA.ip) ? secondaryIp : null,
      mac: bestMac,
      ports: mergedPorts,
      tags: mergedTags,
      customImage,
      isCustomImage,
      resolvedIcon,
      deviceType: devA.deviceType === 'docker' || devB.deviceType === 'docker' ? 'docker' : devA.deviceType,
      subType: devA.subType !== 'server' ? devA.subType : devB.subType,
      parentHost: devA.parentHostId ? devices.find((d) => d.id === devA.parentHostId)?.name : (devB.parentHostId ? devices.find((d) => d.id === devB.parentHostId)?.name : null)
    };
  }, [devA, devB, preferredName, primaryIpChoice, devices]);

  if (!isOpen) return null;

  const handleConfirmMerge = async () => {
    if (!devA || !devB || devA.id === devB.id) {
      setErrorMessage('Veuillez sélectionner deux équipements distincts.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onMerge(devA.id, devB.id, preferredName, primaryIpChoice);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la fusion des équipements.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-2xl p-6 text-slate-200 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-md">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Fusion Manuelle de 2 Équipements</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  Consolidation Intégrale
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sélectionnez deux équipements pour regrouper toutes leurs données (IP, MAC, ports, services et métadonnées). L'icône personnalisée est strictement conservée.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Device Selectors Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Équipement 1 (Principal) */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                1. Équipement Principal (A)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Conservera l'ID</span>
            </div>

            {/* Search filter A */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchA}
                onChange={(e) => setSearchA(e.target.value)}
                placeholder="Filtrer par nom, IP..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            {/* Dropdown Selector A */}
            <select
              value={selectedAId}
              onChange={(e) => setSelectedAId(e.target.value)}
              className="w-full p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              {filteredDevicesA.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.ip} ({d.deviceType})
                </option>
              ))}
            </select>

            {/* Details Card A */}
            {devA && (
              <div className="p-3 bg-slate-900/90 border border-slate-700/70 rounded-lg space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  {(() => {
                    const icon = devA.customImage || devA.serviceIcon || resolveServiceIcon(devA);
                    return icon ? (
                      <img src={icon} alt="" className="w-7 h-7 object-contain rounded p-0.5 bg-slate-950 border border-slate-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center">
                        {getDeviceDefaultIcon(devA.subType, devA.deviceType)}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{devA.name}</div>
                    <div className="text-[11px] font-mono tabular-nums text-cyan-400">{devA.ip} · {devA.mac}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <div>Type: <span className="text-slate-200 font-medium">{devA.deviceType}</span></div>
                  <div>Ports ouverts: <span className="text-slate-200 font-mono">{(devA.openPorts || []).length}</span></div>
                  {devA.isCustomImage && (
                    <div className="col-span-2 text-amber-400 font-semibold flex items-center gap-1">
                      <span>★ Icône personnalisée active</span>
                    </div>
                  )}
                  {devA.parentHostId && (
                    <div className="col-span-2 truncate">Hôte: <span className="text-slate-200">{devices.find(h => h.id === devA.parentHostId)?.name || devA.parentHostId}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Équipement 2 (Secondaire à fusionner) */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                2. Équipement à Fusionner (B)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Sera consolidé dans A</span>
            </div>

            {/* Search filter B */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchB}
                onChange={(e) => setSearchB(e.target.value)}
                placeholder="Filtrer par nom, IP..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Dropdown Selector B */}
            <select
              value={selectedBId}
              onChange={(e) => setSelectedBId(e.target.value)}
              className="w-full p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              {filteredDevicesB.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.ip} ({d.deviceType})
                </option>
              ))}
            </select>

            {/* Details Card B */}
            {devB && (
              <div className="p-3 bg-slate-900/90 border border-slate-700/70 rounded-lg space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  {(() => {
                    const icon = devB.customImage || devB.serviceIcon || resolveServiceIcon(devB);
                    return icon ? (
                      <img src={icon} alt="" className="w-7 h-7 object-contain rounded p-0.5 bg-slate-950 border border-slate-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center">
                        {getDeviceDefaultIcon(devB.subType, devB.deviceType)}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{devB.name}</div>
                    <div className="text-[11px] font-mono tabular-nums text-indigo-400">{devB.ip} · {devB.mac}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <div>Type: <span className="text-slate-200 font-medium">{devB.deviceType}</span></div>
                  <div>Ports ouverts: <span className="text-slate-200 font-mono">{(devB.openPorts || []).length}</span></div>
                  {devB.isCustomImage && (
                    <div className="col-span-2 text-amber-400 font-semibold flex items-center gap-1">
                      <span>★ Icône personnalisée active</span>
                    </div>
                  )}
                  {devB.parentHostId && (
                    <div className="col-span-2 truncate">Hôte: <span className="text-slate-200">{devices.find(h => h.id === devB.parentHostId)?.name || devB.parentHostId}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Merged Result Preview */}
        {mergedPreview && devA && devB && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/40 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Résultat Prévisionnel de la Fusion (Aucune perte de données)</span>
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">
                {mergedPreview.ports.length} ports consolidés
              </span>
            </div>

            {/* Preserved Icon Assurance Badge */}
            {(devA.isCustomImage || devB.isCustomImage) && (
              <div className="flex items-center gap-2 p-2 bg-amber-950/40 border border-amber-500/50 rounded-lg text-xs text-amber-300">
                <Info className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Icône personnalisée préservée :</strong> L'icône configurée manuellement sur {devA.isCustomImage ? `"${devA.name}"` : `"${devB.name}"`} sera appliquée à l'équipement fusionné.
                </span>
              </div>
            )}

            {/* Form to choose final Name and Primary IP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Nom final de l'équipement consolidé :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    className="flex-1 p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:outline-hidden focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPreferredName(devA.name)}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 whitespace-nowrap cursor-pointer"
                  >
                    Nom A
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredName(devB.name)}
                    className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 whitespace-nowrap cursor-pointer"
                  >
                    Nom B
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Adresse IP principale (la seconde sera conservée en métadonnée) :
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={primaryIpChoice}
                    onChange={(e) => setPrimaryIpChoice(e.target.value)}
                    className="flex-1 p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono cursor-pointer"
                  >
                    <option value={devA.ip}>{devA.ip} (IP de {devA.name})</option>
                    <option value={devB.ip}>{devB.ip} (IP de {devB.name})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Combined attributes summary */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-3">
                {mergedPreview.resolvedIcon ? (
                  <img src={mergedPreview.resolvedIcon} alt="" className="w-8 h-8 rounded-lg object-contain p-0.5 bg-slate-950 border border-cyan-500/50 shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    {getDeviceDefaultIcon(mergedPreview.subType, mergedPreview.deviceType)}
                  </div>
                )}
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{mergedPreview.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">Fusionné</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    IP : <span className="text-cyan-300">{mergedPreview.primaryIp}</span>
                    {mergedPreview.secondaryIp && (
                      <span className="text-slate-500"> (Sec: {mergedPreview.secondaryIp})</span>
                    )}
                    {' · '}MAC : <span className="text-slate-300">{mergedPreview.mac}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {mergedPreview.ports.slice(0, 8).map((p) => (
                  <span key={p} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-950 border border-slate-700 text-cyan-300 font-semibold">
                    {p}
                  </span>
                ))}
                {mergedPreview.ports.length > 8 && (
                  <span className="text-[10px] text-slate-500 font-mono">+{mergedPreview.ports.length - 8}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {devA && devB ? (
              <span>L'équipement B ({devB.name}) sera supprimé et ses données consolidées dans A.</span>
            ) : (
              <span>Sélectionnez deux équipements pour continuer.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={isSubmitting || !devA || !devB || devA.id === devB.id}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <GitMerge className="w-4 h-4" />
              <span>{isSubmitting ? 'Fusion en cours...' : 'Confirmer la fusion des 2 équipements'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
