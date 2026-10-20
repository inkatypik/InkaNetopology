export type DeviceType = 'physical' | 'vm' | 'docker' | 'iot';

export type DeviceSubType =
  | 'router'
  | 'switch'
  | 'server'
  | 'nas'
  | 'workstation'
  | 'vm'
  | 'container'
  | 'camera'
  | 'sensor_presence'
  | 'sensor_temp'
  | 'smart_plug'
  | 'smart_bulb'
  | 'access_point'
  | 'printer'
  | 'other';

export type DeviceStatus = 'online' | 'offline' | 'warning';

export interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  vendor: string;
  deviceType: DeviceType;
  subType: DeviceSubType;
  status: DeviceStatus;
  
  // Dynamic host/guest virtualization relationship:
  parentHostId?: string; // Physical host hosting this VM or Docker container
  
  // Physical network topology link:
  connectedToSwitchId?: string; // Router or Switch node it connects to
  portOrInterface?: string; // e.g. "Port 4 (1Gbps)", "Wi-Fi 5GHz", "veth4a91"
  vlan?: number;
  
  os?: string;
  openPorts?: number[];
  location?: string;
  customImage?: string; // URL or preset identifier
  tags: string[];
  metadata: Record<string, string>;
  lastSeen: string;
  latencyMs?: number;
  position?: { x: number; y: number };
}

export type LogLevel = 'INFO' | 'DISCOVERY' | 'WARN' | 'ALERT';
export type LogCategory = 'ARP' | 'PORT' | 'DOCKER' | 'VM' | 'IOT' | 'SYSTEM';

export interface NetworkLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  deviceId?: string;
  ip?: string;
  message: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  netmask: string;
  mac: string;
  family: string;
  cidr: string;
}

export interface ScanStatus {
  isScanning: boolean;
  progressPercent: number;
  currentIp?: string;
  devicesFound: number;
  subnet: string;
  startedAt?: string;
  scanMode: 'fast' | 'deep' | 'iot';
}
