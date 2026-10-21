import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Device } from '../types/network';
import { DeviceNode } from './DeviceNode';
import { ZoomIn, ZoomOut, Maximize2, LayoutGrid, Focus, AlertCircle } from 'lucide-react';

interface TopologyCanvasProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onUpdateDevicePosition: (id: string, pos: { x: number; y: number }) => void;
  onAutoLayout?: () => void;
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
  groupByHost
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.85);
  const [offset, setOffset] = useState({ x: 50, y: 30 });
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
      if (x + 270 > maxX) maxX = x + 270;
      if (y < minY) minY = y;
      if (y + 190 > maxY) maxY = y + 190;
    });

    if (minX === Infinity || maxX === -Infinity) return;

    const graphW = Math.max(maxX - minX, 300);
    const graphH = Math.max(maxY - minY, 200);
    const padding = 70;

    const scaleX = (rect.width - padding * 2) / graphW;
    const scaleY = (rect.height - padding * 2) / graphH;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.15);

    const newOffsetX = (rect.width - graphW * newScale) / 2 - minX * newScale;
    const newOffsetY = (rect.height - graphH * newScale) / 2 - minY * newScale;

    setScale(+newScale.toFixed(2));
    setOffset({ x: Math.round(newOffsetX), y: Math.round(newOffsetY) });
  }, [devices]);

  // Run fitToView on initial mount and when devices count changes significantly
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToView();
    }, 150);
    return () => clearTimeout(timer);
  }, [devices.length, fitToView]);

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(prev + delta, 0.3), 2.0));
  };

  const handleResetView = () => {
    fitToView();
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
  const deviceMap = new Map<string, Device>();
  devices.forEach((d) => deviceMap.set(d.id, d));

  // Determine root switch or router for fallback automatic link drawing
  const rootSwitchOrRouter =
    devices.find((d) => d.subType === 'switch') ||
    devices.find((d) => d.subType === 'router') ||
    devices.find((d) => d.ip.endsWith('.1') || d.ip.endsWith('.254')) ||
    devices[0];

  const physicalLinks: Array<{ from: Device; to: Device; label?: string; isAuto?: boolean }> = [];
  const virtualLinks: Array<{ host: Device; guest: Device; isDocker: boolean }> = [];

  devices.forEach((dev) => {
    // 1. Virtualization link (VM or Docker container to host)
    if (dev.parentHostId && deviceMap.has(dev.parentHostId)) {
      const host = deviceMap.get(dev.parentHostId)!;
      virtualLinks.push({
        host,
        guest: dev,
        isDocker: dev.deviceType === 'docker'
      });
      return;
    }

    // 2. Explicit network switch link
    if (dev.connectedToSwitchId && deviceMap.has(dev.connectedToSwitchId)) {
      const sw = deviceMap.get(dev.connectedToSwitchId)!;
      physicalLinks.push({
        from: sw,
        to: dev,
        label: dev.portOrInterface
      });
      return;
    }

    // 3. AUTOMATIC FALLBACK LINK: connect any unlinked device to core router or switch
    if (rootSwitchOrRouter && dev.id !== rootSwitchOrRouter.id) {
      physicalLinks.push({
        from: rootSwitchOrRouter,
        to: dev,
        label: dev.portOrInterface || (dev.deviceType === 'iot' ? 'Wi-Fi / LAN' : 'LAN'),
        isAuto: true
      });
    }
  });

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative w-full h-[calc(100vh-175px)] bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{
        backgroundImage: `radial-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
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
              setTimeout(fitToView, 200);
            }}
            title="Réorganiser automatiquement le schéma hiérarchique"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95 border border-cyan-400/40"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Réorganiser le schéma</span>
          </button>
        )}

        <button
          onClick={fitToView}
          title="Centrer et ajuster la vue sur l'ensemble des équipements"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md transition-all active:scale-95"
        >
          <Focus className="w-3.5 h-3.5 text-cyan-400" />
          <span>Centrer la vue</span>
        </button>
      </div>

      {/* Zoom / Pan Controls Overlay (Bottom-Right) */}
      <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-lg shadow-xl backdrop-blur-md">
        <button
          onClick={() => handleZoom(0.15)}
          title="Zoom avant"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          title="Zoom arrière"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          title="Centrer la vue sur tous les équipements"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="px-2 py-0.5 text-[11px] font-mono tabular-nums text-slate-400 border-l border-slate-800">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Legend / Overlay (Top-Left) */}
      <div className="absolute top-4 left-4 z-20 p-2.5 bg-slate-900/85 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1.5 pointer-events-none backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-sky-500 rounded-full" />
          <span className="text-[11px] text-slate-300">Liaison réseau physique / Câble LAN</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 border-b border-indigo-400 border-dashed" />
          <span className="text-[11px] text-slate-300">Rattachement VM à l'Hyperviseur</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 border-b border-cyan-400 border-dashed" />
          <span className="text-[11px] text-slate-300">Conteneur Docker sur Hôte</span>
        </div>
      </div>

      {/* Main Scaled & Panned Canvas Viewport */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.15s ease-out'
        }}
      >
        {/* SVG Canvas for Links & Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '8000px', height: '8000px' }}
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

          {/* 1. Physical Network Cables (Solid Lines with Speed / Port Label) */}
          {physicalLinks.map(({ from, to, label, isAuto }, i) => {
            const p1 = from.position || { x: 400, y: 100 };
            const p2 = to.position || { x: 400, y: 300 };
            const x1 = p1.x + 128;
            const y1 = p1.y + 70;
            const x2 = p2.x + 128;
            const y2 = p2.y + 20;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={`phys-${i}`}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isAuto ? '#38bdf8' : '#0284c7'}
                  strokeWidth={isAuto ? '1.5' : '2'}
                  strokeOpacity={isAuto ? '0.35' : '0.55'}
                />
                {label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                    className="bg-slate-900"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 2. Virtualization Dependency Links (Dashed Bezier Splines) */}
          {virtualLinks.map(({ host, guest, isDocker }, i) => {
            const p1 = host.position || { x: 400, y: 200 };
            const p2 = guest.position || { x: 400, y: 400 };
            const x1 = p1.x + 128;
            const y1 = p1.y + 110;
            const x2 = p2.x + 128;
            const y2 = p2.y + 5;

            const midY = (y1 + y2) / 2;
            const strokeColor = isDocker ? '#22d3ee' : '#818cf8';

            return (
              <g key={`virt-${i}`}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeOpacity="0.75"
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
    </div>
  );
};
