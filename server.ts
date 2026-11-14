import express from 'express';
import { createServer as createViteServer } from 'vite';
import os from 'os';
import net from 'net';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import type { Device, DeviceType, DeviceSubType, DeviceTypeDefinition, DeviceSubTypeDefinition, NetworkLog, ScanStatus, GeographicZone, ZoneType, AppSettings } from './src/types/network.js';

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);
const dnsReversePromise = promisify(dns.reverse);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------- PERSISTENCE ----------------
const DATA_DIR = path.resolve(__dirname, 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ZONES_FILE = path.join(DATA_DIR, 'zones.json');
const TYPES_FILE = path.join(DATA_DIR, 'device-types.json');
const SUBTYPES_FILE = path.join(DATA_DIR, 'device-subtypes.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const defaultSettings: AppSettings = {
  presenceCheckEnabled: true,
  presenceCheckIntervalMinutes: 5,
  lastPresenceCheckTime: undefined,
  autoPruneEnabled: true,
  maxInactiveAgeHours: 24,
  protectCoreDevices: true,
  lastPruneTime: undefined,
  defaultSubnet: '192.168.1.0/24'
};

let appSettings: AppSettings = { ...defaultSettings };

// Default Device Types
const defaultDeviceTypes: DeviceTypeDefinition[] = [
  { id: 'physical', name: 'Machine Physique', color: '#3b82f6', icon: 'Server', description: 'Serveurs physiques, routeurs, switchs et baies', isBuiltin: true },
  { id: 'vm', name: 'Machine Virtuelle (VM)', color: '#6366f1', icon: 'Layers', description: 'Hyperviseurs Proxmox, VMware ESXi, KVM', isBuiltin: true },
  { id: 'docker', name: 'Conteneur Docker', color: '#06b6d4', icon: 'Box', description: 'Conteneurs Docker, microservices, Podman', isBuiltin: true },
  { id: 'iot', name: 'Périphérique IoT', color: '#10b981', icon: 'Radio', description: 'Objets connectés, capteurs, caméras, domotique', isBuiltin: true }
];

// Default Device Sub-Types & Roles
const defaultDeviceSubTypes: DeviceSubTypeDefinition[] = [
  { id: 'router', name: 'Passerelle / Routeur', typeId: 'physical', role: 'Passerelle WAN & Routage IP', icon: 'Network', isBuiltin: true },
  { id: 'switch', name: 'Switch Réseau', typeId: 'physical', role: 'Commutateur Ethernet & VLAN', icon: 'Layers', isBuiltin: true },
  { id: 'server', name: 'Serveur Physique', typeId: 'physical', role: 'Hôte d\'exécution & calcul', icon: 'Server', isBuiltin: true },
  { id: 'nas', name: 'Stockage NAS / SAN', typeId: 'physical', role: 'Serveur de fichiers & stockage iSCSI/NFS', icon: 'HardDrive', isBuiltin: true },
  { id: 'workstation', name: 'Poste de Travail / PC', typeId: 'physical', role: 'Station de travail bureautique/CAO', icon: 'Monitor', isBuiltin: true },
  { id: 'printer', name: 'Imprimante Réseau', typeId: 'physical', role: 'Imprimante réseau partagée', icon: 'Printer', isBuiltin: true },
  { id: 'access_point', name: 'Point d\'Accès Wi-Fi', typeId: 'physical', role: 'Borne Wi-Fi & couverture sans-fil', icon: 'Wifi', isBuiltin: true },
  { id: 'vm', name: 'Machine Virtuelle', typeId: 'vm', role: 'Instance VM généraliste', icon: 'Layers', isBuiltin: true },
  { id: 'truenas', name: 'Stockage VM (TrueNAS)', typeId: 'vm', role: 'Stockage virtualisé ZFS', icon: 'HardDrive', isBuiltin: true },
  { id: 'dns', name: 'DNS / Pare-feu (Pi-hole/pfSense)', typeId: 'vm', role: 'Résolveur DNS & sécurité réseau', icon: 'Shield', isBuiltin: true },
  { id: 'container', name: 'Conteneur Docker', typeId: 'docker', role: 'Microservice conteneurisé', icon: 'Box', isBuiltin: true },
  { id: 'reverse_proxy', name: 'Proxy Inverse (Nginx/Traefik)', typeId: 'docker', role: 'Reverse Proxy HTTP/HTTPS & SSL', icon: 'Network', isBuiltin: true },
  { id: 'database', name: 'Base de Données', typeId: 'docker', role: 'SGBD PostgreSQL / MySQL / Redis', icon: 'HardDrive', isBuiltin: true },
  { id: 'monitoring', name: 'Supervision (Grafana/Zabbix)', typeId: 'docker', role: 'Surveillance métriques & alertes', icon: 'Activity', isBuiltin: true },
  { id: 'camera', name: 'Caméra Surveillance IP', typeId: 'iot', role: 'Caméra IP flux RTSP / Sécurité', icon: 'Camera', isBuiltin: true },
  { id: 'sensor_presence', name: 'Capteur de Présence mmWave', typeId: 'iot', role: 'Détection d\'occupation radar', icon: 'Activity', isBuiltin: true },
  { id: 'sensor_temp', name: 'Sonde Température & Humidité', typeId: 'iot', role: 'Télémétrie environnementale', icon: 'Thermometer', isBuiltin: true },
  { id: 'smart_plug', name: 'Prise Connectée / Wattmètre', typeId: 'iot', role: 'Mesure électrique & commande relais', icon: 'Zap', isBuiltin: true },
  { id: 'smart_bulb', name: 'Éclairage Connecté', typeId: 'iot', role: 'Point d\'éclairage pilotable', icon: 'Zap', isBuiltin: true },
  { id: 'other', name: 'Autre équipement', typeId: 'all', role: 'Rôle généraliste', icon: 'HelpCircle', isBuiltin: true }
];

let deviceTypes: DeviceTypeDefinition[] = [];
let deviceSubTypes: DeviceSubTypeDefinition[] = [];

// Default Geographic Zones (Empty by default for clean start)
const defaultZones: GeographicZone[] = [];

let zones: GeographicZone[] = [];

// Default initial baseline topology (Empty by default for clean start)
const defaultDevices: Device[] = [];

let devices: Device[] = [];

// Helper: Check if an IP address is a local Docker bridge or container overlay IP
function isContainerInternalIp(ip?: string): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (trimmed === '127.0.0.1') return true;
  if (/^172\.(1[7-9]|2[0-9]|3[0-1])\./.test(trimmed)) return true;
  if (/^10\.(0|42|244)\./.test(trimmed)) return true;
  return false;
}

// Helper: accurately resolve the exact host machine for any container
// Containers MUST imperatively attach to the host machine sharing their IP address or exposed ports
function findBestHostForContainer(
  container: Partial<Device>,
  devList: Device[]
): Device | undefined {
  if (!devList || devList.length === 0) return undefined;

  const isCandidateHost = (d: Device) =>
    d.id !== container.id &&
    d.subType !== 'switch' &&
    d.subType !== 'router' &&
    d.subType !== 'access_point' &&
    d.deviceType !== 'docker' &&
    d.subType !== 'container';

  // 1. Extract explicit host IP from metadata, port bindings, or location
  const extractExplicitHostIp = (): string | undefined => {
    // A. Direct metadata
    const metaIp =
      container.metadata?.['IP Hôte'] ||
      container.metadata?.['HostIP'] ||
      container.metadata?.['ip_hote'] ||
      container.metadata?.['host_ip'] ||
      container.metadata?.['IP Machine'];
    if (metaIp && metaIp !== '127.0.0.1' && !isContainerInternalIp(metaIp)) {
      return metaIp.trim();
    }

    // B. portOrInterface regex: e.g. "Hôte: 192.168.1.50:8080" or "192.168.1.50:8080->"
    if (container.portOrInterface) {
      const m1 = container.portOrInterface.match(/(?:hôte|host)\s*[:=]?\s*(\d{1,3}(?:\.\d{1,3}){3})/i);
      if (m1 && m1[1] && m1[1] !== '127.0.0.1' && !isContainerInternalIp(m1[1])) {
        return m1[1].trim();
      }
      const m2 = container.portOrInterface.match(/(\d{1,3}(?:\.\d{1,3}){3}):\d+\s*->/);
      if (m2 && m2[1] && m2[1] !== '127.0.0.1' && !isContainerInternalIp(m2[1])) {
        return m2[1].trim();
      }
    }

    // C. location regex: e.g. "Hôte: 192.168.1.50" or "Conteneur sur 192.168.1.50"
    if (container.location) {
      const mLoc = container.location.match(/(?:hôte|host|sur)\s*[:=]?\s*(\d{1,3}(?:\.\d{1,3}){3})/i);
      if (mLoc && mLoc[1] && mLoc[1] !== '127.0.0.1' && !isContainerInternalIp(mLoc[1])) {
        return mLoc[1].trim();
      }
    }

    return undefined;
  };

  const explicitHostIp = extractExplicitHostIp();

  // PRIORITY 1: Explicit shared host IP match -> imperatively attach to host with this shared IP!
  if (explicitHostIp) {
    const hostWithExplicitIp = devList.find((d) => isCandidateHost(d) && d.ip === explicitHostIp);
    if (hostWithExplicitIp) return hostWithExplicitIp;
  }

  // PRIORITY 2: Exact LAN IP match with host (for containers in --net=host or host scan mode)
  if (container.ip && container.ip !== '127.0.0.1' && !isContainerInternalIp(container.ip)) {
    const hostWithSameIp = devList.find((d) => isCandidateHost(d) && d.ip === container.ip);
    if (hostWithSameIp) return hostWithSameIp;
  }

  // PRIORITY 3: Match exposed service port on candidate host's LAN IP
  // (Containers expose services on ports of their host's LAN IP)
  const extractContainerExposedPorts = (): number[] => {
    const ports = new Set<number>(container.openPorts || []);

    const metaPorts = container.metadata?.['Ports'] || container.metadata?.['Ports exposés'] || container.metadata?.['Port'];
    if (metaPorts) {
      const matches = metaPorts.match(/\b\d{1,5}\b/g);
      if (matches) {
        matches.forEach((p) => {
          const num = parseInt(p, 10);
          if (num > 0 && num <= 65535) ports.add(num);
        });
      }
    }

    if (container.portOrInterface) {
      const mHostPorts = container.portOrInterface.match(/(?:0\.0\.0\.0:|:\s*)(\d{1,5})->/g);
      if (mHostPorts) {
        mHostPorts.forEach((hp) => {
          const num = parseInt(hp.replace(/[^0-9]/g, ''), 10);
          if (num > 0 && num <= 65535) ports.add(num);
        });
      }
      const allNums = container.portOrInterface.match(/\b\d{2,5}\b/g);
      if (allNums) {
        allNums.forEach((p) => {
          const num = parseInt(p, 10);
          if (num > 0 && num <= 65535) ports.add(num);
        });
      }
    }

    return Array.from(ports);
  };

  const containerPorts = extractContainerExposedPorts();
  if (containerPorts.length > 0) {
    const specificPorts = containerPorts.filter((p) => ![80, 443].includes(p));
    const portsToCheck = specificPorts.length > 0 ? specificPorts : containerPorts;

    let bestPortHost: Device | undefined;
    let maxSharedPorts = 0;

    const candidateHosts = devList.filter(isCandidateHost);
    for (const host of candidateHosts) {
      const hostPorts = host.openPorts || [];
      const shared = portsToCheck.filter((p) => hostPorts.includes(p));
      if (shared.length > 0) {
        if (shared.length > maxSharedPorts) {
          maxSharedPorts = shared.length;
          bestPortHost = host;
        }
      }
    }

    if (bestPortHost && maxSharedPorts > 0) {
      return bestPortHost;
    }
  }

  // PRIORITY 4: Explicit Host reference in metadata (name or hostname match)
  const hostRef = (
    container.metadata?.['Hôte d\'exécution'] ||
    container.metadata?.['Hôte'] ||
    container.metadata?.['Host'] ||
    container.metadata?.['Hyperviseur'] ||
    ''
  ).trim().toLowerCase();

  if (hostRef && hostRef !== 'local docker daemon' && hostRef !== 'docker-host') {
    const hostByRef = devList.find((d) => {
      if (!isCandidateHost(d)) return false;
      const dName = d.name.trim().toLowerCase();
      const dHost = (d.metadata?.['Nom d\'hôte'] || '').trim().toLowerCase();
      return d.id.toLowerCase() === hostRef || dName === hostRef || (dHost && dHost === hostRef);
    });
    if (hostByRef) return hostByRef;
  }

  // PRIORITY 5: Strict location reference: e.g. location "Conteneur sur PVE-01"
  const location = (container.location || '').trim();
  const matchOn = location.match(/(?:sur|on|hôte|host)\s+([a-zA-Z0-9_\-\.]+)/i);
  if (matchOn && matchOn[1]) {
    const targetHostName = matchOn[1].toLowerCase();
    const hostByLoc = devList.find((d) => {
      if (!isCandidateHost(d)) return false;
      const dName = d.name.toLowerCase();
      return dName === targetHostName || dName.includes(targetHostName) || d.id.toLowerCase() === targetHostName;
    });
    if (hostByLoc) return hostByLoc;
  }

  // PRIORITY 6: Preserve existing parentHostId ONLY if valid and non-conflicting with explicit host IP
  if (container.parentHostId) {
    const existingParent = devList.find((d) => d.id === container.parentHostId);
    if (
      existingParent &&
      isCandidateHost(existingParent) &&
      (!explicitHostIp || existingParent.ip === explicitHostIp)
    ) {
      return existingParent;
    }
  }

  // PRIORITY 7: Local Docker daemon inspection (/var/run/docker.sock)
  if (
    container.metadata?.['Hôte'] === 'Local Docker Daemon' ||
    container.metadata?.['Découverte'] === 'Docker Socket' ||
    container.id?.startsWith('docker-')
  ) {
    const netInfo = getNetworkInterfaces();
    const localIps = netInfo.interfaces.map((i) => i.address).filter(Boolean);
    const localHostname = (os.hostname() || '').toLowerCase();

    const localMatch = devList.find(
      (d) =>
        isCandidateHost(d) &&
        (localIps.includes(d.ip) || (localHostname && d.name.toLowerCase() === localHostname))
    );
    if (localMatch) return localMatch;
  }

  // PRIORITY 8: If there is ONLY ONE dedicated host/server/hypervisor in the entire inventory
  const allCandidateHosts = devList.filter(isCandidateHost);
  if (allCandidateHosts.length === 1) {
    return allCandidateHosts[0];
  }

  return undefined;
}

// Helper: accurately resolve the exact hypervisor for any virtual machine
function findBestHostForVm(
  vm: Partial<Device>,
  devList: Device[]
): Device | undefined {
  if (!devList || devList.length === 0) return undefined;

  const isHypervisor = (d: Device) =>
    d.id !== vm.id &&
    d.deviceType === 'physical' &&
    (d.subType === 'server' || d.subType === 'nas');

  // 1. Explicit hypervisor IP in metadata
  const explicitHypIp = vm.metadata?.['IP Hyperviseur'] || vm.metadata?.['IP Hôte'];
  if (explicitHypIp && explicitHypIp !== '127.0.0.1' && !isContainerInternalIp(explicitHypIp)) {
    const host = devList.find((d) => isHypervisor(d) && d.ip === explicitHypIp);
    if (host) return host;
  }

  // 2. Explicit hypervisor reference in metadata (name or hostname)
  const hypRef = (
    vm.metadata?.['Hyperviseur'] ||
    vm.metadata?.['Hôte'] ||
    vm.metadata?.['Host'] ||
    ''
  ).trim().toLowerCase();

  if (hypRef) {
    const host = devList.find((d) => {
      if (!isHypervisor(d)) return false;
      return d.id.toLowerCase() === hypRef || d.name.toLowerCase() === hypRef || d.ip === hypRef;
    });
    if (host) return host;
  }

  // 3. Location string: e.g. "VM sur PVE-01"
  const loc = (vm.location || '').trim();
  const matchOn = loc.match(/(?:sur|on|hôte|host|pve)\s+([a-zA-Z0-9_\-\.]+)/i);
  if (matchOn && matchOn[1]) {
    const targetName = matchOn[1].toLowerCase();
    const host = devList.find((d) => isHypervisor(d) && (d.name.toLowerCase() === targetName || d.name.toLowerCase().includes(targetName)));
    if (host) return host;
  }

  // 4. Preserve existing parentHostId if valid and non-conflicting
  if (vm.parentHostId) {
    const existing = devList.find((d) => d.id === vm.parentHostId);
    if (
      existing &&
      existing.id !== vm.id &&
      existing.subType !== 'switch' &&
      existing.subType !== 'router' &&
      existing.subType !== 'access_point' &&
      (!explicitHypIp || existing.ip === explicitHypIp)
    ) {
      return existing;
    }
  }

  // 5. If there is ONLY ONE physical server/hypervisor in the entire topology, attach to it:
  const candidateHypervisors = devList.filter(isHypervisor);
  if (candidateHypervisors.length === 1) {
    return candidateHypervisors[0];
  }

  return undefined;
}

// Backward-compatible alias for existing calls
function resolveDockerHost(devList: Device[], container?: Partial<Device>): Device | undefined {
  return findBestHostForContainer(container || {}, devList);
}

// ---------------- DOCKER CONTAINER DEDUPLICATION & FUSION ----------------
// Normalizes service or container name for fuzzy and exact matching
function normalizeServiceName(rawName: string): string {
  if (!rawName) return '';
  let str = rawName.toLowerCase().trim();
  str = str.replace(/^(docker|conteneur|container|serveur|server|vm|service)\s*[-_: ]\s*/i, '');
  str = str.replace(/^(docker|conteneur|container)\s+/i, '');
  str = str.replace(/\([^)]*\)/g, '');
  str = str.replace(/\[[^\]]*\]/g, '');
  str = str.replace(/(:latest|:stable|:alpine|-ce\b|-community|_1|_app|_srv)\b/gi, '');
  str = str.replace(/[^a-z0-9]/g, '');
  return str;
}


// Check if an address is a valid non-synthetic hardware MAC address
function isRealHardwareMac(mac?: string): boolean {
  if (!mac) return false;
  const trimmed = mac.trim().toLowerCase();
  if (trimmed === '00:00:00:00:00:00') return false;
  if (trimmed.startsWith('02:00:00')) return false; // Synthetic ARP fallback
  if (trimmed.length < 11) return false;
  return true;
}

// Check if a device is a container or service candidate eligible for container-specific deduplication
function isContainerCandidate(d: Device, devList: Device[]): boolean {
  if (d.isCore) return false;
  // Core infrastructure, hypervisors, real physical servers, and VMs must NEVER be treated as container candidates to be merged away!
  if (d.deviceType === 'physical' || d.deviceType === 'vm') return false;
  if (['router', 'switch', 'access_point', 'workstation', 'printer', 'camera'].includes(d.subType)) return false;

  if (d.deviceType === 'docker') return true;
  if (['container', 'reverse_proxy', 'database', 'monitoring'].includes(d.subType)) return true;
  if (d.id.startsWith('docker-')) return true;
  if (d.tags?.some((t) => /docker|conteneur/i.test(t))) return true;
  if (d.metadata?.['ContainerID'] || d.metadata?.['Image']) return true;
  if (/^docker\s*[-_:]/i.test(d.name) || /^conteneur\s*[-_:]/i.test(d.name)) return true;

  // Discovered service on a bridge or container internal network
  if (isContainerInternalIp(d.ip)) return true;

  // Discovered service with known container ports and matching web title / tag
  const hasAppPort = (d.openPorts || []).some((p) =>
    [2375, 2376, 9000, 9443, 8080, 8123, 3000, 5000, 5432, 3306, 6379, 8086, 9090, 3100, 8000, 8008, 9001].includes(p)
  );
  if (hasAppPort && (d.metadata?.['Titre Web'] || d.subType === 'container' || d.subType === 'other')) {
    return true;
  }

  return false;
}

// Evaluates whether two devices correspond to the same container entity
function shouldMergeContainers(
  a: Device,
  b: Device,
  devList: Device[]
): { match: boolean; reason: string } {
  if (a.id === b.id) return { match: false, reason: '' };

  // Never merge physical servers, hypervisors, switches, routers or VMs
  if (a.deviceType === 'physical' || b.deviceType === 'physical') return { match: false, reason: '' };
  if (a.deviceType === 'vm' || b.deviceType === 'vm') return { match: false, reason: '' };

  const candA = isContainerCandidate(a, devList);
  const candB = isContainerCandidate(b, devList);
  // BOTH entities must be container candidates!
  if (!candA || !candB) return { match: false, reason: '' };

  // STRICT CROSS-HOST ISOLATION GUARDS:
  // 1. If both already have a parent host and they differ, they run on different hosts -> NEVER MERGE!
  if (a.parentHostId && b.parentHostId && a.parentHostId !== b.parentHostId) {
    return { match: false, reason: '' };
  }

  // 2. If both have explicit Host IP metadata and they differ -> NEVER MERGE!
  const hostIpA = a.metadata?.['IP Hôte'] || (!isContainerInternalIp(a.ip) ? a.ip : '');
  const hostIpB = b.metadata?.['IP Hôte'] || (!isContainerInternalIp(b.ip) ? b.ip : '');
  if (hostIpA && hostIpB && hostIpA !== hostIpB) {
    return { match: false, reason: '' };
  }

  // 3. Same Docker ContainerID (absolute proof of identical container)
  if (a.metadata?.['ContainerID'] && b.metadata?.['ContainerID']) {
    if (a.metadata['ContainerID'] === b.metadata['ContainerID']) {
      return { match: true, reason: `Identifiant conteneur identique (${a.metadata['ContainerID']})` };
    }
    // Different container IDs -> different containers!
    return { match: false, reason: '' };
  }

  const normA = normalizeServiceName(a.name);
  const normB = normalizeServiceName(b.name);
  const portsA = a.openPorts || [];
  const portsB = b.openPorts || [];
  const sharedPorts = portsA.filter((p) => portsB.includes(p));

  const isIntA = isContainerInternalIp(a.ip);
  const isIntB = isContainerInternalIp(b.ip);
  const oneHostOneContainerIp = (isIntA && !isIntB) || (isIntB && !isIntA);

  const namesMatch =
    normA.length >= 3 &&
    normB.length >= 3 &&
    (normA === normB || normA.includes(normB) || normB.includes(normA));

  // Also check if web title matches container name
  const titleA = normalizeServiceName(a.metadata?.['Titre Web'] || '');
  const titleB = normalizeServiceName(b.metadata?.['Titre Web'] || '');
  const titleMatches =
    (titleA.length >= 3 && (titleA === normB || normB.includes(titleA))) ||
    (titleB.length >= 3 && (titleB === normA || normA.includes(titleB)));

  const effectiveNameMatch = namesMatch || titleMatches;
  const nonGenericSharedPorts = sharedPorts.filter((p) => ![80, 443].includes(p));
  const hasAppPortMatch = nonGenericSharedPorts.length > 0;
  const hasAnyPortMatch = sharedPorts.length > 0;

  // Proof of same host:
  const sameHostConfirmed =
    (a.parentHostId && b.parentHostId && a.parentHostId === b.parentHostId) ||
    (hostIpA && hostIpB && hostIpA === hostIpB);

  // Case 1: Matching Name AND Matching Port
  if (effectiveNameMatch && hasAnyPortMatch) {
    return {
      match: true,
      reason: `Nom exposé correspondant ("${a.name}" & "${b.name}") et port partagé (${sharedPorts.join(', ')})`
    };
  }

  // Case 2: Matching Name, one is on Host IP and one is on Container IP
  if (effectiveNameMatch && (oneHostOneContainerIp || a.ip === b.ip)) {
    return {
      match: true,
      reason: `Nom exposé correspondant ("${a.name}" & "${b.name}") entre l'hôte (${isIntA ? b.ip : a.ip}) et le conteneur (${isIntA ? a.ip : b.ip})`
    };
  }

  // Case 3: Both are container candidates with identical normalized name on the same host or bridge
  if (effectiveNameMatch && (sameHostConfirmed || (isIntA && isIntB))) {
    return {
      match: true,
      reason: `Doublon de conteneur avec nom de service identique ("${a.name}" & "${b.name}")`
    };
  }

  // Case 4: Confirmed Same Host & Matching exposed application port
  if (hasAppPortMatch && sameHostConfirmed) {
    return {
      match: true,
      reason: `Port applicatif exposé identique (${nonGenericSharedPorts.join(', ')}) sur le même hôte`
    };
  }

  return { match: false, reason: '' };
}

// Collects all absorbed identifiers (IDs, IPs, MACs, hostnames, names, container IDs, web titles)
// so any future network/Docker scan recognizes merged equipment without creating duplicates
function collectMergedAliases(a: Device, b: Device) {
  const isRealIp = (ip?: string) => Boolean(ip && ip.trim() && ip.trim() !== '127.0.0.1' && ip.trim() !== 'sans IP');
  const isGenericDeviceName = (n?: string) => !n || /^(Équipement|Machine|Device)\s+/i.test(n.trim());

  const splitList = (val?: string) =>
    (val || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const mergedIds = Array.from(
    new Set([
      ...(a.mergedIds || []),
      ...(b.mergedIds || []),
      a.id,
      b.id
    ].filter(Boolean))
  );

  const mergedIps = Array.from(
    new Set([
      ...(a.mergedIps || []),
      ...(b.mergedIps || []),
      a.ip,
      b.ip,
      a.metadata?.['Adresse IP secondaire'],
      b.metadata?.['Adresse IP secondaire'],
      a.metadata?.['IP Conteneur'],
      b.metadata?.['IP Conteneur'],
      ...splitList(a.metadata?.['Adresses IP associées']),
      ...splitList(b.metadata?.['Adresses IP associées']),
      ...splitList(a.metadata?.['Anciennes adresses IP']),
      ...splitList(b.metadata?.['Anciennes adresses IP'])
    ].filter(isRealIp) as string[])
  );

  const mergedMacs = Array.from(
    new Set([
      ...(a.mergedMacs || []),
      ...(b.mergedMacs || []),
      a.mac,
      b.mac,
      a.metadata?.['MAC secondaire'],
      b.metadata?.['MAC secondaire']
    ]
      .filter((m) => isRealHardwareMac(m))
      .map((m) => m!.trim().toLowerCase()))
  );

  const mergedHostnames = Array.from(
    new Set([
      ...(a.mergedHostnames || []),
      ...(b.mergedHostnames || []),
      a.metadata?.['Nom d\'hôte'],
      b.metadata?.['Nom d\'hôte']
    ]
      .map((h) => (h || '').trim())
      .filter(Boolean))
  );

  const mergedNames = Array.from(
    new Set([
      ...(a.mergedNames || []),
      ...(b.mergedNames || []),
      !isGenericDeviceName(a.name) ? a.name.trim() : '',
      !isGenericDeviceName(b.name) ? b.name.trim() : ''
    ].filter(Boolean))
  );

  const mergedContainerIds = Array.from(
    new Set([
      ...(a.mergedContainerIds || []),
      ...(b.mergedContainerIds || []),
      a.metadata?.['ContainerID'],
      b.metadata?.['ContainerID'],
      a.id.startsWith('docker-') ? a.id.replace(/^docker-/, '') : '',
      b.id.startsWith('docker-') ? b.id.replace(/^docker-/, '') : ''
    ]
      .map((c) => (c || '').trim())
      .filter(Boolean))
  );

  const mergedWebTitles = Array.from(
    new Set([
      ...(a.mergedWebTitles || []),
      ...(b.mergedWebTitles || []),
      a.metadata?.['Titre Web'],
      b.metadata?.['Titre Web']
    ]
      .map((t) => (t || '').trim())
      .filter((t) => t.length >= 4))
  );

  return {
    mergedIds,
    mergedIps,
    mergedMacs,
    mergedHostnames,
    mergedNames,
    mergedContainerIds,
    mergedWebTitles
  };
}

// Merges two matching container entities into a single unified device
function mergeContainerEntities(
  target: Device,
  source: Device,
  reason: string,
  devList: Device[]
): Device {
  const isTargetInt = isContainerInternalIp(target.ip);
  const isSourceInt = isContainerInternalIp(source.ip);

  let hostIp = '';
  let containerIp = '';

  if (isTargetInt && !isSourceInt) {
    containerIp = target.ip;
    hostIp = source.ip;
  } else if (!isTargetInt && isSourceInt) {
    containerIp = source.ip;
    hostIp = target.ip;
  } else {
    // Both or neither internal: determine based on parentHost or keep target as main
    containerIp = isTargetInt ? target.ip : (source.metadata?.['IP Conteneur'] || target.ip);
    hostIp = target.metadata?.['IP Hôte'] || source.metadata?.['IP Hôte'] || (!isTargetInt ? target.ip : source.ip);
  }

  const mergedPorts = Array.from(
    new Set([...(target.openPorts || []), ...(source.openPorts || [])])
  ).sort((x, y) => x - y);

  // Consolidated clean name (prefer formatted Docker title if available)
  let cleanName = target.name;
  if (!cleanName.startsWith('Docker - ') && source.name.startsWith('Docker - ')) {
    cleanName = source.name;
  } else if (!cleanName.startsWith('Docker - ')) {
    cleanName = `Docker - ${cleanName.replace(/^(Docker|Conteneur)\s*[-:]?\s*/i, '').trim()}`;
  }

  // STRICT PARENT HOST RESOLUTION:
  // First, find host matching the shared hostIp!
  const hostByIp = hostIp
    ? devList.find(
        (d) =>
          d.ip === hostIp &&
          d.id !== target.id &&
          d.id !== source.id &&
          !['router', 'switch', 'access_point'].includes(d.subType)
      )
    : undefined;

  const targetParent = target.parentHostId ? devList.find((d) => d.id === target.parentHostId) : undefined;
  const sourceParent = source.parentHostId ? devList.find((d) => d.id === source.parentHostId) : undefined;
  
  // Host with matching hostIp is preferred over any mismatched parentHostId
  const hostDevice = hostByIp || targetParent || sourceParent;
  const parentHostId = hostDevice?.id || target.parentHostId || source.parentHostId;
  const isCustomZone = Boolean(target.isCustomZone || source.isCustomZone || target.metadata?.['Zone Manuelle'] || source.metadata?.['Zone Manuelle']);
  const zoneId = isCustomZone
    ? (target.isCustomZone ? target.zoneId : (source.isCustomZone ? source.zoneId : (target.zoneId || source.zoneId)))
    : (hostDevice?.zoneId || target.zoneId || source.zoneId);

  const isCustomImage = Boolean(target.isCustomImage || source.isCustomImage);
  const customImage = target.isCustomImage ? target.customImage : (source.isCustomImage ? source.customImage : (target.customImage || source.customImage));
  const serviceIcon = target.serviceIcon || source.serviceIcon;

  // Build unified metadata with explicit Host IP, Container IP, and exposed ports
  const combinedMetadata: Record<string, string> = {
    ...(source.metadata || {}),
    ...(target.metadata || {}),
    'IP Hôte': hostDevice?.ip || hostIp || target.metadata?.['IP Hôte'] || source.metadata?.['IP Hôte'] || '',
    'IP Conteneur': containerIp || target.ip,
    'Ports exposés': mergedPorts.length > 0 ? mergedPorts.join(', ') : 'Aucun port exposé',
    'Statut fusion': 'Fusionné (Hôte + Conteneur)',
    'Détail fusion': reason,
    'Dernière fusion': new Date().toLocaleString('fr-FR'),
    ...(isCustomZone ? { 'Zone Manuelle': 'true' } : {})
  };

  if (hostDevice) {
    combinedMetadata['Hôte d\'exécution'] = hostDevice.name;
  }

  const mainPort = mergedPorts.length > 0 ? mergedPorts[0] : undefined;
  const portOrInterface = mainPort
    ? `Hôte: ${hostIp || hostDevice?.ip || '?'}:${mainPort} → Conteneur: ${containerIp}:${mainPort}`
    : `Réseau Docker pont (Hôte: ${hostIp || hostDevice?.ip || '?'})`;

  const mergedTags = Array.from(
    new Set([
      ...(target.tags || []),
      ...(source.tags || []),
      'Docker',
      'Conteneur',
      'Fusionné'
    ])
  );

  const isOnline = target.status === 'online' || source.status === 'online';
  const aliases = collectMergedAliases(target, source);

  return {
    ...target,
    name: cleanName,
    ip: containerIp && containerIp !== '127.0.0.1' ? containerIp : (hostIp || target.ip),
    mac: target.mac && !target.mac.startsWith('02:00:00') ? target.mac : source.mac,
    deviceType: 'docker',
    subType: (target.subType !== 'other' && target.subType !== 'server') ? target.subType : (source.subType !== 'other' ? source.subType : 'container'),
    status: isOnline ? 'online' : 'offline',
    zoneId,
    parentHostId,
    portOrInterface,
    openPorts: mergedPorts,
    customImage,
    serviceIcon,
    isCustomImage,
    isCustomZone,
    isCustomName: target.isCustomName || source.isCustomName,
    isCustomType: target.isCustomType || source.isCustomType,
    isManualAdded: Boolean(target.isManualAdded || source.isManualAdded),
    isManuallyMerged: Boolean(target.isManuallyMerged || source.isManuallyMerged),
    ...aliases,
    location: hostDevice ? `Conteneur sur ${hostDevice.name}` : (target.location || `Conteneur sur hôte ${hostIp}`),
    tags: mergedTags,
    metadata: combinedMetadata,
    lastSeen: new Date().toISOString(),
    latencyMs: Math.min(target.latencyMs ?? 999, source.latencyMs ?? 999)
  };
}

// ---------------- UNIVERSAL MULTI-ID DEDUPLICATION & FUSION (ALL EQUIPMENT) ----------------
interface MergeCheckResult {
  match: boolean;
  reason: string;
  confidence: 'high' | 'medium';
  primaryId?: string;
}

// Evaluates whether ANY two devices in the network correspond to the same physical or virtual entity
function shouldMergeDevices(
  a: Device,
  b: Device,
  devList: Device[]
): MergeCheckResult {
  if (a.id === b.id) return { match: false, reason: '', confidence: 'medium' };

  // --- HARD SEPARATION GUARDS (NEVER MERGE THESE COMBINATIONS) ---
  // 1. Never merge a core router/gateway with ordinary client devices or containers
  if ((a.isCore || a.subType === 'router') && (b.deviceType === 'docker' || b.deviceType === 'iot' || b.subType === 'printer' || b.subType === 'workstation')) {
    return { match: false, reason: '', confidence: 'medium' };
  }
  if ((b.isCore || b.subType === 'router') && (a.deviceType === 'docker' || a.deviceType === 'iot' || a.subType === 'printer' || a.subType === 'workstation')) {
    return { match: false, reason: '', confidence: 'medium' };
  }

  // 2. Never merge two distinct physical core routers/switches if they have different IPs and MACs
  if ((a.isCore || a.subType === 'router' || a.subType === 'switch') &&
      (b.isCore || b.subType === 'router' || b.subType === 'switch') &&
      a.ip !== b.ip && a.mac !== b.mac) {
    return { match: false, reason: '', confidence: 'medium' };
  }

  // 3. Never merge a parent host with its own guest VM or container (unless Docker host port consolidation)
  if (a.parentHostId === b.id || b.parentHostId === a.id) {
    if ((a.deviceType === 'physical' && b.deviceType !== 'physical') ||
        (b.deviceType === 'physical' && a.deviceType !== 'physical')) {
      return { match: false, reason: '', confidence: 'medium' };
    }
  }

  // 4. Containers running on DIFFERENT hosts must NEVER merge
  if (a.deviceType === 'docker' && b.deviceType === 'docker') {
    if (a.parentHostId && b.parentHostId && a.parentHostId !== b.parentHostId) {
      return { match: false, reason: '', confidence: 'medium' };
    }
    const hostIpA = a.metadata?.['IP Hôte'] || (!isContainerInternalIp(a.ip) ? a.ip : '');
    const hostIpB = b.metadata?.['IP Hôte'] || (!isContainerInternalIp(b.ip) ? b.ip : '');
    if (hostIpA && hostIpB && hostIpA !== hostIpB) {
      return { match: false, reason: '', confidence: 'medium' };
    }
  }

  // 5. Never merge a physical server/NAS with a VM or container
  if ((a.deviceType === 'physical' && (a.subType === 'server' || a.subType === 'nas')) &&
      (b.deviceType === 'docker' || b.deviceType === 'vm')) {
    return { match: false, reason: '', confidence: 'medium' };
  }
  if ((b.deviceType === 'physical' && (b.subType === 'server' || b.subType === 'nas')) &&
      (a.deviceType === 'docker' || a.deviceType === 'vm')) {
    return { match: false, reason: '', confidence: 'medium' };
  }

  // --- STRONG IDENTIFIERS ---

  // ID RULE 1: Exact Docker ContainerID match (absolute proof of identical container)
  if (a.metadata?.['ContainerID'] && b.metadata?.['ContainerID']) {
    if (a.metadata['ContainerID'] === b.metadata['ContainerID']) {
      return {
        match: true,
        reason: `Identifiant conteneur Docker identique (${a.metadata['ContainerID']})`,
        confidence: 'high'
      };
    }
    return { match: false, reason: '', confidence: 'medium' };
  }

  // ID RULE 2: Real Hardware MAC address match
  // (Applies to all physical devices, servers, workstations, printers, IoT, and VMs with identical virtual NIC MAC)
  if (isRealHardwareMac(a.mac) && isRealHardwareMac(b.mac) && a.mac!.toLowerCase() === b.mac!.toLowerCase()) {
    // Check if this MAC is shared across too many devices (e.g. gateway proxy-ARP)
    const normMac = a.mac!.toLowerCase();
    const macOccurrences = devList.filter((d) => d.mac && d.mac.toLowerCase() === normMac).length;
    if (macOccurrences <= 2) {
      // Same physical equipment!
      if (a.ip && b.ip && a.ip !== b.ip) {
        return {
          match: true,
          reason: `Adresse MAC matérielle identique (${a.mac}) avec renouvellement d'adresse IP (${a.ip} → ${b.ip})`,
          confidence: 'high',
          primaryId: a.status === 'online' ? a.id : b.id
        };
      }
      return {
        match: true,
        reason: `Adresse MAC matérielle identique (${a.mac})`,
        confidence: 'high'
      };
    }
  }

  // ID RULE 3: Same IP Address match (for non-containers, or between same-family devices)
  if (a.ip && b.ip && a.ip === b.ip && a.ip !== '127.0.0.1' && !isContainerInternalIp(a.ip)) {
    // Both are physical devices, or both are VMs, or both are IoT, or one is generic 'other'
    const areCompatibleTypes =
      (a.deviceType === b.deviceType) ||
      (a.subType === 'other' || b.subType === 'other') ||
      (a.deviceType === 'physical' && b.deviceType === 'iot') ||
      (a.deviceType === 'iot' && b.deviceType === 'physical');

    if (areCompatibleTypes && a.deviceType !== 'docker' && b.deviceType !== 'docker') {
      return {
        match: true,
        reason: `Même adresse IP (${a.ip}) et profil d'équipement concordant`,
        confidence: 'high'
      };
    }
  }

  // ID RULE 4: Hostname / NetBIOS / Reverse DNS match with shared ports or vendor
  const normHostA = normalizeServiceName(a.metadata?.['Nom d\'hôte'] || a.name);
  const normHostB = normalizeServiceName(b.metadata?.['Nom d\'hôte'] || b.name);
  const isGenericName = (n: string) =>
    n.length < 4 ||
    /^(device|equipement|inconnu|unknown|machine|linux|server|serveur|host|hote|ip|lan)\b/i.test(n);

  if (!isGenericName(normHostA) && !isGenericName(normHostB) && normHostA === normHostB) {
    const portsA = a.openPorts || [];
    const portsB = b.openPorts || [];
    const sharedPorts = portsA.filter((p) => portsB.includes(p));
    const sameVendor = a.vendor && b.vendor && a.vendor !== 'Générique / Inconnu' && a.vendor === b.vendor;

    if (sharedPorts.length > 0 || sameVendor || a.ip === b.ip) {
      return {
        match: true,
        reason: `Nom d'hôte concordant ("${a.name}") avec ${sharedPorts.length > 0 ? `ports partagés (${sharedPorts.slice(0, 3).join(', ')})` : 'constructeur identique'}`,
        confidence: 'high'
      };
    }
  }

  // ID RULE 5: Web Title & Service signature match (Proxmox, Synology, TrueNAS, Home Assistant, etc.)
  const titleA = (a.metadata?.['Titre Web'] || '').trim().toLowerCase();
  const titleB = (b.metadata?.['Titre Web'] || '').trim().toLowerCase();
  if (titleA.length >= 5 && titleB.length >= 5 && (titleA === titleB || titleA.includes(titleB) || titleB.includes(titleA))) {
    const portsA = a.openPorts || [];
    const portsB = b.openPorts || [];
    const sharedPorts = portsA.filter((p) => portsB.includes(p));
    if (sharedPorts.length > 0) {
      return {
        match: true,
        reason: `Signature de service web identique ("${a.metadata!['Titre Web']}") sur port partagé`,
        confidence: 'high'
      };
    }
  }

  // ID RULE 6: Container Deduplication (Internal Bridge IP vs Host IP exposed port)
  const isDockerA = a.deviceType === 'docker' || a.id.startsWith('docker-');
  const isDockerB = b.deviceType === 'docker' || b.id.startsWith('docker-');
  if (isDockerA && isDockerB) {
    const containerCheck = shouldMergeContainers(a, b, devList);
    if (containerCheck.match) {
      return {
        match: true,
        reason: containerCheck.reason,
        confidence: 'high'
      };
    }
  }

  return { match: false, reason: '', confidence: 'medium' };
}

// Merges ANY two matching equipment entities into a single unified device
function mergeTwoDevices(
  target: Device,
  source: Device,
  reason: string,
  devList: Device[]
): Device {
  // If both are Docker containers, delegate to specialized container merge
  if (target.deviceType === 'docker' && source.deviceType === 'docker') {
    return mergeContainerEntities(target, source, reason, devList);
  }

  // For General Equipment (Physical, VM, IoT, Workstation, Server, NAS, Switch, Printer):
  const isTargetRealMac = isRealHardwareMac(target.mac);
  const isSourceRealMac = isRealHardwareMac(source.mac);
  const chosenMac = isTargetRealMac ? target.mac : (isSourceRealMac ? source.mac : (target.mac || source.mac));

  // Preserve best name: prefer user customized or more specific name over generic "(IP)"
  const isGenericName = (n: string) => /\(\d+\.\d+\.\d+\.\d+\)$/i.test(n) || /^Équipement\s+/i.test(n);
  let chosenName = target.name;
  if (isGenericName(target.name) && !isGenericName(source.name)) {
    chosenName = source.name;
  }

  // Preserve best vendor and OS
  const chosenVendor = (target.vendor && target.vendor !== 'Générique / Inconnu') ? target.vendor : (source.vendor || target.vendor);
  const chosenOs = target.os || source.os;

  // Ports: merged union
  const mergedPorts = Array.from(
    new Set([...(target.openPorts || []), ...(source.openPorts || [])])
  ).sort((x, y) => x - y);

  // Tags: merged union
  const mergedTags = Array.from(
    new Set([
      ...(target.tags || []),
      ...(source.tags || []),
      'Fusionné'
    ])
  );

  // Associated IPs (track history if IPs differ, e.g. DHCP lease renewal)
  const allIps = Array.from(
    new Set([
      target.ip,
      source.ip,
      ...(target.metadata?.['Adresses IP associées']?.split(', ') || []),
      ...(source.metadata?.['Adresses IP associées']?.split(', ') || [])
    ].filter(Boolean))
  );

  // Status & Latency
  const isOnline = target.status === 'online' || source.status === 'online';
  const chosenLatency = Math.min(target.latencyMs ?? 999, source.latencyMs ?? 999);

  // ParentHost / Switch / Zone preservation
  const chosenParentHostId = target.parentHostId || source.parentHostId;
  const chosenSwitchId = target.connectedToSwitchId || source.connectedToSwitchId;

  const isCustomZone = Boolean(target.isCustomZone || source.isCustomZone || target.metadata?.['Zone Manuelle'] || source.metadata?.['Zone Manuelle']);
  const chosenZoneId = isCustomZone
    ? (target.isCustomZone ? target.zoneId : (source.isCustomZone ? source.zoneId : (target.zoneId || source.zoneId)))
    : (target.zoneId || source.zoneId);

  const isCustomImage = Boolean(target.isCustomImage || source.isCustomImage);
  const chosenCustomImage = target.isCustomImage ? target.customImage : (source.isCustomImage ? source.customImage : (target.customImage || source.customImage));
  const chosenServiceIcon = target.serviceIcon || source.serviceIcon;

  // Metadata consolidation
  const combinedMetadata: Record<string, string> = {
    ...(source.metadata || {}),
    ...(target.metadata || {}),
    'Statut fusion': 'Fusionné (Multi-identifiants)',
    'Détail fusion': reason,
    'Dernière fusion': new Date().toLocaleString('fr-FR'),
    ...(allIps.length > 1 ? { 'Adresses IP associées': allIps.join(', ') } : {}),
    ...(isCustomZone ? { 'Zone Manuelle': 'true' } : {})
  };

  const aliases = collectMergedAliases(target, source);

  return {
    ...target,
    name: chosenName,
    ip: target.status === 'online' ? target.ip : (source.status === 'online' ? source.ip : target.ip),
    mac: chosenMac,
    vendor: chosenVendor,
    os: chosenOs,
    status: isOnline ? 'online' : 'offline',
    openPorts: mergedPorts,
    tags: mergedTags,
    zoneId: chosenZoneId,
    parentHostId: chosenParentHostId,
    connectedToSwitchId: chosenSwitchId,
    customImage: chosenCustomImage,
    serviceIcon: chosenServiceIcon,
    isCustomImage,
    isCustomZone,
    isCustomName: target.isCustomName || source.isCustomName,
    isCustomType: target.isCustomType || source.isCustomType,
    isManualAdded: Boolean(target.isManualAdded || source.isManualAdded),
    isManuallyMerged: Boolean(target.isManuallyMerged || source.isManuallyMerged),
    ...aliases,
    metadata: combinedMetadata,
    lastSeen: new Date().toISOString(),
    latencyMs: chosenLatency === 999 ? undefined : chosenLatency
  };
}

// Master function to deduplicate and merge duplicate devices across ALL equipment types
function mergeDuplicateDevices(devList: Device[]): {
  devices: Device[];
  mergedCount: number;
  mergedDetails: string[];
} {
  let list = devList.map((d) => ({ ...d }));
  let mergedCount = 0;
  const mergedDetails: string[] = [];
  let foundMerge = true;

  while (foundMerge) {
    foundMerge = false;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        const check = shouldMergeDevices(a, b, list);
        if (check.match) {
          // Choose target (prefer entity with established user configuration or primary ID)
          let target = a;
          let source = b;

          if (check.primaryId === b.id) {
            target = b;
            source = a;
          } else if (
            (!a.isCore && b.isCore) ||
            (!a.parentHostId && b.parentHostId) ||
            (a.name.includes('(') && !b.name.includes('(')) ||
            (!isRealHardwareMac(a.mac) && isRealHardwareMac(b.mac))
          ) {
            target = b;
            source = a;
          }

          const merged = mergeTwoDevices(target, source, check.reason, list);
          const targetIndex = list.findIndex((d) => d.id === target.id);
          const sourceIndex = list.findIndex((d) => d.id === source.id);

          if (targetIndex !== -1 && sourceIndex !== -1) {
            list[targetIndex] = merged;
            list.splice(sourceIndex, 1);
            mergedCount++;
            mergedDetails.push(
              `Fusionné "${merged.name}" (IP: ${merged.ip}, MAC: ${merged.mac || 'N/A'}) - ${check.reason}`
            );
            foundMerge = true;
            break;
          }
        }
      }
      if (foundMerge) break;
    }
  }

  return { devices: list, mergedCount, mergedDetails };
}

// Backward-compatible alias for existing calls
function mergeDuplicateContainers(devList: Device[]) {
  return mergeDuplicateDevices(devList);
}

// Visual dimensions for card calculations and non-overlapping margins
const NODE_WIDTH = 280;
const NODE_HEIGHT = 220;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 50;

const HOST_HEADER_HEIGHT = 48;
const HOST_PAD_X = 36;
const HOST_PAD_Y = 32;

const ZONE_HEADER_HEIGHT = 52;
const ZONE_PAD_X = 40;
const ZONE_PAD_Y = 36;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(r1: Rect, r2: Rect, minSpacing = 50): boolean {
  return !(
    r1.x + r1.width + minSpacing <= r2.x ||
    r2.x + r2.width + minSpacing <= r1.x ||
    r1.y + r1.height + minSpacing <= r2.y ||
    r2.y + r2.height + minSpacing <= r1.y
  );
}

interface GuestTreeItem {
  guest: Device;
  subContainers: Device[];
  width: number;
  height: number;
  relX?: number;
  relY?: number;
}

interface LayoutUnit {
  type: 'standalone' | 'host_cluster';
  host: Device;
  guestItems: GuestTreeItem[];
  width: number;
  height: number;
  relX?: number;
  relY?: number;
}

// TOPOLOGIE EN ÉTOILE (Clean Non-Overlapping Star Topology Layout):
// 1. Network Core (Passerelle / Routeur cœur) sits at the 2D CENTER (CENTER_X, CENTER_Y).
// 2. All connected entities radiate symmetrically across all 4 quadrants (top, bottom, left, right).
// 3. Hosts enclose their VMs & Docker containers in their block without overlap.
// 4. Nested virtualization (containers inside a VM) placed cleanly below the VM.
// 5. Zones placed radially around the Core with guaranteed zero overlap.
function autoLayoutTopology(devList: Device[], zoneList: GeographicZone[] = zones): Device[] {
  if (!devList || devList.length === 0) return [];

  // Deduplicate and consolidate containers before organizing layout
  const mergeRes = mergeDuplicateContainers(devList);
  const devices: Device[] = mergeRes.devices.map((d) => ({ ...d }));
  const devMap = new Map<string, Device>();
  devices.forEach((d) => devMap.set(d.id, d));

  // 1. Identify Network Core(s)
  const manualCoreNodes = devices.filter((d) => d.isCore === true);
  let coreNodes: Device[] = [];

  if (manualCoreNodes.length > 0) {
    coreNodes = manualCoreNodes;
  } else {
    let defaultCore = devices.find(
      (d) =>
        d.subType === 'router' ||
        d.ip.endsWith('.1') ||
        d.ip.endsWith('.254') ||
        d.name.toLowerCase().includes('passerelle') ||
        d.name.toLowerCase().includes('cœur') ||
        d.name.toLowerCase().includes('coeur') ||
        d.name.toLowerCase().includes('gateway') ||
        d.name.toLowerCase().includes('box') ||
        d.name.toLowerCase().includes('udm')
    );

    if (!defaultCore) {
      defaultCore =
        devices.find((d) => d.subType === 'switch') ||
        devices.find((d) => d.deviceType === 'physical') ||
        devices[0];
    }
    if (defaultCore) coreNodes = [defaultCore];
  }

  const coreNodeIds = new Set(coreNodes.map((c) => c.id));

  // 2. Intelligently heal and re-evaluate container & VM parent host bindings:
  // Containers MUST be imperatively attached to the host with which they share their IP address or exposed ports!
  devices.forEach((d) => {
    if (d.deviceType === 'docker') {
      const best = findBestHostForContainer(d, devices);
      if (best) {
        d.parentHostId = best.id;
        if (!d.metadata) d.metadata = {};
        d.metadata['IP Hôte'] = best.ip;
        d.metadata['Hôte d\'exécution'] = best.name;
        if (!d.location || d.location === 'Découvert sur le réseau local' || d.location.includes('hôte Docker')) {
          d.location = `Conteneur sur ${best.name}`;
        }
      }
    } else if (d.deviceType === 'vm') {
      const bestVmHost = findBestHostForVm(d, devices);
      if (bestVmHost) {
        d.parentHostId = bestVmHost.id;
        if (!d.metadata) d.metadata = {};
        d.metadata['Hyperviseur'] = bestVmHost.name;
        d.metadata['IP Hyperviseur'] = bestVmHost.ip;
        if (!d.location || d.location === 'Découvert sur le réseau local' || d.location.includes('hyperviseur')) {
          d.location = `Machine virtuelle sur ${bestVmHost.name}`;
        }
      }
    }
  });

  // Ensure guests inherit their host's zone recursively so the whole virtualization family stays together
  const resolveZoneId = (dev: Device, visited = new Set<string>()): string | undefined => {
    if (visited.has(dev.id)) return dev.zoneId;
    visited.add(dev.id);
    if (dev.parentHostId && devMap.has(dev.parentHostId)) {
      const parent = devMap.get(dev.parentHostId)!;
      return resolveZoneId(parent, visited) || dev.zoneId;
    }
    return dev.zoneId;
  };

  devices.forEach((d) => {
    // Strictly preserve manually assigned or customized zone!
    if (!d.isCustomZone && !d.metadata?.['Zone Manuelle'] && !d.zoneId) {
      if (d.parentHostId && devMap.has(d.parentHostId)) {
        const parentZone = resolveZoneId(d);
        if (parentZone) {
          d.zoneId = parentZone;
        }
      }
    }
  });

  // 3. Separate Core Nodes from Satellite Devices
  const coreDevices = devices.filter((d) => coreNodeIds.has(d.id));
  const satelliteDevices = devices.filter((d) => !coreNodeIds.has(d.id));

  const CENTER_X = 1800;
  const CENTER_Y = 1400;

  // Place Core Nodes side-by-side at the exact center
  const CORE_SPACING = NODE_WIDTH + 80;
  const totalCoreW = (coreDevices.length - 1) * CORE_SPACING;
  const startCoreX = CENTER_X - totalCoreW / 2;
  coreDevices.forEach((cn, idx) => {
    cn.position = {
      x: Math.round(startCoreX + idx * CORE_SPACING - NODE_WIDTH / 2),
      y: Math.round(CENTER_Y - NODE_HEIGHT / 2)
    };
  });

  const coreBoundingRect: Rect = {
    x: Math.round(startCoreX - NODE_WIDTH / 2 - 50),
    y: Math.round(CENTER_Y - NODE_HEIGHT / 2 - 50),
    width: Math.max(NODE_WIDTH + 100, totalCoreW + NODE_WIDTH + 100),
    height: NODE_HEIGHT + 100
  };

  if (satelliteDevices.length === 0) {
    return devices;
  }

  // 4. Construct Layout Units for all Satellite Devices
  function buildLayoutUnits(devs: Device[]): LayoutUnit[] {
    const units: LayoutUnit[] = [];
    const handledDevIds = new Set<string>();

    const hostCandidates = devs.filter((d) => {
      if (d.parentHostId && devs.some((p) => p.id === d.parentHostId)) return false;
      return devs.some((c) => c.parentHostId === d.id);
    });

    hostCandidates.forEach((host) => {
      handledDevIds.add(host.id);

      const directChildren = devs.filter((c) => c.parentHostId === host.id);
      const guestItems: GuestTreeItem[] = [];

      directChildren.forEach((guest) => {
        handledDevIds.add(guest.id);

        const subContainers = devs.filter((c) => c.parentHostId === guest.id);
        subContainers.forEach((sc) => handledDevIds.add(sc.id));

        if (subContainers.length === 0) {
          guestItems.push({
            guest,
            subContainers: [],
            width: NODE_WIDTH,
            height: NODE_HEIGHT
          });
        } else {
          const scPerRow = Math.min(3, Math.max(1, subContainers.length));
          const scRows = Math.ceil(subContainers.length / scPerRow);
          const scW = Math.max(
            NODE_WIDTH + 30,
            scPerRow * NODE_WIDTH + (scPerRow - 1) * NODE_GAP_X + 40
          );
          const scH =
            NODE_HEIGHT +
            55 +
            scRows * NODE_HEIGHT +
            (scRows - 1) * NODE_GAP_Y +
            30;

          guestItems.push({
            guest,
            subContainers,
            width: scW,
            height: scH
          });
        }
      });

      const maxCol = guestItems.some((gi) => gi.width > 400) ? 2 : Math.min(3, Math.max(1, guestItems.length));
      const guestRows: GuestTreeItem[][] = [];
      for (let i = 0; i < guestItems.length; i += maxCol) {
        guestRows.push(guestItems.slice(i, i + maxCol));
      }

      let maxGuestsRowW = NODE_WIDTH;
      let totalGuestsH = 0;

      guestRows.forEach((row) => {
        const rowW = row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * NODE_GAP_X;
        if (rowW > maxGuestsRowW) maxGuestsRowW = rowW;
        const rowMaxH = Math.max(...row.map((item) => item.height));
        totalGuestsH += rowMaxH + NODE_GAP_Y;
      });

      const clusterW = Math.max(NODE_WIDTH + HOST_PAD_X * 2, maxGuestsRowW + HOST_PAD_X * 2);
      const clusterH =
        HOST_HEADER_HEIGHT +
        HOST_PAD_Y +
        NODE_HEIGHT +
        55 +
        totalGuestsH +
        HOST_PAD_Y;

      let currentItemY = HOST_HEADER_HEIGHT + HOST_PAD_Y + NODE_HEIGHT + 55;
      guestRows.forEach((row) => {
        const rowW = row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * NODE_GAP_X;
        const rowMaxH = Math.max(...row.map((item) => item.height));
        let currentItemX = Math.round((clusterW - rowW) / 2);

        row.forEach((item) => {
          item.relX = currentItemX;
          item.relY = currentItemY;

          if (item.subContainers.length > 0) {
            const scPerRow = Math.min(3, Math.max(1, item.subContainers.length));
            const scRows = Math.ceil(item.subContainers.length / scPerRow);
            const scStartRowY = currentItemY + NODE_HEIGHT + 45;

            item.subContainers.forEach((sc, scIdx) => {
              const scCol = scIdx % scPerRow;
              const scRow = Math.floor(scIdx / scPerRow);
              const itemsInThisScRow = Math.min(scPerRow, item.subContainers.length - scRow * scPerRow);
              const thisRowW = itemsInThisScRow * NODE_WIDTH + (itemsInThisScRow - 1) * NODE_GAP_X;
              const scRowStartX = Math.round(currentItemX + (item.width - thisRowW) / 2);

              sc.position = {
                x: scRowStartX + scCol * (NODE_WIDTH + NODE_GAP_X),
                y: scStartRowY + scRow * (NODE_HEIGHT + NODE_GAP_Y)
              };
            });
          }

          currentItemX += item.width + NODE_GAP_X;
        });

        currentItemY += rowMaxH + NODE_GAP_Y;
      });

      units.push({
        type: 'host_cluster',
        host,
        guestItems,
        width: clusterW,
        height: clusterH
      });
    });

    devs.forEach((d) => {
      if (!handledDevIds.has(d.id)) {
        units.push({
          type: 'standalone',
          host: d,
          guestItems: [],
          width: NODE_WIDTH,
          height: NODE_HEIGHT
        });
      }
    });

    return units;
  }

  function getQuadrantAngles(count: number): number[] {
    if (count <= 0) return [];
    if (count === 1) return [0];
    if (count === 2) return [0, Math.PI];
    if (count === 3) return [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    if (count === 4) return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

    const angles: number[] = [];
    const step = (2 * Math.PI) / count;
    for (let i = 0; i < count; i++) {
      angles.push(i * step);
    }
    return angles;
  }

  const zoneMap = new Map<string, GeographicZone>();
  zoneList.forEach((z) => zoneMap.set(z.id, z));

  const devicesByZone = new Map<string, Device[]>();
  satelliteDevices.forEach((d) => {
    const zId = d.zoneId || 'unassigned';
    const list = devicesByZone.get(zId) || [];
    list.push(d);
    devicesByZone.set(zId, list);
  });

  const distinctZoneKeys = Array.from(devicesByZone.keys());

  function applyUnitPositions(unit: LayoutUnit, absX: number, absY: number) {
    if (unit.type === 'standalone') {
      unit.host.position = { x: absX, y: absY };
    } else {
      const hostX = Math.round(absX + (unit.width - NODE_WIDTH) / 2);
      const hostY = Math.round(absY + HOST_PAD_Y + HOST_HEADER_HEIGHT);
      unit.host.position = { x: hostX, y: hostY };

      unit.guestItems.forEach((item) => {
        const itemAbsX = absX + (item.relX ?? 0);
        const itemAbsY = absY + (item.relY ?? 0);

        item.guest.position = {
          x: Math.round(itemAbsX + (item.width - NODE_WIDTH) / 2),
          y: itemAbsY
        };

        if (item.subContainers.length > 0) {
          const scPerRow = Math.min(3, Math.max(1, item.subContainers.length));
          const scStartRowY = itemAbsY + NODE_HEIGHT + 45;

          item.subContainers.forEach((sc, scIdx) => {
            const scCol = scIdx % scPerRow;
            const scRow = Math.floor(scIdx / scPerRow);
            const itemsInThisScRow = Math.min(scPerRow, item.subContainers.length - scRow * scPerRow);
            const thisRowW = itemsInThisScRow * NODE_WIDTH + (itemsInThisScRow - 1) * NODE_GAP_X;
            const scRowStartX = Math.round(itemAbsX + (item.width - thisRowW) / 2);

            sc.position = {
              x: scRowStartX + scCol * (NODE_WIDTH + NODE_GAP_X),
              y: scStartRowY + scRow * (NODE_HEIGHT + NODE_GAP_Y)
            };
          });
        }
      });
    }
  }

  // CASE A: Only 1 Zone or unassigned devices
  if (distinctZoneKeys.length <= 1) {
    const singleZoneId = distinctZoneKeys[0] || 'unassigned';
    const devsInZone = devicesByZone.get(singleZoneId) || satelliteDevices;
    const units = buildLayoutUnits(devsInZone);

    const placedRects: Rect[] = [coreBoundingRect];
    const angles = getQuadrantAngles(units.length);

    units.forEach((u, idx) => {
      const angle = angles[idx];
      const halfW = u.width / 2;
      const halfH = u.height / 2;

      let radius = Math.max(
        620,
        Math.sqrt(halfW * halfW + halfH * halfH) + Math.max(coreBoundingRect.width, coreBoundingRect.height) / 2 + 80
      );

      let unitX = Math.round(CENTER_X + radius * Math.cos(angle) - halfW);
      let unitY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfH);

      let candidateRect: Rect = { x: unitX, y: unitY, width: u.width, height: u.height };
      let attempts = 0;
      while (attempts < 60) {
        const overlaps = placedRects.some((other) => rectsOverlap(candidateRect, other, 60));
        if (!overlaps) break;
        radius += 70;
        unitX = Math.round(CENTER_X + radius * Math.cos(angle) - halfW);
        unitY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfH);
        candidateRect = { x: unitX, y: unitY, width: u.width, height: u.height };
        attempts++;
      }

      placedRects.push(candidateRect);
      applyUnitPositions(u, unitX, unitY);
    });

    return devices;
  }

  // CASE B: Multiple Geographic Zones (>= 2 Zones)
  interface PlannedZone {
    zoneId: string;
    width: number;
    height: number;
    units: LayoutUnit[];
  }

  const plannedZones: PlannedZone[] = [];

  devicesByZone.forEach((devs, zId) => {
    const units = buildLayoutUnits(devs);

    const totalUnits = units.length;
    let cols = 1;
    if (totalUnits >= 6) cols = 3;
    else if (totalUnits >= 2) cols = 2;

    const rows: LayoutUnit[][] = [];
    for (let i = 0; i < units.length; i += cols) {
      rows.push(units.slice(i, i + cols));
    }

    let currentY = ZONE_PAD_Y + ZONE_HEADER_HEIGHT;
    rows.forEach((row) => {
      const maxHeightInRow = Math.max(...row.map((u) => u.height));
      let currentX = ZONE_PAD_X;
      row.forEach((u) => {
        u.relX = currentX;
        u.relY = currentY;
        currentX += u.width + NODE_GAP_X;
      });
      currentY += maxHeightInRow + NODE_GAP_Y;
    });

    let maxRowW = 0;
    rows.forEach((row) => {
      const rowW = row.reduce((sum, u) => sum + u.width, 0) + (row.length - 1) * NODE_GAP_X;
      if (rowW > maxRowW) maxRowW = rowW;
    });

    const zoneW = Math.max(380, maxRowW + ZONE_PAD_X * 2);
    const zoneH = Math.max(260, currentY + ZONE_PAD_Y - NODE_GAP_Y);

    plannedZones.push({
      zoneId: zId,
      width: zoneW,
      height: zoneH,
      units
    });
  });

  const zoneAngles = getQuadrantAngles(plannedZones.length);
  const placedZoneRects: Rect[] = [coreBoundingRect];

  plannedZones.forEach((pz, idx) => {
    const angle = zoneAngles[idx];
    const halfZW = pz.width / 2;
    const halfZH = pz.height / 2;

    let radius = Math.max(
      650,
      Math.sqrt(halfZW * halfZW + halfZH * halfZH) + Math.max(coreBoundingRect.width, coreBoundingRect.height) / 2 + 100
    );

    let zoneX = Math.round(CENTER_X + radius * Math.cos(angle) - halfZW);
    let zoneY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfZH);

    let candidateRect: Rect = { x: zoneX, y: zoneY, width: pz.width, height: pz.height };
    let attempts = 0;
    while (attempts < 60) {
      const overlaps = placedZoneRects.some((other) => rectsOverlap(candidateRect, other, 80));
      if (!overlaps) break;
      radius += 80;
      zoneX = Math.round(CENTER_X + radius * Math.cos(angle) - halfZW);
      zoneY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfZH);
      candidateRect = { x: zoneX, y: zoneY, width: pz.width, height: pz.height };
      attempts++;
    }

    placedZoneRects.push(candidateRect);

    pz.units.forEach((u) => {
      const unitAbsX = zoneX + (u.relX || 0);
      const unitAbsY = zoneY + (u.relY || 0);
      applyUnitPositions(u, unitAbsX, unitAbsY);
    });
  });

  return devices;
}

function saveDevicesToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde devices.json:', err);
  }
}

function saveZonesToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ZONES_FILE, JSON.stringify(zones, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde zones.json:', err);
  }
}

function loadZonesFromFile() {
  try {
    if (fs.existsSync(ZONES_FILE)) {
      const content = fs.readFileSync(ZONES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        zones = parsed;
        console.log(`[InkaNetopology] ${zones.length} zones géographiques chargées depuis ${ZONES_FILE}`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture zones.json:', err);
  }
  // Default to empty initial zones
  zones = [];
  saveZonesToFile();
}

function loadDevicesFromFile() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const content = fs.readFileSync(DEVICES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Backfill merged aliases for any devices previously merged so future scans never recreate duplicates
        const normalized = parsed.map((d: Device) => {
          const isMergedMeta = Boolean(
            d.isManuallyMerged ||
            d.metadata?.['Statut fusion'] ||
            d.metadata?.['Adresse IP secondaire'] ||
            d.metadata?.['Adresses IP associées']
          );
          if (!isMergedMeta) return d;
          const aliases = collectMergedAliases(d, d);
          return {
            ...d,
            isManuallyMerged: d.isManuallyMerged || Boolean(d.metadata?.['Statut fusion']?.includes('manuellement')),
            ...aliases
          };
        });
        const mergeRes = mergeDuplicateContainers(normalized);
        if (mergeRes.mergedCount > 0) {
          devices = mergeRes.devices;
          console.log(`[InkaNetopology] ${mergeRes.mergedCount} conteneur(s) doublons fusionnés au chargement.`);
          saveDevicesToFile();
        } else {
          devices = normalized;
        }
        console.log(`[InkaNetopology] ${devices.length} équipements chargés depuis ${DEVICES_FILE}`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture devices.json:', err);
  }
  // Default to empty initial topology
  devices = [];
  saveDevicesToFile();
}

function saveTypesToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TYPES_FILE, JSON.stringify(deviceTypes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde device-types.json:', err);
  }
}

function loadTypesFromFile() {
  try {
    if (fs.existsSync(TYPES_FILE)) {
      const content = fs.readFileSync(TYPES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Map of all types by id
        const typeMap = new Map<string, DeviceTypeDefinition>();
        // 1. Ensure default built-in types exist
        defaultDeviceTypes.forEach((t) => typeMap.set(t.id, { ...t }));
        // 2. Merge parsed types from file (preserving any edits or new custom types)
        parsed.forEach((t) => {
          if (t && t.id) {
            const existingBuiltin = typeMap.get(t.id);
            if (existingBuiltin) {
              typeMap.set(t.id, { ...existingBuiltin, ...t, isBuiltin: true });
            } else {
              typeMap.set(t.id, t);
            }
          }
        });
        deviceTypes = Array.from(typeMap.values());
        saveTypesToFile();
        console.log(`[InkaNetopology] ${deviceTypes.length} types d'équipements chargés depuis ${TYPES_FILE} (4 types par défaut garantis + personnalisés)`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture device-types.json:', err);
  }
  deviceTypes = [...defaultDeviceTypes];
  saveTypesToFile();
}

function saveSubTypesToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBTYPES_FILE, JSON.stringify(deviceSubTypes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde device-subtypes.json:', err);
  }
}

function loadSubTypesFromFile() {
  try {
    if (fs.existsSync(SUBTYPES_FILE)) {
      const content = fs.readFileSync(SUBTYPES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const subMap = new Map<string, DeviceSubTypeDefinition>();
        defaultDeviceSubTypes.forEach((st) => subMap.set(st.id, { ...st }));
        parsed.forEach((st) => {
          if (st && st.id) {
            const existingBuiltin = subMap.get(st.id);
            if (existingBuiltin) {
              subMap.set(st.id, { ...existingBuiltin, ...st, isBuiltin: true });
            } else {
              subMap.set(st.id, st);
            }
          }
        });
        deviceSubTypes = Array.from(subMap.values());
        saveSubTypesToFile();
        console.log(`[InkaNetopology] ${deviceSubTypes.length} sous-types/rôles chargés depuis ${SUBTYPES_FILE} (rôles par défaut garantis + personnalisés)`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture device-subtypes.json:', err);
  }
  deviceSubTypes = [...defaultDeviceSubTypes];
  saveSubTypesToFile();
}

function saveSettingsToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erreur sauvegarde settings.json:', err);
  }
}

function loadSettingsFromFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        appSettings = { ...defaultSettings, ...parsed };
        console.log(`[InkaNetopology] Paramètres système chargés depuis ${SETTINGS_FILE}`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture settings.json:', err);
  }
  appSettings = { ...defaultSettings };
  saveSettingsToFile();
}

// Initial load for types, sub-types, zones, devices and settings
loadTypesFromFile();
loadSubTypesFromFile();
loadZonesFromFile();
loadDevicesFromFile();
loadSettingsFromFile();

// Global scan cancellation flag
let isScanCancelled = false;

// Diagnostic logs
let logs: NetworkLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    level: 'INFO',
    category: 'SYSTEM',
    message: 'Moteur InkaNetopology initialisé avec persistance de données active.'
  }
];

let scanStatus: ScanStatus = {
  isScanning: false,
  progressPercent: 0,
  devicesFound: devices.length,
  subnet: '192.168.1.0/24',
  scanMode: 'fast'
};

// SSE subscribers for live streaming logs & scan events
const sseClients: express.Response[] = [];

function broadcastSse(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

function addLog(log: Omit<NetworkLog, 'id' | 'timestamp'>) {
  const newLog: NetworkLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...log
  };
  logs.unshift(newLog);
  if (logs.length > 500) {
    logs = logs.slice(0, 500);
  }
  broadcastSse('new_log', newLog);
  return newLog;
}

// ---------------- MAC OUI DATABASE ----------------
const OUI_TABLE: Record<string, string> = {
  // Ubiquiti
  'e0:63:da': 'Ubiquiti Networks',
  '78:8a:20': 'Ubiquiti Networks',
  '24:a4:3c': 'Ubiquiti Networks',
  'b4:fb:e4': 'Ubiquiti Networks',
  'dc:9f:db': 'Ubiquiti Networks',
  '00:15:6d': 'Ubiquiti Networks',
  '00:27:22': 'Ubiquiti Networks',
  '44:d9:e7': 'Ubiquiti Networks',
  '68:d7:9a': 'Ubiquiti Networks',
  '70:a7:41': 'Ubiquiti Networks',
  '74:83:c2': 'Ubiquiti Networks',
  '80:2a:a8': 'Ubiquiti Networks',
  'f0:9f:c2': 'Ubiquiti Networks',
  // Synology / QNAP
  '00:11:32': 'Synology Inc.',
  '00:08:9b': 'QNAP Systems',
  '24:5e:be': 'QNAP Systems',
  // Raspberry Pi
  'b8:27:eb': 'Raspberry Pi Foundation',
  'dc:a6:32': 'Raspberry Pi Trading',
  'e4:5f:01': 'Raspberry Pi Trading',
  '28:cd:c1': 'Raspberry Pi Trading',
  'd8:3a:dd': 'Raspberry Pi Ltd',
  // Espressif / IoT (ESP8266, ESP32, Shelly, Sonoff)
  '30:ae:a4': 'Espressif Systems (ESP32)',
  '24:0a:c4': 'Espressif Systems',
  '24:6f:28': 'Espressif Systems',
  '2c:3a:e8': 'Espressif Systems',
  '3c:61:05': 'Espressif Systems',
  '3c:71:bf': 'Espressif Systems',
  '4c:75:25': 'Espressif Systems',
  '54:43:b2': 'Espressif Systems',
  '5c:cf:7f': 'Espressif Systems',
  '60:01:94': 'Espressif Systems',
  '68:c6:3a': 'Espressif Systems',
  '7c:df:a1': 'Espressif Systems',
  '84:0d:8e': 'Espressif Systems',
  '84:f3:eb': 'Espressif Systems',
  'a4:cf:12': 'Espressif Systems',
  'a4:e5:7c': 'Espressif Systems',
  'ac:67:b2': 'Espressif Systems',
  'b4:e6:2d': 'Espressif Systems',
  'bc:dd:c2': 'Espressif Systems',
  'c4:4f:33': 'Espressif Systems',
  'cc:50:e3': 'Espressif Systems',
  'd8:bc:38': 'Espressif Systems',
  'dc:4f:22': 'Espressif Systems',
  'e0:98:06': 'Espressif Systems',
  'e8:68:e7': 'Espressif Systems',
  'ec:fa:bc': 'Espressif Systems',
  // Shelly (Allterco)
  'bc:02:6e': 'Allterco Robotics (Shelly)',
  '40:f5:20': 'Allterco Robotics (Shelly)',
  '48:55:19': 'Allterco Robotics (Shelly)',
  '34:94:54': 'Allterco Robotics (Shelly)',
  // Philips Hue
  '00:17:88': 'Signify / Philips Lighting',
  'ec:b5:fa': 'Signify / Philips Lighting',
  // Caméras IP (Hikvision, Reolink, Dahua)
  '44:19:b6': 'Hikvision Digital Tech',
  'bc:ad:28': 'Hikvision Digital Tech',
  'c4:2f:90': 'Hikvision Digital Tech',
  'ec:71:db': 'Reolink Digital',
  '00:e0:4c': 'Reolink Digital',
  '38:af:29': 'Dahua Technology',
  '48:ea:63': 'Dahua Technology',
  '90:02:a9': 'Dahua Technology',
  // Serveurs Dell / HP / Intel
  '18:66:da': 'Dell Inc. (PowerEdge)',
  '24:4b:fe': 'Dell Inc.',
  '00:14:22': 'Dell Inc.',
  '4c:d9:8f': 'Dell Inc.',
  '74:86:7a': 'Dell Inc.',
  'bc:30:5b': 'Dell Inc.',
  'f8:db:88': 'Dell Inc.',
  'd8:9e:f3': 'HP Inc.',
  '00:08:02': 'HP Inc.',
  '3c:4a:92': 'HP Inc.',
  '70:5a:0f': 'HP Inc.',
  '00:1b:21': 'Intel Corporation',
  '00:1e:67': 'Intel Corporation',
  '08:00:27': 'Intel / PCS Systemtechnic',
  // Virtualisation
  '52:54:00': 'QEMU / KVM Virtual NIC',
  'bc:24:11': 'QEMU / Proxmox Virtual NIC',
  '00:05:69': 'VMware Inc.',
  '00:0c:29': 'VMware Inc.',
  '00:50:56': 'VMware Inc.',
  '02:42:ac': 'Docker Virtual Bridge',
  // Réseau (TP-Link, Netgear, Cisco, Mikrotik, Asus)
  '50:c7:bf': 'TP-Link Corporation',
  '60:32:b1': 'TP-Link Corporation',
  '98:48:27': 'TP-Link Corporation',
  'a0:f3:c1': 'TP-Link Corporation',
  'ac:84:c6': 'TP-Link Corporation',
  'c0:06:c3': 'TP-Link Corporation',
  'ec:08:6b': 'TP-Link Corporation',
  'ac:12:03': 'TP-Link Corporation',
  '00:14:6c': 'Netgear Inc.',
  '20:4e:7f': 'Netgear Inc.',
  '44:94:fc': 'Netgear Inc.',
  '84:1b:5e': 'Netgear Inc.',
  '9c:3d:cf': 'Netgear Inc.',
  '00:0c:42': 'MikroTik',
  '48:8f:5a': 'MikroTik',
  '64:d1:54': 'MikroTik',
  'b8:69:f4': 'MikroTik',
  'cc:2d:e0': 'MikroTik',
  '00:00:0c': 'Cisco Systems',
  '00:01:42': 'Cisco Systems',
  '04:92:26': 'ASUSTek Computer',
  '08:60:6e': 'ASUSTek Computer',
  // Apple
  'f4:4d:30': 'Apple Inc.',
  '90:9a:4a': 'Apple Inc.',
  'ac:de:48': 'Apple Inc.',
  '14:10:9f': 'Apple Inc.',
  '3c:07:54': 'Apple Inc.',
  '3c:15:c2': 'Apple Inc.',
  '70:ef:00': 'Apple Inc.',
  'b8:78:26': 'Apple Inc.',
  // Domotique Aqara / Tuya
  '54:ef:44': 'Lumi United Tech (Aqara)',
  '10:5a:f7': 'Tuya Smart Inc.',
  '18:69:d8': 'Tuya Smart Inc.',
  '68:57:2d': 'Tuya Smart Inc.',
  '7c:f6:66': 'Tuya Smart Inc.'
};

function lookupVendor(mac: string): string {
  if (!mac) return 'Fabricant Inconnu';
  const cleanMac = mac.toLowerCase().replace(/[:-]/g, ':');
  if (cleanMac.startsWith('02:42:')) return 'Docker Inc. (veth-bridge)';
  const prefix = cleanMac.split(':').slice(0, 3).join(':');
  if (OUI_TABLE[prefix]) return OUI_TABLE[prefix];
  return 'Équipement Réseau (Générique)';
}

// ---------------- LOCAL INTERFACES & ARP ----------------
function getNetworkInterfaces(): { interfaces: any[]; detectedSubnet: string } {
  const netInterfaces = os.networkInterfaces();
  const list: any[] = [];
  let detectedSubnet = '192.168.1.0/24';

  for (const [name, addrs] of Object.entries(netInterfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        list.push({
          name,
          address: addr.address,
          netmask: addr.netmask,
          mac: addr.mac,
          family: addr.family,
          cidr: addr.cidr || `${addr.address}/24`
        });
        const parts = addr.address.split('.');
        if (parts.length === 4) {
          detectedSubnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
      }
    }
  }

  return { interfaces: list, detectedSubnet };
}

// Read Linux ARP table (/proc/net/arp)
function readLinuxArpTable(): Array<{ ip: string; mac: string; device: string }> {
  try {
    if (fs.existsSync('/proc/net/arp')) {
      const data = fs.readFileSync('/proc/net/arp', 'utf-8');
      const lines = data.split('\n').slice(1);
      const entries: Array<{ ip: string; mac: string; device: string }> = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          const ip = parts[0];
          const mac = parts[3]?.toLowerCase();
          const dev = parts[5];
          if (mac && mac !== '00:00:00:00:00:00') {
            entries.push({ ip, mac, device: dev });
          }
        }
      }
      return entries;
    }
  } catch (err) {
    // Ignore procfs read error
  }
  return [];
}

// Read neighbors from 'ip neigh show' or 'arp -an'
async function readIpNeighbors(): Promise<Array<{ ip: string; mac: string; device: string }>> {
  const entries: Array<{ ip: string; mac: string; device: string }> = [];
  
  // Try 'ip neigh show'
  try {
    const { stdout } = await execPromise('ip neigh show', { timeout: 1500 });
    const lines = stdout.split('\n');
    for (const line of lines) {
      // 192.168.1.1 dev eth0 lladdr e0:63:da:8a:22:10 REACHABLE
      const match = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)\s+lladdr\s+([0-9a-fA-F:]+)/);
      if (match) {
        const ip = match[1];
        const dev = match[2];
        const mac = match[3].toLowerCase();
        if (mac !== '00:00:00:00:00:00') {
          entries.push({ ip, mac, device: dev });
        }
      }
    }
    if (entries.length > 0) return entries;
  } catch {
    // ignore
  }

  // Try 'arp -an'
  try {
    const { stdout } = await execPromise('arp -an', { timeout: 1500 });
    const lines = stdout.split('\n');
    for (const line of lines) {
      // ? (192.168.1.1) at e0:63:da:8a:22:10 [ether] on eth0
      const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:]+)\s+.*on\s+(\S+)/);
      if (match) {
        const ip = match[1];
        const mac = match[2].toLowerCase();
        const dev = match[3];
        if (mac !== '<incomplete>' && mac !== '00:00:00:00:00:00') {
          entries.push({ ip, mac, device: dev });
        }
      }
    }
  } catch {
    // ignore
  }

  return entries;
}

// Read running Docker containers from Docker Unix socket if mounted
function fetchDockerContainers(): Promise<any[]> {
  return new Promise((resolve) => {
    const socketPath = '/var/run/docker.sock';
    if (!fs.existsSync(socketPath)) {
      return resolve([]);
    }

    const req = http.request(
      {
        socketPath,
        path: '/containers/json',
        method: 'GET',
        headers: { Host: 'localhost' },
        timeout: 2000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const containers = JSON.parse(body);
            resolve(Array.isArray(containers) ? containers : []);
          } catch {
            resolve([]);
          }
        });
      }
    );

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

// Read running Docker containers from remote Docker TCP socket (e.g. port 2375/2376 on physical host or VM)
function fetchRemoteDockerContainers(ip: string, port = 2375): Promise<any[]> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: ip,
        port,
        path: '/containers/json',
        method: 'GET',
        headers: { Host: `${ip}:${port}` },
        timeout: 1200
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const containers = JSON.parse(body);
            resolve(Array.isArray(containers) ? containers : []);
          } catch {
            resolve([]);
          }
        });
      }
    );

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

// Probe TCP port connectivity with strict hard JS timer to guarantee abort on filtered ports
function probePort(ip: string, port: number, timeout = 180): Promise<{ open: boolean; rtt: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let isResolved = false;

    // Hard JavaScript timer to guarantee destruction even if kernel SYN hangs
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try {
          socket.destroy();
        } catch {}
        resolve({ open: false, rtt: timeout });
      }
    }, timeout);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const rtt = Math.max(1, Date.now() - start);
        try {
          socket.destroy();
        } catch {}
        resolve({ open: true, rtt });
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        try {
          socket.destroy();
        } catch {}
        resolve({ open: false, rtt: timeout });
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        try {
          socket.destroy();
        } catch {}
        resolve({ open: false, rtt: timeout });
      }
    });

    try {
      socket.connect(port, ip);
    } catch {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        resolve({ open: false, rtt: timeout });
      }
    }
  });
}

// Ping IP via OS binary if available
async function pingIp(ip: string): Promise<{ alive: boolean; rtt: number }> {
  const start = Date.now();
  try {
    await execFilePromise('ping', ['-c', '1', '-W', '1', ip], { timeout: 1000 });
    return { alive: true, rtt: Math.max(1, Date.now() - start) };
  } catch {
    return { alive: false, rtt: 0 };
  }
}

// ---------------- REGULAR NETWORK PRESENCE CHECK & INACTIVE INVENTORY PRUNING ----------------
let isCheckingPresence = false;

async function executePresenceCheck(manual = false): Promise<{ checkedCount: number; onlineCount: number; offlineCount: number }> {
  if (isCheckingPresence) {
    return { checkedCount: 0, onlineCount: 0, offlineCount: 0 };
  }
  isCheckingPresence = true;
  appSettings.lastPresenceCheckTime = new Date().toISOString();
  saveSettingsToFile();

  let onlineCount = 0;
  let offlineCount = 0;
  const now = new Date().toISOString();

  try {
    const ipDevices = devices.filter((d) => d.ip && d.ip.trim().length > 0);
    const BATCH_SIZE = 10;

    for (let i = 0; i < ipDevices.length; i += BATCH_SIZE) {
      const chunk = ipDevices.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (dev) => {
          let alive = false;
          let rtt = 1.0;

          // 1. Try ICMP ping
          const pingRes = await pingIp(dev.ip);
          if (pingRes.alive) {
            alive = true;
            rtt = pingRes.rtt;
          } else {
            // 2. Try port probe on openPorts or standard ports
            const portsToTry = dev.openPorts && dev.openPorts.length > 0 ? dev.openPorts.slice(0, 3) : [80, 443, 22];
            for (const port of portsToTry) {
              const probe = await probePort(dev.ip, port, 300);
              if (probe.open) {
                alive = true;
                rtt = probe.rtt;
                break;
              }
            }
          }

          // 3. For fused Docker containers or multi-IP merged equipment: probe secondary / merged IPs if primary did not respond
          if (!alive) {
            const extraIps = Array.from(
              new Set([
                ...(dev.metadata?.['IP Hôte'] ? [dev.metadata['IP Hôte']] : []),
                ...(dev.metadata?.['Adresse IP secondaire'] ? [dev.metadata['Adresse IP secondaire']] : []),
                ...(dev.mergedIps || [])
              ].filter((x) => x && x !== dev.ip && x !== '127.0.0.1'))
            );
            const portsToTry = dev.openPorts && dev.openPorts.length > 0 ? dev.openPorts.slice(0, 3) : [80, 443, 8080, 9000];
            for (const altIp of extraIps) {
              const altPing = await pingIp(altIp);
              if (altPing.alive) {
                alive = true;
                rtt = altPing.rtt;
                break;
              }
              for (const port of portsToTry) {
                const probe = await probePort(altIp, port, 300);
                if (probe.open) {
                  alive = true;
                  rtt = probe.rtt;
                  break;
                }
              }
              if (alive) break;
            }
          }

          if (alive) {
            dev.status = 'online';
            dev.lastSeen = now;
            dev.latencyMs = rtt;
            onlineCount++;
          } else {
            // Equipment is offline/unreachable: do not update lastSeen so inactivity accumulates
            dev.status = 'offline';
            offlineCount++;
          }
        })
      );
    }

    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
    broadcastSse('settings_updated', appSettings);

    addLog({
      level: 'INFO',
      category: 'SYSTEM',
      message: `Test de présence réseau ${manual ? 'manuel' : 'automatique'} : ${ipDevices.length} vérifié(s) (${onlineCount} actif(s), ${offlineCount} hors-ligne).`
    });
  } catch (err) {
    console.error('Erreur during presence check:', err);
  } finally {
    isCheckingPresence = false;
  }

  return { checkedCount: devices.length, onlineCount, offlineCount };
}

let isPruning = false;

function executeInventoryPrune(manual = false): { prunedCount: number; prunedDevices: string[] } {
  if (isPruning) return { prunedCount: 0, prunedDevices: [] };
  isPruning = true;
  appSettings.lastPruneTime = new Date().toISOString();
  saveSettingsToFile();

  const nowMs = Date.now();
  const maxAgeMs = appSettings.maxInactiveAgeHours * 60 * 60 * 1000;
  const prunedNames: string[] = [];
  const keptDevices: Device[] = [];

  for (const dev of devices) {
    // If protecting core devices (routers, central switches), skip pruning
    if (appSettings.protectCoreDevices && dev.isCore) {
      keptDevices.push(dev);
      continue;
    }

    // CRITICAL: Manually added equipment (e.g., Zigbee / Z-Wave sensors without IP)
    // cannot be pinged or scanned; they MUST be kept by default unless manually deleted by user!
    if (dev.isManualAdded || !dev.ip || dev.ip === 'sans IP' || dev.tags?.includes('Sans IP')) {
      keptDevices.push(dev);
      continue;
    }

    const lastSeenTime = dev.lastSeen ? new Date(dev.lastSeen).getTime() : 0;
    const isInactiveTooLong = (nowMs - lastSeenTime) > maxAgeMs;

    if (isInactiveTooLong) {
      prunedNames.push(`${dev.name} (${dev.ip || 'sans IP'})`);
    } else {
      keptDevices.push(dev);
    }
  }

  if (prunedNames.length > 0) {
    devices = keptDevices;
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
    broadcastSse('inventory_pruned', { count: prunedNames.length, names: prunedNames });

    addLog({
      level: 'WARN',
      category: 'SYSTEM',
      message: `Nettoyage d'inventaire ${manual ? 'manuel' : 'automatique'} : ${prunedNames.length} équipement(s) inactif(s) depuis plus de ${appSettings.maxInactiveAgeHours}h supprimé(s) (${prunedNames.slice(0, 5).join(', ')}${prunedNames.length > 5 ? '...' : ''}).`
    });
  }

  isPruning = false;
  return { prunedCount: prunedNames.length, prunedDevices: prunedNames };
}

// Background scheduler for periodic keepalive presence checks and auto-pruning
setInterval(() => {
  const now = Date.now();

  // 1. Periodic keepalive presence check
  if (appSettings.presenceCheckEnabled && appSettings.presenceCheckIntervalMinutes > 0 && devices.length > 0) {
    const lastCheck = appSettings.lastPresenceCheckTime ? new Date(appSettings.lastPresenceCheckTime).getTime() : 0;
    const intervalMs = appSettings.presenceCheckIntervalMinutes * 60 * 1000;
    if (now - lastCheck >= intervalMs) {
      executePresenceCheck(false).catch((err) => console.error('Erreur keepalive auto:', err));
    }
  }

  // 2. Periodic inventory cleanup (pruning)
  if (appSettings.autoPruneEnabled && appSettings.maxInactiveAgeHours > 0 && devices.length > 0) {
    const lastPrune = appSettings.lastPruneTime ? new Date(appSettings.lastPruneTime).getTime() : 0;
    // Check every 2 minutes
    const pruneCheckIntervalMs = 2 * 60 * 1000;
    if (now - lastPrune >= pruneCheckIntervalMs) {
      executeInventoryPrune(false);
    }
  }
}, 10000);

// Fetch HTTP web title (if port 80/443/8080/8006/5000 is open) with strict timeout
function fetchWebTitle(ip: string, port: number, timeoutMs = 300): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let req: any = null;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          if (req) req.destroy();
        } catch {}
        resolve(null);
      }
    }, timeoutMs);

    try {
      const isHttps = port === 443 || port === 8443;
      const client = isHttps ? https : http;

      req = client.request(
        {
          host: ip,
          port,
          path: '/',
          method: 'GET',
          headers: { 'User-Agent': 'InkaNetopology/1.0' },
          rejectUnauthorized: false,
          timeout: timeoutMs
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => {
            data += chunk;
            if (data.length > 2000) {
              try {
                if (req) req.destroy();
              } catch {}
            }
          });
          res.on('end', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (titleMatch && titleMatch[1]) {
                resolve(titleMatch[1].trim().slice(0, 50));
              } else if (res.headers.server) {
                const s = res.headers.server;
                resolve(Array.isArray(s) ? s[0].slice(0, 40) : s.slice(0, 40));
              } else {
                resolve(null);
              }
            }
          });
        }
      );

      req.on('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      });

      req.on('timeout', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            if (req) req.destroy();
          } catch {}
          resolve(null);
        }
      });

      req.end();
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

// Reverse DNS lookup with strict 350ms timeout to prevent LAN hangs
function reverseDns(ip: string, timeoutMs = 350): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    dns.reverse(ip, (err, hostnames) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (!err && hostnames && hostnames.length > 0) {
          resolve(hostnames[0]);
        } else {
          resolve(null);
        }
      }
    });
  });
}

// Classify device according to vendor, ports, hostname, titles
function classifyDevice(
  ip: string,
  mac: string,
  vendor: string,
  openPorts: number[],
  hostname?: string | null,
  webTitle?: string | null
): {
  deviceType: DeviceType;
  subType: DeviceSubType;
  name: string;
  os?: string;
  tags: string[];
} {
  const vLower = vendor.toLowerCase();
  const hLower = (hostname || '').toLowerCase();
  const tLower = (webTitle || '').toLowerCase();
  const tags: string[] = ['Auto-découvert', 'LAN'];

  // Check for Docker container
  if (mac.startsWith('02:42:') || mac.startsWith('02:42')) {
    return {
      deviceType: 'docker',
      subType: 'container',
      name: hostname || `Conteneur Docker (${ip})`,
      os: 'Linux (Docker Bridge)',
      tags: [...tags, 'Docker', 'Conteneur']
    };
  }

  // Check for Proxmox / QEMU / KVM / VMware VM
  if (
    vLower.includes('qemu') ||
    vLower.includes('vmware') ||
    mac.startsWith('52:54:00') ||
    mac.startsWith('bc:24:11') ||
    mac.startsWith('00:0c:29')
  ) {
    return {
      deviceType: 'vm',
      subType: 'vm',
      name: webTitle ? `VM - ${webTitle}` : hostname ? `VM - ${hostname}` : `Machine Virtuelle (${ip})`,
      os: openPorts.includes(3389) ? 'Windows VM' : 'Linux VM',
      tags: [...tags, 'VM', 'Virtualisation']
    };
  }

  // Proxmox Host
  if (openPorts.includes(8006) || tLower.includes('proxmox') || hLower.includes('pve')) {
    return {
      deviceType: 'physical',
      subType: 'server',
      name: `Serveur Proxmox VE (${ip})`,
      os: 'Proxmox VE (Debian 12)',
      tags: [...tags, 'Hyperviseur', 'Proxmox', 'Serveur']
    };
  }

  // NAS (Synology, QNAP, TrueNAS, OMV)
  if (
    vLower.includes('synology') ||
    vLower.includes('qnap') ||
    openPorts.includes(5000) ||
    openPorts.includes(5001) ||
    tLower.includes('synology') ||
    tLower.includes('diskstation') ||
    tLower.includes('openmediavault') ||
    tLower.includes('truenas')
  ) {
    return {
      deviceType: 'physical',
      subType: 'nas',
      name: webTitle || (vLower.includes('synology') ? `NAS Synology (${ip})` : `NAS Stockage (${ip})`),
      os: tLower.includes('openmediavault') ? 'OpenMediaVault (Linux)' : vLower.includes('synology') ? 'Synology DSM' : 'Stockage NAS',
      tags: [...tags, 'NAS', 'Stockage', 'SMB/NFS']
    };
  }

  // Routers & Gateways
  const isDefaultGatewayIp = ip.endsWith('.1') || ip.endsWith('.254');
  if (
    vLower.includes('ubiquiti') ||
    vLower.includes('mikrotik') ||
    vLower.includes('cisco') ||
    vLower.includes('netgear') ||
    tLower.includes('unifi') ||
    tLower.includes('openwrt') ||
    tLower.includes('pfsense') ||
    tLower.includes('opnsense') ||
    (isDefaultGatewayIp && (openPorts.includes(53) || openPorts.includes(80) || openPorts.includes(443)))
  ) {
    const isSwitch = vLower.includes('edgeswitch') || tLower.includes('switch');
    return {
      deviceType: 'physical',
      subType: isSwitch ? 'switch' : 'router',
      name: webTitle || (isDefaultGatewayIp ? `Passerelle / Routeur (${ip})` : `${vendor} (${ip})`),
      os: tLower.includes('unifi') ? 'UniFi OS' : tLower.includes('openwrt') ? 'OpenWrt' : 'Système Réseau',
      tags: [...tags, isSwitch ? 'Switch' : 'Passerelle', 'Réseau']
    };
  }

  // IP Cameras (RTSP 554, ONVIF, Hikvision, Reolink, Dahua)
  if (
    openPorts.includes(554) ||
    vLower.includes('hikvision') ||
    vLower.includes('reolink') ||
    vLower.includes('dahua') ||
    tLower.includes('camera') ||
    tLower.includes('ipcam') ||
    tLower.includes('nvr')
  ) {
    return {
      deviceType: 'iot',
      subType: 'camera',
      name: webTitle || (vLower.includes('reolink') ? `Caméra Reolink (${ip})` : vLower.includes('hikvision') ? `Caméra Hikvision (${ip})` : `Caméra Surveillance IP (${ip})`),
      os: 'Firmware Caméra IP (RTSP/ONVIF)',
      tags: [...tags, 'IoT', 'Caméra', 'Vidéo']
    };
  }

  // Home Automation / IoT Sensors / Shelly / ESP32 / Hue
  if (
    vLower.includes('espressif') ||
    vLower.includes('shelly') ||
    vLower.includes('signify') ||
    vLower.includes('philips') ||
    vLower.includes('tuya') ||
    vLower.includes('aqara') ||
    openPorts.includes(6053) || // ESPHome
    openPorts.includes(1883) || // MQTT
    openPorts.includes(8123)    // Home Assistant
  ) {
    let sub: DeviceSubType = 'other';
    let name = `${vendor} (${ip})`;

    if (openPorts.includes(8123) || tLower.includes('home assistant')) {
      return {
        deviceType: 'physical',
        subType: 'server',
        name: 'Home Assistant Hub',
        os: 'Home Assistant OS',
        tags: [...tags, 'Domotique', 'Home Assistant', 'Serveur']
      };
    }

    if (vLower.includes('shelly') || tLower.includes('shelly')) {
      sub = 'smart_plug';
      name = `Module Shelly (${ip})`;
    } else if (vLower.includes('espressif') || openPorts.includes(6053)) {
      sub = 'sensor_temp';
      name = `Sonde ESP32 / ESPHome (${ip})`;
    } else if (vLower.includes('aqara')) {
      sub = 'sensor_presence';
      name = `Capteur Aqara (${ip})`;
    } else if (vLower.includes('signify') || vLower.includes('hue')) {
      name = `Pont Philips Hue (${ip})`;
    }

    return {
      deviceType: 'iot',
      subType: sub,
      name: webTitle || name,
      os: 'Firmware IoT / Domotique',
      tags: [...tags, 'IoT', 'Domotique']
    };
  }

  // Workstations & PCs
  if (openPorts.includes(3389) || openPorts.includes(135) || openPorts.includes(445)) {
    return {
      deviceType: 'physical',
      subType: 'workstation',
      name: hostname ? `PC - ${hostname}` : `Poste Windows (${ip})`,
      os: 'Windows 10/11 / Windows Server',
      tags: [...tags, 'Workstation', 'SMB', 'Bureau']
    };
  }

  // Printers
  if (openPorts.includes(515) || openPorts.includes(631) || openPorts.includes(9100) || hLower.includes('print')) {
    return {
      deviceType: 'physical',
      subType: 'printer',
      name: hostname ? `Imprimante - ${hostname}` : `Imprimante Réseau (${ip})`,
      os: 'Firmware Impression (IPP/RAW)',
      tags: [...tags, 'Imprimante', 'Périphérique']
    };
  }

  // Generic fallback
  return {
    deviceType: 'physical',
    subType: 'other',
    name: webTitle || (hostname ? `${hostname} (${ip})` : `${vendor} (${ip})`),
    os: openPorts.includes(22) ? 'Linux / Unix (SSH)' : openPorts.includes(80) ? 'Serveur Web (HTTP)' : 'Système Réseau Détecté',
    tags: [...tags, 'Découvert']
  };
}

// ---------------- OFFICIAL SERVICE & CONTAINER ICON RESOLVER ----------------
// Resolves official vector brand icons from walkxcode/dashboard-icons CDN (GitHub)
function resolveServiceIcon(device: Partial<Device>): string | undefined {
  const cdnSvg = (slug: string) => `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/${slug}.svg`;

  const name = (device.name || '').toLowerCase();
  const title = ((device.metadata?.['Titre Web'] || '') + ' ' + (device.metadata?.['Image'] || '')).toLowerCase();
  const hostname = (device.metadata?.['Nom d\'hôte'] || '').toLowerCase();
  const os = (device.os || '').toLowerCase();
  const subType = (device.subType || '').toLowerCase();
  const ports = device.openPorts || [];

  const haystack = `${name} ${title} ${hostname} ${os} ${device.location || ''} ${Object.values(device.metadata || {}).join(' ')}`.toLowerCase();

  // 1. Home Assistant
  if (/home\s*assistant|hassio|hass\b/i.test(haystack) || ports.includes(8123)) {
    return cdnSvg('home-assistant');
  }

  // 2. Portainer
  if (/portainer/i.test(haystack) || ports.includes(9000) || ports.includes(9443)) {
    return cdnSvg('portainer');
  }

  // 3. Proxmox VE
  if (/proxmox|pve/i.test(haystack) || ports.includes(8006)) {
    return cdnSvg('proxmox');
  }

  // 4. TrueNAS / FreeNAS
  if (/truenas|freenas/i.test(haystack)) {
    return cdnSvg('truenas');
  }

  // 5. Synology DSM
  if (/synology|dsm|diskstation/i.test(haystack) || ports.includes(5000) || ports.includes(5001)) {
    return cdnSvg('synology');
  }

  // 6. QNAP
  if (/qnap|qts/i.test(haystack) || (ports.includes(8080) && /qnap/i.test(haystack))) {
    return cdnSvg('qnap');
  }

  // 7. Pi-hole
  if (/pi[\s-]*hole/i.test(haystack)) {
    return cdnSvg('pi-hole');
  }

  // 8. AdGuard Home
  if (/adguard/i.test(haystack) || (ports.includes(3000) && /adguard/i.test(haystack))) {
    return cdnSvg('adguard-home');
  }

  // 9. Plex
  if (/plex/i.test(haystack) || ports.includes(32400)) {
    return cdnSvg('plex');
  }

  // 10. Jellyfin
  if (/jellyfin/i.test(haystack) || ports.includes(8096)) {
    return cdnSvg('jellyfin');
  }

  // 11. Emby
  if (/emby/i.test(haystack) || (ports.includes(8096) && /emby/i.test(haystack))) {
    return cdnSvg('emby');
  }

  // 12. Nextcloud
  if (/nextcloud/i.test(haystack)) {
    return cdnSvg('nextcloud');
  }

  // 13. Nginx Proxy Manager
  if (/nginx[\s-]*proxy[\s-]*manager|npm\b/i.test(haystack) || (ports.includes(81) && /nginx/i.test(haystack))) {
    return cdnSvg('nginx-proxy-manager');
  }

  // 14. Traefik
  if (/traefik/i.test(haystack) || (ports.includes(8080) && /traefik/i.test(haystack))) {
    return cdnSvg('traefik');
  }

  // 15. Grafana
  if (/grafana/i.test(haystack) || (ports.includes(3000) && /grafana/i.test(haystack))) {
    return cdnSvg('grafana');
  }

  // 16. Prometheus
  if (/prometheus/i.test(haystack) || ports.includes(9090)) {
    return cdnSvg('prometheus');
  }

  // 17. Uptime Kuma
  if (/uptime[\s-]*kuma/i.test(haystack) || ports.includes(3001)) {
    return cdnSvg('uptime-kuma');
  }

  // 18. Vaultwarden / Bitwarden
  if (/vaultwarden|bitwarden/i.test(haystack)) {
    return cdnSvg('vaultwarden');
  }

  // 19. Node-RED
  if (/node[\s-]*red/i.test(haystack) || ports.includes(1880)) {
    return cdnSvg('node-red');
  }

  // 20. Mosquitto MQTT
  if (/mosquitto|mqtt/i.test(haystack) || ports.includes(1883)) {
    return cdnSvg('mosquitto');
  }

  // 21. PostgreSQL
  if (/postgres|pgsql/i.test(haystack) || ports.includes(5432)) {
    return cdnSvg('postgres');
  }

  // 22. MySQL / MariaDB
  if (/mariadb/i.test(haystack)) return cdnSvg('mariadb');
  if (/mysql/i.test(haystack) || ports.includes(3306)) return cdnSvg('mysql');

  // 23. Redis
  if (/redis/i.test(haystack) || ports.includes(6379)) {
    return cdnSvg('redis');
  }

  // 24. UniFi
  if (/unifi/i.test(haystack) || (ports.includes(8443) && /unifi/i.test(haystack))) {
    return cdnSvg('unifi');
  }

  // 25. WireGuard
  if (/wireguard/i.test(haystack) || ports.includes(51820)) {
    return cdnSvg('wireguard');
  }

  // 26. pfSense
  if (/pfsense/i.test(haystack)) {
    return cdnSvg('pfsense');
  }

  // 27. qBittorrent
  if (/qbittorrent|qbit/i.test(haystack)) {
    return cdnSvg('qbittorrent');
  }

  // 28. Paperless
  if (/paperless/i.test(haystack)) {
    return cdnSvg('paperless-ngx');
  }

  // 29. Immich
  if (/immich/i.test(haystack) || ports.includes(2283)) {
    return cdnSvg('immich');
  }

  // 30. Frigate
  if (/frigate/i.test(haystack)) {
    return cdnSvg('frigate');
  }

  // 31. Generic Docker
  if (device.deviceType === 'docker' || subType === 'container') {
    return cdnSvg('docker');
  }

  return undefined;
}

// ---------------- API ROUTES ----------------

// Get interfaces
app.get('/api/interfaces', (req, res) => {
  const data = getNetworkInterfaces();
  const arpEntries = readLinuxArpTable();
  res.json({
    interfaces: data.interfaces,
    defaultSubnet: data.detectedSubnet,
    arpTableSize: arpEntries.length,
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime()
  });
});

// ---------------- DEVICE TYPES & SUBTYPES API ROUTES ----------------
// Get all device types and sub-types / roles
app.get('/api/types', (req, res) => {
  res.json({
    types: deviceTypes,
    subTypes: deviceSubTypes
  });
});

// Create new device type
app.post('/api/types', (req, res) => {
  const { id, name, color, icon, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du type est requis.' });
  }

  const rawId = (id || name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const typeId = rawId.startsWith('type-') ? rawId : `type-${rawId}-${Date.now().toString(36).slice(-4)}`;

  // Check unique ID
  const existing = deviceTypes.find((t) => t.id === typeId || t.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Un type nommé "${name}" existe déjà.` });
  }

  const newType: DeviceTypeDefinition = {
    id: typeId,
    name: name.trim(),
    color: color || '#3b82f6',
    icon: icon || 'Server',
    description: description || '',
    isBuiltin: false
  };

  deviceTypes.push(newType);
  saveTypesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Nouveau type d'équipement créé: "${newType.name}" (${newType.id})`
  });

  broadcastSse('type_added', newType);
  res.status(201).json(newType);
});

// Update device type
app.put('/api/types/:id', (req, res) => {
  const { id } = req.params;
  const index = deviceTypes.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Type d\'équipement non trouvé.' });
  }

  const prev = deviceTypes[index];
  const updated: DeviceTypeDefinition = {
    ...prev,
    ...req.body,
    id, // protect id
    isBuiltin: prev.isBuiltin // protect builtin status
  };

  deviceTypes[index] = updated;
  saveTypesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Type d'équipement mis à jour: "${updated.name}"`
  });

  broadcastSse('type_updated', updated);
  res.json(updated);
});

// Delete device type
app.delete('/api/types/:id', (req, res) => {
  const { id } = req.params;
  const index = deviceTypes.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Type d\'équipement non trouvé.' });
  }

  const removed = deviceTypes[index];
  deviceTypes = deviceTypes.filter((t) => t.id !== id);
  saveTypesToFile();

  // If any devices had this type, fallback to 'physical' or first available type
  const fallbackType = deviceTypes[0]?.id || 'physical';
  let devUpdated = false;
  devices.forEach((d) => {
    if (d.deviceType === id) {
      d.deviceType = fallbackType;
      devUpdated = true;
    }
  });

  if (devUpdated) {
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
  }

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Type d'équipement supprimé: "${removed.name}"`
  });

  broadcastSse('type_deleted', { id });
  res.json({ success: true, id });
});

// Get all sub-types / roles
app.get('/api/subtypes', (req, res) => {
  res.json(deviceSubTypes);
});

// Create new sub-type / role (can be linked to a particular equipment)
app.post('/api/subtypes', (req, res) => {
  const { id, name, typeId, role, icon, description, deviceId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du sous-type / rôle est requis.' });
  }

  const rawId = (id || name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const subTypeId = rawId.startsWith('sub-') ? rawId : `sub-${rawId}-${Date.now().toString(36).slice(-4)}`;

  const newSubType: DeviceSubTypeDefinition = {
    id: subTypeId,
    name: name.trim(),
    typeId: typeId || 'all',
    role: role || name.trim(),
    icon: icon || 'Cpu',
    description: description || '',
    deviceId: deviceId || undefined,
    isBuiltin: false
  };

  deviceSubTypes.push(newSubType);
  saveSubTypesToFile();

  // If linked to a specific device, optionally update device role
  if (deviceId) {
    const targetDev = devices.find((d) => d.id === deviceId);
    if (targetDev) {
      targetDev.subType = newSubType.id;
      if (newSubType.role) targetDev.role = newSubType.role;
      saveDevicesToFile();
      broadcastSse('device_updated', targetDev);
    }
  }

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Nouveau sous-type / rôle créé: "${newSubType.name}"${deviceId ? ' (Lié à un équipement spécifique)' : ''}`
  });

  broadcastSse('subtype_added', newSubType);
  res.status(201).json(newSubType);
});

// Update sub-type / role
app.put('/api/subtypes/:id', (req, res) => {
  const { id } = req.params;
  const index = deviceSubTypes.findIndex((st) => st.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sous-type / rôle non trouvé.' });
  }

  const prev = deviceSubTypes[index];
  const updated: DeviceSubTypeDefinition = {
    ...prev,
    ...req.body,
    id, // protect id
    isBuiltin: prev.isBuiltin
  };

  deviceSubTypes[index] = updated;
  saveSubTypesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Sous-type / rôle mis à jour: "${updated.name}"`
  });

  broadcastSse('subtype_updated', updated);
  res.json(updated);
});

// Delete sub-type / role
app.delete('/api/subtypes/:id', (req, res) => {
  const { id } = req.params;
  const index = deviceSubTypes.findIndex((st) => st.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sous-type / rôle non trouvé.' });
  }

  const removed = deviceSubTypes[index];
  deviceSubTypes = deviceSubTypes.filter((st) => st.id !== id);
  saveSubTypesToFile();

  // If any devices had this subType, fallback to 'other'
  let devUpdated = false;
  devices.forEach((d) => {
    if (d.subType === id) {
      d.subType = 'other';
      devUpdated = true;
    }
  });

  if (devUpdated) {
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
  }

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Sous-type / rôle supprimé: "${removed.name}"`
  });

  broadcastSse('subtype_deleted', { id });
  res.json({ success: true, id });
});

// ---------------- GEOGRAPHIC ZONES API ROUTES ----------------
// Get all zones
app.get('/api/zones', (req, res) => {
  res.json(zones);
});

// Create a new zone
app.post('/api/zones', (req, res) => {
  const { name, type, description, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom de la zone est requis.' });
  }

  const newZone: GeographicZone = {
    id: req.body.id || `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    type: type || 'piece',
    description: description || '',
    color: color || '#0ea5e9'
  };

  zones.push(newZone);
  saveZonesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Nouvelle zone géographique créée: "${newZone.name}" (${newZone.type})`
  });

  broadcastSse('zone_added', newZone);
  res.status(201).json(newZone);
});

// Update / Rename a zone
app.put('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  const index = zones.findIndex((z) => z.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Zone géographique non trouvée.' });
  }

  const prev = zones[index];
  const updated: GeographicZone = {
    ...prev,
    ...req.body,
    id // keep id
  };

  zones[index] = updated;
  saveZonesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Zone géographique mise à jour: "${updated.name}" (${updated.type})`
  });

  broadcastSse('zone_updated', updated);
  res.json(updated);
});

// Delete a zone
app.delete('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  const index = zones.findIndex((z) => z.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Zone géographique non trouvée.' });
  }

  const removed = zones[index];
  zones = zones.filter((z) => z.id !== id);
  saveZonesToFile();

  // Clear zoneId from assigned devices
  let deviceUpdated = false;
  devices.forEach((d) => {
    if (d.zoneId === id) {
      delete d.zoneId;
      deviceUpdated = true;
    }
  });

  if (deviceUpdated) {
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
  }

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Zone géographique supprimée: "${removed.name}"`
  });

  broadcastSse('zone_deleted', { id });
  res.json({ success: true, id });
});

// Get all devices
app.get('/api/devices', (req, res) => {
  res.json(devices);
});

// Create a new device
app.post('/api/devices', (req, res) => {
  const body = req.body;
  if (!body.name || !body.name.trim()) {
    return res.status(400).json({ error: 'Le nom de l\'équipement est requis.' });
  }

  const cleanIp = body.ip ? body.ip.trim() : '';

  const newDevice: Device = {
    id: body.id || `dev-${Date.now()}`,
    name: body.name.trim(),
    ip: cleanIp,
    mac: body.mac || '02:00:00:' + Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':'),
    vendor: body.vendor || (body.deviceType === 'docker' ? 'Docker Inc.' : body.deviceType === 'vm' ? 'QEMU / KVM' : cleanIp ? 'Générique' : 'IoT / Capteur sans IP'),
    deviceType: body.deviceType || 'physical',
    subType: body.subType || 'other',
    status: body.status || 'online',
    parentHostId: body.parentHostId,
    connectedToSwitchId: body.connectedToSwitchId,
    portOrInterface: body.portOrInterface,
    vlan: body.vlan || 1,
    os: body.os,
    openPorts: body.openPorts || [],
    location: body.location || 'Localisation non définie',
    customImage: body.customImage,
    isManualAdded: true, // Manually added by user -> preserved indefinitely across scans and presence tests
    tags: body.tags || (cleanIp ? [] : ['Sans IP', 'Capteur']),
    metadata: {
      ...(body.metadata || {}),
      ...(cleanIp ? {} : { 'Protocole': 'Zigbee / Z-Wave / Non-IP', 'Ajouté manuellement': 'Oui' })
    },
    lastSeen: new Date().toISOString(),
    latencyMs: body.latencyMs || (cleanIp ? 1.0 : undefined),
    position: body.position || { x: 300 + Math.random() * 200, y: 300 + Math.random() * 200 }
  };

  devices.push(newDevice);
  saveDevicesToFile();

  addLog({
    level: 'DISCOVERY',
    category: newDevice.deviceType === 'docker' ? 'DOCKER' : newDevice.deviceType === 'vm' ? 'VM' : newDevice.deviceType === 'iot' ? 'IOT' : 'SYSTEM',
    ip: newDevice.ip || 'sans IP',
    deviceId: newDevice.id,
    message: `Nouvel équipement ajouté manuellement: "${newDevice.name}" (${newDevice.ip || 'Sans IP'} - ${newDevice.deviceType.toUpperCase()})`
  });

  broadcastSse('device_added', newDevice);
  res.status(201).json(newDevice);
});

// Update a device
app.put('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  const index = devices.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Équipement non trouvé.' });
  }

  const prev = devices[index];
  const body = req.body || {};

  // Detect and lock manual customization flags so future scans never erase them
  const isCustomImage = body.isCustomImage ?? (body.customImage !== undefined && body.customImage !== prev.customImage ? true : prev.isCustomImage);
  const isCustomZone = body.isCustomZone ?? (body.zoneId !== undefined && body.zoneId !== prev.zoneId ? true : prev.isCustomZone);
  const isCustomName = body.isCustomName ?? (body.name !== undefined && body.name !== prev.name ? true : prev.isCustomName);
  const isCustomType = body.isCustomType ?? ((body.deviceType !== undefined && body.deviceType !== prev.deviceType) || (body.subType !== undefined && body.subType !== prev.subType) ? true : prev.isCustomType);

  const updatedMetadata = {
    ...(prev.metadata || {}),
    ...(body.metadata || {})
  };
  if (isCustomZone) {
    updatedMetadata['Zone Manuelle'] = 'true';
  }

  const updated: Device = {
    ...prev,
    ...body,
    id, // preserve ID
    isCustomImage,
    isCustomZone,
    isCustomName,
    isCustomType,
    metadata: updatedMetadata
  };

  if (prev.parentHostId !== updated.parentHostId) {
    const parentHost = devices.find((d) => d.id === updated.parentHostId);
    addLog({
      level: 'INFO',
      category: updated.deviceType === 'docker' ? 'DOCKER' : 'VM',
      deviceId: updated.id,
      ip: updated.ip,
      message: `Relation de dépendance modifiée: ${updated.name} rattaché à l'hôte ${parentHost ? parentHost.name : 'aucun (détaché)'}.`
    });
  }

  devices[index] = updated;
  saveDevicesToFile();
  broadcastSse('device_updated', updated);
  res.json(updated);
});

// Clear entire inventory to restart from clean slate (0 devices)
app.delete('/api/devices', (req, res) => {
  const previousCount = devices.length;
  devices = [];
  saveDevicesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Inventaire entièrement vidé (${previousCount} équipements supprimés). Base vierge prête pour un nouveau scan.`
  });

  broadcastSse('inventory_cleared', { count: 0 });
  broadcastSse('topology_updated', []);
  broadcastSse('scan_complete', { devices: [], scanStatus });
  res.json({ success: true, count: 0, message: 'Inventaire entièrement vidé.' });
});

app.post(['/api/devices/clear', '/api/inventory/clear'], (req, res) => {
  const previousCount = devices.length;
  devices = [];
  saveDevicesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Inventaire entièrement vidé (${previousCount} équipements supprimés). Base vierge prête pour un nouveau scan.`
  });

  broadcastSse('inventory_cleared', { count: 0 });
  broadcastSse('topology_updated', []);
  broadcastSse('scan_complete', { devices: [], scanStatus });
  res.json({ success: true, count: 0, message: 'Inventaire entièrement vidé.' });
});

// Delete single device
app.delete('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  const dev = devices.find((d) => d.id === id);
  if (!dev) {
    return res.status(404).json({ error: 'Équipement non trouvé.' });
  }

  devices.forEach((d) => {
    if (d.parentHostId === id) delete d.parentHostId;
    if (d.connectedToSwitchId === id) delete d.connectedToSwitchId;
  });

  devices = devices.filter((d) => d.id !== id);
  saveDevicesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Équipement "${dev.name}" (${dev.ip}) supprimé de l'inventaire.`
  });

  broadcastSse('device_deleted', { id });
  res.json({ success: true, id });
});

// Real-time logs endpoint
app.get('/api/logs', (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json(logs.slice(0, limit));
});

// Clear logs
app.delete('/api/logs', (req, res) => {
  logs = [
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Journal d\'événements réinitialisé par l\'utilisateur.'
    }
  ];
  broadcastSse('logs_cleared', {});
  res.json({ success: true });
});

// SSE Stream for live journaling
app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
});

// Scanner status
app.get('/api/scan/status', (req, res) => {
  res.json({
    ...scanStatus,
    devicesFound: devices.length
  });
});

// Cancel / interrupt running scan
app.post(['/api/scan/cancel', '/api/scan/stop'], (req, res) => {
  if (!scanStatus.isScanning) {
    return res.json({ success: true, message: 'Aucun scan en cours.' });
  }

  isScanCancelled = true;
  scanStatus.isScanning = false;
  scanStatus.progressPercent = 0;

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: 'Scan réseau interrompu manuellement par l\'utilisateur.'
  });

  broadcastSse('scan_cancelled', { scanStatus });
  broadcastSse('scan_complete', { devices, scanStatus, cancelled: true });
  res.json({ success: true, message: 'Scan interrompu avec succès.' });
});

// ---------------- REAL NETWORK SCANNER ENGINE ----------------
// Trigger Network Scan (Active Sweep + ARP Discovery + Port Probe + Automatic Inventory Addition)
app.post('/api/scan', async (req, res) => {
  if (scanStatus.isScanning) {
    return res.status(409).json({ error: 'Un scan est déjà en cours d\'exécution.' });
  }

  const subnet = req.body.subnet || '192.168.1.0/24';

  isScanCancelled = false;
  scanStatus = {
    isScanning: true,
    progressPercent: 0,
    currentIp: subnet.replace(/\.0\/\d+/, '.1'),
    devicesFound: devices.length,
    subnet,
    startedAt: new Date().toISOString()
  };

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Démarrage du scan réseau complet et unifié sur le sous-réseau ${subnet}...`
  });

  res.json({ success: true, message: 'Scan lancé avec succès.', scanStatus });

  // Run scan asynchronously
  (async () => {
    try {
      // 1. Parse target IP range
      const subnetParts = subnet.split('/')[0].split('.');
      if (subnetParts.length !== 4) {
        throw new Error('Format de sous-réseau non valide (ex: 192.168.1.0/24)');
      }
      const baseIp = `${subnetParts[0]}.${subnetParts[1]}.${subnetParts[2]}`;
      const candidateIps: string[] = [];
      for (let i = 1; i <= 254; i++) {
        candidateIps.push(`${baseIp}.${i}`);
      }

      // Unified comprehensive port list covering Infrastructure, Hypervisors, Containers, Databases, IoT & Web
      const portsToProbe = [
        21, 22, 53, 80, 443, 445, 554, 1883, 2375, 2376, 3000, 3306, 3389,
        5000, 5001, 5353, 5432, 6053, 6379, 8000, 8006, 8080, 8086, 8123,
        8443, 9000, 9090, 9443
      ];

      // Keep discovered alive hosts: Map<IP, { mac, rtt, openPorts, hostname, title, isFromArp }>
      const aliveHosts = new Map<
        string,
        {
          mac?: string;
          rtt: number;
          openPorts: number[];
          hostname?: string | null;
          webTitle?: string | null;
        }
      >();

      // 2. Initial ARP & Neighbor table check (for MAC mapping cache only, NOT automatically declared alive)
      const initialArp = readLinuxArpTable();
      const initialNeighbors = await readIpNeighbors();
      const allInitial = [...initialArp, ...initialNeighbors];
      const arpMacByIp = new Map<string, string>();
      for (const entry of allInitial) {
        if (entry.ip && entry.mac && entry.mac !== '00:00:00:00:00:00') {
          arpMacByIp.set(entry.ip, entry.mac);
        }
      }

      if (arpMacByIp.size > 0) {
        addLog({
          level: 'INFO',
          category: 'ARP',
          message: `Table ARP initiale inspectée: ${arpMacByIp.size} entrées MAC détectées en cache.`
        });
      }

      // 3. Active subnet sweep in concurrent batches of 20 IPs
      const BATCH_SIZE = 20;
      const totalIps = candidateIps.length;
      let completedCount = 0;

      for (let i = 0; i < candidateIps.length; i += BATCH_SIZE) {
        if (isScanCancelled) break;
        const batch = candidateIps.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (targetIp) => {
            if (isScanCancelled) return;
            // First try quick ICMP ping
            const pingRes = await pingIp(targetIp);
            let isAlive = pingRes.alive;
            let bestRtt = pingRes.rtt;
            const openPortsFound: number[] = [];

            // Probe key fast discovery ports during sweep
            for (const port of [80, 443, 22, 8006, 5000, 8123, 1883, 9000]) {
              if (isScanCancelled) break;
              const res = await probePort(targetIp, port, 160);
              if (res.open) {
                isAlive = true;
                openPortsFound.push(port);
                if (res.rtt < bestRtt || bestRtt === 0) bestRtt = res.rtt;
              }
            }

            if (isAlive) {
              const existing = aliveHosts.get(targetIp);
              const macFromArp = arpMacByIp.get(targetIp) || existing?.mac;
              aliveHosts.set(targetIp, {
                mac: macFromArp,
                rtt: bestRtt || 1.5,
                openPorts: Array.from(new Set([...(existing?.openPorts || []), ...openPortsFound]))
              });
            }
          })
        );

        if (isScanCancelled) break;

        completedCount += batch.length;
        scanStatus.progressPercent = Math.min(80, Math.round((completedCount / totalIps) * 80));
        scanStatus.currentIp = batch[batch.length - 1];
        broadcastSse('scan_progress', scanStatus);
      }

      if (isScanCancelled) {
        scanStatus.isScanning = false;
        scanStatus.progressPercent = 0;
        broadcastSse('scan_cancelled', { scanStatus });
        broadcastSse('scan_complete', { devices, scanStatus, cancelled: true });
        return;
      }

      // 4. Post-sweep: Re-read kernel ARP & neighbor table (populated after packet transmissions)
      const postSweepArp = readLinuxArpTable();
      const postSweepNeighbors = await readIpNeighbors();
      const allPost = [...postSweepArp, ...postSweepNeighbors];
      for (const entry of allPost) {
        if (entry.ip && entry.mac && entry.mac !== '00:00:00:00:00:00') {
          arpMacByIp.set(entry.ip, entry.mac);
          // Only update MAC for hosts that were verified alive!
          const current = aliveHosts.get(entry.ip);
          if (current) {
            current.mac = entry.mac;
          }
        }
      }

      scanStatus.progressPercent = 85;
      broadcastSse('scan_progress', scanStatus);

      if (isScanCancelled) {
        scanStatus.isScanning = false;
        scanStatus.progressPercent = 0;
        broadcastSse('scan_cancelled', { scanStatus });
        broadcastSse('scan_complete', { devices, scanStatus, cancelled: true });
        return;
      }

      // 5. Query local Docker daemon if mounted
      const dockerContainers = await fetchDockerContainers();
      if (dockerContainers.length > 0) {
        addLog({
          level: 'INFO',
          category: 'DOCKER',
          message: `Socket Docker inspecté: ${dockerContainers.length} conteneurs découverts localement.`
        });
      }

      // 6. Deep inspection of discovered alive IPs (ports, reverse DNS, HTTP title)
      const aliveList = Array.from(aliveHosts.entries());
      let inspectedCount = 0;

      for (const [ip, hostInfo] of aliveList) {
        if (isScanCancelled) break;
        inspectedCount++;

        // Dynamically advance progress between 86% and 98%
        const dynPercent = 85 + Math.round((inspectedCount / Math.max(1, aliveList.length)) * 13);
        scanStatus.progressPercent = Math.min(98, dynPercent);
        scanStatus.currentIp = ip;
        broadcastSse('scan_progress', scanStatus);

        // Probe remaining ports with 160ms hard limit
        const portPromises = portsToProbe.map(async (p) => {
          if (!hostInfo.openPorts.includes(p)) {
            const probe = await probePort(ip, p, 160);
            if (probe.open) hostInfo.openPorts.push(p);
          }
        });
        await Promise.all(portPromises);

        if (isScanCancelled) break;

        // Reverse DNS with strict 200ms timeout
        try {
          hostInfo.hostname = await reverseDns(ip, 200);
        } catch {
          hostInfo.hostname = null;
        }

        // Web title grab if web port is open (with strict 250ms timeout)
        const webPort = hostInfo.openPorts.find((p) => [80, 443, 8006, 5000, 8080, 8123].includes(p));
        if (webPort && !isScanCancelled) {
          try {
            hostInfo.webTitle = await fetchWebTitle(ip, webPort, 250);
          } catch {
            hostInfo.webTitle = null;
          }
        }
      }

      if (isScanCancelled) {
        scanStatus.isScanning = false;
        scanStatus.progressPercent = 0;
        broadcastSse('scan_cancelled', { scanStatus });
        broadcastSse('scan_complete', { devices, scanStatus, cancelled: true });
        return;
      }

      // 7. CRITICAL STEP: MERGE INTO INVENTORY & ADD NEW DEVICES
      let newlyAddedCount = 0;
      let updatedCount = 0;

      // Count occurrences of each MAC across alive hosts to detect shared router/gateway proxy-ARP MACs
      const macCounts = new Map<string, number>();
      for (const [, hostInfo] of aliveHosts) {
        if (hostInfo.mac && hostInfo.mac !== '00:00:00:00:00:00') {
          const normMac = hostInfo.mac.toLowerCase();
          macCounts.set(normMac, (macCounts.get(normMac) || 0) + 1);
        }
      }

      // Find primary switch or router ID to connect new physical devices
      const mainSwitch =
        devices.find((d) => d.subType === 'switch') ||
        devices.find((d) => d.subType === 'router') ||
        devices[0];

      // A) Process Network discovered hosts
      for (const [ip, hostInfo] of aliveHosts.entries()) {
        const rawMac = hostInfo.mac;
        const mac = rawMac || '02:00:00:' + ip.split('.').map((p) => (+p).toString(16).padStart(2, '0')).slice(1).join(':');
        const vendor = lookupVendor(mac);

        // Check if MAC is unique (appears only once in the scan) or shared (proxy-ARP/gateway MAC)
        const isMacUnique = rawMac && (macCounts.get(rawMac.toLowerCase()) || 0) <= 1;

        // Multi-ID Matching against existing inventory (including previously merged identities):
        // 1. Exact primary IP match
        // 2. Merged / secondary IP alias match (manually or automatically merged equipment)
        // 3. Real Hardware MAC match (primary or merged MACs, handles DHCP IP migration without duplicate)
        // 4. Resolved Hostname match (primary or merged hostnames/names)
        // 5. Web Service Title match (primary or merged web titles)
        let existingIndex = devices.findIndex((d) => d.ip === ip);
        let matchReason = `Adresse IP (${ip})`;
        let matchedViaMergedAlias = false;

        if (existingIndex === -1) {
          const idx = devices.findIndex(
            (d) =>
              d.mergedIps?.includes(ip) ||
              d.metadata?.['Adresse IP secondaire'] === ip ||
              d.metadata?.['IP Conteneur'] === ip
          );
          if (idx !== -1) {
            existingIndex = idx;
            matchedViaMergedAlias = true;
            matchReason = `Identité fusionnée persistante (IP ${ip} rattachée à "${devices[idx].name}")`;
          }
        }

        if (existingIndex === -1 && rawMac && isMacUnique && isRealHardwareMac(rawMac)) {
          const normRaw = rawMac.toLowerCase();
          const idx = devices.findIndex(
            (d) =>
              (d.mac && d.mac.toLowerCase() === normRaw && isRealHardwareMac(d.mac)) ||
              Boolean(d.mergedMacs?.includes(normRaw))
          );
          if (idx !== -1) {
            existingIndex = idx;
            matchReason = devices[idx].mergedMacs?.includes(normRaw) && devices[idx].mac?.toLowerCase() !== normRaw
              ? `Adresse MAC fusionnée (${rawMac})`
              : `Adresse MAC matérielle (${rawMac}) - renouvellement IP (${devices[idx].ip} → ${ip})`;
          }
        }

        if (existingIndex === -1 && hostInfo.hostname) {
          const normH = normalizeServiceName(hostInfo.hostname);
          if (normH.length >= 4 && !/^(device|equipement|inconnu|unknown|machine|linux|server|serveur|host|hote|ip|lan)\b/i.test(normH)) {
            const idx = devices.findIndex((d) => {
              const candidates = [
                d.metadata?.['Nom d\'hôte'] || '',
                d.name || '',
                ...(d.mergedHostnames || []),
                ...(d.mergedNames || [])
              ].filter(Boolean);
              const nameMatched = candidates.some((c) => normalizeServiceName(c) === normH);
              if (nameMatched) {
                const shared = (d.openPorts || []).filter((p) => hostInfo.openPorts.includes(p));
                return shared.length > 0 || d.deviceType === 'physical' || d.deviceType === 'vm' || Boolean(d.isManuallyMerged);
              }
              return false;
            });
            if (idx !== -1) {
              existingIndex = idx;
              matchReason = `Nom d'hôte résolu ("${hostInfo.hostname}")`;
            }
          }
        }

        if (existingIndex === -1 && hostInfo.webTitle) {
          const normT = normalizeServiceName(hostInfo.webTitle);
          if (normT.length >= 5) {
            const idx = devices.findIndex((d) => {
              const titleCandidates = [
                d.metadata?.['Titre Web'] || '',
                ...(d.mergedWebTitles || [])
              ].filter(Boolean);
              const titleMatched = titleCandidates.some((t) => normalizeServiceName(t) === normT);
              if (titleMatched) {
                const shared = (d.openPorts || []).filter((p) => hostInfo.openPorts.includes(p));
                return shared.length > 0 || Boolean(d.isManuallyMerged);
              }
              return false;
            });
            if (idx !== -1) {
              existingIndex = idx;
              matchReason = `Signature de service Web ("${hostInfo.webTitle}")`;
            }
          }
        }

        if (existingIndex !== -1) {
          // Device exists -> Update status, latency, openPorts, lastSeen
          const existing = devices[existingIndex];
          const mergedPorts = Array.from(new Set([...(existing.openPorts || []), ...hostInfo.openPorts])).sort((a, b) => a - b);

          // Keep primary IP if matched via merged alias OR if existing primary IP is currently alive on the network
          const keepExistingPrimaryIp = Boolean(
            existing.ip &&
            existing.ip !== 'sans IP' &&
            (matchedViaMergedAlias || existing.isManuallyMerged || aliveHosts.has(existing.ip))
          );
          const nextIp = keepExistingPrimaryIp ? existing.ip : ip;
          const oldIp = existing.ip;
          const isIpChanged = Boolean(oldIp && oldIp !== nextIp);

          const previousIps = Array.from(new Set([
            ...(existing.metadata?.['Anciennes adresses IP']?.split(', ') || []),
            ...(isIpChanged ? [oldIp] : [])
          ])).filter(Boolean);

          const updatedMergedIps = existing.mergedIps || ip !== nextIp
            ? Array.from(new Set([...(existing.mergedIps || []), existing.ip, ip].filter((x) => Boolean(x) && x !== '127.0.0.1' && x !== 'sans IP')))
            : existing.mergedIps;
          const updatedMergedMacs = existing.mergedMacs || (rawMac && isRealHardwareMac(rawMac))
            ? Array.from(new Set([...(existing.mergedMacs || []), ...(rawMac && isRealHardwareMac(rawMac) ? [rawMac.toLowerCase()] : [])]))
            : existing.mergedMacs;
          const updatedMergedHostnames = existing.mergedHostnames || hostInfo.hostname
            ? Array.from(new Set([...(existing.mergedHostnames || []), ...(hostInfo.hostname ? [hostInfo.hostname] : [])]))
            : existing.mergedHostnames;
          const updatedMergedWebTitles = existing.mergedWebTitles || hostInfo.webTitle
            ? Array.from(new Set([...(existing.mergedWebTitles || []), ...(hostInfo.webTitle ? [hostInfo.webTitle] : [])]))
            : existing.mergedWebTitles;

          // Compute auto service icon from detected ports, title, and hostname
          const tempDev: Partial<Device> = {
            ...existing,
            ip: nextIp,
            openPorts: mergedPorts,
            metadata: {
              ...(existing.metadata || {}),
              ...(hostInfo.webTitle ? { 'Titre Web': hostInfo.webTitle } : {}),
              ...(hostInfo.hostname ? { 'Nom d\'hôte': hostInfo.hostname } : {})
            }
          };
          const autoIcon = resolveServiceIcon(tempDev);

          let updatedName = existing.name;
          if (!existing.isCustomName && !existing.isManuallyMerged) {
            if (isIpChanged && updatedName.includes(oldIp)) {
              updatedName = updatedName.replace(oldIp, nextIp);
            } else if (hostInfo.hostname && (/^(Équipement|Machine|Device)\s+/i.test(updatedName) || /\(\d+\.\d+\.\d+\.\d+\)$/.test(updatedName))) {
              updatedName = hostInfo.hostname;
            }
          }

          // Strict preservation of manual customizations:
          // 1. customImage: if manually set, NEVER overwrite; if not, apply autoIcon or keep existing
          const customImage = existing.isCustomImage
            ? existing.customImage
            : (existing.customImage || autoIcon || undefined);

          // 2. zoneId: strictly preserve existing zone (never overwrite user assigned zone during scan!)
          const zoneId = existing.zoneId;

          devices[existingIndex] = {
            ...existing,
            name: updatedName,
            ip: nextIp,
            status: 'online',
            lastSeen: new Date().toISOString(),
            latencyMs: +(hostInfo.rtt || existing.latencyMs || 1.0).toFixed(1),
            openPorts: mergedPorts,
            mac: (existing.mac && isRealHardwareMac(existing.mac)) ? existing.mac : mac,
            vendor: (existing.vendor && existing.vendor !== 'Générique / Inconnu') ? existing.vendor : vendor,
            customImage,
            serviceIcon: autoIcon || existing.serviceIcon,
            zoneId,
            isCustomImage: existing.isCustomImage,
            isCustomZone: existing.isCustomZone,
            isCustomName: existing.isCustomName,
            isCustomType: existing.isCustomType,
            isManuallyMerged: existing.isManuallyMerged,
            mergedIps: updatedMergedIps,
            mergedMacs: updatedMergedMacs,
            mergedHostnames: updatedMergedHostnames,
            mergedWebTitles: updatedMergedWebTitles,
            position: existing.position, // Keep user placed position!
            metadata: {
              ...(existing.metadata || {}),
              ...(hostInfo.webTitle ? { 'Titre Web': hostInfo.webTitle } : {}),
              ...(hostInfo.hostname ? { 'Nom d\'hôte': hostInfo.hostname } : {}),
              ...(previousIps.length > 0 ? { 'Anciennes adresses IP': previousIps.join(', ') } : {}),
              'Dernier scan': new Date().toLocaleString('fr-FR'),
              'Méthode mise à jour': `Scan réseau (${matchReason})`
            }
          };
          updatedCount++;
          broadcastSse('device_updated', devices[existingIndex]);
        } else {
          // NEW DEVICE DISCOVERED -> Classify and add to devices inventory!
          const classification = classifyDevice(
            ip,
            mac,
            vendor,
            hostInfo.openPorts,
            hostInfo.hostname,
            hostInfo.webTitle
          );

          // Calculate a smart non-overlapping position
          const nextIndex = devices.length;
          const posX = 100 + (nextIndex % 7) * 170;
          const posY = 740 + Math.floor(nextIndex / 7) * 160;

          const isDockerDevice = classification.deviceType === 'docker';
          const isVmDevice = classification.deviceType === 'vm';
          
          // Smart container and VM to host association: accurately bind to the real host server
          const containerParent = isDockerDevice
            ? findBestHostForContainer({ ip, mac, name: classification.name, openPorts: hostInfo.openPorts }, devices)
            : undefined;
          const vmParent = isVmDevice
            ? findBestHostForVm({ ip, mac, name: classification.name, openPorts: hostInfo.openPorts }, devices)
            : undefined;
          const assignedParent = containerParent || vmParent;

          // Default zone assignment based on device type
          let defaultZoneId = 'zone-site-hq';
          if (classification.subType === 'router' || classification.subType === 'switch' || classification.subType === 'server' || classification.subType === 'nas') {
            defaultZoneId = 'zone-baie-01';
          } else if (classification.subType === 'camera') {
            defaultZoneId = 'zone-sr-01';
          } else if (classification.subType === 'workstation' || classification.subType === 'printer') {
            defaultZoneId = 'zone-bureau';
          } else if (classification.deviceType === 'iot') {
            defaultZoneId = 'zone-salon';
          } else if (isDockerDevice || isVmDevice) {
            defaultZoneId = assignedParent?.zoneId || 'zone-datacenter';
          }

          const tempNewDev: Partial<Device> = {
            name: classification.name,
            ip,
            openPorts: hostInfo.openPorts,
            deviceType: classification.deviceType,
            subType: classification.subType,
            os: classification.os,
            metadata: {
              ...(hostInfo.webTitle ? { 'Titre Web': hostInfo.webTitle } : {}),
              ...(hostInfo.hostname ? { 'Nom d\'hôte': hostInfo.hostname } : {})
            }
          };
          const autoServiceIcon = resolveServiceIcon(tempNewDev);

          const newDevice: Device = {
            id: `dev-${ip.replace(/\./g, '-')}-${Date.now().toString(36)}`,
            name: classification.name,
            ip,
            mac,
            vendor,
            deviceType: classification.deviceType,
            subType: classification.subType,
            status: 'online',
            zoneId: defaultZoneId,
            parentHostId: (isDockerDevice || isVmDevice) ? assignedParent?.id : undefined,
            connectedToSwitchId: (isDockerDevice || isVmDevice) ? undefined : (mainSwitch ? mainSwitch.id : undefined),
            vlan: 1,
            os: classification.os,
            openPorts: hostInfo.openPorts,
            customImage: autoServiceIcon || undefined,
            serviceIcon: autoServiceIcon || undefined,
            location: isDockerDevice
              ? `Conteneur sur ${assignedParent ? assignedParent.name : 'hôte Docker'}`
              : isVmDevice
              ? `Machine virtuelle sur ${assignedParent ? assignedParent.name : 'hyperviseur'}`
              : 'Découvert sur le réseau local',
            tags: classification.tags,
            metadata: {
              'Méthode': 'Scan réseau automatique',
              'Date découverte': new Date().toLocaleString('fr-FR'),
              ...(hostInfo.webTitle ? { 'Titre Web': hostInfo.webTitle } : {}),
              ...(hostInfo.hostname ? { 'Nom d\'hôte': hostInfo.hostname } : {}),
              ...(isDockerDevice && assignedParent ? { 'IP Hôte': assignedParent.ip, 'Hôte d\'exécution': assignedParent.name } : {}),
              ...(isVmDevice && assignedParent ? { 'IP Hyperviseur': assignedParent.ip, 'Hyperviseur': assignedParent.name } : {})
            },
            lastSeen: new Date().toISOString(),
            latencyMs: +(hostInfo.rtt || 1.5).toFixed(1),
            position: { x: posX, y: posY }
          };

          devices.push(newDevice);
          newlyAddedCount++;

          addLog({
            level: 'DISCOVERY',
            category: newDevice.deviceType === 'docker' ? 'DOCKER' : newDevice.deviceType === 'vm' ? 'VM' : newDevice.deviceType === 'iot' ? 'IOT' : 'ARP',
            ip: newDevice.ip,
            deviceId: newDevice.id,
            message: `Nouvel équipement découvert: ${newDevice.name} (${newDevice.ip} - ${newDevice.mac})${assignedParent ? ` [Rattaché à ${assignedParent.name}]` : ''}`
          });

          broadcastSse('device_added', newDevice);
        }
      }

      // B) Process Local Docker containers if discovered via socket
      // Associate with local machine host or server dedicated to Docker
      const dockerHost = findBestHostForContainer(
        {
          name: 'Docker Engine Daemon',
          location: 'Serveur Dédié Docker',
          metadata: { 'Hôte': 'Local Docker Daemon' }
        },
        devices
      );

      for (const ct of dockerContainers) {
        const ctId = ct.Id.substring(0, 12);
        const ctName = `Docker - ${(ct.Names[0] || ctId).replace(/^\//, '')}`;

        const openPorts = (ct.Ports || [])
          .map((p: any) => p.PublicPort || p.PrivatePort)
          .filter(Boolean);

        // Find actual container IP from its networks (avoid defaulting to host IP)
        let ctIp = '127.0.0.1';
        if (ct.NetworkSettings?.Networks) {
          for (const netName of Object.keys(ct.NetworkSettings.Networks)) {
            const netIp = ct.NetworkSettings.Networks[netName]?.IPAddress;
            if (netIp && netIp.trim()) {
              ctIp = netIp.trim();
              break;
            }
          }
        }
        if (ctIp === '127.0.0.1' && dockerHost?.ip) {
          ctIp = dockerHost.ip;
        }

        const existingCt = devices.find(
          (d) =>
            d.id === `docker-${ctId}` ||
            d.metadata?.['ContainerID'] === ctId ||
            Boolean(d.mergedContainerIds?.includes(ctId)) ||
            Boolean(d.mergedIds?.includes(`docker-${ctId}`)) ||
            d.name === ctName ||
            Boolean(d.mergedNames?.includes(ctName)) ||
            (ctIp !== '127.0.0.1' && d.mergedIps?.includes(ctIp) && (d.deviceType === 'docker' || Boolean(d.isManuallyMerged)))
        );

        const hostPortBinding = openPorts.length > 0
          ? `Hôte: ${dockerHost?.ip || '0.0.0.0'}:${openPorts[0]} → Conteneur: ${ctIp}:${openPorts[0]}`
          : `Docker Engine (${ct.Image})`;

        if (existingCt) {
          const isMergedTarget = Boolean(existingCt.isManuallyMerged || existingCt.id !== `docker-${ctId}`);
          existingCt.status = ct.State === 'running' ? 'online' : (isMergedTarget && existingCt.status === 'online' ? 'online' : 'offline');
          existingCt.lastSeen = new Date().toISOString();
          existingCt.openPorts = Array.from(new Set([...(existingCt.openPorts || []), ...openPorts])).sort((a, b) => a - b);
          if (!isMergedTarget && ctIp !== '127.0.0.1') {
            existingCt.ip = ctIp;
          }
          existingCt.mergedContainerIds = Array.from(new Set([...(existingCt.mergedContainerIds || []), ctId]));
          existingCt.mergedIds = Array.from(new Set([...(existingCt.mergedIds || []), `docker-${ctId}`]));
          existingCt.mergedNames = Array.from(new Set([...(existingCt.mergedNames || []), ctName]));
          if (ctIp !== '127.0.0.1') {
            existingCt.mergedIps = Array.from(new Set([...(existingCt.mergedIps || []), existingCt.ip, ctIp].filter(Boolean)));
          }
          const autoCtIcon = resolveServiceIcon({
            ...existingCt,
            openPorts: existingCt.openPorts,
            os: ct.Image,
            metadata: { ...(existingCt.metadata || {}), 'Image': ct.Image }
          });
          if (autoCtIcon) existingCt.serviceIcon = autoCtIcon;
          if (!existingCt.isCustomImage && !existingCt.customImage && autoCtIcon) {
            existingCt.customImage = autoCtIcon;
          }
          if (!isMergedTarget && dockerHost && !existingCt.parentHostId) {
            existingCt.parentHostId = dockerHost.id;
            if (!existingCt.metadata) existingCt.metadata = {};
            existingCt.metadata['IP Hôte'] = dockerHost.ip;
            existingCt.metadata['Hôte d\'exécution'] = dockerHost.name;
          }
          updatedCount++;
          broadcastSse('device_updated', existingCt);
        } else {
          const posX = 120 + (devices.length % 7) * 170;
          const posY = 750 + Math.floor(devices.length / 7) * 160;

          const tempCtDev: Partial<Device> = {
            name: ctName,
            ip: ctIp,
            openPorts,
            deviceType: 'docker',
            subType: 'container',
            os: ct.Image,
            metadata: {
              'Image': ct.Image
            }
          };
          const autoCtIcon = resolveServiceIcon(tempCtDev);

          const newContainer: Device = {
            id: `docker-${ctId}`,
            name: ctName,
            ip: ctIp,
            mac: '02:42:ac:11:' + ctId.slice(0, 4).match(/../g)?.join(':') || '02:42:ac:11:00:99',
            vendor: 'Docker Inc.',
            deviceType: 'docker',
            subType: 'container',
            status: ct.State === 'running' ? 'online' : 'offline',
            zoneId: dockerHost?.zoneId || 'zone-datacenter',
            parentHostId: dockerHost ? dockerHost.id : undefined,
            portOrInterface: hostPortBinding,
            vlan: 1,
            os: ct.Image,
            openPorts,
            customImage: autoCtIcon || undefined,
            serviceIcon: autoCtIcon || undefined,
            location: `Conteneur sur ${dockerHost ? dockerHost.name : 'hôte Docker'}`,
            tags: ['Docker', 'Conteneur', 'Local'],
            metadata: {
              'Image': ct.Image,
              'Command': ct.Command || '',
              'Status': ct.Status || '',
              'ContainerID': ctId,
              'IP Conteneur': ctIp,
              ...(dockerHost ? { 'IP Hôte': dockerHost.ip, 'Hôte d\'exécution': dockerHost.name } : {}),
              ...(openPorts.length > 0 ? { 'Ports exposés': openPorts.join(', ') } : {})
            },
            lastSeen: new Date().toISOString(),
            latencyMs: 0.2,
            position: { x: posX, y: posY }
          };

          devices.push(newContainer);
          newlyAddedCount++;

          addLog({
            level: 'DISCOVERY',
            category: 'DOCKER',
            deviceId: newContainer.id,
            message: `Nouveau conteneur Docker détecté: ${newContainer.name} rattaché à l'hôte ${dockerHost ? dockerHost.name : 'hôte par défaut'}`
          });

          broadcastSse('device_added', newContainer);
        }
      }

      // C) Process Remote Docker daemons discovered on physical hosts OR virtual machines (port 2375 or 2376)
      for (const [hostIp, hostInfo] of aliveHosts.entries()) {
        const dockerPort = hostInfo.openPorts.find((p) => p === 2375 || p === 2376);
        if (dockerPort) {
          try {
            const remoteContainers = await fetchRemoteDockerContainers(hostIp, dockerPort);
            if (remoteContainers.length > 0) {
              const matchedHost = devices.find((d) => d.ip === hostIp);
              const hostName = matchedHost ? matchedHost.name : hostIp;
              addLog({
                level: 'INFO',
                category: 'DOCKER',
                message: `Docker distant détecté sur ${hostName} (${hostIp}:${dockerPort}): ${remoteContainers.length} conteneur(s) interrogé(s).`
              });

              for (const ct of remoteContainers) {
                const ctId = ct.Id.substring(0, 12);
                const ctName = `Docker - ${(ct.Names[0] || ctId).replace(/^\//, '')}`;

                const openPorts = (ct.Ports || [])
                  .map((p: any) => p.PublicPort || p.PrivatePort)
                  .filter(Boolean);

                let ctIp = '127.0.0.1';
                if (ct.NetworkSettings?.Networks) {
                  for (const netName of Object.keys(ct.NetworkSettings.Networks)) {
                    const netIp = ct.NetworkSettings.Networks[netName]?.IPAddress;
                    if (netIp && netIp.trim()) {
                      ctIp = netIp.trim();
                      break;
                    }
                  }
                }
                if (ctIp === '127.0.0.1') ctIp = hostIp;

                const existingCt = devices.find(
                  (d) =>
                    d.id === `docker-${ctId}` ||
                    d.metadata?.['ContainerID'] === ctId ||
                    Boolean(d.mergedContainerIds?.includes(ctId)) ||
                    Boolean(d.mergedIds?.includes(`docker-${ctId}`)) ||
                    d.name === ctName ||
                    Boolean(d.mergedNames?.includes(ctName)) ||
                    (ctIp !== '127.0.0.1' && d.mergedIps?.includes(ctIp) && (d.deviceType === 'docker' || Boolean(d.isManuallyMerged)))
                );

                const hostPortBinding = openPorts.length > 0
                  ? `Hôte: ${hostIp}:${openPorts[0]} → Conteneur: ${ctIp}:${openPorts[0]}`
                  : `Docker Engine (${ct.Image})`;

                if (existingCt) {
                  const isMergedTarget = Boolean(existingCt.isManuallyMerged || existingCt.id !== `docker-${ctId}`);
                  existingCt.status = ct.State === 'running' ? 'online' : (isMergedTarget && existingCt.status === 'online' ? 'online' : 'offline');
                  existingCt.lastSeen = new Date().toISOString();
                  existingCt.openPorts = Array.from(new Set([...(existingCt.openPorts || []), ...openPorts])).sort((a, b) => a - b);
                  existingCt.mergedContainerIds = Array.from(new Set([...(existingCt.mergedContainerIds || []), ctId]));
                  existingCt.mergedIds = Array.from(new Set([...(existingCt.mergedIds || []), `docker-${ctId}`]));
                  existingCt.mergedNames = Array.from(new Set([...(existingCt.mergedNames || []), ctName]));
                  if (ctIp !== '127.0.0.1') {
                    existingCt.mergedIps = Array.from(new Set([...(existingCt.mergedIps || []), existingCt.ip, ctIp].filter(Boolean)));
                  }
                  if (!isMergedTarget && matchedHost && !existingCt.parentHostId) {
                    existingCt.parentHostId = matchedHost.id;
                  }
                  updatedCount++;
                  broadcastSse('device_updated', existingCt);
                } else {
                  const posX = 120 + (devices.length % 7) * 170;
                  const posY = 750 + Math.floor(devices.length / 7) * 160;
                  const tempCtDev: Partial<Device> = {
                    name: ctName,
                    ip: ctIp,
                    openPorts,
                    deviceType: 'docker',
                    subType: 'container',
                    os: ct.Image,
                    metadata: { 'Image': ct.Image }
                  };
                  const autoCtIcon = resolveServiceIcon(tempCtDev);

                  const newContainer: Device = {
                    id: `docker-${ctId}`,
                    name: ctName,
                    ip: ctIp,
                    mac: '02:42:ac:11:' + (ctId.slice(0, 4).match(/../g)?.join(':') || '00:99'),
                    vendor: 'Docker Inc.',
                    deviceType: 'docker',
                    subType: 'container',
                    status: ct.State === 'running' ? 'online' : 'offline',
                    zoneId: matchedHost?.zoneId || 'zone-datacenter',
                    parentHostId: matchedHost ? matchedHost.id : undefined,
                    portOrInterface: hostPortBinding,
                    vlan: matchedHost?.vlan || 1,
                    os: ct.Image,
                    openPorts,
                    customImage: autoCtIcon || undefined,
                    serviceIcon: autoCtIcon || undefined,
                    location: `Conteneur sur ${matchedHost ? matchedHost.name : hostIp}`,
                    tags: ['Docker', 'Conteneur', matchedHost?.deviceType === 'vm' ? 'VM Docker' : 'Hôte Docker'],
                    metadata: {
                      'Image': ct.Image,
                      'Command': ct.Command || '',
                      'Status': ct.Status || '',
                      'ContainerID': ctId,
                      'IP Conteneur': ctIp,
                      ...(matchedHost ? { 'IP Hôte': matchedHost.ip, 'Hôte d\'exécution': matchedHost.name } : {}),
                      ...(openPorts.length > 0 ? { 'Ports exposés': openPorts.join(', ') } : {})
                    },
                    lastSeen: new Date().toISOString(),
                    latencyMs: 0.5,
                    position: { x: posX, y: posY }
                  };
                  devices.push(newContainer);
                  newlyAddedCount++;
                  broadcastSse('device_added', newContainer);
                }
              }
            }
          } catch {
            // ignore remote docker socket error
          }
        }
      }

      // D) Deduplicate and fuse Docker containers (host entity vs container IP entity)
      const mergeRes = mergeDuplicateContainers(devices);
      if (mergeRes.mergedCount > 0) {
        devices = mergeRes.devices;
        addLog({
          level: 'INFO',
          category: 'DOCKER',
          message: `${mergeRes.mergedCount} conteneur(s) Docker fusionné(s) sans doublon (IP hôte + IP conteneur consolidées).`
        });
        mergeRes.mergedDetails.forEach((det) => {
          addLog({ level: 'DISCOVERY', category: 'DOCKER', message: det });
        });
      }

      // 8. AUTO-LAYOUT: Organiser automatiquement tout le schéma et résoudre les liaisons
      devices = autoLayoutTopology(devices);

      // 9. PERSISTENCE: Sauvegarde dans data/devices.json
      saveDevicesToFile();

      // 10. Complete scan & notify
      scanStatus.isScanning = false;
      scanStatus.progressPercent = 100;
      scanStatus.devicesFound = devices.length;

      addLog({
        level: 'INFO',
        category: 'SYSTEM',
        message: `Scan terminé avec succès. ${aliveHosts.size} équipements en ligne détectés, ${newlyAddedCount} nouveaux ajoutés à l'inventaire (${devices.length} au total).`
      });

      broadcastSse('scan_complete', {
        devices,
        scanStatus,
        newlyAddedCount,
        updatedCount,
        totalAlive: aliveHosts.size,
        devicesFound: devices.length
      });
    } catch (err: any) {
      console.error('Scan error:', err);
      scanStatus.isScanning = false;
      addLog({
        level: 'ALERT',
        category: 'SYSTEM',
        message: `Erreur lors de l'exécution du scan: ${err.message || 'Échec d\'analyse'}`
      });
      broadcastSse('scan_complete', { devices, scanStatus });
    }
  })();
});

// Ping / Diagnostic for a specific device
app.post('/api/devices/:id/ping', async (req, res) => {
  const { id } = req.params;
  const dev = devices.find((d) => d.id === id);
  if (!dev) {
    return res.status(404).json({ error: 'Équipement non trouvé.' });
  }

  // Real ping attempt if possible, fallback to TCP probe or simulation
  let rtt = 1.0;
  let isAlive = false;

  const pingRes = await pingIp(dev.ip);
  if (pingRes.alive) {
    isAlive = true;
    rtt = pingRes.rtt;
  } else if (dev.openPorts && dev.openPorts.length > 0) {
    const probe = await probePort(dev.ip, dev.openPorts[0], 400);
    if (probe.open) {
      isAlive = true;
      rtt = probe.rtt;
    }
  }

  if (!isAlive) {
    // If local test without real network ping response, keep device status
    rtt = +(0.5 + Math.random() * 2).toFixed(1);
  }

  dev.latencyMs = rtt;
  dev.lastSeen = new Date().toISOString();
  saveDevicesToFile();

  addLog({
    level: 'INFO',
    category: 'PORT',
    ip: dev.ip,
    deviceId: dev.id,
    message: `Test de connectivité sur ${dev.name} (${dev.ip}): RTT ${rtt} ms - Ports: ${(dev.openPorts || []).join(', ') || 'N/A'}`
  });

  broadcastSse('device_updated', dev);
  res.json({
    success: true,
    ip: dev.ip,
    rttMs: rtt,
    openPorts: dev.openPorts || [],
    status: dev.status
  });
});

// Reset topology and clear inventory completely (no demo data)
app.post('/api/reset-topology', (req, res) => {
  devices = [];
  zones = [];
  saveDevicesToFile();
  saveZonesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: 'Topologie réseau et inventaire entièrement réinitialisés (aucun équipement démo conservé).'
  });

  broadcastSse('topology_reset', devices);
  broadcastSse('zones_updated', zones);
  broadcastSse('inventory_cleared', {});
  broadcastSse('scan_complete', { devices, scanStatus });
  res.json({ success: true, devices, zones });
});

// Manual Merge of 2 selected equipment records with maximal information consolidation
app.post('/api/inventory/merge-two', (req, res) => {
  const sourceId = req.body.sourceId || req.body.sourceDeviceId;
  const targetId = req.body.targetId || req.body.targetDeviceId;
  const { preferredName, primaryIpChoice } = req.body;
  if (!sourceId || !targetId) {
    return res.status(400).json({ error: 'sourceId et targetId sont obligatoires.' });
  }

  const devA = devices.find((d) => d.id === sourceId);
  const devB = devices.find((d) => d.id === targetId);

  if (!devA || !devB) {
    return res.status(404).json({ error: 'Un ou les deux équipements sélectionnés sont introuvables.' });
  }

  // 1. Custom icon / image: Strictly preserve custom icon if chosen on either equipment!
  let customImage: string | undefined;
  let isCustomImage = false;
  if (devA.isCustomImage && devA.customImage) {
    customImage = devA.customImage;
    isCustomImage = true;
  } else if (devB.isCustomImage && devB.customImage) {
    customImage = devB.customImage;
    isCustomImage = true;
  } else {
    customImage = devA.customImage || devB.customImage || undefined;
    isCustomImage = Boolean(devA.isCustomImage || devB.isCustomImage);
  }
  const serviceIcon = devA.serviceIcon || devB.serviceIcon || undefined;

  // 2. Name: preserve custom name or pick the most informative
  let name = preferredName?.trim() || devA.name;
  if (!preferredName) {
    if (devA.isCustomName) name = devA.name;
    else if (devB.isCustomName) name = devB.name;
    else if (devA.name.startsWith('Équipement') && !devB.name.startsWith('Équipement')) name = devB.name;
    else name = devA.name;
  }

  // 3. IP Addresses: select main primary IP and store secondary in metadata & tags
  let primaryIp = devA.ip;
  let secondaryIp = devB.ip;
  if (primaryIpChoice === devB.ip) {
    primaryIp = devB.ip;
    secondaryIp = devA.ip;
  } else if (isContainerInternalIp(devA.ip) && !isContainerInternalIp(devB.ip)) {
    primaryIp = devB.ip;
    secondaryIp = devA.ip;
  }

  // 4. Hardware MAC address: preserve real hardware MAC
  let mac = devA.mac;
  if ((!devA.mac || !isRealHardwareMac(devA.mac)) && devB.mac && isRealHardwareMac(devB.mac)) {
    mac = devB.mac;
  }

  // 5. Union of all open ports
  const mergedPorts = Array.from(new Set([...(devA.openPorts || []), ...(devB.openPorts || [])])).sort((a, b) => a - b);

  // 6. Union of all tags
  const mergedTags = Array.from(new Set([...(devA.tags || []), ...(devB.tags || []), 'Fusionné']));

  // 7. Consolidation of all metadata (Docker ports, host IP, titles, etc.)
  const mergedMetadata: Record<string, string> = {
    ...(devB.metadata || {}),
    ...(devA.metadata || {}),
    'Date fusion': new Date().toLocaleString('fr-FR'),
    'Équipements fusionnés': `${devA.name} [${devA.ip}] + ${devB.name} [${devB.ip}]`,
    'Statut fusion': 'Fusionné manuellement'
  };
  if (secondaryIp && secondaryIp !== primaryIp) {
    mergedMetadata['Adresse IP secondaire'] = secondaryIp;
    if (!mergedTags.includes(secondaryIp)) mergedTags.push(secondaryIp);
  }
  if (devB.mac && devB.mac !== mac) {
    mergedMetadata['MAC secondaire'] = devB.mac;
  }

  // 8. Zone, Host and Switch links
  const zoneId = (devA.isCustomZone ? devA.zoneId : devB.isCustomZone ? devB.zoneId : (devA.zoneId || devB.zoneId)) || undefined;
  const parentHostId = devA.parentHostId || devB.parentHostId || undefined;
  const connectedToSwitchId = devA.connectedToSwitchId || devB.connectedToSwitchId || undefined;
  const portOrInterface = devA.portOrInterface || devB.portOrInterface || undefined;
  const isCore = Boolean(devA.isCore || devB.isCore);

  const aliases = collectMergedAliases(devA, devB);
  const mergedMetadataWithAliases: Record<string, string> = {
    ...mergedMetadata,
    ...(aliases.mergedIps.length > 1 ? { 'Adresses IP associées': aliases.mergedIps.join(', ') } : {})
  };

  const mergedDevice: Device = {
    ...devA,
    name,
    ip: primaryIp,
    mac: mac || '02:00:00:00:00:00',
    vendor: (devA.vendor && devA.vendor !== 'Générique / Inconnu' && devA.vendor !== 'Inconnu') ? devA.vendor : (devB.vendor || devA.vendor || 'Inconnu'),
    deviceType: (devA.deviceType === 'docker' || devB.deviceType === 'docker') ? 'docker' : (devA.deviceType === 'vm' || devB.deviceType === 'vm' ? 'vm' : devA.deviceType),
    subType: (devA.subType !== 'server' && devA.subType !== 'other') ? devA.subType : devB.subType,
    status: (devA.status === 'online' || devB.status === 'online') ? 'online' : 'offline',
    os: devA.os || devB.os || undefined,
    openPorts: mergedPorts,
    tags: mergedTags,
    metadata: mergedMetadataWithAliases,
    customImage,
    serviceIcon,
    isCustomImage,
    isCustomZone: Boolean(devA.isCustomZone || devB.isCustomZone),
    isCustomName: Boolean(devA.isCustomName || devB.isCustomName || preferredName?.trim()),
    isCustomType: Boolean(devA.isCustomType || devB.isCustomType),
    isManualAdded: Boolean(devA.isManualAdded || devB.isManualAdded),
    isManuallyMerged: true,
    ...aliases,
    zoneId,
    parentHostId,
    connectedToSwitchId,
    portOrInterface,
    isCore,
    lastSeen: new Date().toISOString()
  };

  // Re-point any child guests (VMs/containers) or switch connections from devB to mergedDevice.id
  devices.forEach((d) => {
    if (d.parentHostId === devB.id) d.parentHostId = mergedDevice.id;
    if (d.connectedToSwitchId === devB.id) d.connectedToSwitchId = mergedDevice.id;
  });

  // Replace devA and remove devB
  const idxA = devices.findIndex((d) => d.id === devA.id);
  devices[idxA] = mergedDevice;
  devices = devices.filter((d) => d.id !== devB.id);

  saveDevicesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Fusion manuelle réussie : "${devA.name}" (${devA.ip}) et "${devB.name}" (${devB.ip}) consolidés sous "${mergedDevice.name}". ${mergedPorts.length} ports et icône préservée.`
  });

  broadcastSse('device_updated', mergedDevice);
  broadcastSse('device_deleted', { id: devB.id });
  broadcastSse('topology_updated', devices);

  res.json({ success: true, mergedDevice, deletedId: devB.id, devices });
});

// Clear entire inventory endpoint (empty to 0)
app.post('/api/devices/clear', (req, res) => {
  devices = [];
  saveDevicesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: 'Inventaire des équipements entièrement vidé par l\'utilisateur.'
  });

  broadcastSse('inventory_cleared', {});
  broadcastSse('scan_complete', { devices, scanStatus });
  res.json({ success: true, count: 0 });
});

// Auto-layout / Automatic diagram generation endpoint
app.post('/api/topology/autolayout', (req, res) => {
  devices = autoLayoutTopology(devices);
  saveDevicesToFile();

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: 'Schéma de topologie réorganisé et centré automatiquement par niveaux hiérarchiques.'
  });

  broadcastSse('topology_updated', devices);
  res.json({ success: true, devices });
});

// Universal deduplication and fusion for all equipment types (IP, MAC, Hostname, Ports, Services, Docker)
app.post('/api/inventory/merge-duplicates', (req, res) => {
  const mergeRes = mergeDuplicateDevices(devices);
  if (mergeRes.mergedCount > 0) {
    devices = mergeRes.devices;
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
    addLog({
      level: 'INFO',
      category: 'SYSTEM',
      message: `${mergeRes.mergedCount} équipement(s) fusionné(s) avec succès (adresses IP, MAC, services, ports et conteneurs consolidés sans doublon).`
    });
    mergeRes.mergedDetails.forEach((det) => {
      addLog({ level: 'DISCOVERY', category: 'SYSTEM', message: det });
    });
  }
  res.json({
    success: true,
    mergedCount: mergeRes.mergedCount,
    details: mergeRes.mergedDetails,
    devices
  });
});

// Detect potential duplicates across all equipment without modifying
app.get('/api/inventory/duplicates', (req, res) => {
  const duplicates: Array<{ deviceA: Device; deviceB: Device; reason: string; confidence: string }> = [];
  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const check = shouldMergeDevices(devices[i], devices[j], devices);
      if (check.match) {
        duplicates.push({
          deviceA: devices[i],
          deviceB: devices[j],
          reason: check.reason,
          confidence: check.confidence
        });
      }
    }
  }
  res.json({ count: duplicates.length, duplicates });
});

// Legacy / alias endpoint for Docker containers merge (delegates to universal merge)
app.post('/api/containers/merge', (req, res) => {
  const mergeRes = mergeDuplicateDevices(devices);
  if (mergeRes.mergedCount > 0) {
    devices = mergeRes.devices;
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
    addLog({
      level: 'INFO',
      category: 'DOCKER',
      message: `${mergeRes.mergedCount} équipement(s) / conteneur(s) fusionné(s) avec succès (adresses IP hôtes et conteneurs consolidées sans doublon).`
    });
    mergeRes.mergedDetails.forEach((det) => {
      addLog({ level: 'DISCOVERY', category: 'DOCKER', message: det });
    });
  }
  res.json({
    success: true,
    mergedCount: mergeRes.mergedCount,
    details: mergeRes.mergedDetails,
    devices
  });
});

// Legacy / alias endpoint for container duplicate detection
app.get('/api/containers/duplicates', (req, res) => {
  const duplicates: Array<{ deviceA: Device; deviceB: Device; reason: string }> = [];
  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const check = shouldMergeDevices(devices[i], devices[j], devices);
      if (check.match) {
        duplicates.push({
          deviceA: devices[i],
          deviceB: devices[j],
          reason: check.reason
        });
      }
    }
  }
  res.json({ count: duplicates.length, duplicates });
});

// Export topology configuration (including devices, zones, types, sub-types, and subnet info)
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inkanetopology-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    subnet: scanStatus.subnet,
    devices,
    zones,
    types: deviceTypes,
    subTypes: deviceSubTypes,
    logs: logs.slice(0, 100)
  });
});

// Import topology configuration (accepts { devices, zones, types, subTypes }, legacy schemas, or Device[] array)
app.post('/api/import', (req, res) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: 'Données JSON invalides ou corps de requête vide.' });
  }

  let hasValidPayload = false;

  // 1. Devices extraction (direct array or nested properties)
  const rawDevices = Array.isArray(body)
    ? body
    : (body.devices || body.deviceList || body.nodes || body.elements || body.topology?.devices || body.data?.devices);

  if (Array.isArray(rawDevices)) {
    const mapped = rawDevices.map((d: any, idx: number) => ({
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
      isCustomImage: Boolean(d.isCustomImage),
      isCustomZone: Boolean(d.isCustomZone),
      isCustomName: Boolean(d.isCustomName),
      isCustomType: Boolean(d.isCustomType),
      isManualAdded: Boolean(d.isManualAdded),
      isManuallyMerged: Boolean(d.isManuallyMerged),
      ...(Array.isArray(d.mergedIds) ? { mergedIds: d.mergedIds.map(String) } : {}),
      ...(Array.isArray(d.mergedIps) ? { mergedIps: d.mergedIps.map(String) } : {}),
      ...(Array.isArray(d.mergedMacs) ? { mergedMacs: d.mergedMacs.map(String) } : {}),
      ...(Array.isArray(d.mergedHostnames) ? { mergedHostnames: d.mergedHostnames.map(String) } : {}),
      ...(Array.isArray(d.mergedNames) ? { mergedNames: d.mergedNames.map(String) } : {}),
      ...(Array.isArray(d.mergedContainerIds) ? { mergedContainerIds: d.mergedContainerIds.map(String) } : {}),
      ...(Array.isArray(d.mergedWebTitles) ? { mergedWebTitles: d.mergedWebTitles.map(String) } : {}),
      tags: Array.isArray(d.tags) ? d.tags : [],
      metadata: typeof d.metadata === 'object' && d.metadata !== null ? d.metadata : {},
      lastSeen: d.lastSeen ? String(d.lastSeen) : new Date().toISOString(),
      latencyMs: typeof d.latencyMs === 'number' ? d.latencyMs : undefined,
      position: (d.position && typeof d.position.x === 'number' && typeof d.position.y === 'number')
        ? d.position
        : { x: 200 + (idx % 4) * 300, y: 180 + Math.floor(idx / 4) * 220 }
    }));

    // Deduplicate imported containers (fusing host IP entities and container IP entities)
    const mergeRes = mergeDuplicateContainers(mapped);
    devices = mergeRes.devices;
    saveDevicesToFile();
    broadcastSse('topology_updated', devices);
    hasValidPayload = true;
  }

  // 2. Zones extraction
  if (typeof body === 'object' && !Array.isArray(body)) {
    const rawZones = body.zones || body.geographicZones || body.zoneList || body.topology?.zones || body.data?.zones;
    if (Array.isArray(rawZones)) {
      zones = rawZones.map((z: any, idx: number) => ({
        id: String(z.id || `zone-${Date.now()}-${idx}`),
        name: String(z.name || `Zone ${idx + 1}`),
        type: (['piece', 'sous_repartiteur', 'baie', 'site', 'autre'].includes(z.type)) ? z.type : 'piece',
        description: z.description ? String(z.description) : undefined,
        color: z.color ? String(z.color) : '#0ea5e9'
      }));
      saveZonesToFile();
      broadcastSse('zones_updated', zones);
      hasValidPayload = true;
    }

    // 3. Types extraction (always preserve the 4 built-in types + imported custom types)
    const rawTypes = body.types || body.deviceTypes || body.typeList || body.topology?.types || body.data?.types;
    if (Array.isArray(rawTypes)) {
      const typeMap = new Map<string, DeviceTypeDefinition>();
      defaultDeviceTypes.forEach((t) => typeMap.set(t.id, { ...t }));
      rawTypes.forEach((t: any, idx: number) => {
        if (!t) return;
        const tid = String(t.id || `custom-type-${Date.now()}-${idx}`);
        const existingBuiltin = typeMap.get(tid);
        typeMap.set(tid, {
          ...(existingBuiltin || {}),
          id: tid,
          name: String(t.name || existingBuiltin?.name || `Type ${idx + 1}`),
          color: String(t.color || existingBuiltin?.color || '#3b82f6'),
          icon: t.icon ? String(t.icon) : (existingBuiltin?.icon || 'Server'),
          description: t.description ? String(t.description) : existingBuiltin?.description,
          isBuiltin: Boolean(existingBuiltin || t.isBuiltin)
        });
      });
      deviceTypes = Array.from(typeMap.values());
      saveTypesToFile();
      broadcastSse('types_updated', deviceTypes);
      hasValidPayload = true;
    }

    // 4. Sub-types extraction
    const rawSubTypes = body.subTypes || body.deviceSubTypes || body.roles || body.subTypeList || body.topology?.subTypes || body.data?.subTypes;
    if (Array.isArray(rawSubTypes)) {
      deviceSubTypes = rawSubTypes.map((s: any, idx: number) => ({
        id: String(s.id || `custom-sub-${Date.now()}-${idx}`),
        name: String(s.name || `Sous-type ${idx + 1}`),
        typeId: s.typeId ? String(s.typeId) : 'all',
        role: s.role ? String(s.role) : undefined,
        icon: s.icon ? String(s.icon) : undefined,
        description: s.description ? String(s.description) : undefined,
        deviceId: s.deviceId ? String(s.deviceId) : undefined,
        isBuiltin: Boolean(s.isBuiltin)
      }));
      saveSubTypesToFile();
      broadcastSse('subtypes_updated', deviceSubTypes);
      hasValidPayload = true;
    }
  }

  if (!hasValidPayload) {
    return res.status(400).json({ error: 'Le fichier JSON ne contient aucune section reconnue (devices, zones, types ou subTypes).' });
  }

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Topologie réseau importée avec succès : ${devices.length} équipements, ${zones.length} zones, ${deviceTypes.length} types.`
  });

  res.json({
    success: true,
    deviceCount: devices.length,
    devicesCount: devices.length,
    zoneCount: zones.length,
    zonesCount: zones.length,
    typesCount: deviceTypes.length,
    devices,
    zones,
    types: deviceTypes,
    subTypes: deviceSubTypes
  });
});

// Asynchronous background export synchronization endpoint
app.post('/api/export-sync', (req, res) => {
  const body = req.body;
  if (body && typeof body === 'object') {
    if (Array.isArray(body.devices)) {
      devices = body.devices;
      saveDevicesToFile();
    }
    if (Array.isArray(body.zones)) {
      zones = body.zones;
      saveZonesToFile();
    }
    if (Array.isArray(body.types)) {
      deviceTypes = body.types;
      saveTypesToFile();
    }
    if (Array.isArray(body.subTypes)) {
      deviceSubTypes = body.subTypes;
      saveSubTypesToFile();
    }
  }
  res.json({ success: true });
});

// Settings configuration endpoints
app.get('/api/settings', (req, res) => {
  res.json(appSettings);
});

app.put('/api/settings', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Données de configuration invalides.' });
  }

  appSettings = {
    ...appSettings,
    presenceCheckEnabled: typeof body.presenceCheckEnabled === 'boolean' ? body.presenceCheckEnabled : appSettings.presenceCheckEnabled,
    presenceCheckIntervalMinutes: typeof body.presenceCheckIntervalMinutes === 'number' && body.presenceCheckIntervalMinutes > 0 ? body.presenceCheckIntervalMinutes : appSettings.presenceCheckIntervalMinutes,
    autoPruneEnabled: typeof body.autoPruneEnabled === 'boolean' ? body.autoPruneEnabled : appSettings.autoPruneEnabled,
    maxInactiveAgeHours: typeof body.maxInactiveAgeHours === 'number' && body.maxInactiveAgeHours > 0 ? body.maxInactiveAgeHours : appSettings.maxInactiveAgeHours,
    protectCoreDevices: typeof body.protectCoreDevices === 'boolean' ? body.protectCoreDevices : appSettings.protectCoreDevices,
    defaultSubnet: typeof body.defaultSubnet === 'string' && body.defaultSubnet.trim().length > 0 ? body.defaultSubnet.trim() : appSettings.defaultSubnet
  };

  saveSettingsToFile();
  broadcastSse('settings_updated', appSettings);

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Paramètres mis à jour : test présence ${appSettings.presenceCheckEnabled ? `actif (${appSettings.presenceCheckIntervalMinutes} min)` : 'désactivé'}, nettoyage auto ${appSettings.autoPruneEnabled ? `actif (inactif > ${appSettings.maxInactiveAgeHours}h)` : 'désactivé'}.`
  });

  res.json({ success: true, settings: appSettings });
});

// Immediate manual presence check
app.post('/api/presence/check', async (req, res) => {
  const result = await executePresenceCheck(true);
  res.json({ success: true, ...result, settings: appSettings });
});

// Immediate manual inventory prune
app.post('/api/inventory/prune', (req, res) => {
  const result = executeInventoryPrune(true);
  res.json({ success: true, ...result, settings: appSettings });
});

// Logo PNG direct download endpoint
app.get(['/api/logo', '/api/logo.png'], (req, res) => {
  const logoPath = path.resolve(__dirname, 'public/logo.png');
  if (fs.existsSync(logoPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.download(logoPath, 'inkanetopology-logo.png');
  } else {
    res.status(404).send('Logo non trouvé');
  }
});

// Serve full standalone documentation
app.get(['/documentation', '/documentation.html'], (req, res) => {
  res.sendFile(path.resolve(__dirname, 'documentation.html'));
});

// ---------------- VITE / STATIC SERVING ----------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[InkaNetopology] Serveur actif sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
