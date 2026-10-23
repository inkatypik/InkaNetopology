import React, { useState, useEffect, useMemo } from 'react';
import type { Device, DeviceType, NetworkLog, ScanStatus, GeographicZone } from './types/network';
import { Navbar, type ActiveTab } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { TopologyCanvas } from './components/TopologyCanvas';
import { HostsDependencyView } from './components/HostsDependencyView';
import { DeviceInventoryTable } from './components/DeviceInventoryTable';
import { LiveLogViewer } from './components/LiveLogViewer';
import { DeviceEditModal } from './components/DeviceEditModal';
import { AddDeviceModal } from './components/AddDeviceModal';
import { DockerDeployModal } from './components/DockerDeployModal';
import { ClearInventoryModal } from './components/ClearInventoryModal';
import { ZoneManagerModal } from './components/ZoneManagerModal';
import { autoLayoutTopology } from './utils/topologyLayout';
import { XCircle, Square } from 'lucide-react';

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [zones, setZones] = useState<GeographicZone[]>([]);
  const [logs, setLogs] = useState<NetworkLog[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('topology');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isSseConnected, setIsSseConnected] = useState<boolean>(false);

  // Scan state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanningIp, setCurrentScanningIp] = useState<string>('');
  const [subnet, setSubnet] = useState<string>('192.168.1.0/24');
  const [scanMode, setScanMode] = useState<'fast' | 'deep' | 'iot'>('fast');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<DeviceType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedVlan, setSelectedVlan] = useState<number | 'all'>('all');
  const [groupByHost, setGroupByHost] = useState<boolean>(true);

  // Modals & Selection
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDockerModalOpen, setIsDockerModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState<boolean>(false);
  const [addModalPresetParentId, setAddModalPresetParentId] = useState<string | undefined>();
  const [addModalPresetType, setAddModalPresetType] = useState<DeviceType | undefined>();

  // Diagnostic toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync dark class on root document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Initial fetch for devices, zones, interfaces, and logs
  useEffect(() => {
    fetch('/api/devices')
      .then((res) => res.json())
      .then((data: Device[]) => {
        if (Array.isArray(data)) setDevices(data);
      })
      .catch((err) => console.error('Erreur chargement équipements:', err));

    fetch('/api/zones')
      .then((res) => res.json())
      .then((data: GeographicZone[]) => {
        if (Array.isArray(data)) setZones(data);
      })
      .catch((err) => console.error('Erreur chargement zones:', err));

    fetch('/api/logs?limit=100')
      .then((res) => res.json())
      .then((data: NetworkLog[]) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch((err) => console.error('Erreur chargement journaux:', err));

    fetch('/api/interfaces')
      .then((res) => res.json())
      .then((info) => {
        if (info.defaultSubnet) {
          setSubnet(info.defaultSubnet);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time Server-Sent Events (SSE) connection
  useEffect(() => {
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/logs/stream');

      evtSource.onopen = () => {
        setIsSseConnected(true);
      };

      evtSource.addEventListener('connected', () => {
        setIsSseConnected(true);
      });

      evtSource.addEventListener('new_log', (e) => {
        const newLog: NetworkLog = JSON.parse(e.data);
        setLogs((prev) => [newLog, ...prev.slice(0, 499)]);
      });

      evtSource.addEventListener('scan_progress', (e) => {
        const status: ScanStatus = JSON.parse(e.data);
        setIsScanning(true);
        setScanProgress(status.progressPercent);
        if (status.currentIp) setCurrentScanningIp(status.currentIp);
      });

      evtSource.addEventListener('scan_complete', (e) => {
        const payload = JSON.parse(e.data);
        setIsScanning(false);
        setScanProgress(100);
        if (payload.devices) setDevices(payload.devices);
        if (payload.newlyAddedCount > 0) {
          showToast(`Scan terminé: ${payload.newlyAddedCount} nouvel(s) équipement(s) ajouté(s) à l'inventaire (${payload.devices?.length || 0} au total).`);
        } else if (payload.updatedCount > 0) {
          showToast(`Scan terminé: ${payload.updatedCount} équipement(s) mis à jour (${payload.devices?.length || 0} au total).`);
        } else {
          showToast(`Scan terminé: ${payload.devices?.length || 0} équipements dans l'inventaire.`);
        }
      });

      evtSource.addEventListener('scan_cancelled', () => {
        setIsScanning(false);
        setScanProgress(0);
        showToast('Scan réseau interrompu manuellement.');
      });

      evtSource.addEventListener('inventory_cleared', () => {
        setDevices([]);
        setSelectedDevice(null);
        showToast('Inventaire entièrement vidé.');
      });

      evtSource.addEventListener('topology_reset', (e) => {
        const resetDevices: Device[] = JSON.parse(e.data);
        setDevices(resetDevices);
      });

      evtSource.addEventListener('topology_updated', (e) => {
        const updatedList: Device[] = JSON.parse(e.data);
        setDevices(updatedList);
      });

      evtSource.addEventListener('device_updated', (e) => {
        const updated: Device = JSON.parse(e.data);
        setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        if (selectedDevice?.id === updated.id) {
          setSelectedDevice(updated);
        }
      });

      evtSource.addEventListener('device_added', (e) => {
        const added: Device = JSON.parse(e.data);
        setDevices((prev) => [...prev, added]);
      });

      evtSource.addEventListener('device_deleted', (e) => {
        const { id } = JSON.parse(e.data);
        setDevices((prev) => prev.filter((d) => d.id !== id));
      });

      evtSource.addEventListener('zone_added', (e) => {
        const addedZone: GeographicZone = JSON.parse(e.data);
        setZones((prev) => [...prev.filter((z) => z.id !== addedZone.id), addedZone]);
      });

      evtSource.addEventListener('zone_updated', (e) => {
        const updatedZone: GeographicZone = JSON.parse(e.data);
        setZones((prev) => prev.map((z) => (z.id === updatedZone.id ? updatedZone : z)));
      });

      evtSource.addEventListener('zone_deleted', (e) => {
        const { id } = JSON.parse(e.data);
        setZones((prev) => prev.filter((z) => z.id !== id));
      });

      evtSource.addEventListener('logs_cleared', () => {
        setLogs([]);
      });

      evtSource.onerror = () => {
        setIsSseConnected(false);
      };
    } catch {
      setIsSseConnected(false);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [selectedDevice]);

  // Trigger network scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    setScanProgress(5);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet, scanMode })
      });
      if (!res.ok) {
        setIsScanning(false);
        showToast('Erreur lors du lancement du scan.');
      }
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      showToast('Impossible de contacter le serveur de scan.');
    }
  };

  // Cancel / interrupt network scan immediately
  const handleCancelScan = async () => {
    try {
      await fetch('/api/scan/cancel', { method: 'POST' });
      setIsScanning(false);
      setScanProgress(0);
      showToast('Scan réseau interrompu manuellement.');
    } catch (err) {
      console.error('Erreur interruption scan:', err);
      setIsScanning(false);
      showToast('Scan interrompu.');
    }
  };

  // Clear entire inventory to clean slate (0 devices)
  const handleClearInventory = async () => {
    try {
      const res = await fetch('/api/devices/clear', { method: 'POST' });
      if (res.ok) {
        setDevices([]);
        setSelectedDevice(null);
        showToast('Inventaire entièrement vidé (0 équipement). Prêt pour un nouveau scan.');
      } else {
        showToast('Erreur lors du vidage de l\'inventaire.');
      }
    } catch (err) {
      console.error('Erreur vidage inventaire:', err);
      showToast('Erreur de connexion au serveur.');
    }
  };

  // Ping / Connectivity test
  const handlePingDevice = async (device: Device) => {
    showToast(`Test de connectivité sur ${device.name} (${device.ip})...`);
    try {
      const res = await fetch(`/api/devices/${device.id}/ping`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Connectivité OK: RTT ${data.rttMs} ms - Ports: ${data.openPorts.join(', ')}`);
      }
    } catch {
      showToast(`Échec du test de connectivité vers ${device.ip}`);
    }
  };

  // Update device position on topology canvas
  const handleUpdatePosition = async (id: string, pos: { x: number; y: number }) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, position: pos } : d))
    );
    try {
      await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: pos })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Update parent host relationship (virtualization linking)
  const handleUpdateParent = async (deviceId: string, newParentId: string | undefined) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentHostId: newParentId })
      });
      const updated = await res.json();
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
      showToast('Relation de dépendance mise à jour.');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la mise à jour de l\'hôte parent.');
    }
  };

  // Save device from edit modal
  const handleSaveDevice = async (updated: Device) => {
    try {
      const res = await fetch(`/api/devices/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const saved = await res.json();
      setDevices((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      showToast(`Équipement "${saved.name}" mis à jour.`);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'enregistrement.');
    }
  };

  // Add new device
  const handleAddDevice = async (newDev: Partial<Device>) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDev)
      });
      const saved = await res.json();
      setDevices((prev) => [...prev, saved]);
      showToast(`Équipement "${saved.name}" ajouté avec succès.`);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'ajout de l\'équipement.');
    }
  };

  // Save / Update / Rename geographic zone
  const handleSaveZone = async (zone: GeographicZone) => {
    try {
      const exists = zones.some((z) => z.id === zone.id);
      const url = exists ? `/api/zones/${zone.id}` : '/api/zones';
      const method = exists ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zone)
      });
      const saved = await res.json();
      setZones((prev) => {
        const idx = prev.findIndex((z) => z.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      showToast(`Zone "${saved.name}" enregistrée avec succès.`);
    } catch (err) {
      console.error('Erreur sauvegarde zone:', err);
      showToast('Erreur lors de l\'enregistrement de la zone.');
    }
  };

  // Delete geographic zone
  const handleDeleteZone = async (zoneId: string) => {
    try {
      await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setDevices((prev) =>
        prev.map((d) => (d.zoneId === zoneId ? { ...d, zoneId: undefined } : d))
      );
      showToast('Zone géographique supprimée.');
    } catch (err) {
      console.error('Erreur suppression zone:', err);
      showToast('Erreur lors de la suppression de la zone.');
    }
  };

  // Delete device
  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('Confirmer la suppression de cet équipement de la topologie ?')) {
      return;
    }
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.id !== id));
      if (selectedDevice?.id === id) setSelectedDevice(null);
      showToast('Équipement supprimé.');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression.');
    }
  };

  // Reset topology
  const handleResetTopology = async () => {
    if (!window.confirm('Voulez-vous réinitialiser la topologie au schéma par défaut ?')) {
      return;
    }
    try {
      const res = await fetch('/api/reset-topology', { method: 'POST' });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
      showToast('Topologie réinitialisée.');
    } catch (err) {
      console.error(err);
    }
  };

  // Reorganise & auto-layout topology into hierarchical schema
  const handleAutoLayout = async () => {
    try {
      const res = await fetch('/api/topology/autolayout', { method: 'POST' });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
      showToast('Schéma de topologie réorganisé automatiquement.');
    } catch {
      // Fallback client-side auto-layout
      const arranged = autoLayoutTopology(devices);
      setDevices(arranged);
      showToast('Schéma de topologie réorganisé.');
    }
  };

  // Export JSON
  const handleExportTopology = () => {
    window.location.href = '/api/export';
  };

  // Clear logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      showToast('Journal d\'événements effacé.');
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic device counts
  const counts = useMemo(() => {
    return {
      all: devices.length,
      physical: devices.filter((d) => d.deviceType === 'physical').length,
      vm: devices.filter((d) => d.deviceType === 'vm').length,
      docker: devices.filter((d) => d.deviceType === 'docker').length,
      iot: devices.filter((d) => d.deviceType === 'iot').length
    };
  }, [devices]);

  // Available VLANs
  const availableVlans = useMemo(() => {
    const set = new Set<number>();
    devices.forEach((d) => {
      if (d.vlan) set.add(d.vlan);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [devices]);

  // Filtered devices for rendering
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      // Type filter
      if (selectedType !== 'all' && d.deviceType !== selectedType) return false;

      // Status filter
      if (selectedStatus !== 'all' && d.status !== selectedStatus) return false;

      // VLAN filter
      if (selectedVlan !== 'all' && d.vlan !== selectedVlan) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = d.name.toLowerCase().includes(q);
        const inIp = d.ip.toLowerCase().includes(q);
        const inMac = d.mac.toLowerCase().includes(q);
        const inVendor = d.vendor.toLowerCase().includes(q);
        const inOs = d.os?.toLowerCase().includes(q);
        const inLocation = d.location?.toLowerCase().includes(q);
        const inTags = d.tags?.some((t) => t.toLowerCase().includes(q));
        if (!inName && !inIp && !inMac && !inVendor && !inOs && !inLocation && !inTags) {
          return false;
        }
      }

      return true;
    });
  }, [devices, selectedType, selectedStatus, selectedVlan, searchQuery]);

  const onlineCount = useMemo(() => devices.filter((d) => d.status === 'online').length, [devices]);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'}`}>
      {/* Top Bar Contract Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'docker') {
            setIsDockerModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onTriggerScan={handleTriggerScan}
        onCancelScan={handleCancelScan}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onlineCount={onlineCount}
        totalCount={devices.length}
      />

      {/* Real-time Scan Progress Bar Banner */}
      {isScanning && (
        <div className="w-full bg-cyan-950/80 border-b border-cyan-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-cyan-200">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold">Scan réseau en cours d'exécution</span>
            <span className="font-mono tabular-nums text-cyan-400">
              Sondage: {currentScanningIp || subnet} ({scanProgress}%)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-48 bg-slate-900 rounded-full h-2 overflow-hidden border border-cyan-800/50">
              <div
                className="bg-cyan-400 h-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <button
              onClick={handleCancelScan}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900/90 border border-rose-700/60 rounded-md transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Interrompre immédiatement le scan réseau"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Interrompre</span>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Filter and Action Toolbar */}
      <Toolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onSelectType={setSelectedType}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        selectedVlan={selectedVlan}
        onSelectVlan={setSelectedVlan}
        availableVlans={availableVlans}
        groupByHost={groupByHost}
        onToggleGroupByHost={() => setGroupByHost(!groupByHost)}
        counts={counts}
        subnet={subnet}
        onSubnetChange={setSubnet}
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        onOpenAddModal={() => {
          setAddModalPresetParentId(undefined);
          setAddModalPresetType(undefined);
          setIsAddModalOpen(true);
        }}
        onAutoLayout={handleAutoLayout}
        onExport={handleExportTopology}
        onResetTopology={handleResetTopology}
        onClearInventory={() => setIsClearModalOpen(true)}
      />

      {/* Main View Area by Tab */}
      <main className="w-full">
        {activeTab === 'topology' && (
          <TopologyCanvas
            devices={filteredDevices}
            zones={zones}
            selectedDevice={selectedDevice}
            onSelectDevice={setSelectedDevice}
            onEditDevice={(dev) => setEditingDevice(dev)}
            onPingDevice={handlePingDevice}
            onSaveDevice={handleSaveDevice}
            onUpdateDevicePosition={handleUpdatePosition}
            onAutoLayout={handleAutoLayout}
            onTriggerScan={handleTriggerScan}
            onResetTopology={handleResetTopology}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onSaveZone={handleSaveZone}
            onDeleteZone={handleDeleteZone}
            onOpenZoneManager={() => setIsZoneManagerOpen(true)}
            groupByHost={groupByHost}
          />
        )}

        {activeTab === 'hosts' && (
          <HostsDependencyView
            devices={devices}
            onUpdateDeviceParent={handleUpdateParent}
            onEditDevice={(dev) => setEditingDevice(dev)}
            onOpenAddModal={(presetParentId, presetType) => {
              setAddModalPresetParentId(presetParentId);
              setAddModalPresetType(presetType);
              setIsAddModalOpen(true);
            }}
            onPingDevice={handlePingDevice}
          />
        )}

        {activeTab === 'inventory' && (
          <DeviceInventoryTable
            devices={filteredDevices}
            zones={zones}
            onSelectDevice={(dev) => setSelectedDevice(dev)}
            onEditDevice={(dev) => setEditingDevice(dev)}
            onPingDevice={handlePingDevice}
            onDeleteDevice={handleDeleteDevice}
          />
        )}

        {activeTab === 'logs' && (
          <LiveLogViewer
            logs={logs}
            onClearLogs={handleClearLogs}
            isConnected={isSseConnected}
          />
        )}
      </main>

      {/* Device Edit Modal */}
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          allDevices={devices}
          zones={zones}
          isOpen={Boolean(editingDevice)}
          onClose={() => setEditingDevice(null)}
          onSave={handleSaveDevice}
          onPing={handlePingDevice}
        />
      )}

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddDevice}
        allDevices={devices}
        presetParentId={addModalPresetParentId}
        presetType={addModalPresetType}
      />

      {/* Zone Manager Modal */}
      <ZoneManagerModal
        isOpen={isZoneManagerOpen}
        onClose={() => setIsZoneManagerOpen(false)}
        zones={zones}
        devices={devices}
        onSaveZone={handleSaveZone}
        onDeleteZone={handleDeleteZone}
      />

      {/* Docker Deployment Guide Modal */}
      <DockerDeployModal
        isOpen={isDockerModalOpen}
        onClose={() => setIsDockerModalOpen(false)}
      />

      {/* Clear Entire Inventory Confirmation Modal */}
      <ClearInventoryModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirmClear={handleClearInventory}
        deviceCount={devices.length}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs font-medium rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
