import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { Device } from '../types/network';
import { DeviceNode } from './DeviceNode';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Focus,
  AlertCircle,
  Radar,
  Plus,
  RotateCcw,
  Layers,
  Box,
  Server
} from 'lucide-react';

interface TopologyCanvasProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onUpdateDevicePosition: (id: string, pos: { x: number; y: number }) => void;
  onAutoLayout?: () => void;
  onTriggerScan?: () => void;
  onResetTopology?: () => void;
  onOpenAddModal?: () => void;
  groupByHost: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  onEditDevice,
  onPingDevice,
  onUpdateDevicePosition,
  onAutoLayout,
  onTriggerScan,
  onResetTopology,
  onOpenAddModal,
  groupByHost
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);
  const [offset, setOffset] = useState({ x: 80, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node drag state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Auto-fit view to center all devices on canvas
  const fitToView = useCallback(() => {
    if (!containerRef.current || devices.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    devices.forEach((d) => {
      const x = d.position?.x ?? 100;
      const y = d.position?.y ?? 100;
      if (x < minX) minX = x;
      if (x + 280 > maxX) maxX = x + 280;
      if (y < minY) minY = y;
      if (y + 200 > maxY) maxY = y + 200;
    });

    if (minX === Infinity || maxX === -Infinity) return;

    const graphW = Math.max(maxX - minX, 350);
    const graphH = Math.max(maxY - minY, 250);
    const padding = 80;

    const scaleX = (rect.width - padding * 2) / graphW;
    const scaleY = (rect.height - padding * 2) / graphH;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.1);

    const newOffsetX = (rect.width - graphW * newScale) / 2 - minX * newScale;
    const newOffsetY = (rect.height - graphH * newScale) / 2 - minY * newScale;

    setScale(+newScale.toFixed(2));
    setOffset({ x: Math.round(newOffsetX), y: Math.round(newOffsetY) });
  }, [devices]);

  // Run fitToView on initial mount and when devices count changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToView();
    }, 150);
    return () => clearTimeout(timer);
  }, [devices.length, fitToView]);

  // NATIVE MOUSE WHEEL ZOOM WITH MOUSE-CENTERED TRANSFORM (PASSIVE: FALSE TO PREVENT PAGE SCROLL)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Smooth zoom factor based on wheel delta
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

      setScale((prevScale) => {
        const nextScale = Math.min(Math.max(prevScale * zoomFactor, 0.2), 2.5);
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
      const nextScale = Math.min(Math.max(prevScale + delta, 0.2), 2.5);
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

  // Map for fast node lookups
  const deviceMap = useMemo(() => {
    const map = new Map<string, Device>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  // Determine root switch or router for fallback automatic link drawing
  const rootSwitchOrRouter = useMemo(() => {
    return (
      devices.find((d) => d.subType === 'switch') ||
      devices.find((d) => d.subType === 'router') ||
      devices.find((d) => d.ip.endsWith('.1') || d.ip.endsWith('.254')) ||
      devices[0]
    );
  }, [devices]);

  // Links computation
  const { physicalLinks, virtualLinks } = useMemo(() => {
    const phys: Array<{ from: Device; to: Device; label?: string; isAuto?: boolean }> = [];
    const virt: Array<{ host: Device; guest: Device; isDocker: boolean }> = [];

    devices.forEach((dev) => {
      // 1. Virtualization link (VM or Docker container to host)
      if (dev.parentHostId && deviceMap.has(dev.parentHostId)) {
        const host = deviceMap.get(dev.parentHostId)!;
        virt.push({
          host,
          guest: dev,
          isDocker: dev.deviceType === 'docker'
        });
        return;
      }

      // 2. Explicit network switch link
      if (dev.connectedToSwitchId && deviceMap.has(dev.connectedToSwitchId)) {
        const sw = deviceMap.get(dev.connectedToSwitchId)!;
        phys.push({
          from: sw,
          to: dev,
          label: dev.portOrInterface
        });
        return;
      }

      // 3. Fallback link to core router / switch (exclude hosts and virtuals with parent)
      if (rootSwitchOrRouter && dev.id !== rootSwitchOrRouter.id) {
        phys.push({
          from: rootSwitchOrRouter,
          to: dev,
          label: dev.portOrInterface || (dev.deviceType === 'iot' ? 'Wi-Fi / LAN' : 'LAN'),
          isAuto: true
        });
      }
    });

    return { physicalLinks: phys, virtualLinks: virt };
  }, [devices, deviceMap, rootSwitchOrRouter]);

  // CLUSTER BOUNDING BOXES FOR VISUAL CLARITY
  // Compute enclosing hulls for hosts that contain child VMs or Docker containers
  const hostClusters = useMemo(() => {
    if (!groupByHost) return [];

    const clusters: Array<{
      hostId: string;
      hostName: string;
      isDocker: boolean;
      childCount: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    // Group children by host
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

      const allNodes = [host, ...children];
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
        x: Math.round(minX - padX),
        y: Math.round(minY - padY - 26),
        width: Math.round(maxX - minX + padX * 2),
        height: Math.round(maxY - minY + padY * 2 + 26)
      });
    });

    return clusters;
  }, [devices, deviceMap, groupByHost]);

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
            Lancez un scan réseau ou ajoutez un équipement manuellement pour générer automatiquement le schéma.
          </p>
        </div>
      )}

      {/* Floating Canvas Action Toolbar (Top-Right) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {onAutoLayout && (
          <button
            onClick={() => {
              onAutoLayout();
              setTimeout(fitToView, 220);
            }}
            title="Réorganiser automatiquement le schéma en vue aérée et hiérarchique"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-cyan-600/95 hover:bg-cyan-500 text-white rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border border-cyan-400/50 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Réorganiser le schéma</span>
          </button>
        )}

        <button
          onClick={fitToView}
          title="Centrer et ajuster la vue sur l'ensemble des équipements"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          <Focus className="w-3.5 h-3.5 text-cyan-400" />
          <span>Centrer la vue</span>
        </button>
      </div>

      {/* Zoom / Pan Controls Overlay with Wheel Tip (Bottom-Right) */}
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
            className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            100%
          </button>

          <button
            onClick={fitToView}
            title="Ajuster la vue pour voir tous les équipements"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-cyan-400" />
          </button>

          <div className="px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-cyan-400 font-semibold border-l border-slate-800">
            {Math.round(scale * 100)}%
          </div>
        </div>

        {/* Mouse wheel helper badge */}
        <div className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-400 font-mono pointer-events-none backdrop-blur-xs">
          Molette : Zoom · Clic & Glisser : Déplacement
        </div>
      </div>

      {/* Legend / Overlay (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2 pointer-events-none backdrop-blur-md shadow-xl">
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
      </div>

      {/* Main Scaled & Panned Canvas Viewport */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* SVG Canvas for Host Bounding Clusters and Links */}
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

          {/* 1. VISUAL HOST CLUSTER ENCLOSING BOUNDARIES (DOCKER & VM GROUPS) */}
          {hostClusters.map((cluster) => {
            const isDocker = cluster.isDocker;
            const strokeColor = isDocker ? 'rgba(34, 211, 238, 0.4)' : 'rgba(129, 140, 248, 0.4)';
            const fillColor = isDocker ? 'rgba(8, 47, 73, 0.22)' : 'rgba(49, 46, 129, 0.22)';
            const textColor = isDocker ? '#38bdf8' : '#a5b4fc';

            return (
              <g key={`cluster-${cluster.hostId}`} className="animate-in fade-in duration-300">
                {/* Rounded enclosure rect */}
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
                  strokeDasharray="6 4"
                />

                {/* Cluster Header Badge */}
                <g transform={`translate(${cluster.x + 14}, ${cluster.y + 18})`}>
                  <rect
                    x="0"
                    y="-12"
                    width={Math.min(cluster.width - 28, 280)}
                    height="20"
                    rx="6"
                    fill={isDocker ? 'rgba(12, 74, 110, 0.9)' : 'rgba(30, 27, 75, 0.9)'}
                    stroke={strokeColor}
                    strokeWidth="1"
                  />
                  <text
                    x="10"
                    y="2"
                    fill={textColor}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {isDocker ? '⚡ Cluster Docker' : '🖥️ Hyperviseur'} · {cluster.childCount} {isDocker ? 'conteneurs' : 'VMs'}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 2. Physical Network Cables (Solid Lines with Speed / Port Label) */}
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
                  strokeWidth={isRelated ? '3' : isAuto ? '1.5' : '2'}
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

          {/* 3. Virtualization Dependency Links (Dashed Bezier Splines) */}
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

        {/* Device Nodes Layer */}
        {devices.map((device) => {
          const pos = device.position || { x: 100, y: 100 };
          const parentDevice = device.parentHostId
            ? deviceMap.get(device.parentHostId)
            : undefined;

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
                isSelected={selectedDevice?.id === device.id}
                onSelect={onSelectDevice}
                onEdit={onEditDevice}
                onPing={onPingDevice}
                isDragging={draggedNodeId === device.id}
              />
            </div>
          );
        })}
      </div>

      {/* Empty State Overlay when inventory is completely cleared (0 devices) */}
      {devices.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 pointer-events-none">
          <div className="max-w-md w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-sm">
              <Radar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Inventaire entièrement vide
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              La base d'équipements a été réinitialisée à zéro. Vous pouvez lancer un scan actif de votre sous-réseau pour découvrir vos équipements réels, ou ajouter vos machines manuellement.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-6">
              {onTriggerScan && (
                <button
                  onClick={onTriggerScan}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Radar className="w-4 h-4" />
                  <span>Scanner le réseau local</span>
                </button>
              )}

              {onOpenAddModal && (
                <button
                  onClick={onOpenAddModal}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ajouter manuellement</span>
                </button>
              )}

              {onResetTopology && (
                <button
                  onClick={onResetTopology}
                  title="Recharger la topologie d'exemple"
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recharger démo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
