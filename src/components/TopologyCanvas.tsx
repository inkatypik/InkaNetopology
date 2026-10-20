import React, { useRef, useState, useEffect } from 'react';
import type { Device } from '../types/network';
import { DeviceNode } from './DeviceNode';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface TopologyCanvasProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device | null) => void;
  onEditDevice: (device: Device) => void;
  onPingDevice: (device: Device) => void;
  onUpdateDevicePosition: (id: string, pos: { x: number; y: number }) => void;
  groupByHost: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  devices,
  selectedDevice,
  onSelectDevice,
  onEditDevice,
  onPingDevice,
  onUpdateDevicePosition,
  groupByHost
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node drag state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(prev + delta, 0.4), 2.0));
  };

  const handleResetView = () => {
    setScale(1);
    setOffset({ x: 40, y: 30 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on canvas background, unselect and start pan
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

  // Calculate links between devices
  // 1. Physical / Network links (connectedToSwitchId)
  // 2. Virtualization dependency links (parentHostId)
  const deviceMap = new Map<string, Device>();
  devices.forEach((d) => deviceMap.set(d.id, d));

  const physicalLinks: Array<{ from: Device; to: Device; label?: string }> = [];
  const virtualLinks: Array<{ host: Device; guest: Device; isDocker: boolean }> = [];

  devices.forEach((dev) => {
    // Parent host link (VM or Docker container)
    if (dev.parentHostId && deviceMap.has(dev.parentHostId)) {
      const host = deviceMap.get(dev.parentHostId)!;
      virtualLinks.push({
        host,
        guest: dev,
        isDocker: dev.deviceType === 'docker'
      });
    }

    // Network switch link
    if (dev.connectedToSwitchId && deviceMap.has(dev.connectedToSwitchId)) {
      const sw = deviceMap.get(dev.connectedToSwitchId)!;
      physicalLinks.push({
        from: sw,
        to: dev,
        label: dev.portOrInterface
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
      {/* Zoom / Pan Controls Overlay */}
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
          title="Réinitialiser la vue"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="px-2 py-0.5 text-[11px] font-mono tabular-nums text-slate-400 border-l border-slate-800">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Legend / Overlay */}
      <div className="absolute top-4 left-4 z-20 p-2.5 bg-slate-900/85 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1.5 pointer-events-none backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-sky-500 rounded-full" />
          <span className="text-[11px] text-slate-300">Liaison réseau physique / Switch</span>
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
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* SVG Canvas for Links & Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '4000px', height: '4000px' }}
        >
          <defs>
            {/* Arrow marker for virtualization dependencies */}
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
          {physicalLinks.map(({ from, to, label }, i) => {
            const p1 = from.position || { x: 200, y: 100 };
            const p2 = to.position || { x: 200, y: 300 };
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
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeOpacity="0.4"
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
            const p1 = host.position || { x: 200, y: 200 };
            const p2 = guest.position || { x: 200, y: 400 };
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
