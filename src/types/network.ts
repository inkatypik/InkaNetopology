export type DeviceType = string;
export type DeviceSubType = string;

export interface DeviceTypeDefinition {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  isBuiltin?: boolean;
}

export interface DeviceSubTypeDefinition {
  id: string;
  name: string;
  typeId?: string; // 'all' or specific DeviceType id
  applicableDeviceTypes?: string[];
  role?: string;
  icon?: string;
  description?: string;
  deviceId?: string; // linked specifically to a particular equipment
  isBuiltin?: boolean;
}

export type DeviceStatus = 'online' | 'offline' | 'warning';

export type ZoneType = 'piece' | 'sous_repartiteur' | 'baie' | 'site' | 'autre';

export interface GeographicZone {
  id: string;
  name: string;
  type: ZoneType;
  description?: string;
  color?: string; // hex color or accent code
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  mac: string;
  vendor: string;
  deviceType: DeviceType;
  subType: DeviceSubType;
  role?: string; // Descriptive or custom role tied to this equipment
  status: DeviceStatus;
  
  // Geographic zone organization
  zoneId?: string;

  // Dynamic host/guest virtualization relationship:
  parentHostId?: string; // Physical host hosting this VM or Docker container
  
  // Physical network topology link:
  connectedToSwitchId?: string; // Router or Switch node it connects to
  portOrInterface?: string; // e.g. "Port 4 (1Gbps)", "Wi-Fi 5GHz", "veth4a91"
  vlan?: number;
  
  // Core network manual flag (can have multiple core devices)
  isCore?: boolean;

  os?: string;
  openPorts?: number[];
  location?: string;
  customImage?: string; // URL or preset identifier
  serviceIcon?: string; // Automatically detected official application/service icon
  isCustomImage?: boolean; // True if user manually customized the icon/image
  isCustomZone?: boolean; // True if user manually customized the geographic zone
  isCustomName?: boolean; // True if user manually renamed the equipment
  isCustomType?: boolean; // True if user manually changed the equipment type/subtype
  isManualAdded?: boolean; // True if equipment was added manually (Zigbee, Z-Wave, non-IP sensor, etc.)
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
  scanMode?: string;
}

export interface AppSettings {
  // Presence check (periodic network keepalive ping)
  presenceCheckEnabled: boolean;
  presenceCheckIntervalMinutes: number; // e.g. 0.5 (30s), 1, 2, 5, 10, 15, 30, 60
  lastPresenceCheckTime?: string;

  // Auto-prune / cleanup inactive equipment
  autoPruneEnabled: boolean;
  maxInactiveAgeHours: number; // e.g. 1, 6, 12, 24, 72, 168, 336, 720
  protectCoreDevices: boolean; // Protect core network equipment from deletion
  lastPruneTime?: string;

  // Default subnet
  defaultSubnet: string;
}
