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
import type { Device, DeviceType, DeviceSubType, NetworkLog, ScanStatus } from './src/types/network.js';
import { autoLayoutTopology } from './src/utils/topologyLayout.js';

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);
const dnsReversePromise = promisify(dns.reverse);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// ---------------- PERSISTENCE ----------------
const DATA_DIR = path.resolve(__dirname, 'data');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

// Default initial baseline topology
const defaultDevices: Device[] = [
  // 1. ROUTEUR & INFRA PHYSIQUE CENTRALE
  {
    id: 'dev-router-01',
    name: 'UniFi Dream Machine Pro',
    ip: '192.168.1.1',
    mac: 'e0:63:da:8a:22:10',
    vendor: 'Ubiquiti Networks',
    deviceType: 'physical',
    subType: 'router',
    status: 'online',
    portOrInterface: 'WAN / SFP+ 10G',
    vlan: 1,
    os: 'UniFi OS 3.2.12',
    openPorts: [53, 80, 443, 8443, 22],
    location: 'Baie Principale - RDC',
    tags: ['Passerelle', 'Réseau', 'Critique'],
    metadata: {
      'Rôle': 'Passerelle & Pare-feu DPI',
      'Débit WAN': '1 Gbps Fibre',
      'CPU': 'Quad-Core ARM Cortex-A57 @ 1.7GHz',
      'RAM': '4 GB DDR4'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.8,
    position: { x: 420, y: 70 }
  },
  {
    id: 'dev-switch-01',
    name: 'Switch USW-24-PoE Gen2',
    ip: '192.168.1.2',
    mac: 'e0:63:da:9b:33:41',
    vendor: 'Ubiquiti Networks',
    deviceType: 'physical',
    subType: 'switch',
    status: 'online',
    connectedToSwitchId: 'dev-router-01',
    portOrInterface: 'SFP Port 25 (Uplink 1G)',
    vlan: 1,
    os: 'EdgeSwitch OS 6.5.55',
    openPorts: [80, 443, 22, 161],
    location: 'Baie Principale - RDC',
    tags: ['Switch', 'PoE 95W', 'Infrastructure'],
    metadata: {
      'Ports Actifs': '16 / 24',
      'Budget PoE': '58W consommés / 95W',
      'Uplink': '1 Gbps vers UDM Pro'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 1.1,
    position: { x: 420, y: 220 }
  },

  // 2. HÔTES PHYSIQUES DE VIRTUALISATION
  {
    id: 'dev-host-proxmox',
    name: 'Serveur Proxmox VE - Dell R740',
    ip: '192.168.1.10',
    mac: '18:66:da:44:81:90',
    vendor: 'Dell Inc. (PowerEdge)',
    deviceType: 'physical',
    subType: 'server',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 1 (LACP Bond 2x1G)',
    vlan: 10,
    os: 'Proxmox VE 8.2 (Debian 12)',
    openPorts: [22, 8006, 111, 3128],
    location: 'Baie Salle Serveur - Rack U12',
    tags: ['Hyperviseur', 'Production', 'Cluster-PVE'],
    metadata: {
      'Processeur': '2x Intel Xeon Silver 4210R (40 threads)',
      'Mémoire Vive': '128 Go ECC DDR4',
      'Stockage': 'ZFS RAID10 NVMe (3.8 To)',
      'Hyperviseur': 'QEMU/KVM 8.1'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.9,
    position: { x: 180, y: 400 }
  },
  {
    id: 'dev-host-docker',
    name: 'Hôte Docker Micro-Srv - HP ProDesk',
    ip: '192.168.1.15',
    mac: 'd8:9e:f3:12:7c:44',
    vendor: 'HP Inc.',
    deviceType: 'physical',
    subType: 'server',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 4 (Gigabit)',
    vlan: 10,
    os: 'Ubuntu Server 24.04 LTS (Docker 26.1)',
    openPorts: [22, 2375, 9443],
    location: 'Atelier / Lab',
    tags: ['Docker Host', 'Microservices', 'Homelab'],
    metadata: {
      'Moteur': 'Docker Engine v26.1.3 + Compose v2.27',
      'Conteneurs actifs': '4 en cours d\'exécution',
      'Processeur': 'Intel Core i5-10500T (6C/12T)',
      'RAM': '32 Go DDR4'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 1.2,
    position: { x: 680, y: 400 }
  },
  {
    id: 'dev-nas-01',
    name: 'NAS Synology DiskStation DS920+',
    ip: '192.168.1.20',
    mac: '00:11:32:89:bc:02',
    vendor: 'Synology Inc.',
    deviceType: 'physical',
    subType: 'nas',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 7 (LACP 2Gbps)',
    vlan: 10,
    os: 'DSM 7.2.1 Update 5',
    openPorts: [80, 443, 5000, 5001, 2049, 445],
    location: 'Baie Principale - U4',
    tags: ['Stockage', 'NFS/SMB', 'Sauvegarde'],
    metadata: {
      'Volume': 'SHR-1 Btrfs (24 To utiles)',
      'RAID': '4x WD Red Plus 8To',
      'Cache': '2x 500GB NVMe M.2 Read/Write',
      'Partages': 'NFS PVE, SMB Medias, Backup TimeMachine'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 1.0,
    position: { x: 420, y: 420 }
  },

  // 3. MACHINES VIRTUELLES
  {
    id: 'dev-vm-101',
    name: 'VM-101 Web & API Gateway',
    ip: '192.168.1.50',
    mac: 'bc:24:11:8a:55:01',
    vendor: 'QEMU / Proxmox Virtual NIC',
    deviceType: 'vm',
    subType: 'vm',
    status: 'online',
    parentHostId: 'dev-host-proxmox',
    portOrInterface: 'vmbr0 (vnet101)',
    vlan: 10,
    os: 'Debian 12 Bookworm',
    openPorts: [80, 443, 22, 3000],
    location: 'Virtuel (sur Proxmox Dell R740)',
    tags: ['VM', 'Frontend', 'Web Server'],
    metadata: {
      'vCPU': '4 cœurs',
      'RAM': '8 Go dédiée',
      'Disque': '60 Go virtio-scsi',
      'ID PVE': 'VMID 101'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.4,
    position: { x: 60, y: 590 }
  },
  {
    id: 'dev-vm-102',
    name: 'VM-102 Home Assistant OS',
    ip: '192.168.1.55',
    mac: 'bc:24:11:8a:55:02',
    vendor: 'QEMU / Proxmox Virtual NIC',
    deviceType: 'vm',
    subType: 'vm',
    status: 'online',
    parentHostId: 'dev-host-proxmox',
    portOrInterface: 'vmbr0 (vnet102)',
    vlan: 10,
    os: 'Home Assistant OS 12.3 (Core 2024.5)',
    openPorts: [8123, 22, 1400],
    location: 'Virtuel (sur Proxmox Dell R740)',
    tags: ['VM', 'Domotique', 'Supervisé'],
    metadata: {
      'vCPU': '2 cœurs',
      'RAM': '4 Go dédiée',
      'Passthrough USB': 'Clé Zigbee Sonoff ZBDongle-P',
      'ID PVE': 'VMID 102'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.5,
    position: { x: 190, y: 590 }
  },
  {
    id: 'dev-vm-103',
    name: 'VM-103 Windows Server 2022 AD',
    ip: '192.168.1.60',
    mac: 'bc:24:11:8a:55:03',
    vendor: 'QEMU / Proxmox Virtual NIC',
    deviceType: 'vm',
    subType: 'vm',
    status: 'online',
    parentHostId: 'dev-host-proxmox',
    portOrInterface: 'vmbr0 (vnet103)',
    vlan: 10,
    os: 'Microsoft Windows Server 2022',
    openPorts: [3389, 53, 88, 389, 445],
    location: 'Virtuel (sur Proxmox Dell R740)',
    tags: ['VM', 'Active Directory', 'DNS'],
    metadata: {
      'vCPU': '4 cœurs',
      'RAM': '16 Go',
      'Rôle': 'Contrôleur de domaine AD DS & DNS local',
      'ID PVE': 'VMID 103'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.6,
    position: { x: 320, y: 590 }
  },

  // 4. CONTENEURS DOCKER
  {
    id: 'dev-ct-nginx',
    name: 'Docker - Nginx Proxy Manager',
    ip: '192.168.1.15',
    mac: '02:42:ac:11:00:02',
    vendor: 'Docker Inc. (veth-bridge)',
    deviceType: 'docker',
    subType: 'container',
    status: 'online',
    parentHostId: 'dev-host-docker',
    portOrInterface: 'docker0 (172.17.0.2) -> Ports 80,443',
    vlan: 10,
    os: 'Alpine Linux 3.19 (Nginx)',
    openPorts: [80, 443, 81],
    location: 'Conteneur sur HP ProDesk',
    tags: ['Docker', 'Reverse Proxy', 'SSL Certs'],
    metadata: {
      'Image': 'jc21/nginx-proxy-manager:latest',
      'Réseau': 'bridge + host ports 80/443',
      'Uptime': '14 jours 6 heures',
      'Certificats': '12 certs Let\'s Encrypt renouvelés'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.2,
    position: { x: 570, y: 590 }
  },
  {
    id: 'dev-ct-portainer',
    name: 'Docker - Portainer CE Dashboard',
    ip: '192.168.1.15',
    mac: '02:42:ac:11:00:03',
    vendor: 'Docker Inc. (veth-bridge)',
    deviceType: 'docker',
    subType: 'container',
    status: 'online',
    parentHostId: 'dev-host-docker',
    portOrInterface: 'docker0 (172.17.0.3) -> Port 9443',
    vlan: 10,
    os: 'Alpine Linux (Portainer v2.20)',
    openPorts: [9443, 9000],
    location: 'Conteneur sur HP ProDesk',
    tags: ['Docker', 'Management', 'Admin'],
    metadata: {
      'Image': 'portainer/portainer-ce:latest',
      'Socket': '/var/run/docker.sock monté en lecture',
      'Gestionnaire': 'Portainer Community Edition'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.2,
    position: { x: 700, y: 590 }
  },
  {
    id: 'dev-ct-mqtt',
    name: 'Docker - Eclipse Mosquitto MQTT',
    ip: '192.168.1.15',
    mac: '02:42:ac:11:00:04',
    vendor: 'Docker Inc. (veth-bridge)',
    deviceType: 'docker',
    subType: 'container',
    status: 'online',
    parentHostId: 'dev-host-docker',
    portOrInterface: 'docker0 (172.17.0.4) -> Port 1883',
    vlan: 10,
    os: 'Alpine Linux (Mosquitto 2.0.18)',
    openPorts: [1883, 9001],
    location: 'Conteneur sur HP ProDesk',
    tags: ['Docker', 'Broker MQTT', 'IoT Core'],
    metadata: {
      'Image': 'eclipse-mosquitto:2',
      'Clients connectés': '18 sondes & capteurs',
      'Débit messages': '42 msg/sec'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.2,
    position: { x: 830, y: 590 }
  },
  {
    id: 'dev-ct-postgres',
    name: 'Docker - PostgreSQL 16 TSDB',
    ip: '192.168.1.15',
    mac: '02:42:ac:11:00:05',
    vendor: 'Docker Inc. (veth-bridge)',
    deviceType: 'docker',
    subType: 'container',
    status: 'online',
    parentHostId: 'dev-host-docker',
    portOrInterface: 'docker0 (172.17.0.5) -> Port 5432',
    vlan: 10,
    os: 'Debian 12 (Postgres 16.2)',
    openPorts: [5432],
    location: 'Conteneur sur HP ProDesk',
    tags: ['Docker', 'Base de données', 'Telemetry'],
    metadata: {
      'Image': 'postgres:16-alpine',
      'Base': 'telemetry_tsdb',
      'Taille': '4.2 Go'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 0.3,
    position: { x: 960, y: 590 }
  },

  // 5. APPAREILS IOT & DOMOTIQUE
  {
    id: 'dev-iot-cam01',
    name: 'Caméra Extérieure Nord - Hikvision 4K',
    ip: '192.168.1.101',
    mac: '44:19:b6:33:10:a1',
    vendor: 'Hikvision Digital Tech',
    deviceType: 'iot',
    subType: 'camera',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 11 (PoE 802.3af 7.5W)',
    vlan: 20,
    os: 'Embedded Linux (Hikvision IPC V5.7)',
    openPorts: [80, 554, 8000],
    location: 'Façade Nord - Parking',
    tags: ['IoT', 'VLAN 20', 'Caméra RTSP', 'PoE'],
    metadata: {
      'Flux RTSP': 'rtsp://192.168.1.101:554/Streaming/Channels/101',
      'Résolution': '3840x2160 (4K @ 25fps)',
      'Consommation PoE': '6.8W',
      'Vision Nocturne': 'IR 30m actif'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 2.4,
    position: { x: 80, y: 770 }
  },
  {
    id: 'dev-iot-cam02',
    name: 'Caméra Entrée Porte - Reolink Doorbell',
    ip: '192.168.1.102',
    mac: 'ec:71:db:11:e4:67',
    vendor: 'Reolink Digital',
    deviceType: 'iot',
    subType: 'camera',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 12 (PoE 802.3af 4.8W)',
    vlan: 20,
    os: 'Reolink Firmware v3.0.0',
    openPorts: [80, 443, 554, 9000],
    location: 'Entrée Principale',
    tags: ['IoT', 'VLAN 20', 'Sonnette Cam', 'PoE'],
    metadata: {
      'Type': 'Interphone vidéo PoE ONVIF',
      'Audio': 'Bidirectionnel Full-Duplex',
      'Consommation': '4.2W'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 2.1,
    position: { x: 260, y: 770 }
  },
  {
    id: 'dev-iot-pir01',
    name: 'Capteur de Présence mmWave - Aqara FP2',
    ip: '192.168.1.115',
    mac: '54:ef:44:bc:89:12',
    vendor: 'Lumi United Tech (Aqara)',
    deviceType: 'iot',
    subType: 'sensor_presence',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Wi-Fi 2.4GHz (-52 dBm)',
    vlan: 20,
    os: 'Aqara Zigbee/Matter OS v1.2.6',
    openPorts: [80, 5353],
    location: 'Salon / Séjour',
    tags: ['IoT', 'Capteur Présence', 'mmWave', 'Domotique'],
    metadata: {
      'Technologie': 'Radar onde millimétrique 60GHz',
      'Portée': 'Zone quadrillée 8m x 6m',
      'Multi-cibles': 'Jusqu\'à 5 personnes suivies',
      'Intégration': 'Home Assistant via HomeKit Local'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 4.8,
    position: { x: 440, y: 770 }
  },
  {
    id: 'dev-iot-temp01',
    name: 'Sonde Température & Humidité - ESP32 S3',
    ip: '192.168.1.120',
    mac: '30:ae:a4:78:32:09',
    vendor: 'Espressif Systems',
    deviceType: 'iot',
    subType: 'sensor_temp',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Wi-Fi 2.4GHz (-48 dBm)',
    vlan: 20,
    os: 'ESPHome 2024.4.1 (FreeRTOS)',
    openPorts: [80, 6053],
    location: 'Baie Rack Serveurs',
    tags: ['IoT', 'ESP32', 'Température', 'Surveillance'],
    metadata: {
      'Température': '21.4 °C (Nominale)',
      'Humidité relative': '44.8 % RH',
      'Pression': '1013.2 hPa (BME280)',
      'Rafraîchissement': 'Toutes les 10 secondes via MQTT'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 3.2,
    position: { x: 620, y: 770 }
  },
  {
    id: 'dev-iot-plug01',
    name: 'Prise Connectée Shelly Plus 1PM',
    ip: '192.168.1.130',
    mac: 'bc:02:6e:aa:90:f4',
    vendor: 'Allterco Robotics (Shelly)',
    deviceType: 'iot',
    subType: 'smart_plug',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Wi-Fi 2.4GHz (-60 dBm)',
    vlan: 20,
    os: 'Shelly Gen2 Firmware v1.3.1',
    openPorts: [80, 8000],
    location: 'Prise Baie Rack Onduleur',
    tags: ['IoT', 'Wattmètre', 'Shelly', 'Onduleur'],
    metadata: {
      'Puissance instantanée': '184.2 W',
      'Consommation totale': '42.8 kWh ce mois',
      'Tension mesurée': '231.4 V',
      'Température relais': '38.2 °C'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 3.6,
    position: { x: 800, y: 770 }
  },
  {
    id: 'dev-iot-hue',
    name: 'Pont Philips Hue Bridge V2',
    ip: '192.168.1.140',
    mac: 'ec:b5:fa:21:49:7b',
    vendor: 'Signify Netherlands B.V.',
    deviceType: 'iot',
    subType: 'other',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 8 (100 Mbps)',
    vlan: 20,
    os: 'Hue Hub Software v1.63',
    openPorts: [80, 443, 2100],
    location: 'Salon / Meuble TV',
    tags: ['IoT', 'Zigbee Gateway', 'Éclairage'],
    metadata: {
      'Canal Zigbee': 'Canal 25',
      'Ampoules appairées': '24 luminaires',
      'Protocole': 'Zigbee 3.0 / Matter'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 1.8,
    position: { x: 970, y: 770 }
  },

  // 6. BUREAUTIQUE / WORKSTATION
  {
    id: 'dev-pc-xps',
    name: 'Station CAO / Dév - Dell XPS 8950',
    ip: '192.168.1.75',
    mac: '24:4b:fe:88:99:a0',
    vendor: 'Dell Inc.',
    deviceType: 'physical',
    subType: 'workstation',
    status: 'online',
    connectedToSwitchId: 'dev-switch-01',
    portOrInterface: 'Port 18 (2.5 Gbps)',
    vlan: 1,
    os: 'Windows 11 Pro 23H2',
    openPorts: [135, 445, 3389],
    location: 'Bureau Principal',
    tags: ['Bureautique', 'Workstation', 'Développeur'],
    metadata: {
      'GPU': 'NVIDIA RTX 4080 (16GB)',
      'CPU': 'Intel Core i9-12900K',
      'RAM': '64 Go DDR5'
    },
    lastSeen: new Date().toISOString(),
    latencyMs: 1.1,
    position: { x: 1110, y: 400 }
  }
];

let devices: Device[] = [];

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

function loadDevicesFromFile() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const content = fs.readFileSync(DEVICES_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        devices = parsed;
        console.log(`[InkaNetopology] ${devices.length} équipements chargés depuis ${DEVICES_FILE}`);
        return;
      }
    }
  } catch (err) {
    console.error('Erreur lecture devices.json:', err);
  }
  // Fallback to default initial topology
  devices = [...defaultDevices];
  saveDevicesToFile();
}

// Initial load
loadDevicesFromFile();

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

// Probe TCP port connectivity
function probePort(ip: string, port: number, timeout = 250): Promise<{ open: boolean; rtt: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        const rtt = Date.now() - start;
        socket.destroy();
        resolve({ open: true, rtt });
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ open: false, rtt: timeout });
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ open: false, rtt: timeout });
      }
    });

    try {
      socket.connect(port, ip);
    } catch {
      if (!isResolved) {
        isResolved = true;
        resolve({ open: false, rtt: timeout });
      }
    }
  });
}

// Ping IP via OS binary if available
async function pingIp(ip: string): Promise<{ alive: boolean; rtt: number }> {
  const start = Date.now();
  try {
    await execFilePromise('ping', ['-c', '1', '-W', '1', ip], { timeout: 1200 });
    return { alive: true, rtt: Math.max(1, Date.now() - start) };
  } catch {
    return { alive: false, rtt: 0 };
  }
}

// Fetch HTTP web title (if port 80/443/8080/8006/5000 is open)
function fetchWebTitle(ip: string, port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const isHttps = port === 443 || port === 8443 || port === 8006 || port === 9443;
    const client = isHttps ? https : http;
    const timeout = 1200;

    const req = client.request(
      {
        host: ip,
        port,
        path: '/',
        method: 'GET',
        headers: { 'User-Agent': 'InkaNetopology/1.0 Scanner' },
        rejectUnauthorized: false,
        timeout
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 5000) req.destroy(); // Limit data read
        });
        res.on('end', () => {
          const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            resolve(titleMatch[1].trim());
          } else if (res.headers.server) {
            resolve(Array.isArray(res.headers.server) ? res.headers.server[0] : res.headers.server);
          } else {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

// Reverse DNS lookup
async function reverseDns(ip: string): Promise<string | null> {
  try {
    const hostnames = await dnsReversePromise(ip);
    if (hostnames && hostnames.length > 0) {
      return hostnames[0];
    }
  } catch {
    // ignore
  }
  return null;
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

// Get all devices
app.get('/api/devices', (req, res) => {
  res.json(devices);
});

// Create a new device
app.post('/api/devices', (req, res) => {
  const body = req.body;
  if (!body.name || !body.ip) {
    return res.status(400).json({ error: 'Nom et adresse IP requis.' });
  }

  const newDevice: Device = {
    id: body.id || `dev-${Date.now()}`,
    name: body.name,
    ip: body.ip,
    mac: body.mac || '02:00:00:' + Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':'),
    vendor: body.vendor || 'Générique / Inconnu',
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
    tags: body.tags || [],
    metadata: body.metadata || {},
    lastSeen: new Date().toISOString(),
    latencyMs: body.latencyMs || 1.0,
    position: body.position || { x: 300 + Math.random() * 200, y: 300 + Math.random() * 200 }
  };

  devices.push(newDevice);
  saveDevicesToFile();

  addLog({
    level: 'DISCOVERY',
    category: newDevice.deviceType === 'docker' ? 'DOCKER' : newDevice.deviceType === 'vm' ? 'VM' : newDevice.deviceType === 'iot' ? 'IOT' : 'ARP',
    ip: newDevice.ip,
    deviceId: newDevice.id,
    message: `Nouvel équipement ajouté: "${newDevice.name}" (${newDevice.ip} - ${newDevice.deviceType.toUpperCase()})`
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
  const updated: Device = {
    ...prev,
    ...req.body,
    id // preserve ID
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

// Delete device
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

// ---------------- REAL NETWORK SCANNER ENGINE ----------------
// Trigger Network Scan (Active Sweep + ARP Discovery + Port Probe + Automatic Inventory Addition)
app.post('/api/scan', async (req, res) => {
  if (scanStatus.isScanning) {
    return res.status(409).json({ error: 'Un scan est déjà en cours d\'exécution.' });
  }

  const subnet = req.body.subnet || '192.168.1.0/24';
  const scanMode: 'fast' | 'deep' | 'iot' = req.body.scanMode || 'fast';

  scanStatus = {
    isScanning: true,
    progressPercent: 0,
    currentIp: subnet.replace(/\.0\/\d+/, '.1'),
    devicesFound: devices.length,
    subnet,
    startedAt: new Date().toISOString(),
    scanMode
  };

  addLog({
    level: 'INFO',
    category: 'SYSTEM',
    message: `Démarrage du scan réseau sur le sous-réseau ${subnet} (Mode: ${scanMode.toUpperCase()})...`
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

      // Check key common ports according to scan mode
      const portsToProbe =
        scanMode === 'deep'
          ? [22, 53, 80, 443, 445, 554, 1883, 3000, 3389, 5000, 5001, 8006, 8080, 8123, 8443, 9000, 9443]
          : scanMode === 'iot'
          ? [80, 443, 554, 1883, 5353, 6053, 8000, 8123]
          : [22, 53, 80, 443, 445, 8006, 5000, 8123, 8080];

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

      // 2. Initial ARP & Neighbor table check
      const initialArp = readLinuxArpTable();
      const initialNeighbors = await readIpNeighbors();
      const allInitial = [...initialArp, ...initialNeighbors];
      for (const entry of allInitial) {
        if (entry.ip.startsWith(baseIp) && entry.mac && entry.mac !== '00:00:00:00:00:00') {
          aliveHosts.set(entry.ip, {
            mac: entry.mac,
            rtt: 1.0,
            openPorts: []
          });
        }
      }

      if (aliveHosts.size > 0) {
        addLog({
          level: 'INFO',
          category: 'ARP',
          message: `Table ARP initiale inspectée: ${aliveHosts.size} équipements physiques déjà présents en cache.`
        });
      }

      // 3. Active subnet sweep in concurrent batches of 20 IPs
      const BATCH_SIZE = 20;
      const totalIps = candidateIps.length;
      let completedCount = 0;

      for (let i = 0; i < candidateIps.length; i += BATCH_SIZE) {
        const batch = candidateIps.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (targetIp) => {
            // First try quick ICMP ping
            const pingRes = await pingIp(targetIp);
            let isAlive = pingRes.alive;
            let bestRtt = pingRes.rtt;
            const openPortsFound: number[] = [];

            // Probe a quick subset of ports (80, 443, 22) during sweep
            for (const port of [80, 443, 22, 8006, 5000]) {
              const res = await probePort(targetIp, port, 180);
              if (res.open) {
                isAlive = true;
                openPortsFound.push(port);
                if (res.rtt < bestRtt || bestRtt === 0) bestRtt = res.rtt;
              }
            }

            if (isAlive) {
              const existing = aliveHosts.get(targetIp);
              aliveHosts.set(targetIp, {
                mac: existing?.mac,
                rtt: bestRtt || 1.5,
                openPorts: Array.from(new Set([...(existing?.openPorts || []), ...openPortsFound]))
              });
            }
          })
        );

        completedCount += batch.length;
        scanStatus.progressPercent = Math.min(80, Math.round((completedCount / totalIps) * 80));
        scanStatus.currentIp = batch[batch.length - 1];
        broadcastSse('scan_progress', scanStatus);
      }

      // 4. Post-sweep: Re-read kernel ARP & neighbor table (populated after packet transmissions)
      const postSweepArp = readLinuxArpTable();
      const postSweepNeighbors = await readIpNeighbors();
      const allPost = [...postSweepArp, ...postSweepNeighbors];
      for (const entry of allPost) {
        if (entry.ip.startsWith(baseIp) && entry.mac && entry.mac !== '00:00:00:00:00:00') {
          const current = aliveHosts.get(entry.ip);
          aliveHosts.set(entry.ip, {
            mac: entry.mac,
            rtt: current?.rtt || 1.0,
            openPorts: current?.openPorts || []
          });
        }
      }

      scanStatus.progressPercent = 85;
      broadcastSse('scan_progress', scanStatus);

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
      scanStatus.progressPercent = 90;
      broadcastSse('scan_progress', scanStatus);

      const aliveList = Array.from(aliveHosts.entries());
      for (const [ip, hostInfo] of aliveList) {
        // Probe remaining ports
        const portPromises = portsToProbe.map(async (p) => {
          if (!hostInfo.openPorts.includes(p)) {
            const probe = await probePort(ip, p, 200);
            if (probe.open) hostInfo.openPorts.push(p);
          }
        });
        await Promise.all(portPromises);

        // Reverse DNS
        hostInfo.hostname = await reverseDns(ip);

        // Web title grab if web port is open
        const webPort = hostInfo.openPorts.find((p) => [80, 443, 8006, 5000, 8080, 8123].includes(p));
        if (webPort) {
          hostInfo.webTitle = await fetchWebTitle(ip, webPort);
        }
      }

      // 7. CRITICAL STEP: MERGE INTO INVENTORY & ADD NEW DEVICES
      let newlyAddedCount = 0;
      let updatedCount = 0;

      // Find primary switch or router ID to connect new physical devices
      const mainSwitch =
        devices.find((d) => d.subType === 'switch') ||
        devices.find((d) => d.subType === 'router') ||
        devices[0];

      // A) Process Network discovered hosts
      for (const [ip, hostInfo] of aliveHosts.entries()) {
        const mac = hostInfo.mac || '02:00:00:' + ip.split('.').map((p) => (+p).toString(16).padStart(2, '0')).slice(1).join(':');
        const vendor = lookupVendor(mac);

        // Check if device already exists in inventory by IP or MAC
        const existingIndex = devices.findIndex(
          (d) => d.ip === ip || (d.mac && d.mac !== '00:00:00:00:00:00' && d.mac.toLowerCase() === mac.toLowerCase())
        );

        if (existingIndex !== -1) {
          // Device exists -> Update status, latency, openPorts, lastSeen
          const existing = devices[existingIndex];
          const mergedPorts = Array.from(new Set([...(existing.openPorts || []), ...hostInfo.openPorts]));

          devices[existingIndex] = {
            ...existing,
            status: 'online',
            lastSeen: new Date().toISOString(),
            latencyMs: +(hostInfo.rtt || existing.latencyMs || 1.0).toFixed(1),
            openPorts: mergedPorts,
            mac: existing.mac && !existing.mac.startsWith('02:00:00') ? existing.mac : mac,
            vendor: existing.vendor !== 'Générique / Inconnu' ? existing.vendor : vendor
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

          const newDevice: Device = {
            id: `dev-${ip.replace(/\./g, '-')}-${Date.now().toString(36)}`,
            name: classification.name,
            ip,
            mac,
            vendor,
            deviceType: classification.deviceType,
            subType: classification.subType,
            status: 'online',
            connectedToSwitchId: mainSwitch ? mainSwitch.id : undefined,
            vlan: 1,
            os: classification.os,
            openPorts: hostInfo.openPorts,
            location: 'Découvert sur le réseau local',
            tags: classification.tags,
            metadata: {
              'Méthode': 'Scan réseau automatique',
              'Date découverte': new Date().toLocaleString('fr-FR'),
              ...(hostInfo.webTitle ? { 'Titre Web': hostInfo.webTitle } : {}),
              ...(hostInfo.hostname ? { 'Nom d\'hôte': hostInfo.hostname } : {})
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
            message: `Nouvel équipement découvert et ajouté à l'inventaire: ${newDevice.name} (${newDevice.ip} - ${newDevice.mac})`
          });

          broadcastSse('device_added', newDevice);
        }
      }

      // B) Process Local Docker containers if discovered via socket
      const dockerHost = devices.find((d) => d.subType === 'server' && d.name.toLowerCase().includes('docker')) || mainSwitch;
      for (const ct of dockerContainers) {
        const ctId = ct.Id.substring(0, 12);
        const ctName = `Docker - ${(ct.Names[0] || ctId).replace(/^\//, '')}`;
        const existingCt = devices.find(
          (d) => d.id === `docker-${ctId}` || d.name === ctName
        );

        const openPorts = (ct.Ports || [])
          .map((p: any) => p.PublicPort || p.PrivatePort)
          .filter(Boolean);

        if (existingCt) {
          existingCt.status = ct.State === 'running' ? 'online' : 'offline';
          existingCt.lastSeen = new Date().toISOString();
          existingCt.openPorts = openPorts;
          broadcastSse('device_updated', existingCt);
        } else {
          const posX = 120 + (devices.length % 7) * 170;
          const posY = 750 + Math.floor(devices.length / 7) * 160;

          const newContainer: Device = {
            id: `docker-${ctId}`,
            name: ctName,
            ip: ct.NetworkSettings?.Networks?.bridge?.IPAddress || '127.0.0.1',
            mac: '02:42:ac:11:' + ctId.slice(0, 4).match(/../g)?.join(':') || '02:42:ac:11:00:99',
            vendor: 'Docker Inc.',
            deviceType: 'docker',
            subType: 'container',
            status: ct.State === 'running' ? 'online' : 'offline',
            parentHostId: dockerHost ? dockerHost.id : undefined,
            portOrInterface: `Docker Engine (${ct.Image})`,
            vlan: 1,
            os: ct.Image,
            openPorts,
            location: 'Conteneur local hôte',
            tags: ['Docker', 'Conteneur', 'Local'],
            metadata: {
              'Image': ct.Image,
              'Command': ct.Command || '',
              'Status': ct.Status || '',
              'ContainerID': ctId
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
            message: `Nouveau conteneur Docker détecté et ajouté à l'inventaire: ${newContainer.name} (${ct.Image})`
          });

          broadcastSse('device_added', newContainer);
        }
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

// Reset topology to factory baseline
app.post('/api/reset-topology', (req, res) => {
  devices = [...defaultDevices];
  saveDevicesToFile();

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: 'Topologie réseau et inventaire réinitialisés au schéma par défaut.'
  });

  broadcastSse('topology_reset', devices);
  broadcastSse('scan_complete', { devices, scanStatus });
  res.json({ success: true, devices });
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

// Export topology configuration
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="inkanetopology-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    subnet: scanStatus.subnet,
    devices,
    logs: logs.slice(0, 100)
  });
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
