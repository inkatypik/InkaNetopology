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
  previewUrl: string;
}

export const PRESET_HARDWARE_IMAGES: PresetImage[] = [
  {
    id: 'ubiquiti_udm_pro',
    label: 'Routeur / Passerelle 1U Rack (UniFi UDM)',
    category: 'physical',
    previewUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'dell_poweredge_server',
    label: 'Serveur Rack 2U (Dell PowerEdge)',
    category: 'physical',
    previewUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'synology_nas_4bay',
    label: 'Serveur NAS 4 Baies (Synology DiskStation)',
    category: 'physical',
    previewUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'docker_container_whale',
    label: 'Conteneur Docker Moteur veth',
    category: 'docker',
    previewUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'hikvision_outdoor_cam',
    label: 'Caméra Surveillance IP 4K RTSP',
    category: 'iot',
    previewUrl: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'sensor_presence_radar',
    label: 'Capteur Présence Radar mmWave',
    category: 'iot',
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'esp32_iot_sensor',
    label: 'Sonde Température Microcontrôleur ESP32',
    category: 'iot',
    previewUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=300&q=80'
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
