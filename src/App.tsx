import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Device, DeviceType, NetworkLog, ScanStatus, GeographicZone, DeviceTypeDefinition, DeviceSubTypeDefinition, AppSettings } from './types/network';
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
import { TypeManagerModal } from './components/TypeManagerModal';
import { SettingsModal } from './components/SettingsModal';
import { ManualMergeModal } from './components/ManualMergeModal';
import { autoLayoutTopology, autoLayoutByZones } from './utils/topologyLayout';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { XCircle, Square } from 'lucide-react';

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [zones, setZones] = useState<GeographicZone[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDefinition[]>([]);
  const [deviceSubTypes, setDeviceSubTypes] = useState<DeviceSubTypeDefinition[]>([]);
  const [logs, setLogs] = useState<NetworkLog[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('topology');
  const [isSseConnected, setIsSseConnected] = useState<boolean>(false);

  // Scan state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanningIp, setCurrentScanningIp] = useState<string>('');
  const [subnet, setSubnet] = useState<string>('192.168.1.0/24');
  const [scanMode, setScanMode] = useState<'fast' | 'deep' | 'iot'>('fast');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedVlan, setSelectedVlan] = useState<number | 'all'>('all');
  const [groupByHost, setGroupByHost] = useState<boolean>(true);

  // Topology zones & fold state
  const [showZoneEnclosures, setShowZoneEnclosures] = useState<boolean>(true);
  const [collapsedHostIds, setCollapsedHostIds] = useState<Set<string>>(new Set());
  const [collapsedZoneIds, setCollapsedZoneIds] = useState<Set<string>>(new Set());
  const [layoutTrigger, setLayoutTrigger] = useState<number>(0);

  // Modals & Selection
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDockerModalOpen, setIsDockerModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState<boolean>(false);
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isManualMergeModalOpen, setIsManualMergeModalOpen] = useState<boolean>(false);
  const [manualMergePresetDevice, setManualMergePresetDevice] = useState<Device | null>(null);
  const [manualMergePresetDevices, setManualMergePresetDevices] = useState<Device[] | null>(null);
  const [showInspectorAndHighlight, setShowInspectorAndHighlight] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>({
    presenceCheckEnabled: true,
    presenceCheckIntervalMinutes: 5,
    autoPruneEnabled: true,
    maxInactiveAgeHours: 24,
    protectCoreDevices: true,
    defaultSubnet: '192.168.1.0/24'
  });
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

  // Permanent dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initial fetch for devices, zones, types, subtypes, interfaces, and logs
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

    fetch('/api/types')
      .then((res) => res.json())
      .then((data: DeviceTypeDefinition[]) => {
        if (Array.isArray(data)) setDeviceTypes(data);
      })
      .catch((err) => console.error('Erreur chargement types:', err));

    fetch('/api/subtypes')
      .then((res) => res.json())
      .then((data: DeviceSubTypeDefinition[]) => {
        if (Array.isArray(data)) setDeviceSubTypes(data);
      })
      .catch((err) => console.error('Erreur chargement sous-types:', err));

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

    fetch('/api/settings')
      .then((res) => res.json())
      .then((cfg: AppSettings) => {
        if (cfg && typeof cfg === 'object') {
          setSettings(cfg);
          if (cfg.defaultSubnet) {
            setSubnet(cfg.defaultSubnet);
          }
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

      evtSource.addEventListener('zones_updated', (e) => {
        const list: GeographicZone[] = JSON.parse(e.data);
        setZones(list);
      });

      evtSource.addEventListener('type_added', (e) => {
        const addedType: DeviceTypeDefinition = JSON.parse(e.data);
        setDeviceTypes((prev) => [...prev.filter((t) => t.id !== addedType.id), addedType]);
      });

      evtSource.addEventListener('type_updated', (e) => {
        const updatedType: DeviceTypeDefinition = JSON.parse(e.data);
        setDeviceTypes((prev) => prev.map((t) => (t.id === updatedType.id ? updatedType : t)));
      });

      evtSource.addEventListener('type_deleted', (e) => {
        const { id } = JSON.parse(e.data);
        setDeviceTypes((prev) => prev.filter((t) => t.id !== id));
      });

      evtSource.addEventListener('types_updated', (e) => {
        const list: DeviceTypeDefinition[] = JSON.parse(e.data);
        setDeviceTypes(list);
      });

      evtSource.addEventListener('subtype_added', (e) => {
        const addedSubType: DeviceSubTypeDefinition = JSON.parse(e.data);
        setDeviceSubTypes((prev) => [...prev.filter((s) => s.id !== addedSubType.id), addedSubType]);
      });

      evtSource.addEventListener('subtype_updated', (e) => {
        const updatedSubType: DeviceSubTypeDefinition = JSON.parse(e.data);
        setDeviceSubTypes((prev) => prev.map((s) => (s.id === updatedSubType.id ? updatedSubType : s)));
      });

      evtSource.addEventListener('subtype_deleted', (e) => {
        const { id } = JSON.parse(e.data);
        setDeviceSubTypes((prev) => prev.filter((s) => s.id !== id));
      });

      evtSource.addEventListener('subtypes_updated', (e) => {
        const list: DeviceSubTypeDefinition[] = JSON.parse(e.data);
        setDeviceSubTypes(list);
      });

      evtSource.addEventListener('settings_updated', (e) => {
        try {
          const updatedSettings: AppSettings = JSON.parse(e.data);
          setSettings(updatedSettings);
        } catch {}
      });

      evtSource.addEventListener('inventory_pruned', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.count > 0) {
            showToast(`${payload.count} équipement(s) inactif(s) purgé(s) de l'inventaire.`);
          }
        } catch {}
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

  // Debounced API position saves to prevent HTTP flooding during drag
  const positionSaveTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Update device position on topology canvas
  const handleUpdatePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, position: pos } : d))
    );

    const existingTimer = positionSaveTimeoutsRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      positionSaveTimeoutsRef.current.delete(id);
      try {
        await fetch(`/api/devices/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: pos })
        });
      } catch (err) {
        console.error(err);
      }
    }, 250);

    positionSaveTimeoutsRef.current.set(id, timer);
  }, []);

  // Batch update positions for zone or cluster multi-drag
  const handleBatchUpdatePositions = useCallback((updates: Array<{ id: string; pos: { x: number; y: number } }>) => {
    if (updates.length === 0) return;
    const posMap = new Map<string, { x: number; y: number }>();
    updates.forEach((u) => posMap.set(u.id, u.pos));

    setDevices((prev) =>
      prev.map((d) => {
        const newPos = posMap.get(d.id);
        if (newPos) {
          return { ...d, position: newPos };
        }
        return d;
      })
    );

    updates.forEach(({ id, pos }) => {
      const existing = positionSaveTimeoutsRef.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        positionSaveTimeoutsRef.current.delete(id);
        try {
          await fetch(`/api/devices/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: pos })
          });
        } catch (err) {
          console.error(err);
        }
      }, 250);

      positionSaveTimeoutsRef.current.set(id, timer);
    });
  }, []);

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

  // Save device from edit modal with instant zone repositioning if zone changed
  const handleSaveDevice = async (updated: Device) => {
    try {
      const existing = devices.find((d) => d.id === updated.id);
      // Instant zone repositioning if geographic zone changed
      if (updated.zoneId && existing?.zoneId !== updated.zoneId) {
        const targetZoneDevs = devices.filter(
          (d) => d.zoneId === updated.zoneId && d.id !== updated.id
        );
        if (targetZoneDevs.length > 0) {
          const minX = Math.min(...targetZoneDevs.map((d) => d.position?.x ?? 200));
          const minY = Math.min(...targetZoneDevs.map((d) => d.position?.y ?? 200));
          const cols = Math.max(2, Math.ceil(Math.sqrt(targetZoneDevs.length + 1)));
          const slotCol = targetZoneDevs.length % cols;
          const slotRow = Math.floor(targetZoneDevs.length / cols);
          let targetX = minX + slotCol * 310;
          let targetY = minY + slotRow * 230;

          // Prevent direct overlap with existing nodes
          let collides = targetZoneDevs.some(
            (d) =>
              Math.abs((d.position?.x ?? 0) - targetX) < 150 &&
              Math.abs((d.position?.y ?? 0) - targetY) < 120
          );
          while (collides) {
            targetX += 310;
            collides = targetZoneDevs.some(
              (d) =>
                Math.abs((d.position?.x ?? 0) - targetX) < 150 &&
                Math.abs((d.position?.y ?? 0) - targetY) < 120
            );
          }
          updated.position = { x: targetX, y: targetY };
        } else {
          // Dedicated initial zone position
          const zoneIdx = Math.max(0, zones.findIndex((z) => z.id === updated.zoneId));
          const col = zoneIdx % 3;
          const row = Math.floor(zoneIdx / 3);
          updated.position = { x: 180 + col * 950, y: 220 + row * 700 };
        }
      }

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

  // Multi-selection handler: support single click (device 1) and Ctrl+click (device 2) for direct manual merge
  const handleDeviceSelection = (device: Device | null, event?: React.MouseEvent) => {
    if (!device) {
      setSelectedDevice(null);
      setSelectedDevices([]);
      return;
    }

    const isCtrlOrCmd = event ? (event.ctrlKey || event.metaKey || event.shiftKey) : false;

    if (isCtrlOrCmd) {
      setSelectedDevices((prev) => {
        // If already selected, deselect
        if (prev.some((d) => d.id === device.id)) {
          const filtered = prev.filter((d) => d.id !== device.id);
          setSelectedDevice(filtered[0] || null);
          return filtered;
        }
        // If 0 previously selected, but selectedDevice exists
        let baseList = [...prev];
        if (baseList.length === 0 && selectedDevice && selectedDevice.id !== device.id) {
          baseList = [selectedDevice];
        }
        // Limit to max 2 equipment for fusion
        if (baseList.length >= 2) {
          // Replace second device
          const updated = [baseList[0], device];
          setSelectedDevice(device);
          showToast(`2 équipements sélectionnés pour la fusion : "${updated[0].name}" et "${updated[1].name}".`);
          return updated;
        }
        const updated = [...baseList, device];
        setSelectedDevice(device);
        if (updated.length === 2) {
          showToast(`2 équipements sélectionnés pour la fusion : "${updated[0].name}" et "${updated[1].name}". Cliquez sur "Fusion manuelle" pour les fusionner.`);
        }
        return updated;
      });
    } else {
      // Normal single click: selects equipment #1
      setSelectedDevice(device);
      setSelectedDevices([device]);
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
      setSelectedDevices((prev) => prev.filter((d) => d.id !== id));
      showToast('Équipement supprimé.');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la suppression.');
    }
  };

  // Reset topology
  const handleResetTopology = async () => {
    if (!window.confirm('Voulez-vous réinitialiser la topologie et vider l\'inventaire ?')) {
      return;
    }
    try {
      const res = await fetch('/api/reset-topology', { method: 'POST' });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
      if (data.zones) {
        setZones(data.zones);
      }
      setSelectedDevice(null);
      showToast('Topologie et inventaire réinitialisés.');
    } catch (err) {
      console.error(err);
    }
  };

  // Reorganise & auto-layout topology into Star schema with core network at 2D center
  const handleStarTopologyLayout = async () => {
    try {
      const res = await fetch('/api/topology/autolayout', { method: 'POST' });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
      setLayoutTrigger((prev) => prev + 1);
      showToast('Schéma réorganisé en étoile avec cœur au centre et zéro chevauchement.');
    } catch {
      // Fallback client-side auto-layout
      const arranged = autoLayoutTopology(devices, zones);
      setDevices(arranged);
      setLayoutTrigger((prev) => prev + 1);
      showToast('Schéma réorganisé en étoile avec cœur au centre et zéro chevauchement.');
    }
  };

  // Universal deduplication and fusion (IPs, MACs, Hostnames, Ports, Services, Docker containers)
  const handleMergeDuplicates = async () => {
    try {
      const res = await fetch('/api/inventory/merge-duplicates', { method: 'POST' });
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
      if (data.mergedCount > 0) {
        showToast(
          `${data.mergedCount} équipement(s) fusionné(s) avec succès (adresses IP, MAC, services, ports et conteneurs consolidés sans doublon).`
        );
      } else {
        showToast('Aucun doublon détecté. Tous les équipements et conteneurs sont déjà consolidés.');
      }
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la fusion des doublons.');
    }
  };

  const handleMergeContainers = handleMergeDuplicates;

  // Manual Merge of Two Selected Devices with Maximum Informative Consolidation & Custom Icon Preservation
  const handleManualMerge = async (
    sourceId: string,
    targetId: string,
    preferredName?: string,
    primaryIpChoice?: string
  ) => {
    try {
      const res = await fetch('/api/inventory/merge-two', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeviceId: sourceId,
          targetDeviceId: targetId,
          preferredName,
          primaryIpChoice
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la fusion');
      }
      if (data.devices) {
        setDevices(data.devices);
      }
      if (data.mergedDevice) {
        setSelectedDevice(data.mergedDevice);
      }
      showToast(
        data.message ||
          'Les deux équipements ont été fusionnés avec succès et toutes leurs données consolidées.'
      );
    } catch (err: any) {
      console.error('Erreur fusion manuelle:', err);
      showToast(err.message || 'Erreur lors de la fusion manuelle des deux équipements.');
      throw err;
    }
  };

  // Collapse / Fold helpers
  const hostIdsWithChildren = useMemo(() => {
    const parentIds = new Set<string>();
    devices.forEach((d) => {
      if (d.parentHostId) parentIds.add(d.parentHostId);
    });
    return Array.from(parentIds);
  }, [devices]);

  const zoneIdsWithDevices = useMemo(() => {
    const zoneIds = new Set<string>();
    devices.forEach((d) => {
      if (d.zoneId) zoneIds.add(d.zoneId);
    });
    return Array.from(zoneIds);
  }, [devices]);

  const hasCollapsibleGroups = hostIdsWithChildren.length > 0 || zoneIdsWithDevices.length > 0;
  const allCollapsed =
    hasCollapsibleGroups &&
    hostIdsWithChildren.every((id) => collapsedHostIds.has(id)) &&
    zoneIdsWithDevices.every((id) => collapsedZoneIds.has(id));

  const handleToggleAllCollapse = () => {
    if (allCollapsed) {
      setCollapsedHostIds(new Set());
      setCollapsedZoneIds(new Set());
    } else {
      setCollapsedHostIds(new Set(hostIdsWithChildren));
      setCollapsedZoneIds(new Set(zoneIdsWithDevices));
    }
  };

  const handleToggleCollapseHost = (hostId: string) => {
    setCollapsedHostIds((prev) => {
      const next = new Set(prev);
      if (next.has(hostId)) next.delete(hostId);
      else next.add(hostId);
      return next;
    });
  };

  const handleToggleCollapseZone = (zoneId: string) => {
    setCollapsedZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  // Save / Update Equipment Type Definition
  const handleSaveType = async (typeDef: DeviceTypeDefinition) => {
    try {
      const exists = deviceTypes.some((t) => t.id === typeDef.id);
      const url = exists ? `/api/types/${typeDef.id}` : '/api/types';
      const method = exists ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeDef)
      });
      const saved = await res.json();
      setDeviceTypes((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      showToast(`Type "${saved.name}" enregistré avec succès.`);
    } catch (err) {
      console.error('Erreur sauvegarde type:', err);
      showToast('Erreur lors de l\'enregistrement du type.');
    }
  };

  // Delete Equipment Type
  const handleDeleteType = async (typeId: string) => {
    try {
      await fetch(`/api/types/${typeId}`, { method: 'DELETE' });
      setDeviceTypes((prev) => prev.filter((t) => t.id !== typeId));
      showToast('Type d\'équipement supprimé.');
    } catch (err) {
      console.error('Erreur suppression type:', err);
      showToast('Erreur lors de la suppression du type.');
    }
  };

  // Save / Update SubType or Role
  const handleSaveSubType = async (subTypeDef: DeviceSubTypeDefinition) => {
    try {
      const exists = deviceSubTypes.some((s) => s.id === subTypeDef.id);
      const url = exists ? `/api/subtypes/${subTypeDef.id}` : '/api/subtypes';
      const method = exists ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subTypeDef)
      });
      const saved = await res.json();
      setDeviceSubTypes((prev) => {
        const idx = prev.findIndex((s) => s.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      showToast(`Rôle/Sous-type "${saved.name}" enregistré.`);
    } catch (err) {
      console.error('Erreur sauvegarde sous-type:', err);
      showToast('Erreur lors de l\'enregistrement du sous-type.');
    }
  };

  // Delete SubType or Role
  const handleDeleteSubType = async (subTypeId: string) => {
    try {
      await fetch(`/api/subtypes/${subTypeId}`, { method: 'DELETE' });
      setDeviceSubTypes((prev) => prev.filter((s) => s.id !== subTypeId));
      showToast('Sous-type / rôle supprimé.');
    } catch (err) {
      console.error('Erreur suppression sous-type:', err);
      showToast('Erreur lors de la suppression du sous-type.');
    }
  };

  // Import JSON topology with robust parsing & multi-version schema compatibility
  const handleImportTopology = async (file: File) => {
    showToast('Importation du fichier JSON en cours...');
    try {
      const rawText = await file.text();
      const text = rawText.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM if present
      if (!text) {
        showToast('Le fichier sélectionné est vide.');
        return;
      }
      if (text.startsWith('<') || text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
        showToast('Fichier invalide : le fichier contient du code HTML au lieu de données JSON.');
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr: any) {
        console.error('Erreur parsing JSON:', jsonErr);
        showToast(`Syntaxe JSON invalide : ${jsonErr.message || 'erreur'}`);
        return;
      }

      if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
        showToast('Format JSON non reconnu.');
        return;
      }

      // 1. Extract devices (support v1, v2, direct arrays, or nested data)
      let importedDevices: Device[] = [];
      let importedZones: GeographicZone[] = [];
      let importedTypes: DeviceTypeDefinition[] = [];
      let importedSubTypes: DeviceSubTypeDefinition[] = [];

      if (Array.isArray(parsed)) {
        importedDevices = parsed;
      } else if (typeof parsed === 'object') {
        const rawDevs = parsed.devices || parsed.deviceList || parsed.nodes || parsed.elements || parsed.topology?.devices || parsed.data?.devices;
        if (Array.isArray(rawDevs)) importedDevices = rawDevs;

        const rawZones = parsed.zones || parsed.geographicZones || parsed.zoneList || parsed.topology?.zones || parsed.data?.zones;
        if (Array.isArray(rawZones)) importedZones = rawZones;

        const rawTypes = parsed.types || parsed.deviceTypes || parsed.typeList || parsed.topology?.types || parsed.data?.types;
        if (Array.isArray(rawTypes)) importedTypes = rawTypes;

        const rawSubTypes = parsed.subTypes || parsed.deviceSubTypes || parsed.roles || parsed.subTypeList || parsed.topology?.subTypes || parsed.data?.subTypes;
        if (Array.isArray(rawSubTypes)) importedSubTypes = rawSubTypes;
      }

      // Sanitize every imported device so all required properties exist
      importedDevices = importedDevices.map((d: any, idx: number) => ({
        id: String(d.id || `imported-dev-${Date.now()}-${idx}`),
        name: String(d.name || d.hostname || d.ip || `Équipement ${idx + 1}`),
        ip: String(d.ip || ''),
        mac: String(d.mac || ''),
        vendor: String(d.vendor || 'Inconnu'),
        deviceType: String(d.deviceType || d.type || 'physical'),
        subType: String(d.subType || d.role || 'server'),
        role: d.role ? String(d.role) : undefined,
        status: (d.status === 'offline' || d.status === 'warning') ? d.status : 'online',
        zoneId: d.zoneId ? String(d.zoneId) : undefined,
        parentHostId: d.parentHostId ? String(d.parentHostId) : undefined,
        connectedToSwitchId: d.connectedToSwitchId ? String(d.connectedToSwitchId) : undefined,
        portOrInterface: d.portOrInterface ? String(d.portOrInterface) : undefined,
        vlan: typeof d.vlan === 'number' ? d.vlan : (d.vlan ? Number(d.vlan) : undefined),
        isCore: Boolean(d.isCore),
        os: d.os ? String(d.os) : undefined,
        openPorts: Array.isArray(d.openPorts) ? d.openPorts : [],
        location: d.location ? String(d.location) : undefined,
        customImage: d.customImage ? String(d.customImage) : undefined,
        tags: Array.isArray(d.tags) ? d.tags : [],
        metadata: typeof d.metadata === 'object' && d.metadata !== null ? d.metadata : {},
        lastSeen: d.lastSeen ? String(d.lastSeen) : new Date().toISOString(),
        latencyMs: typeof d.latencyMs === 'number' ? d.latencyMs : undefined,
        position: (d.position && typeof d.position.x === 'number' && typeof d.position.y === 'number')
          ? d.position
          : { x: 200 + (idx % 4) * 300, y: 180 + Math.floor(idx / 4) * 220 }
      }));

      // Apply to React state immediately so user sees results instantly
      setDevices(importedDevices);
      if (importedZones.length > 0) setZones(importedZones);
      if (importedTypes.length > 0) setDeviceTypes(importedTypes);
      if (importedSubTypes.length > 0) setDeviceSubTypes(importedSubTypes);

      // Persist to server backend
      try {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            devices: importedDevices,
            zones: importedZones,
            types: importedTypes,
            subTypes: importedSubTypes
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.devices)) setDevices(data.devices);
          if (Array.isArray(data.zones)) setZones(data.zones);
          if (Array.isArray(data.types)) setDeviceTypes(data.types);
          if (Array.isArray(data.subTypes)) setDeviceSubTypes(data.subTypes);
        }
      } catch (srvErr) {
        console.warn('Persistance serveur différée:', srvErr);
      }

      showToast(`Topologie importée avec succès (${importedDevices.length} équipements, ${importedZones.length} zones).`);
    } catch (err: any) {
      console.error('Erreur import JSON:', err);
      showToast(`Fichier JSON invalide: ${err?.message || 'erreur'}`);
    }
  };

  // Export PNG image covering 100% of the entire topology diagram
  const handleExportPng = async () => {
    if (activeTab !== 'topology') {
      setActiveTab('topology');
      showToast('Bascule sur la vue Topologie pour l\'export...');
      await new Promise((r) => setTimeout(r, 350));
    }

    const container = document.getElementById('topology-canvas-container');
    const viewport = document.getElementById('topology-canvas-viewport');
    if (!container) {
      showToast('Erreur: zone de dessin introuvable.');
      return;
    }

    if (devices.length === 0) {
      showToast('Aucun équipement présent sur la topologie pour l\'export.');
      return;
    }

    showToast('Génération de l\'image PNG complète du réseau...');

    // Save initial container & viewport styles
    const origContainerWidth = container.style.width;
    const origContainerHeight = container.style.height;
    const origContainerOverflow = container.style.overflow;
    const origContainerMaxWidth = container.style.maxWidth;
    const origContainerMaxHeight = container.style.maxHeight;
    const origViewportTransform = viewport ? viewport.style.transform : '';
    const origViewportTransition = viewport ? viewport.style.transition : '';

    try {
      // Calculate global bounding box of all equipment
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      devices.forEach((d) => {
        const x = d.position?.x ?? 200;
        const y = d.position?.y ?? 180;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 300);
        maxY = Math.max(maxY, y + 200);
      });

      if (!isFinite(minX)) { minX = 100; maxX = 1200; }
      if (!isFinite(minY)) { minY = 100; maxY = 800; }

      // Generous padding around the entire topology
      const paddingX = 140;
      const paddingY = 140;
      const startX = minX - paddingX;
      const startY = minY - paddingY;
      const fullWidth = Math.max(1280, Math.ceil(maxX - minX + paddingX * 2));
      const fullHeight = Math.max(800, Math.ceil(maxY - minY + paddingY * 2));

      // Temporarily transform viewport and expand container to fit all content
      if (viewport) {
        viewport.style.transition = 'none';
        viewport.style.transform = `translate(${-startX}px, ${-startY}px) scale(1)`;
      }
      container.style.width = `${fullWidth}px`;
      container.style.height = `${fullHeight}px`;
      container.style.maxWidth = 'none';
      container.style.maxHeight = 'none';
      container.style.overflow = 'visible';

      // Wait brief frame for layout and render
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

      let dataUrl: string;
      try {
        dataUrl = await toPng(container, {
          backgroundColor: '#020617',
          width: fullWidth,
          height: fullHeight,
          filter: (node) => !(node as HTMLElement)?.classList?.contains('export-exclude'),
          pixelRatio: 2,
          skipFonts: true,
          fontEmbedCSS: '',
          cacheBust: false,
          imagePlaceholder: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%23334155"><rect width="36" height="36" rx="6"/></svg>'
        });
      } catch (firstErr) {
        console.warn('Pass 1 export PNG (pixelRatio 2) échouée, essai pass 2:', firstErr);
        dataUrl = await toPng(container, {
          backgroundColor: '#020617',
          width: fullWidth,
          height: fullHeight,
          filter: (node) => !(node as HTMLElement)?.classList?.contains('export-exclude'),
          pixelRatio: 1,
          skipFonts: true,
          fontEmbedCSS: '',
          cacheBust: false
        });
      }

      const link = document.createElement('a');
      link.download = `topologie-reseau-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Image PNG complète exportée avec succès !');
    } catch (err) {
      console.error('Erreur export PNG:', err);
      showToast('Échec de la capture PNG.');
    } finally {
      // Restore original container & viewport styles
      container.style.width = origContainerWidth;
      container.style.height = origContainerHeight;
      container.style.overflow = origContainerOverflow;
      container.style.maxWidth = origContainerMaxWidth;
      container.style.maxHeight = origContainerMaxHeight;
      if (viewport) {
        viewport.style.transform = origViewportTransform;
        viewport.style.transition = origViewportTransition;
      }
    }
  };

  // Export PDF document covering 100% of the entire topology diagram
  const handleExportPdf = async () => {
    if (activeTab !== 'topology') {
      setActiveTab('topology');
      showToast('Bascule sur la vue Topologie pour l\'export...');
      await new Promise((r) => setTimeout(r, 350));
    }

    const container = document.getElementById('topology-canvas-container');
    const viewport = document.getElementById('topology-canvas-viewport');
    if (!container) {
      showToast('Erreur: zone de dessin introuvable.');
      return;
    }

    if (devices.length === 0) {
      showToast('Aucun équipement présent sur la topologie pour l\'export.');
      return;
    }

    showToast('Génération du document PDF complet...');

    // Save initial container & viewport styles
    const origContainerWidth = container.style.width;
    const origContainerHeight = container.style.height;
    const origContainerOverflow = container.style.overflow;
    const origContainerMaxWidth = container.style.maxWidth;
    const origContainerMaxHeight = container.style.maxHeight;
    const origViewportTransform = viewport ? viewport.style.transform : '';
    const origViewportTransition = viewport ? viewport.style.transition : '';

    try {
      // Calculate global bounding box of all equipment
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      devices.forEach((d) => {
        const x = d.position?.x ?? 200;
        const y = d.position?.y ?? 180;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 300);
        maxY = Math.max(maxY, y + 200);
      });

      if (!isFinite(minX)) { minX = 100; maxX = 1200; }
      if (!isFinite(minY)) { minY = 100; maxY = 800; }

      // Generous padding around the entire topology
      const paddingX = 140;
      const paddingY = 140;
      const startX = minX - paddingX;
      const startY = minY - paddingY;
      const fullWidth = Math.max(1280, Math.ceil(maxX - minX + paddingX * 2));
      const fullHeight = Math.max(800, Math.ceil(maxY - minY + paddingY * 2));

      // Temporarily transform viewport and expand container to fit all content
      if (viewport) {
        viewport.style.transition = 'none';
        viewport.style.transform = `translate(${-startX}px, ${-startY}px) scale(1)`;
      }
      container.style.width = `${fullWidth}px`;
      container.style.height = `${fullHeight}px`;
      container.style.maxWidth = 'none';
      container.style.maxHeight = 'none';
      container.style.overflow = 'visible';

      // Wait brief frame for layout and render
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

      let dataUrl: string;
      try {
        dataUrl = await toPng(container, {
          backgroundColor: '#020617',
          width: fullWidth,
          height: fullHeight,
          filter: (node) => !(node as HTMLElement)?.classList?.contains('export-exclude'),
          pixelRatio: 2,
          skipFonts: true,
          fontEmbedCSS: '',
          cacheBust: false,
          imagePlaceholder: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%23334155"><rect width="36" height="36" rx="6"/></svg>'
        });
      } catch (firstErr) {
        console.warn('Pass 1 export PDF (pixelRatio 2) échouée, essai pass 2:', firstErr);
        dataUrl = await toPng(container, {
          backgroundColor: '#020617',
          width: fullWidth,
          height: fullHeight,
          filter: (node) => !(node as HTMLElement)?.classList?.contains('export-exclude'),
          pixelRatio: 1,
          skipFonts: true,
          fontEmbedCSS: '',
          cacheBust: false
        });
      }

      const pdf = new jsPDF({
        orientation: fullWidth > fullHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const imgProps = pdf.getImageProperties(dataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
      const renderW = imgProps.width * ratio;
      const renderH = imgProps.height * ratio;
      const posX = (pageWidth - renderW) / 2;
      const posY = (pageHeight - renderH) / 2;

      pdf.setFillColor(2, 6, 23);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.addImage(dataUrl, 'PNG', posX, posY, renderW, renderH);
      pdf.save(`topologie-reseau-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('Document PDF complet exporté avec succès !');
    } catch (err) {
      console.error('Erreur export PDF:', err);
      showToast('Échec de la génération PDF.');
    } finally {
      // Restore original container & viewport styles
      container.style.width = origContainerWidth;
      container.style.height = origContainerHeight;
      container.style.overflow = origContainerOverflow;
      container.style.maxWidth = origContainerMaxWidth;
      container.style.maxHeight = origContainerMaxHeight;
      if (viewport) {
        viewport.style.transform = origViewportTransform;
        viewport.style.transition = origViewportTransition;
      }
    }
  };

  // Settings configuration handlers
  const handleSaveSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!res.ok) throw new Error('Échec mise à jour paramètres');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      showToast('Paramètres système mis à jour.');
      return true;
    } catch (err) {
      console.error('Erreur sauvegarde paramètres:', err);
      showToast('Erreur lors de la sauvegarde des paramètres.');
      return false;
    }
  };

  const handleManualPresenceCheck = async () => {
    try {
      const res = await fetch('/api/presence/check', { method: 'POST' });
      if (!res.ok) throw new Error('Échec du test de présence');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      showToast(`Test de présence : ${data.onlineCount} actif(s), ${data.offlineCount} hors-ligne sur ${data.checkedCount}.`);
      return {
        checkedCount: data.checkedCount || 0,
        onlineCount: data.onlineCount || 0,
        offlineCount: data.offlineCount || 0
      };
    } catch (err) {
      console.error('Erreur test de présence:', err);
      showToast('Erreur lors du test de présence.');
      return null;
    }
  };

  const handleManualPrune = async () => {
    try {
      const res = await fetch('/api/inventory/prune', { method: 'POST' });
      if (!res.ok) throw new Error('Échec de la purge d\'inventaire');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.prunedCount > 0) {
        showToast(`${data.prunedCount} équipement(s) inactif(s) supprimé(s) de l'inventaire.`);
      } else {
        showToast('Aucun équipement inactif ne dépasse le délai de rétention.');
      }
      return {
        prunedCount: data.prunedCount || 0,
        prunedDevices: data.prunedDevices || []
      };
    } catch (err) {
      console.error('Erreur purge inventaire:', err);
      showToast('Erreur lors du nettoyage de l\'inventaire.');
      return null;
    }
  };

  // Export JSON topology (clean client-side blob download - immune to iframe navigation/HTML corruption)
  const handleExportTopology = async () => {
    try {
      showToast('Préparation de l\'export JSON...');

      // Live state is the primary source of truth (always holds user edits, node positions, newly created zones/types)
      const exportData = {
        app: 'InkaNetopology',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        subnet,
        devices,
        zones,
        types: deviceTypes,
        subTypes: deviceSubTypes
      };

      // Asynchronously sync snapshot with server persistence
      fetch('/api/export-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      }).catch(() => {});

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inkanetopology-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Fichier JSON exporté avec succès (${devices.length} équipements, ${zones.length} zones).`);
    } catch (err) {
      console.error('Erreur export JSON:', err);
      showToast('Échec de la génération du fichier JSON.');
    }
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
    const c: Record<string, number> = {
      all: devices.length,
      physical: 0,
      vm: 0,
      docker: 0,
      iot: 0
    };
    deviceTypes.forEach((t) => {
      c[t.id] = 0;
    });
    devices.forEach((d) => {
      c[d.deviceType] = (c[d.deviceType] || 0) + 1;
    });
    return c;
  }, [devices, deviceTypes]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Fixed Sticky Header & Circulation Area across ALL views */}
      <div className="sticky top-0 z-40 w-full shrink-0 shadow-md">
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
          showInspectorAndHighlight={showInspectorAndHighlight}
          onToggleInspectorAndHighlight={() =>
            setShowInspectorAndHighlight(!showInspectorAndHighlight)
          }
          onlineCount={onlineCount}
          totalCount={devices.length}
        />

      {/* Real-time Scan Progress Bar Banner */}
      {isScanning && (
        <div className="w-full bg-cyan-950/90 border-b border-cyan-800/80 px-6 py-1.5 flex items-center justify-between text-xs text-cyan-200">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold">Scan réseau en cours:</span>
            <span className="font-mono tabular-nums text-cyan-400">
              {currentScanningIp || subnet} ({scanProgress}%)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-48 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-cyan-800/50">
              <div
                className="bg-cyan-400 h-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <button
              onClick={handleCancelScan}
              className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 rounded transition-colors shadow-xs cursor-pointer active:scale-95"
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
        isScanning={isScanning}
        scanProgress={scanProgress}
        onTriggerScan={handleTriggerScan}
        onCancelScan={handleCancelScan}
        onOpenAddModal={() => {
          setAddModalPresetParentId(undefined);
          setAddModalPresetType(undefined);
          setIsAddModalOpen(true);
        }}
        onAutoLayout={handleStarTopologyLayout}
        onMergeDuplicates={handleMergeDuplicates}
        onMergeContainers={handleMergeDuplicates}
        selectedCount={selectedDevices.length}
        onOpenManualMerge={() => {
          if (selectedDevices.length >= 2) {
            setManualMergePresetDevices([selectedDevices[0], selectedDevices[1]]);
            setManualMergePresetDevice(selectedDevices[0]);
          } else if (selectedDevices.length === 1) {
            setManualMergePresetDevices([selectedDevices[0]]);
            setManualMergePresetDevice(selectedDevices[0]);
          } else {
            setManualMergePresetDevices(null);
            setManualMergePresetDevice(selectedDevice || null);
          }
          setIsManualMergeModalOpen(true);
        }}
        onExport={handleExportTopology}
        onResetTopology={handleResetTopology}
        onClearInventory={() => setIsClearModalOpen(true)}
        types={deviceTypes}
        onOpenTypeManager={() => setIsTypeManagerOpen(true)}
        showGeographicZones={showZoneEnclosures}
        onToggleShowGeographicZones={() => setShowZoneEnclosures(!showZoneEnclosures)}
        onOpenZoneManager={() => setIsZoneManagerOpen(true)}
        zonesCount={zones.length}
        allCollapsed={allCollapsed}
        onToggleAllCollapse={handleToggleAllCollapse}
        hasCollapsibleGroups={hasCollapsibleGroups}
        onImportTopology={handleImportTopology}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>

      {/* Main View Area by Tab */}
      <main className="w-full">
        {activeTab === 'topology' && (
          <TopologyCanvas
            allDevices={devices}
            devices={filteredDevices}
            zones={zones}
            types={deviceTypes}
            subTypes={deviceSubTypes}
            selectedDevice={selectedDevice}
            selectedDevices={selectedDevices}
            onSelectDevice={handleDeviceSelection}
            onEditDevice={(dev) => setEditingDevice(dev)}
            onDeleteDevice={handleDeleteDevice}
            onInitiateMerge={(dev) => {
              setManualMergePresetDevice(dev);
              setManualMergePresetDevices([dev]);
              setIsManualMergeModalOpen(true);
            }}
            onPingDevice={handlePingDevice}
            onSaveDevice={handleSaveDevice}
            onUpdateDevicePosition={handleUpdatePosition}
            onBatchUpdatePositions={handleBatchUpdatePositions}
            onAutoLayout={handleStarTopologyLayout}
            onTriggerScan={handleTriggerScan}
            onResetTopology={handleResetTopology}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onSaveZone={handleSaveZone}
            onDeleteZone={handleDeleteZone}
            onOpenZoneManager={() => setIsZoneManagerOpen(true)}
            showInspectorAndHighlight={showInspectorAndHighlight}
            groupByHost={groupByHost}
            showZoneEnclosures={showZoneEnclosures}
            collapsedHostIds={collapsedHostIds}
            onToggleCollapseHost={handleToggleCollapseHost}
            collapsedZoneIds={collapsedZoneIds}
            onToggleCollapseZone={handleToggleCollapseZone}
            canvasViewportId="topology-canvas-viewport"
            layoutTrigger={layoutTrigger}
          />
        )}

        {activeTab === 'hosts' && (
          <HostsDependencyView
            devices={devices}
            zones={zones}
            types={deviceTypes}
            subTypes={deviceSubTypes}
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
            allDevices={devices}
            devices={filteredDevices}
            zones={zones}
            types={deviceTypes}
            subTypes={deviceSubTypes}
            selectedDevice={selectedDevice}
            onSelectDevice={(dev) => handleDeviceSelection(dev)}
            onEditDevice={(dev) => setEditingDevice(dev)}
            onPingDevice={handlePingDevice}
            onDeleteDevice={handleDeleteDevice}
            onMergeDuplicates={handleMergeDuplicates}
            onMergeContainers={handleMergeDuplicates}
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
          types={deviceTypes}
          subTypes={deviceSubTypes}
          onOpenTypeManager={() => setIsTypeManagerOpen(true)}
          onSaveSubType={handleSaveSubType}
          isOpen={Boolean(editingDevice)}
          onClose={() => setEditingDevice(null)}
          onSave={handleSaveDevice}
          onDelete={handleDeleteDevice}
          onPing={handlePingDevice}
        />
      )}

      {/* Manual Merge Modal for Two Selected Equipment */}
      <ManualMergeModal
        isOpen={isManualMergeModalOpen}
        onClose={() => {
          setIsManualMergeModalOpen(false);
          setManualMergePresetDevice(null);
          setManualMergePresetDevices(null);
        }}
        devices={devices}
        preselectedDevice={manualMergePresetDevice}
        preselectedDevices={manualMergePresetDevices}
        onMerge={handleManualMerge}
      />

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddDevice}
        allDevices={devices}
        types={deviceTypes}
        subTypes={deviceSubTypes}
        presetParentId={addModalPresetParentId}
        presetType={addModalPresetType as any}
      />

      {/* Type & SubType / Role Manager Modal */}
      <TypeManagerModal
        isOpen={isTypeManagerOpen}
        onClose={() => setIsTypeManagerOpen(false)}
        types={deviceTypes}
        subTypes={deviceSubTypes}
        devices={devices}
        onSaveType={handleSaveType}
        onDeleteType={handleDeleteType}
        onSaveSubType={handleSaveSubType}
        onDeleteSubType={handleDeleteSubType}
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

      {/* Settings Modal (Presence Check & Inactive Inventory Auto-Prune) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onTriggerPresenceCheck={handleManualPresenceCheck}
        onTriggerPrune={handleManualPrune}
        devices={devices}
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
