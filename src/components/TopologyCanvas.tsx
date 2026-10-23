import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { Device, GeographicZone } from '../types/network';
import { DeviceNode } from './DeviceNode';
import { QuickLinkModal } from './QuickLinkModal';
import {
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  AlertCircle,
  Plus,
  RotateCcw,
  Layers,
  Box,
  Server,
  Link2,
  Cpu,
  ChevronDown,
  ChevronRight,
  MapPin,
  Home,
  Building2,
  Check,
  Edit2,
  Star,
  Compass
} from 'lucide-react';

interface TopologyCanvasProps {
  devices: Device[];
  zones?: GeographicZone[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onSaveDevice?: (device: Device) => void;
  onUpdateDevicePosition: (id: string, pos: { x: number; y: number }) => void;
  onAutoLayout?: () => void;
  onTriggerScan?: () => void;
  onResetTopology?: () => void;
  onOpenAddModal?: () => void;
  onSaveZone?: (zone: GeographicZone) => void;
  onDeleteZone?: (zoneId: string) => void;
  onOpenZoneManager?: () => void;
  groupByHost: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  devices,
  zones = [],
  selectedDevice,
  onSelectDevice,
  onEditDevice,
  onPingDevice,
  onSaveDevice,
  onUpdateDevicePosition,
  onAutoLayout,
  onTriggerScan,
  onResetTopology,
  onOpenAddModal,
  onSaveZone,
  onDeleteZone,
  onOpenZoneManager,
  groupByHost
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const [offset, setOffset] = useState({ x: -280, y: -220 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node drag state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Quick link modal state to edit organization and links directly on topology canvas
  const [linkingDevice, setLinkingDevice] = useState<Device | null>(null);

  // Collapsed host IDs (host groups folded/unfolded)
  const [collapsedHostIds, setCollapsedHostIds] = useState<Set<string>>(new Set());

  // Show / Hide geographic zone enclosures
  const [showZoneEnclosures, setShowZoneEnclosures] = useState(true);

  // Inline zone renaming state
  const [renamingZoneId, setRenamingZoneId] = useState<string | null>(null);
  const [renamingZoneName, setRenamingZoneName] = useState<string>('');

  // Toggle single host group collapse
  const toggleCollapseHost = (hostId: string) => {
    setCollapsedHostIds((prev) => {
      const next = new Set(prev);
      if (next.has(hostId)) {
        next.delete(hostId);
      } else {
        next.add(hostId);
      }
      return next;
    });
  };

  // NATIVE MOUSE WHEEL ZOOM WITH MOUSE-CENTERED TRANSFORM (PASSIVE: FALSE TO PREVENT PAGE SCROLL)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

      setScale((prevScale) => {
        const nextScale = Math.min(Math.max(prevScale * zoomFactor, 0.18), 2.5);
        setOffset((prevOffset) => {
          const nextOffsetX = mouseX - (mouseX - prevOffset.x) * (nextScale / prevScale);
          const nextOffsetY = mouseY - (mouseY - prevOffset.y) * (nextScale / prevScale);
          return { x: Math.round(nextOffsetX), y: Math.round(nextOffsetY) };
        });
        return +nextScale.toFixed(3);
      });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Manual Zoom buttons
  const handleZoom = (delta: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setScale((prevScale) => {
      const nextScale = Math.min(Math.max(prevScale + delta, 0.18), 2.5);
      setOffset((prevOffset) => {
        const nextOffsetX = centerX - (centerX - prevOffset.x) * (nextScale / prevScale);
        const nextOffsetY = centerY - (centerY - prevOffset.y) * (nextScale / prevScale);
        return { x: Math.round(nextOffsetX), y: Math.round(nextOffsetY) };
      });
      return +nextScale.toFixed(2);
    });
  };

  const handleSetScalePreset = (targetScale: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setScale((prevScale) => {
      setOffset((prevOffset) => {
        const nextOffsetX = centerX - (centerX - prevOffset.x) * (targetScale / prevScale);
        const nextOffsetY = centerY - (centerY - prevOffset.y) * (targetScale / prevScale);
        return { x: Math.round(nextOffsetX), y: Math.round(nextOffsetY) };
      });
      return targetScale;
    });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectDevice(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggedNodeId) {
      const dev = devices.find((d) => d.id === draggedNodeId);
      if (dev && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newX = Math.round((e.clientX - rect.left - offset.x) / scale - dragOffset.x);
        const newY = Math.round((e.clientY - rect.top - offset.y) / scale - dragOffset.y);
        onUpdateDevicePosition(draggedNodeId, { x: Math.max(10, newX), y: Math.max(10, newY) });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, dev: Device) => {
    e.stopPropagation();
    const pos = dev.position || { x: 100, y: 100 };
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - offset.x) / scale;
      const clickY = (e.clientY - rect.top - offset.y) / scale;
      setDragOffset({ x: clickX - pos.x, y: clickY - pos.y });
      setDraggedNodeId(dev.id);
      onSelectDevice(dev);
    }
  };

  // Maps for fast lookups
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

  // Identify Core Network Node (Center of the Star)
  const coreNode = useMemo(() => {
    return (
      devices.find(
        (d) =>
          d.subType === 'router' ||
          d.tags?.some((t) => t.toLowerCase().includes('passerelle') || t.toLowerCase().includes('cœur')) ||
          d.name.toLowerCase().includes('cœur') ||
          d.name.toLowerCase().includes('coeur') ||
          d.name.toLowerCase().includes('udm') ||
          d.ip.endsWith('.1') ||
          d.ip.endsWith('.254')
      ) ||
      devices.find((d) => d.subType === 'switch') ||
      devices[0]
    );
  }, [devices]);

  // Compute children counts per host
  const childrenCountMap = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => {
      if (d.parentHostId) {
        map.set(d.parentHostId, (map.get(d.parentHostId) || 0) + 1);
      }
    });
    return map;
  }, [devices]);

  // Hosts that actually have children attached
  const hostIdsWithChildren = useMemo(() => {
    return Array.from(childrenCountMap.keys()).filter((id) => (childrenCountMap.get(id) || 0) > 0);
  }, [childrenCountMap]);

  // Filter visible devices based on collapsed host groups
  const visibleDevices = useMemo(() => {
    return devices.filter((d) => {
      if (d.parentHostId && collapsedHostIds.has(d.parentHostId)) {
        return false;
      }
      return true;
    });
  }, [devices, collapsedHostIds]);

  const visibleDeviceIds = useMemo(() => new Set(visibleDevices.map((d) => d.id)), [visibleDevices]);

  // Links computation (only among visible nodes)
  const { physicalLinks, virtualLinks } = useMemo(() => {
    const phys: Array<{ from: Device; to: Device; label?: string; isAuto?: boolean }> = [];
    const virt: Array<{ host: Device; guest: Device; isDocker: boolean }> = [];

    devices.forEach((dev) => {
      if (!visibleDeviceIds.has(dev.id)) return;

      // 1. Virtualization link (VM or Docker container to host)
      if (dev.parentHostId && deviceMap.has(dev.parentHostId)) {
        const host = deviceMap.get(dev.parentHostId)!;
        if (visibleDeviceIds.has(host.id) && !collapsedHostIds.has(host.id)) {
          virt.push({
            host,
            guest: dev,
            isDocker: dev.deviceType === 'docker'
          });
        }
        return;
      }

      // 2. Explicit network switch link
      if (dev.connectedToSwitchId && deviceMap.has(dev.connectedToSwitchId)) {
        const sw = deviceMap.get(dev.connectedToSwitchId)!;
        if (visibleDeviceIds.has(sw.id)) {
          phys.push({
            from: sw,
            to: dev,
            label: dev.portOrInterface
          });
        }
        return;
      }

      // 3. Fallback star ray link to core router / switch
      if (coreNode && dev.id !== coreNode.id) {
        if (visibleDeviceIds.has(coreNode.id)) {
          phys.push({
            from: coreNode,
            to: dev,
            label: dev.portOrInterface || (dev.deviceType === 'iot' ? 'Wi-Fi / LAN' : 'LAN'),
            isAuto: true
          });
        }
      }
    });

    return { physicalLinks: phys, virtualLinks: virt };
  }, [devices, deviceMap, visibleDeviceIds, collapsedHostIds, coreNode]);

  // CLUSTER BOUNDING BOXES FOR HOST VIRTUALIZATION
  const hostClusters = useMemo(() => {
    if (!groupByHost) return [];

    const clusters: Array<{
      hostId: string;
      hostName: string;
      isDocker: boolean;
      childCount: number;
      isCollapsed: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const childrenByHost = new Map<string, Device[]>();
    devices.forEach((d) => {
      if (d.parentHostId) {
        const list = childrenByHost.get(d.parentHostId) || [];
        list.push(d);
        childrenByHost.set(d.parentHostId, list);
      }
    });

    childrenByHost.forEach((children, hostId) => {
      const host = deviceMap.get(hostId);
      if (!host || children.length === 0) return;

      const isCollapsed = collapsedHostIds.has(hostId);
      const allNodes = isCollapsed ? [host] : [host, ...children];

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      allNodes.forEach((node) => {
        const x = node.position?.x ?? 100;
        const y = node.position?.y ?? 100;
        if (x < minX) minX = x;
        if (x + 256 > maxX) maxX = x + 256;
        if (y < minY) minY = y;
        if (y + 170 > maxY) maxY = y + 170;
      });

      const padX = 28;
      const padY = 24;
      const isDocker = children.some((c) => c.deviceType === 'docker');

      clusters.push({
        hostId,
        hostName: host.name,
        isDocker,
        childCount: children.length,
        isCollapsed,
        x: Math.round(minX - padX),
        y: Math.round(minY - padY - 32),
        width: Math.round(maxX - minX + padX * 2),
        height: Math.round(maxY - minY + padY * 2 + 32)
      });
    });

    return clusters;
  }, [devices, deviceMap, groupByHost, collapsedHostIds]);

  // GEOGRAPHIC ZONE ENCLOSING BOUNDARIES (Pièces, Baies, Sous-Répartiteurs, Sites)
  const zoneClusters = useMemo(() => {
    if (!showZoneEnclosures) return [];

    const clusters: Array<{
      zone: GeographicZone;
      deviceCount: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const devicesByZone = new Map<string, Device[]>();
    visibleDevices.forEach((d) => {
      if (d.zoneId) {
        const list = devicesByZone.get(d.zoneId) || [];
        list.push(d);
        devicesByZone.set(d.zoneId, list);
      }
    });

    devicesByZone.forEach((devs, zId) => {
      const zone = zoneMap.get(zId);
      if (!zone || devs.length === 0) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      devs.forEach((node) => {
        const x = node.position?.x ?? 100;
        const y = node.position?.y ?? 100;
        if (x < minX) minX = x;
        if (x + 256 > maxX) maxX = x + 256;
        if (y < minY) minY = y;
        if (y + 170 > maxY) maxY = y + 170;
      });

      const padX = 36;
      const padY = 32;

      clusters.push({
        zone,
        deviceCount: devs.length,
        x: Math.round(minX - padX),
        y: Math.round(minY - padY - 36),
        width: Math.round(maxX - minX + padX * 2),
        height: Math.round(maxY - minY + padY * 2 + 36)
      });
    });

    return clusters;
  }, [visibleDevices, zoneMap, showZoneEnclosures]);

  // Check if all host groups are collapsed
  const allCollapsed = useMemo(() => {
    if (hostIdsWithChildren.length === 0) return false;
    return hostIdsWithChildren.every((id) => collapsedHostIds.has(id));
  }, [hostIdsWithChildren, collapsedHostIds]);

  const toggleAllCollapse = () => {
    if (allCollapsed) {
      setCollapsedHostIds(new Set());
    } else {
      setCollapsedHostIds(new Set(hostIdsWithChildren));
    }
  };

  // Start inline zone renaming
  const handleStartRenameZone = (zone: GeographicZone) => {
    setRenamingZoneId(zone.id);
    setRenamingZoneName(zone.name);
  };

  // Submit inline zone renaming
  const handleSaveRenameZone = (zone: GeographicZone) => {
    if (renamingZoneName.trim() && onSaveZone) {
      onSaveZone({
        ...zone,
        name: renamingZoneName.trim()
      });
    }
    setRenamingZoneId(null);
  };

  // Helper for zone type icon
  const getZoneTypeIcon = (type: string) => {
    switch (type) {
      case 'baie':
        return <Server className="w-3.5 h-3.5" />;
      case 'sous_repartiteur':
        return <Layers className="w-3.5 h-3.5" />;
      case 'piece':
        return <Home className="w-3.5 h-3.5" />;
      case 'site':
        return <Building2 className="w-3.5 h-3.5" />;
      default:
        return <MapPin className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative w-full h-[calc(100vh-175px)] bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{
        backgroundImage: `radial-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px)`,
        backgroundSize: '28px 28px'
      }}
    >
      {/* Empty State Banner if no devices */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <AlertCircle className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">Aucun équipement sur la topologie</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Lancez un scan réseau ou ajoutez un équipement manuellement pour générer automatiquement le schéma en étoile.
          </p>
        </div>
      )}

      {/* Floating Canvas Action Toolbar (Top-Right) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex-wrap justify-end">
        {/* Direct Link Editor for selected device */}
        {selectedDevice && (
          <button
            onClick={() => setLinkingDevice(selectedDevice)}
            title={`Modifier l'organisation et les liaisons de "${selectedDevice.name}"`}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border border-indigo-400/50 cursor-pointer animate-in fade-in"
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-200" />
            <span className="truncate max-w-[150px]">Liaisons : {selectedDevice.name}</span>
          </button>
        )}

        {/* Geographic Zones Toggle */}
        <button
          onClick={() => setShowZoneEnclosures(!showZoneEnclosures)}
          title={showZoneEnclosures ? 'Masquer les délimitations de zones' : 'Afficher les délimitations de zones'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border cursor-pointer ${
            showZoneEnclosures
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-200 hover:bg-amber-900/60'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>Zones géographiques</span>
        </button>

        {/* Zone Manager Modal Trigger */}
        {onOpenZoneManager && (
          <button
            onClick={onOpenZoneManager}
            title="Gérer, ajouter ou renommer les zones géographiques (pièces, baies, sous-répartiteurs, sites)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gérer les zones ({zones.length})</span>
          </button>
        )}

        {/* Global Expand / Collapse All Groups */}
        {hostIdsWithChildren.length > 0 && (
          <button
            onClick={toggleAllCollapse}
            title={allCollapsed ? 'Déplier tous les groupes hôtes/machines' : 'Replier tous les groupes hôtes/machines'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{allCollapsed ? 'Tout déplier' : 'Tout replier'}</span>
          </button>
        )}

        {/* Star Auto Layout Button */}
        {onAutoLayout && (
          <button
            onClick={onAutoLayout}
            title="Réorganiser automatiquement le schéma en topologie en étoile avec le cœur de réseau au centre"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-cyan-600/95 hover:bg-cyan-500 text-white rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border border-cyan-400/50 cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-cyan-200 text-cyan-200" />
            <span>Topologie en Étoile</span>
          </button>
        )}
      </div>

      {/* Zoom Controls Overlay (Bottom-Right) - "Centrer la vue" is completely removed */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md">
          <button
            onClick={() => handleZoom(0.15)}
            title="Zoom avant (Molette vers le haut)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            title="Zoom arrière (Molette vers le bas)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleSetScalePreset(1.0)}
            title="Échelle réelle 100%"
            className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            100%
          </button>

          <div className="px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-cyan-400 font-semibold border-l border-slate-800">
            {Math.round(scale * 100)}%
          </div>
        </div>

        {/* Mouse wheel helper badge */}
        <div className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-400 font-mono pointer-events-none backdrop-blur-xs">
          Molette : Zoom · Glisser : Déplacement · Clic Nom : Éditer
        </div>
      </div>

      {/* Legend / Overlay (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2 pointer-events-none backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="text-[11px] text-amber-300 font-bold">Cœur de réseau au centre de l'étoile</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-0.5 bg-sky-500 rounded-full" />
          <span className="text-[11px] text-slate-300 font-medium">Liaison réseau physique (Câble LAN)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-0.5 border-b-2 border-indigo-400 border-dashed" />
          <span className="text-[11px] text-indigo-300 font-medium">Rattachement Machine Virtuelle (Hyperviseur)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-0.5 border-b-2 border-cyan-400 border-dashed" />
          <span className="text-[11px] text-cyan-300 font-medium">Conteneur Docker sur Hôte physique</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-slate-400">Zones géographiques éditables & renommables</span>
        </div>
      </div>

      {/* Main Scaled & Panned Canvas Viewport */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* SVG Canvas for Host Clusters, Geographic Zones, and Star Rays */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '10000px', height: '10000px' }}
        >
          <defs>
            <marker
              id="arrow-vm"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#818cf8" />
            </marker>
            <marker
              id="arrow-docker"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#22d3ee" />
            </marker>
          </defs>

          {/* 1. GEOGRAPHIC ZONE BOUNDING ENCLOSURES (Pièces, Baies, Sous-Répartiteurs, Sites) */}
          {zoneClusters.map((cluster) => {
            const zColor = cluster.zone.color || '#0ea5e9';
            return (
              <g key={`zone-rect-${cluster.zone.id}`} className="transition-all duration-300">
                <rect
                  x={cluster.x}
                  y={cluster.y}
                  width={cluster.width}
                  height={cluster.height}
                  rx="22"
                  ry="22"
                  fill={`${zColor}0d`}
                  stroke={zColor}
                  strokeWidth="1.5"
                  strokeDasharray="8 6"
                  strokeOpacity="0.45"
                />
              </g>
            );
          })}

          {/* 2. VISUAL HOST CLUSTER ENCLOSING BOUNDARIES (DOCKER & VM GROUPS) */}
          {hostClusters.map((cluster) => {
            const isDocker = cluster.isDocker;
            const isCollapsed = cluster.isCollapsed;
            const strokeColor = isCollapsed
              ? 'rgba(245, 158, 11, 0.45)'
              : isDocker
              ? 'rgba(34, 211, 238, 0.4)'
              : 'rgba(129, 140, 248, 0.4)';
            const fillColor = isCollapsed
              ? 'rgba(69, 26, 3, 0.15)'
              : isDocker
              ? 'rgba(8, 47, 73, 0.22)'
              : 'rgba(49, 46, 129, 0.22)';

            return (
              <g key={`cluster-${cluster.hostId}`} className="transition-all duration-300">
                <rect
                  x={cluster.x}
                  y={cluster.y}
                  width={cluster.width}
                  height={cluster.height}
                  rx="18"
                  ry="18"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeDasharray={isCollapsed ? '4 4' : '6 4'}
                />
              </g>
            );
          })}

          {/* 3. Physical Network Cables (Solid Lines with Speed / Port Label) */}
          {physicalLinks.map(({ from, to, label, isAuto }, i) => {
            const p1 = from.position || { x: 400, y: 100 };
            const p2 = to.position || { x: 400, y: 300 };
            const x1 = p1.x + 128;
            const y1 = p1.y + 70;
            const x2 = p2.x + 128;
            const y2 = p2.y + 20;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const isRelated =
              selectedDevice &&
              (selectedDevice.id === from.id || selectedDevice.id === to.id);

            return (
              <g key={`phys-${i}`}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isRelated ? '#38bdf8' : isAuto ? '#0284c7' : '#0369a1'}
                  strokeWidth={isRelated ? '3.5' : isAuto ? '1.5' : '2'}
                  strokeOpacity={isRelated ? '1' : isAuto ? '0.45' : '0.65'}
                />
                {label && (
                  <g transform={`translate(${midX}, ${midY - 4})`}>
                    <rect
                      x={-label.length * 3.5 - 4}
                      y="-10"
                      width={label.length * 7 + 8}
                      height="14"
                      rx="3"
                      fill="#020617"
                      fillOpacity="0.8"
                    />
                    <text
                      x="0"
                      y="0"
                      fill={isRelated ? '#38bdf8' : '#94a3b8'}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 4. Virtualization Dependency Links (Dashed Bezier Splines) */}
          {virtualLinks.map(({ host, guest, isDocker }, i) => {
            const p1 = host.position || { x: 400, y: 200 };
            const p2 = guest.position || { x: 400, y: 400 };
            const x1 = p1.x + 128;
            const y1 = p1.y + 120;
            const x2 = p2.x + 128;
            const y2 = p2.y + 8;

            const midY = (y1 + y2) / 2;
            const isRelated =
              selectedDevice &&
              (selectedDevice.id === host.id || selectedDevice.id === guest.id);

            const strokeColor = isDocker ? '#22d3ee' : '#818cf8';

            return (
              <g key={`virt-${i}`}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isRelated ? '3.5' : '2.5'}
                  strokeDasharray="6 4"
                  strokeOpacity={isRelated ? '1' : '0.8'}
                  markerEnd={isDocker ? 'url(#arrow-docker)' : 'url(#arrow-vm)'}
                />
              </g>
            );
          })}
        </svg>

        {/* 5. INTERACTIVE GEOGRAPHIC ZONE HEADERS (Renamable & Editable inline directly from Canvas) */}
        {zoneClusters.map((cluster) => {
          const zone = cluster.zone;
          const isRenaming = renamingZoneId === zone.id;
          const zColor = zone.color || '#0ea5e9';

          return (
            <div
              key={`zone-hdr-${zone.id}`}
              style={{
                position: 'absolute',
                left: `${cluster.x + 16}px`,
                top: `${cluster.y + 6}px`,
                zIndex: 14
              }}
              className="pointer-events-auto flex items-center gap-2"
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-md text-xs font-semibold bg-slate-900/90 border-slate-700/80"
                style={{ borderColor: `${zColor}80` }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: zColor }}
                />
                <span className="text-slate-400">
                  {getZoneTypeIcon(zone.type)}
                </span>

                {isRenaming ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renamingZoneName}
                      onChange={(e) => setRenamingZoneName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRenameZone(zone);
                        if (e.key === 'Escape') setRenamingZoneId(null);
                      }}
                      className="px-2 py-0.5 text-xs bg-slate-950 border border-cyan-400 rounded text-white font-medium focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRenameZone(zone)}
                      title="Valider le renommage"
                      className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartRenameZone(zone)}
                    title={`Cliquer pour renommer directement la zone "${zone.name}"`}
                    className="flex items-center gap-1.5 hover:text-cyan-300 cursor-pointer group/ztitle"
                  >
                    <span className="text-slate-100 font-semibold">{zone.name}</span>
                    <Edit2 className="w-3 h-3 text-slate-500 opacity-60 group-hover/ztitle:opacity-100 group-hover/ztitle:text-cyan-400 transition-opacity" />
                  </button>
                )}

                <span className="text-slate-500 font-normal">·</span>
                <span className="text-[11px] font-mono text-slate-300">
                  {cluster.deviceCount} équipement{cluster.deviceCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}

        {/* 6. Interactive Host Cluster Headers (Expand / Collapse groups) */}
        {hostClusters.map((cluster) => {
          const isDocker = cluster.isDocker;
          const isCollapsed = cluster.isCollapsed;

          return (
            <div
              key={`cluster-hdr-${cluster.hostId}`}
              style={{
                position: 'absolute',
                left: `${cluster.x + 14}px`,
                top: `${cluster.y + 8}px`,
                zIndex: 15
              }}
              className="pointer-events-auto flex items-center gap-2"
            >
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-md text-xs font-semibold ${
                  isCollapsed
                    ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                    : isDocker
                    ? 'bg-sky-950/90 border-cyan-500/50 text-cyan-200'
                    : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isDocker ? (
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{cluster.hostName}</span>
                  <span className="text-slate-400 font-normal">·</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {cluster.childCount} {isDocker ? 'conteneurs' : 'VMs'}
                  </span>
                </span>

                {/* Direct Fold / Unfold Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseHost(cluster.hostId);
                  }}
                  title={
                    isCollapsed
                      ? `Déplier les ${cluster.childCount} machines masquées`
                      : 'Replier ce groupe pour aérer la vue'
                  }
                  className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer border ${
                    isCollapsed
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isCollapsed ? (
                    <>
                      <ChevronRight className="w-3 h-3 text-amber-400" />
                      <span>Déplier ({cluster.childCount})</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 text-cyan-400" />
                      <span>Replier</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* 7. Visible Device Nodes Layer */}
        {visibleDevices.map((device) => {
          const pos = device.position || { x: 100, y: 100 };
          const parentDevice = device.parentHostId
            ? deviceMap.get(device.parentHostId)
            : undefined;

          const childCount = childrenCountMap.get(device.id) || 0;
          const isCollapsed = collapsedHostIds.has(device.id);
          const zone = device.zoneId ? zoneMap.get(device.zoneId) : undefined;
          const isCore = coreNode ? device.id === coreNode.id : false;

          return (
            <div
              key={device.id}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, device)}
            >
              <DeviceNode
                device={device}
                parentDevice={parentDevice}
                zone={zone}
                isCore={isCore}
                isSelected={selectedDevice?.id === device.id}
                onSelect={onSelectDevice}
                onEdit={onEditDevice}
                onPing={onPingDevice}
                onQuickLink={(dev) => setLinkingDevice(dev)}
                isDragging={draggedNodeId === device.id}
                childCount={childCount}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapseHost}
              />
            </div>
          );
        })}
      </div>

      {/* Quick Link & Organization Modal (Directly on canvas) */}
      <QuickLinkModal
        device={linkingDevice}
        allDevices={devices}
        zones={zones}
        isOpen={Boolean(linkingDevice)}
        onClose={() => setLinkingDevice(null)}
        onSave={(updated) => {
          if (onSaveDevice) {
            onSaveDevice(updated);
          }
          setLinkingDevice(null);
        }}
      />
    </div>
  );
};
