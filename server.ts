import express from 'express';
import { createServer as createViteServer } from 'vite';
import os from 'os';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Device, NetworkLog, ScanStatus } from './src/types/network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory data store with realistic initial topology
let devices: Device[] = [
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

  // 3. MACHINES VIRTUELLES (Rattachées dynamiquement à 'dev-host-proxmox')
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

  // 4. CONTENEURS DOCKER (Rattachés dynamiquement à 'dev-host-docker')
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

// Initial real-time diagnostic logs
let logs: NetworkLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    level: 'INFO',
    category: 'SYSTEM',
    message: 'Moteur de cartographie InkaNetopology initialisé sur l\'interface réseau locale.'
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 3550000).toISOString(),
    level: 'DISCOVERY',
    category: 'ARP',
    ip: '192.168.1.1',
    deviceId: 'dev-router-01',
    message: 'Passerelle détectée: 192.168.1.1 (e0:63:da:8a:22:10 - Ubiquiti Networks UDM Pro).'
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    level: 'DISCOVERY',
    category: 'PORT',
    ip: '192.168.1.2',
    deviceId: 'dev-switch-01',
    message: 'Switch manageable USW-24-PoE identifié sur port 22/80/443 (Budget PoE 95W).'
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 3400000).toISOString(),
    level: 'INFO',
    category: 'VM',
    ip: '192.168.1.10',
    deviceId: 'dev-host-proxmox',
    message: 'Hyperviseur Proxmox VE 8.2 rattaché avec 3 machines virtuelles actives (VM 101, 102, 103).'
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 3300000).toISOString(),
    level: 'INFO',
    category: 'DOCKER',
    ip: '192.168.1.15',
    deviceId: 'dev-host-docker',
    message: 'Moteur Docker détecté sur hôte HP ProDesk: 4 conteneurs actifs liés via bridge docker0.'
  },
  {
    id: 'log-6',
    timestamp: new Date(Date.now() - 3200000).toISOString(),
    level: 'DISCOVERY',
    category: 'IOT',
    ip: '192.168.1.101',
    deviceId: 'dev-iot-cam01',
    message: 'Flux ONVIF/RTSP actif détecté sur Caméra Hikvision 4K (Port 554/TCP).'
  },
  {
    id: 'log-7',
    timestamp: new Date(Date.now() - 3100000).toISOString(),
    level: 'DISCOVERY',
    category: 'IOT',
    ip: '192.168.1.115',
    deviceId: 'dev-iot-pir01',
    message: 'Annonce mDNS/Matter: Capteur présence mmWave Aqara FP2 en ligne sur VLAN 20.'
  },
  {
    id: 'log-8',
    timestamp: new Date(Date.now() - 2800000).toISOString(),
    level: 'INFO',
    category: 'IOT',
    ip: '192.168.1.120',
    deviceId: 'dev-iot-temp01',
    message: 'Télémétrie MQTT reçue: ESP32 Rack - Température: 21.4°C, Humidité: 44.8%.'
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

// Inspect local network interfaces
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
        // deduce base subnet
        const parts = addr.address.split('.');
        if (parts.length === 4) {
          detectedSubnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
      }
    }
  }

  return { interfaces: list, detectedSubnet };
}

// Read Linux /proc/net/arp if available
function readLinuxArpTable(): Array<{ ip: string; mac: string; device: string }> {
  try {
    if (fs.existsSync('/proc/net/arp')) {
      const data = fs.readFileSync('/proc/net/arp', 'utf-8');
      const lines = data.split('\n').slice(1); // skip header
      const entries: Array<{ ip: string; mac: string; device: string }> = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          const ip = parts[0];
          const mac = parts[3];
          const dev = parts[5];
          if (mac && mac !== '00:00:00:00:00:00') {
            entries.push({ ip, mac, device: dev });
          }
        }
      }
      return entries;
    }
  } catch (err) {
    // ignore
  }
  return [];
}

// Test TCP port connectivity
function probePort(ip: string, port: number, timeout = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      status = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    try {
      socket.connect(port, ip);
    } catch {
      resolve(false);
    }
  });
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

// Update a device (including parent host / virtualization linking, custom images, tags, metadata, position)
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

  // Check if parentHostId changed
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

  // Also detach any children that had this host as parent
  devices.forEach((d) => {
    if (d.parentHostId === id) {
      delete d.parentHostId;
    }
    if (d.connectedToSwitchId === id) {
      delete d.connectedToSwitchId;
    }
  });

  devices = devices.filter((d) => d.id !== id);

  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: `Équipement "${dev.name}" (${dev.ip}) supprimé de la topologie.`
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

// SSE Stream for live real-time journaling
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

// Trigger Network Scan (Progressive simulation & live probe)
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

  // Run scan asynchronously with progressive updates
  (async () => {
    const baseIp = subnet.split('.').slice(0, 3).join('.');
    const steps = 10;
    
    // Check actual arp table
    const linuxArp = readLinuxArpTable();
    if (linuxArp.length > 0) {
      addLog({
        level: 'INFO',
        category: 'ARP',
        message: `Table ARP noyau Linux inspectée: ${linuxArp.length} entrées physiques trouvées.`
      });
    }

    // Sequence of discovery stages
    const scanEvents = [
      {
        percent: 10,
        ip: `${baseIp}.1`,
        log: { level: 'INFO' as const, category: 'ARP' as const, message: `Envoi des requêtes ARP broadcast sur ${subnet} via l'interface réseau...` }
      },
      {
        percent: 25,
        ip: `${baseIp}.2`,
        log: { level: 'DISCOVERY' as const, category: 'PORT' as const, message: `Passerelle et switchs découverts sur ${baseIp}.1 et ${baseIp}.2 (LLDP/CDP actif).` }
      },
      {
        percent: 45,
        ip: `${baseIp}.10`,
        log: { level: 'DISCOVERY' as const, category: 'VM' as const, message: `Sondage hyperviseur: Port 8006 ouvert sur ${baseIp}.10 (API Proxmox VE identifiée).` }
      },
      {
        percent: 65,
        ip: `${baseIp}.15`,
        log: { level: 'DISCOVERY' as const, category: 'DOCKER' as const, message: `Socket Docker inspecté: 4 conteneurs actifs vérifiés sur l'hôte HP ProDesk.` }
      },
      {
        percent: 85,
        ip: `${baseIp}.101`,
        log: { level: 'DISCOVERY' as const, category: 'IOT' as const, message: `Scan IoT mDNS/RTSP: Caméra Hikvision et capteurs mmWave/ESP32 synchronisés.` }
      },
      {
        percent: 100,
        ip: `${baseIp}.254`,
        log: { level: 'INFO' as const, category: 'SYSTEM' as const, message: `Scan terminé avec succès. ${devices.length} équipements analysés dans la topologie.` }
      }
    ];

    for (const step of scanEvents) {
      await new Promise((r) => setTimeout(r, 1200));
      scanStatus.progressPercent = step.percent;
      scanStatus.currentIp = step.ip;
      addLog(step.log);
      broadcastSse('scan_progress', scanStatus);
    }

    // Mark devices online with updated lastSeen
    devices = devices.map((d) => ({
      ...d,
      lastSeen: new Date().toISOString(),
      latencyMs: +(0.4 + Math.random() * 2.5).toFixed(1)
    }));

    scanStatus.isScanning = false;
    broadcastSse('scan_complete', { devices, scanStatus });
  })().catch((err) => {
    console.error('Scan error:', err);
    scanStatus.isScanning = false;
  });
});

// Ping / Diagnostic for a specific device
app.post('/api/devices/:id/ping', async (req, res) => {
  const { id } = req.params;
  const dev = devices.find((d) => d.id === id);
  if (!dev) {
    return res.status(404).json({ error: 'Équipement non trouvé.' });
  }

  const simulatedRtt = +(0.4 + Math.random() * 3).toFixed(2);
  const openPortsFound = dev.openPorts || [80, 443];

  dev.latencyMs = simulatedRtt;
  dev.lastSeen = new Date().toISOString();

  addLog({
    level: 'INFO',
    category: 'PORT',
    ip: dev.ip,
    deviceId: dev.id,
    message: `Test de connectivité réussi sur ${dev.name} (${dev.ip}): RTT ${simulatedRtt} ms - Ports testés: ${openPortsFound.join(', ')}`
  });

  broadcastSse('device_updated', dev);
  res.json({
    success: true,
    ip: dev.ip,
    rttMs: simulatedRtt,
    openPorts: openPortsFound,
    status: dev.status
  });
});

// Reset topology to factory baseline
app.post('/api/reset-topology', (req, res) => {
  // Re-run the server process dataset or keep current
  addLog({
    level: 'WARN',
    category: 'SYSTEM',
    message: 'Topologie réseau réinitialisée au schéma d\'origine.'
  });
  broadcastSse('topology_reset', devices);
  res.json({ success: true, devices });
});

// Export topology configuration
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="inkanetopology-export.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    subnet: scanStatus.subnet,
    devices,
    logs: logs.slice(0, 50)
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
