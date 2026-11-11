import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { Device, GeographicZone, DeviceTypeDefinition, DeviceSubTypeDefinition } from '../types/network';
import { DeviceNode } from './DeviceNode';
import { QuickLinkModal } from './QuickLinkModal';
import { DeviceSummaryCard } from './DeviceSummaryCard';
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
  ChevronUp,
  ChevronRight,
  MapPin,
  Home,
  Building2,
  Check,
  Edit2,
  Star,
  Compass,
  GripHorizontal,
  Move,
  Tag
} from 'lucide-react';
import { getDeviceTypeColor, getDeviceTypeLabel } from '../utils/hardwareIcons';

interface TopologyCanvasProps {
  allDevices?: Device[];
  devices: Device[];
  zones?: GeographicZone[];
  types?: DeviceTypeDefinition[];
  subTypes?: DeviceSubTypeDefinition[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice?: (id: string) => void;
  onInitiateMerge?: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onSaveDevice?: (device: Device) => void;
  onUpdateDevicePosition: (id: string, pos: { x: number; y: number }) => void;
  onBatchUpdatePositions?: (updates: Array<{ id: string; pos: { x: number; y: number } }>) => void;
  onAutoLayout?: () => void;
  onTriggerScan?: () => void;
  onResetTopology?: () => void;
  onOpenAddModal?: () => void;
  onSaveZone?: (zone: GeographicZone) => void;
  onDeleteZone?: (zoneId: string) => void;
  onOpenZoneManager?: () => void;
  showInspectorAndHighlight?: boolean;
  groupByHost: boolean;
  showZoneEnclosures?: boolean;
  collapsedHostIds?: Set<string>;
  onToggleCollapseHost?: (hostId: string) => void;
  collapsedZoneIds?: Set<string>;
  onToggleCollapseZone?: (zoneId: string) => void;
  canvasViewportId?: string;
  layoutTrigger?: number;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  allDevices,
  devices,
  zones = [],
  types = [],
  subTypes = [],
  selectedDevice,
  onSelectDevice,
  onEditDevice,
  onDeleteDevice,
  onInitiateMerge,
  onPingDevice,
  onSaveDevice,
  onUpdateDevicePosition,
  onBatchUpdatePositions,
  onAutoLayout,
  onTriggerScan,
  onResetTopology,
  onOpenAddModal,
  onSaveZone,
  onDeleteZone,
  onOpenZoneManager,
  showInspectorAndHighlight = true,
  groupByHost,
  showZoneEnclosures: propShowZoneEnclosures,
  collapsedHostIds: propCollapsedHostIds,
  onToggleCollapseHost: propOnToggleCollapseHost,
  collapsedZoneIds: propCollapsedZoneIds,
  onToggleCollapseZone: propOnToggleCollapseZone,
  canvasViewportId = 'topology-canvas-viewport',
  layoutTrigger
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const [offset, setOffset] = useState({ x: -280, y: -220 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Single node drag state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Group / Zone multi-node drag state
  const [draggedZoneId, setDraggedZoneId] = useState<string | null>(null);
  const [draggedClusterHostId, setDraggedClusterHostId] = useState<string | null>(null);
  const multiDragStartRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const multiDragInitialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Quick link modal state to edit organization and links directly on topology canvas
  const [linkingDevice, setLinkingDevice] = useState<Device | null>(null);

  // Host groups collapse state (internal fallback or controlled)
  const [internalCollapsedHostIds, setInternalCollapsedHostIds] = useState<Set<string>>(new Set());
  const collapsedHostIds = propCollapsedHostIds ?? internalCollapsedHostIds;

  const toggleCollapseHost = (hostId: string) => {
    if (propOnToggleCollapseHost) {
      propOnToggleCollapseHost(hostId);
    } else {
      setInternalCollapsedHostIds((prev) => {
        const next = new Set(prev);
        if (next.has(hostId)) next.delete(hostId);
        else next.add(hostId);
        return next;
      });
    }
  };

  // Geographic zones collapse state (internal fallback or controlled)
  const [internalCollapsedZoneIds, setInternalCollapsedZoneIds] = useState<Set<string>>(new Set());
  const collapsedZoneIds = propCollapsedZoneIds ?? internalCollapsedZoneIds;

  const toggleCollapseZone = (zoneId: string) => {
    if (propOnToggleCollapseZone) {
      propOnToggleCollapseZone(zoneId);
    } else {
      setInternalCollapsedZoneIds((prev) => {
        const next = new Set(prev);
        if (next.has(zoneId)) next.delete(zoneId);
        else next.add(zoneId);
        return next;
      });
    }
  };

  // Show / Hide geographic zone enclosures
  const showZoneEnclosures = propShowZoneEnclosures ?? true;

  // Draggable & Collapsible Legend Overlay
  const [legendPos, setLegendPos] = useState({ x: 20, y: 20 });
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [legendTab, setLegendTab] = useState<'general' | 'zones' | 'types' | 'roles'>('general');
  const [isDraggingLegend, setIsDraggingLegend] = useState(false);
  const legendDragOffsetRef = useRef({ x: 0, y: 0 });

  // Inline zone renaming state
  const [renamingZoneId, setRenamingZoneId] = useState<string | null>(null);
  const [renamingZoneName, setRenamingZoneName] = useState<string>('');

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

  // Canonical Core Network Node determined from the COMPLETE inventory (allDevices)
  // CRITICAL: The core node MUST remain the true core whether selected, displayed, or filtered out.
  // Never assign core status to a non-core device!
  const trueCoreNode = useMemo(() => {
    const list = allDevices && allDevices.length > 0 ? allDevices : devices;
    const manuals = list.filter((d) => d.isCore === true);
    if (manuals.length > 0) return manuals[0];
    const defaultCore =
      list.find(
        (d) =>
          d.subType === 'router' ||
          d.tags?.some((t) => t.toLowerCase().includes('passerelle') || t.toLowerCase().includes('cœur') || t.toLowerCase().includes('coeur')) ||
          d.name.toLowerCase().includes('cœur') ||
          d.name.toLowerCase().includes('coeur') ||
          d.name.toLowerCase().includes('udm') ||
          d.ip.endsWith('.1') ||
          d.ip.endsWith('.254')
      ) ||
      list.find((d) => d.subType === 'switch') ||
      list[0];
    return defaultCore || null;
  }, [allDevices, devices]);

  const isDraggingActive = Boolean(
    draggedNodeId || draggedZoneId || draggedClusterHostId || isPanning || isDraggingLegend
  );
  const isDraggingActiveRef = useRef(false);
  isDraggingActiveRef.current = isDraggingActive;

  const centerViewOnCoreRef = useRef<((targetScale?: number) => void) | null>(null);

  // Center automatically ONLY on initial load when devices first arrive
  const hasInitiallyCenteredRef = useRef(false);
  useEffect(() => {
    if (!hasInitiallyCenteredRef.current && devices.length > 0) {
      hasInitiallyCenteredRef.current = true;
      const timer = setTimeout(() => {
        if (!isDraggingActiveRef.current && centerViewOnCoreRef.current) {
          centerViewOnCoreRef.current();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [devices.length]);

  // Recenter automatically ONLY when user explicitly triggers "Générer le schéma" (layoutTrigger increments)
  const lastHandledLayoutTriggerRef = useRef(0);
  useEffect(() => {
    if (layoutTrigger && layoutTrigger > 0 && layoutTrigger !== lastHandledLayoutTriggerRef.current) {
      lastHandledLayoutTriggerRef.current = layoutTrigger;
      const timer = setTimeout(() => {
        if (!isDraggingActiveRef.current && centerViewOnCoreRef.current) {
          centerViewOnCoreRef.current();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [layoutTrigger]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectDevice(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingLegend) {
      setLegendPos({
        x: Math.max(10, e.clientX - legendDragOffsetRef.current.x),
        y: Math.max(10, e.clientY - legendDragOffsetRef.current.y)
      });
      return;
    }

    if (draggedZoneId || draggedClusterHostId) {
      const deltaX = Math.round((e.clientX - multiDragStartRef.current.clientX) / scale);
      const deltaY = Math.round((e.clientY - multiDragStartRef.current.clientY) / scale);
      if (onBatchUpdatePositions) {
        const updates: Array<{ id: string; pos: { x: number; y: number } }> = [];
        multiDragInitialPositionsRef.current.forEach((initialPos, id) => {
          updates.push({
            id,
            pos: { x: initialPos.x + deltaX, y: initialPos.y + deltaY }
          });
        });
        onBatchUpdatePositions(updates);
      } else {
        multiDragInitialPositionsRef.current.forEach((initialPos, id) => {
          onUpdateDevicePosition(id, {
            x: initialPos.x + deltaX,
            y: initialPos.y + deltaY
          });
        });
      }
      return;
    }

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
        onUpdateDevicePosition(draggedNodeId, { x: newX, y: newY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
    setDraggedZoneId(null);
    setDraggedClusterHostId(null);
    setIsDraggingLegend(false);
  };

  // Group / Geographic Zone Drag Start (Drags all member devices together!)
  const handleZoneHeaderMouseDown = (e: React.MouseEvent, zoneId: string) => {
    e.stopPropagation();
    const zoneDevices = devices.filter((d) => d.zoneId === zoneId);
    if (zoneDevices.length === 0) return;

    multiDragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    const initialMap = new Map<string, { x: number; y: number }>();
    zoneDevices.forEach((d) => {
      initialMap.set(d.id, { ...(d.position || { x: 100, y: 100 }) });
    });
    multiDragInitialPositionsRef.current = initialMap;
    setDraggedZoneId(zoneId);
  };

  // Host Cluster Drag Start (Drags host and all child VMs/containers together without leaving any nested children behind!)
  const handleClusterHeaderMouseDown = (e: React.MouseEvent, hostId: string) => {
    e.stopPropagation();
    const host = devices.find((d) => d.id === hostId);

    const getAllDescendants = (hId: string, visited = new Set<string>()): Device[] => {
      if (visited.has(hId)) return [];
      visited.add(hId);
      const direct = devices.filter((d) => d.parentHostId === hId);
      const res: Device[] = [];
      for (const c of direct) {
        res.push(c);
        res.push(...getAllDescendants(c.id, visited));
      }
      return res;
    };

    const allDescendants = getAllDescendants(hostId);
    const clusterDevices = host ? [host, ...allDescendants] : allDescendants;
    if (clusterDevices.length === 0) return;

    multiDragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    const initialMap = new Map<string, { x: number; y: number }>();
    clusterDevices.forEach((d) => {
      initialMap.set(d.id, { ...(d.position || { x: 100, y: 100 }) });
    });
    multiDragInitialPositionsRef.current = initialMap;
    setDraggedClusterHostId(hostId);
  };

  // Legend Drag Start
  const handleLegendMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingLegend(true);
    legendDragOffsetRef.current = {
      x: e.clientX - legendPos.x,
      y: e.clientY - legendPos.y
    };
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

  // Filter visible devices based on collapsed host groups (recursively for nested VMs/containers) AND collapsed geographic zones
  const visibleDevices = useMemo(() => {
    return devices.filter((d) => {
      // Check if any ancestor host is collapsed
      let current = d;
      let depth = 0;
      while (current.parentHostId && depth < 20) {
        if (collapsedHostIds.has(current.parentHostId)) {
          return false;
        }
        const parent = deviceMap.get(current.parentHostId);
        if (!parent) break;
        current = parent;
        depth++;
      }

      if (d.zoneId && collapsedZoneIds.has(d.zoneId)) {
        return false;
      }
      return true;
    });
  }, [devices, deviceMap, collapsedHostIds, collapsedZoneIds]);

  const visibleDeviceIds = useMemo(() => new Set(visibleDevices.map((d) => d.id)), [visibleDevices]);

  // Is the true core node currently visible in the active filtered view?
  const isTrueCoreVisible = useMemo(() => {
    return trueCoreNode ? visibleDeviceIds.has(trueCoreNode.id) : false;
  }, [trueCoreNode, visibleDeviceIds]);

  // Center viewport on the network core node (if visible) or visible devices average center
  const centerViewOnCore = useCallback((targetScale?: number) => {
    if (isDraggingActiveRef.current) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentScale = targetScale ?? scale;

    const targetCore = isTrueCoreVisible ? trueCoreNode : null;
    let targetX = 1800;
    let targetY = 1400;

    if (targetCore?.position) {
      targetX = targetCore.position.x + 140;
      targetY = targetCore.position.y + 110;
    } else if (visibleDevices.length > 0) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      visibleDevices.forEach((d) => {
        if (d.position) {
          sumX += d.position.x + 140;
          sumY += d.position.y + 110;
          count++;
        }
      });
      if (count > 0) {
        targetX = sumX / count;
        targetY = sumY / count;
      }
    }

    const nextOffsetX = Math.round(rect.width / 2 - targetX * currentScale);
    const nextOffsetY = Math.round(rect.height / 2 - targetY * currentScale);
    setOffset({ x: nextOffsetX, y: nextOffsetY });
  }, [trueCoreNode, isTrueCoreVisible, visibleDevices, scale]);

  centerViewOnCoreRef.current = centerViewOnCore;

  // Links computation (strictly among visible nodes, never re-routing to an arbitrary fake core)
  const { physicalLinks, virtualLinks } = useMemo(() => {
    const phys: Array<{ from: Device; to: Device; label?: string; isAuto?: boolean }> = [];
    const virt: Array<{ host: Device; guest: Device; isDocker: boolean }> = [];

    devices.forEach((dev) => {
      if (!visibleDeviceIds.has(dev.id)) return;

      // 1. Virtualization link (VM or Docker container to host)
      // Only draw if BOTH the guest and the host are currently visible
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
      // Only draw if BOTH endpoints (switch and device) are visible
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

      // 3. Fallback star ray link to canonical core router / switch
      // CRITICAL: The core network node remains the true canonical core, visible or not.
      // If the true core node is NOT visible in the filtered view, links to it are simply not displayed!
      // They are NEVER re-routed to an arbitrary device!
      if (trueCoreNode && isTrueCoreVisible && dev.id !== trueCoreNode.id) {
        phys.push({
          from: trueCoreNode,
          to: dev,
          label: dev.portOrInterface || (dev.deviceType === 'iot' ? 'Wi-Fi / LAN' : 'LAN'),
          isAuto: true
        });
      }
    });

    return { physicalLinks: phys, virtualLinks: virt };
  }, [devices, deviceMap, visibleDeviceIds, collapsedHostIds, trueCoreNode, isTrueCoreVisible]);

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

    const getDescendants = (hId: string, visited = new Set<string>()): Device[] => {
      if (visited.has(hId)) return [];
      visited.add(hId);
      const direct = devices.filter((d) => d.parentHostId === hId);
      const res: Device[] = [];
      for (const c of direct) {
        res.push(c);
        res.push(...getDescendants(c.id, visited));
      }
      return res;
    };

    // Find hosts with children
    const hostCandidates = devices.filter((d) => {
      // Must have children
      return devices.some((c) => c.parentHostId === d.id);
    });

    hostCandidates.forEach((host) => {
      // Only draw cluster box for top-level hosts (not a child of another host in the diagram)
      if (host.parentHostId && deviceMap.has(host.parentHostId)) {
        return;
      }

      const allDescendants = getDescendants(host.id);
      if (allDescendants.length === 0) return;

      const isCollapsed = collapsedHostIds.has(host.id);
      const allNodes = isCollapsed ? [host] : [host, ...allDescendants];

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      allNodes.forEach((node) => {
        const x = node.position?.x ?? 100;
        const y = node.position?.y ?? 100;
        if (x < minX) minX = x;
        if (x + 280 > maxX) maxX = x + 280;
        if (y < minY) minY = y;
        if (y + 220 > maxY) maxY = y + 220;
      });

      const padX = 36;
      const padY = 32;
      const isDocker = allDescendants.some((c) => c.deviceType === 'docker');

      clusters.push({
        hostId: host.id,
        hostName: host.name,
        isDocker,
        childCount: allDescendants.length,
        isCollapsed,
        x: Math.round(minX - padX),
        y: Math.round(minY - padY - 36),
        width: Math.max(340, Math.round(maxX - minX + padX * 2)),
        height: Math.max(220, Math.round(maxY - minY + padY * 2 + 36))
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
      isCollapsed: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const allZoneDevices = new Map<string, Device[]>();
    devices.forEach((d) => {
      if (d.zoneId) {
        const list = allZoneDevices.get(d.zoneId) || [];
        list.push(d);
        allZoneDevices.set(d.zoneId, list);
      }
    });

    allZoneDevices.forEach((devs, zId) => {
      const zone = zoneMap.get(zId);
      if (!zone || devs.length === 0) return;

      const isCollapsed = collapsedZoneIds.has(zId);

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      devs.forEach((node) => {
        const x = node.position?.x ?? 100;
        const y = node.position?.y ?? 100;
        if (x < minX) minX = x;
        if (x + 280 > maxX) maxX = x + 280;
        if (y < minY) minY = y;
        if (y + 220 > maxY) maxY = y + 220;
      });

      const padX = 40;
      const padY = 36;
      const headerH = 48;

      if (isCollapsed) {
        clusters.push({
          zone,
          deviceCount: devs.length,
          isCollapsed: true,
          x: Math.round(minX - padX),
          y: Math.round(minY - padY - headerH),
          width: 310,
          height: 52
        });
      } else {
        clusters.push({
          zone,
          deviceCount: devs.length,
          isCollapsed: false,
          x: Math.round(minX - padX),
          y: Math.round(minY - padY - headerH),
          width: Math.max(360, Math.round(maxX - minX + padX * 2)),
          height: Math.max(240, Math.round(maxY - minY + padY * 2 + headerH))
        });
      }
    });

    return clusters;
  }, [devices, zoneMap, showZoneEnclosures, collapsedZoneIds]);

  // Check if all host groups are collapsed
  const allCollapsed = useMemo(() => {
    if (hostIdsWithChildren.length === 0) return false;
    return hostIdsWithChildren.every((id) => collapsedHostIds.has(id));
  }, [hostIdsWithChildren, collapsedHostIds]);

  const toggleAllCollapse = () => {
    if (propOnToggleCollapseHost) {
      hostIdsWithChildren.forEach((id) => {
        if (allCollapsed && collapsedHostIds.has(id)) {
          propOnToggleCollapseHost(id);
        } else if (!allCollapsed && !collapsedHostIds.has(id)) {
          propOnToggleCollapseHost(id);
        }
      });
    } else {
      setInternalCollapsedHostIds(allCollapsed ? new Set() : new Set(hostIdsWithChildren));
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

  // Helper for zone type French label
  const getZoneTypeLabel = (type: string) => {
    switch (type) {
      case 'baie':
        return 'Baie';
      case 'sous_repartiteur':
        return 'Sous-répartiteur';
      case 'piece':
        return 'Pièce';
      case 'site':
        return 'Site';
      default:
        return 'Autre';
    }
  };

  // Statistics and categorizations for the comprehensive Legend
  const legendStats = useMemo(() => {
    // 1. Zones breakdown with device count
    const zoneCounts = new Map<string, number>();
    devices.forEach((d) => {
      if (d.zoneId) {
        zoneCounts.set(d.zoneId, (zoneCounts.get(d.zoneId) || 0) + 1);
      }
    });

    const activeZones = zones.map((z) => ({
      zone: z,
      count: zoneCounts.get(z.id) || 0
    }));

    const unassignedZoneCount = devices.filter((d) => !d.zoneId).length;

    // 2. Types breakdown with device count
    const builtInTypeIds = ['physical', 'vm', 'docker', 'iot'];
    const allTypeIds = new Set<string>(builtInTypeIds);
    types.forEach((t) => allTypeIds.add(t.id));
    devices.forEach((d) => {
      if (d.deviceType) allTypeIds.add(d.deviceType);
    });

    const typeCounts = new Map<string, number>();
    devices.forEach((d) => {
      const t = d.deviceType || 'physical';
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    });

    const typeItems = Array.from(allTypeIds).map((typeId) => {
      const customDef = types.find((t) => t.id === typeId);
      const name = customDef?.name || getDeviceTypeLabel(typeId, types);
      const colorStyle = getDeviceTypeColor(typeId, types);
      const count = typeCounts.get(typeId) || 0;
      return {
        id: typeId,
        name,
        colorHex: colorStyle.colorHex || '#64748b',
        count,
        isCustom: !builtInTypeIds.includes(typeId)
      };
    });

    // 3. Roles and Sub-types breakdown with device count
    const roleMap = new Map<string, { role: string; subType?: string; typeId?: string; count: number; deviceNames: string[] }>();
    devices.forEach((d) => {
      const roleStr = d.role?.trim() || d.subType?.trim();
      if (roleStr) {
        const key = roleStr.toLowerCase();
        const existing = roleMap.get(key);
        if (existing) {
          existing.count += 1;
          if (existing.deviceNames.length < 3) existing.deviceNames.push(d.name);
        } else {
          roleMap.set(key, {
            role: roleStr,
            subType: d.subType,
            typeId: d.deviceType,
            count: 1,
            deviceNames: [d.name]
          });
        }
      }
    });

    // Also include configured subTypes definitions
    subTypes.forEach((st) => {
      const roleStr = st.role?.trim() || st.name.trim();
      if (roleStr) {
        const key = roleStr.toLowerCase();
        if (!roleMap.has(key)) {
          roleMap.set(key, {
            role: roleStr,
            subType: st.name,
            typeId: st.typeId,
            count: 0,
            deviceNames: []
          });
        }
      }
    });

    const roleItems = Array.from(roleMap.values()).sort((a, b) => b.count - a.count);

    return {
      activeZones,
      typeItems,
      roleItems,
      unassignedZoneCount
    };
  }, [devices, zones, types, subTypes]);

  return (
    <div
      ref={containerRef}
      id="topology-canvas-container"
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
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 flex-wrap justify-end export-exclude">
        {/* Direct Link Editor for selected device (gated by showInspectorAndHighlight) */}
        {showInspectorAndHighlight && selectedDevice && (
          <button
            onClick={() => setLinkingDevice(selectedDevice)}
            title={`Modifier l'organisation et les liaisons de "${selectedDevice.name}"`}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border border-indigo-400/50 cursor-pointer animate-in fade-in"
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-200" />
            <span className="truncate max-w-[150px]">Liaisons : {selectedDevice.name}</span>
          </button>
        )}
      </div>

      {/* Floating Standardized Fiche Équipement on Canvas for Selected Device (gated by showInspectorAndHighlight) */}
      {showInspectorAndHighlight && selectedDevice && (
        <div className="absolute bottom-5 left-5 z-30 w-84 max-w-[calc(100vw-40px)] export-exclude animate-in fade-in slide-in-from-bottom-2 duration-200">
          <DeviceSummaryCard
            device={selectedDevice}
            allDevices={devices}
            zones={zones}
            types={types}
            subTypes={subTypes}
            onEdit={onEditDevice}
            onDelete={onDeleteDevice}
            onInitiateMerge={onInitiateMerge}
            onPing={onPingDevice}
            onSelect={onSelectDevice}
            onClose={() => onSelectDevice(null)}
            className="shadow-2xl border-cyan-500/50"
          />
        </div>
      )}

      {/* Zoom Controls Overlay (Bottom-Right) - "Centrer la vue" and mouse helper text removed */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2 export-exclude">
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
            onClick={() => centerViewOnCore()}
            title="Centrer la vue sur le cœur de réseau"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cœur</span>
          </button>

          <button
            onClick={() => {
              setScale(1.0);
              centerViewOnCore(1.0);
            }}
            title="Échelle réelle 100%"
            className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            100%
          </button>

          <div className="px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-cyan-400 font-semibold border-l border-slate-800">
            {Math.round(scale * 100)}%
          </div>
        </div>
      </div>

      {/* Draggable & Minimizable Enhanced Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          left: `${legendPos.x}px`,
          top: `${legendPos.y}px`,
          zIndex: 35
        }}
        className="transition-shadow"
      >
        {isLegendCollapsed ? (
          <div
            onMouseDown={handleLegendMouseDown}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/95 border border-slate-700/80 hover:border-cyan-500/60 rounded-xl shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing text-xs select-none"
          >
            <GripHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="text-slate-200 font-semibold text-[11px]">Légende</span>
            <span className="px-1.5 py-0.5 bg-slate-800 text-cyan-400 font-mono text-[10px] rounded-full border border-slate-700">
              {zones.length}Z · {legendStats.typeItems.length}T · {legendStats.roleItems.length}R
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLegendCollapsed(false);
              }}
              title="Agrandir la légende"
              className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl text-xs text-slate-400 space-y-2.5 backdrop-blur-md shadow-2xl w-[320px] sm:w-[360px] select-none">
            {/* Draggable Header */}
            <div
              onMouseDown={handleLegendMouseDown}
              className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-1.5">
                <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-200">Légende de la topologie</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLegendCollapsed(true);
                }}
                title="Réduire la légende"
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Segmented Category Tabs */}
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px] font-semibold">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setLegendTab('general')}
                className={`py-1 px-1 rounded transition-colors text-center truncate ${
                  legendTab === 'general'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                Général
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setLegendTab('zones')}
                title="Zones géographiques"
                className={`py-1 px-1 rounded transition-colors text-center truncate ${
                  legendTab === 'zones'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                Zones ({zones.length})
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setLegendTab('types')}
                title="Types d'équipements"
                className={`py-1 px-1 rounded transition-colors text-center truncate ${
                  legendTab === 'types'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                Types ({legendStats.typeItems.length})
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setLegendTab('roles')}
                title="Rôles & Sous-types"
                className={`py-1 px-1 rounded transition-colors text-center truncate ${
                  legendTab === 'roles'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                Rôles ({legendStats.roleItems.length})
              </button>
            </div>

            {/* Scrollable Legend Content by Active Tab */}
            <div className="max-h-60 overflow-y-auto pr-1">
              {/* TAB 1: GÉNÉRAL */}
              {legendTab === 'general' && (
                <div className="space-y-2 py-0.5">
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-amber-300 font-bold">Cœur de réseau au centre (Étoile)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-sky-500 rounded-full shrink-0" />
                    <span className="text-[11px] text-slate-300 font-medium">Liaison réseau physique (LAN Ethernet/Wi-Fi)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 border-b-2 border-indigo-400 border-dashed shrink-0" />
                    <span className="text-[11px] text-indigo-300 font-medium">Machine Virtuelle (Hyperviseur parent)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 border-b-2 border-cyan-400 border-dashed shrink-0" />
                    <span className="text-[11px] text-cyan-300 font-medium">Conteneur Docker sur Hôte parent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-slate-300">Zones géographiques (déplaçables & éditables)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[11px] text-slate-300">Groupes hôtes physiques (repliables / dépliables)</span>
                  </div>
                </div>
              )}

              {/* TAB 2: ZONES GÉOGRAPHIQUES */}
              {legendTab === 'zones' && (
                <div className="space-y-1.5 py-0.5">
                  {legendStats.activeZones.length === 0 ? (
                    <div className="text-center py-3 text-slate-400 text-[11px]">
                      <p>Aucune zone géographique créée.</p>
                      {onOpenZoneManager && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={onOpenZoneManager}
                          className="mt-2 text-cyan-400 hover:text-cyan-300 underline font-semibold text-[10px] cursor-pointer"
                        >
                          Gérer les zones géographiques
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {legendStats.activeZones.map(({ zone, count }) => {
                        const isCollapsed = collapsedZoneIds.has(zone.id);
                        const zColor = zone.color || '#0ea5e9';
                        return (
                          <div
                            key={`leg-zone-${zone.id}`}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: zColor }}
                              />
                              <span className="text-slate-400 shrink-0">
                                {getZoneTypeIcon(zone.type)}
                              </span>
                              <span className="text-[11px] font-medium text-slate-200 truncate" title={zone.name}>
                                {zone.name}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono shrink-0">
                                {getZoneTypeLabel(zone.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700">
                                {count} {count > 1 ? 'équip.' : 'équip.'}
                              </span>
                              {count > 0 && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => toggleCollapseZone(zone.id)}
                                  title={isCollapsed ? 'Déplier la zone' : 'Replier la zone'}
                                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {legendStats.unassignedZoneCount > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-1 border-t border-slate-800/60 font-mono">
                          <span>Non assignés à une zone</span>
                          <span className="text-amber-400 font-semibold">{legendStats.unassignedZoneCount} équip.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: TYPES D'ÉQUIPEMENTS */}
              {legendTab === 'types' && (
                <div className="space-y-1.5 py-0.5">
                  {legendStats.typeItems.map((item) => (
                    <div
                      key={`leg-type-${item.id}`}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <span className="text-[11px] font-medium text-slate-200 truncate" title={item.name}>
                          {item.name}
                        </span>
                        {item.isCustom && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-mono shrink-0">
                            Perso
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700 shrink-0">
                        {item.count} {item.count > 1 ? 'équip.' : 'équip.'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: RÔLES & SOUS-TYPES */}
              {legendTab === 'roles' && (
                <div className="space-y-1.5 py-0.5">
                  {legendStats.roleItems.length === 0 ? (
                    <div className="text-center py-3 text-slate-400 text-[11px]">
                      <p>Aucun rôle ou sous-type spécifique défini.</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Définissez les rôles de vos équipements lors de leur édition.
                      </p>
                    </div>
                  ) : (
                    legendStats.roleItems.map((item, idx) => (
                      <div
                        key={`leg-role-${idx}-${item.role}`}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-200 truncate" title={item.role}>
                              {item.role}
                            </div>
                            {item.typeId && (
                              <div className="text-[9px] text-slate-400 font-mono truncate">
                                {getDeviceTypeLabel(item.typeId, types)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700">
                            {item.count} {item.count > 1 ? 'équip.' : 'équip.'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Scaled & Panned Canvas Viewport */}
      <div
        id={canvasViewportId}
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* SVG Canvas for Host Clusters, Geographic Zones, and Star Rays */}
        <svg
          className="absolute inset-0 pointer-events-none w-full h-full"
          style={{ overflow: 'visible' }}
        >
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
              showInspectorAndHighlight &&
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
              showInspectorAndHighlight &&
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
                />
                {/* Direct inline vector arrow pointing down into guest node */}
                <polygon
                  points={`${x2},${y2 + 2} ${x2 - 5},${y2 - 7} ${x2 + 5},${y2 - 7}`}
                  fill={strokeColor}
                  opacity={isRelated ? 1 : 0.85}
                />
              </g>
            );
          })}
        </svg>

        {/* 5. INTERACTIVE GEOGRAPHIC ZONE HEADERS (Renamable, Draggable & Foldable) */}
        {zoneClusters.map((cluster) => {
          const zone = cluster.zone;
          const isRenaming = renamingZoneId === zone.id;
          const zColor = zone.color || '#0ea5e9';
          const isCollapsed = cluster.isCollapsed;

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
                onMouseDown={(e) => handleZoneHeaderMouseDown(e, zone.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-md text-xs font-semibold bg-slate-900/90 border-slate-700/80 cursor-grab active:cursor-grabbing hover:border-cyan-400/60 transition-all select-none group/zonehdr"
                style={{ borderColor: `${zColor}80` }}
                title="Glisser pour déplacer toute la zone géographique"
              >
                <Move className="w-3.5 h-3.5 text-slate-400 group-hover/zonehdr:text-cyan-400 shrink-0" />
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRenameZone(zone);
                    }}
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

                {/* Zone Fold / Unfold Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseZone(zone.id);
                  }}
                  title={
                    isCollapsed
                      ? `Déplier la zone ${zone.name} (${cluster.deviceCount} équipements)`
                      : `Replier la zone ${zone.name}`
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
                      <span>Déplier ({cluster.deviceCount})</span>
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

        {/* 6. Interactive Host Cluster Headers (Draggable & Foldable) */}
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
                onMouseDown={(e) => handleClusterHeaderMouseDown(e, cluster.hostId)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg backdrop-blur-md text-xs font-semibold cursor-grab active:cursor-grabbing select-none group/clusterhdr ${
                  isCollapsed
                    ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                    : isDocker
                    ? 'bg-sky-950/90 border-cyan-500/50 text-cyan-200'
                    : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
                }`}
                title="Glisser pour déplacer le groupe hôte et ses machines"
              >
                <Move className="w-3.5 h-3.5 opacity-60 group-hover/clusterhdr:opacity-100 shrink-0" />
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
          const isCore = trueCoreNode ? device.id === trueCoreNode.id : false;

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
                types={types}
                subTypes={subTypes}
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
