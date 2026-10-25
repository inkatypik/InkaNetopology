import React from 'react';
import type { DeviceSubType, DeviceType } from '../types/network';
import {
  Server,
  Network,
  Cpu,
  Box,
  Camera,
  Activity,
  Thermometer,
  Zap,
  HardDrive,
  Monitor,
  Printer,
  Wifi,
  Radio,
  Layers,
  HelpCircle
} from 'lucide-react';

export interface PresetImage {
  id: string;
  label: string;
  category: DeviceType;
  subType?: DeviceSubType;
  previewUrl: string;
}

// Helper to make clean, self-contained SVG Data URIs for generic hardware icons
const makeSvgUri = (svgContent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">${svgContent}</svg>`
  )}`;

export const PRESET_HARDWARE_IMAGES: PresetImage[] = [
  // 1. ROUTEUR & PASSERELLE (Vert émeraude)
  {
    id: 'icon_router_core',
    label: 'Routeur / Passerelle Cœur 1U',
    category: 'physical',
    subType: 'router',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#064e3b" stroke="#10b981" stroke-width="2"/>
      <rect x="14" y="32" width="52" height="20" rx="4" fill="#022c22" stroke="#34d399" stroke-width="1.5"/>
      <circle cx="24" cy="42" r="3" fill="#10b981"/>
      <circle cx="34" cy="42" r="3" fill="#10b981"/>
      <circle cx="44" cy="42" r="3" fill="#34d399"/>
      <circle cx="56" cy="42" r="4" fill="#059669" stroke="#6ee7b7" stroke-width="1"/>
      <path d="M 28 22 C 34 16, 46 16, 52 22" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 34 26 C 37 23, 43 23, 46 26" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round"/>
      <line x1="40" y1="28" x2="40" y2="32" stroke="#6ee7b7" stroke-width="2"/>
    `)
  },
  {
    id: 'icon_router_wifi',
    label: 'Routeur Wi-Fi 6 Mesh',
    category: 'physical',
    subType: 'router',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#042f2e" stroke="#14b8a6" stroke-width="2"/>
      <rect x="22" y="36" width="36" height="24" rx="6" fill="#134e4a" stroke="#2dd4bf" stroke-width="1.5"/>
      <path d="M 18 24 C 28 14, 52 14, 62 24" fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 26 29 C 33 22, 47 22, 54 29" fill="none" stroke="#5eead4" stroke-width="2" stroke-linecap="round"/>
      <circle cx="40" cy="48" r="4" fill="#2dd4bf"/>
    `)
  },

  // 2. SWITCHS & RÉSEAU (Bleu ciel)
  {
    id: 'icon_switch_24p',
    label: 'Switch Rack 24 Ports PoE+',
    category: 'physical',
    subType: 'switch',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#0c4a6e" stroke="#0ea5e9" stroke-width="2"/>
      <rect x="12" y="28" width="56" height="24" rx="4" fill="#082f49" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="20" cy="36" r="2.5" fill="#38bdf8"/>
      <circle cx="28" cy="36" r="2.5" fill="#38bdf8"/>
      <circle cx="36" cy="36" r="2.5" fill="#38bdf8"/>
      <circle cx="44" cy="36" r="2.5" fill="#38bdf8"/>
      <circle cx="20" cy="44" r="2.5" fill="#38bdf8"/>
      <circle cx="28" cy="44" r="2.5" fill="#38bdf8"/>
      <circle cx="36" cy="44" r="2.5" fill="#38bdf8"/>
      <circle cx="44" cy="44" r="2.5" fill="#38bdf8"/>
      <rect x="52" y="34" width="10" height="12" rx="2" fill="#0369a1" stroke="#7dd3fc" stroke-width="1"/>
    `)
  },
  {
    id: 'icon_ap_wifi',
    label: 'Point d\'Accès Wi-Fi Plafonnier',
    category: 'physical',
    subType: 'access_point',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#164e63" stroke="#06b6d4" stroke-width="2"/>
      <circle cx="40" cy="40" r="24" fill="#083344" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="40" cy="40" r="14" fill="#0e7490" stroke="#67e8f9" stroke-width="1.5"/>
      <circle cx="40" cy="40" r="5" fill="#22d3ee"/>
    `)
  },

  // 3. SERVEURS & STOCKAGE (Bleu roi / Ambre)
  {
    id: 'icon_server_rack',
    label: 'Serveur Hyperviseur Rack 2U',
    category: 'physical',
    subType: 'server',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#1e1b4b" stroke="#6366f1" stroke-width="2"/>
      <rect x="14" y="20" width="52" height="16" rx="4" fill="#0f172a" stroke="#818cf8" stroke-width="1.5"/>
      <rect x="14" y="44" width="52" height="16" rx="4" fill="#0f172a" stroke="#818cf8" stroke-width="1.5"/>
      <circle cx="22" cy="28" r="2.5" fill="#22c55e"/>
      <circle cx="28" cy="28" r="2.5" fill="#38bdf8"/>
      <circle cx="22" cy="52" r="2.5" fill="#22c55e"/>
      <circle cx="28" cy="52" r="2.5" fill="#38bdf8"/>
      <line x1="38" y1="28" x2="58" y2="28" stroke="#475569" stroke-width="2"/>
      <line x1="38" y1="52" x2="58" y2="52" stroke="#475569" stroke-width="2"/>
    `)
  },
  {
    id: 'icon_nas_storage',
    label: 'Serveur NAS Baie 4 Disques',
    category: 'physical',
    subType: 'nas',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#451a03" stroke="#f59e0b" stroke-width="2"/>
      <rect x="16" y="18" width="48" height="44" rx="5" fill="#291202" stroke="#fbbf24" stroke-width="1.5"/>
      <rect x="22" y="24" width="7" height="32" rx="2" fill="#78350f" stroke="#fde68a" stroke-width="1"/>
      <rect x="33" y="24" width="7" height="32" rx="2" fill="#78350f" stroke="#fde68a" stroke-width="1"/>
      <rect x="44" y="24" width="7" height="32" rx="2" fill="#78350f" stroke="#fde68a" stroke-width="1"/>
      <rect x="55" y="24" width="4" height="32" rx="1.5" fill="#10b981"/>
    `)
  },

  // 4. DOCKER & CONTENEURS (Cyan)
  {
    id: 'icon_docker_whale',
    label: 'Conteneur Docker (Moby)',
    category: 'docker',
    subType: 'container',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#083344" stroke="#06b6d4" stroke-width="2"/>
      <rect x="24" y="26" width="8" height="7" rx="1" fill="#22d3ee"/>
      <rect x="34" y="26" width="8" height="7" rx="1" fill="#22d3ee"/>
      <rect x="44" y="26" width="8" height="7" rx="1" fill="#22d3ee"/>
      <rect x="14" y="35" width="8" height="7" rx="1" fill="#38bdf8"/>
      <rect x="24" y="35" width="8" height="7" rx="1" fill="#38bdf8"/>
      <rect x="34" y="35" width="8" height="7" rx="1" fill="#38bdf8"/>
      <rect x="44" y="35" width="8" height="7" rx="1" fill="#38bdf8"/>
      <rect x="54" y="35" width="8" height="7" rx="1" fill="#38bdf8"/>
      <path d="M 12 45 C 12 55, 64 55, 68 45" fill="#0e7490" stroke="#67e8f9" stroke-width="1.5"/>
    `)
  },
  {
    id: 'icon_vm_hypervisor',
    label: 'Machine Virtuelle KVM / Proxmox',
    category: 'vm',
    subType: 'vm',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#312e81" stroke="#818cf8" stroke-width="2"/>
      <polygon points="40,16 66,30 40,44 14,30" fill="#4338ca" stroke="#c7d2fe" stroke-width="1.5"/>
      <polygon points="40,30 66,44 40,58 14,44" fill="#3730a3" stroke="#a5b4fc" stroke-width="1.5"/>
      <polygon points="40,44 66,58 40,72 14,58" fill="#312e81" stroke="#818cf8" stroke-width="1.5"/>
    `)
  },

  // 5. IOT & DOMOTIQUE (Émeraude / Rose / Jaune)
  {
    id: 'icon_camera_rtsp',
    label: 'Caméra Surveillance IP 4K',
    category: 'iot',
    subType: 'camera',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#4c0519" stroke="#f43f5e" stroke-width="2"/>
      <path d="M 16 32 L 46 26 L 46 54 L 16 48 Z" fill="#881337" stroke="#fb7185" stroke-width="1.5"/>
      <polygon points="46,35 64,24 64,56 46,45" fill="#be123c" stroke="#fda4af" stroke-width="1.5"/>
      <circle cx="26" cy="40" r="5" fill="#1e293b" stroke="#fda4af" stroke-width="1"/>
      <circle cx="26" cy="40" r="2.5" fill="#0284c7"/>
    `)
  },
  {
    id: 'icon_sensor_temp',
    label: 'Sonde Température & Météo ESP32',
    category: 'iot',
    subType: 'sensor_temp',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#14532d" stroke="#22c55e" stroke-width="2"/>
      <rect x="36" y="18" width="8" height="32" rx="4" fill="#166534" stroke="#86efac" stroke-width="1.5"/>
      <circle cx="40" cy="54" r="10" fill="#15803d" stroke="#86efac" stroke-width="1.5"/>
      <circle cx="40" cy="54" r="6" fill="#ef4444"/>
      <line x1="40" y1="30" x2="40" y2="50" stroke="#ef4444" stroke-width="3"/>
    `)
  },
  {
    id: 'icon_smart_plug',
    label: 'Prise Connectée Wattmètre',
    category: 'iot',
    subType: 'smart_plug',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#713f12" stroke="#eab308" stroke-width="2"/>
      <circle cx="40" cy="40" r="22" fill="#422006" stroke="#facc15" stroke-width="2"/>
      <polygon points="42,24 32,39 39,39 38,56 48,41 41,41" fill="#fde047" stroke="#ca8a04" stroke-width="1"/>
    `)
  },
  {
    id: 'icon_radar_presence',
    label: 'Détecteur de Présence / Mouvement',
    category: 'iot',
    subType: 'sensor_presence',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#064e3b" stroke="#10b981" stroke-width="2"/>
      <circle cx="40" cy="40" r="6" fill="#34d399"/>
      <path d="M 26 26 C 34 18, 46 18, 54 26" fill="none" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 18 18 C 30 6, 50 6, 62 18" fill="none" stroke="#a7f3d0" stroke-width="2" stroke-linecap="round"/>
    `)
  },

  // 6. BUREAUTIQUE / POSTES (Gris ardoise)
  {
    id: 'icon_workstation_pc',
    label: 'Station CAO / Poste de Travail',
    category: 'physical',
    subType: 'workstation',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
      <rect x="18" y="20" width="44" height="30" rx="3" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>
      <polygon points="34,50 46,50 48,58 32,58" fill="#475569"/>
      <rect x="28" y="58" width="24" height="3" rx="1" fill="#94a3b8"/>
      <rect x="22" y="24" width="36" height="22" fill="#0284c7" fill-opacity="0.25"/>
    `)
  },
  {
    id: 'icon_printer_net',
    label: 'Imprimante Réseau Multifonction',
    category: 'physical',
    subType: 'printer',
    previewUrl: makeSvgUri(`
      <rect width="80" height="80" rx="16" fill="#334155" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="24" y="18" width="32" height="16" rx="2" fill="#f8fafc"/>
      <rect x="16" y="32" width="48" height="24" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
      <rect x="24" y="46" width="32" height="14" rx="2" fill="#f1f5f9"/>
      <circle cx="56" cy="38" r="2" fill="#10b981"/>
    `)
  }
];

export function getDeviceDefaultIcon(subType: DeviceSubType, deviceType: DeviceType): React.ReactNode {
  const iconProps = { className: "w-5 h-5", strokeWidth: 1.8 };

  if (deviceType === 'docker') {
    return <Box {...iconProps} className="w-5 h-5 text-cyan-400" />;
  }
  if (deviceType === 'vm') {
    return <Cpu {...iconProps} className="w-5 h-5 text-indigo-400" />;
  }

  switch (subType) {
    case 'router':
      return <Radio {...iconProps} className="w-5 h-5 text-emerald-400" />;
    case 'switch':
      return <Network {...iconProps} className="w-5 h-5 text-sky-400" />;
    case 'server':
      return <Server {...iconProps} className="w-5 h-5 text-blue-400" />;
    case 'nas':
      return <HardDrive {...iconProps} className="w-5 h-5 text-amber-400" />;
    case 'workstation':
      return <Monitor {...iconProps} className="w-5 h-5 text-slate-300" />;
    case 'printer':
      return <Printer {...iconProps} className="w-5 h-5 text-slate-400" />;
    case 'camera':
      return <Camera {...iconProps} className="w-5 h-5 text-rose-400" />;
    case 'sensor_presence':
      return <Activity {...iconProps} className="w-5 h-5 text-emerald-400" />;
    case 'sensor_temp':
      return <Thermometer {...iconProps} className="w-5 h-5 text-amber-400" />;
    case 'smart_plug':
      return <Zap {...iconProps} className="w-5 h-5 text-yellow-400" />;
    case 'access_point':
      return <Wifi {...iconProps} className="w-5 h-5 text-teal-400" />;
    case 'container':
      return <Box {...iconProps} className="w-5 h-5 text-cyan-400" />;
    case 'vm':
      return <Layers {...iconProps} className="w-5 h-5 text-indigo-400" />;
    default:
      return <HelpCircle {...iconProps} className="w-5 h-5 text-slate-400" />;
  }
}

export function getDeviceTypeColor(deviceType: DeviceType): {
  bg: string;
  border: string;
  text: string;
  badge: string;
  glow: string;
} {
  switch (deviceType) {
    case 'physical':
      return {
        bg: 'bg-slate-900/90 dark:bg-slate-900/95',
        border: 'border-blue-500/30 hover:border-blue-400',
        text: 'text-blue-400',
        badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        glow: 'rgba(59, 130, 246, 0.25)'
      };
    case 'vm':
      return {
        bg: 'bg-slate-900/90 dark:bg-slate-900/95',
        border: 'border-indigo-500/30 hover:border-indigo-400',
        text: 'text-indigo-400',
        badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
        glow: 'rgba(99, 102, 241, 0.25)'
      };
    case 'docker':
      return {
        bg: 'bg-slate-900/90 dark:bg-slate-900/95',
        border: 'border-cyan-500/30 hover:border-cyan-400',
        text: 'text-cyan-400',
        badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        glow: 'rgba(6, 182, 212, 0.25)'
      };
    case 'iot':
      return {
        bg: 'bg-slate-900/90 dark:bg-slate-900/95',
        border: 'border-emerald-500/30 hover:border-emerald-400',
        text: 'text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        glow: 'rgba(16, 185, 129, 0.25)'
      };
  }
}

export function getDeviceTypeLabel(deviceType: DeviceType): string {
  switch (deviceType) {
    case 'physical':
      return 'Machine Physique';
    case 'vm':
      return 'Machine Virtuelle (VM)';
    case 'docker':
      return 'Conteneur Docker';
    case 'iot':
      return 'Périphérique IoT';
  }
}
