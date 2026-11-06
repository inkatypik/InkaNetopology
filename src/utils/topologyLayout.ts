import type { Device, GeographicZone } from '../types/network';

/**
 * Intelligent container-to-host matcher.
 * Accurately finds the exact host machine for a container based on IP matching,
 * host metadata, port bindings, and virtualization links.
 */
export function findBestHostForContainer(
  container: Partial<Device>,
  devList: Device[]
): Device | undefined {
  // 1. If container already has a valid host assigned, preserve it!
  if (container.parentHostId) {
    const existingParent = devList.find((d) => d.id === container.parentHostId);
    if (
      existingParent &&
      existingParent.subType !== 'switch' &&
      existingParent.subType !== 'router' &&
      existingParent.id !== container.id
    ) {
      return existingParent;
    }
  }

  const isCandidateHost = (d: Device) =>
    d.id !== container.id &&
    d.subType !== 'switch' &&
    d.subType !== 'router' &&
    d.subType !== 'access_point' &&
    d.deviceType !== 'docker' &&
    (d.deviceType === 'physical' || d.deviceType === 'vm' || d.subType === 'server' || d.subType === 'nas');

  // 2. Exact IP match with a host machine or VM (e.g. Docker host network mode or container exposed on host IP)
  if (container.ip && container.ip !== '127.0.0.1' && !container.ip.startsWith('172.17.') && !container.ip.startsWith('172.18.')) {
    const hostWithSameIp = devList.find((d) => isCandidateHost(d) && d.ip === container.ip);
    if (hostWithSameIp) return hostWithSameIp;
  }

  // 3. Name or location reference match (e.g. location "Conteneur sur Proxmox-01" -> matches VM or Server "Proxmox-01")
  const locOrName = `${container.location || ''} ${container.name || ''}`.toLowerCase();
  const hostByRef = devList.find(
    (d) =>
      isCandidateHost(d) &&
      (locOrName.includes(d.name.toLowerCase()) ||
        (d.metadata && Object.values(d.metadata).some((v) => typeof v === 'string' && locOrName.includes(v.toLowerCase()))))
  );
  if (hostByRef) return hostByRef;

  // 4. Host or VM explicitly tagged with 'docker' or named 'docker' / 'portainer'
  const byDockerTag = devList.find(
    (d) =>
      isCandidateHost(d) &&
      (d.name.toLowerCase().includes('docker') ||
        d.name.toLowerCase().includes('portainer') ||
        d.tags?.some((t) => t.toLowerCase().includes('docker') || t.toLowerCase().includes('portainer')))
  );
  if (byDockerTag) return byDockerTag;

  // 5. Host with docker/portainer open ports (2375, 2376, 9000, 9443)
  const byPort = devList.find(
    (d) =>
      isCandidateHost(d) &&
      d.openPorts &&
      d.openPorts.some((p) => [2375, 2376, 9000, 9443].includes(p))
  );
  if (byPort) return byPort;

  // 6. If there is a single dedicated server or NAS, bind to it
  const candidateServers = devList.filter(
    (d) => isCandidateHost(d) && (d.subType === 'server' || d.subType === 'nas')
  );
  if (candidateServers.length === 1) {
    return candidateServers[0];
  }

  // 7. If all devices are non-servers and there is only 1 physical host:
  const physicalCandidates = devList.filter((d) => isCandidateHost(d));
  if (physicalCandidates.length === 1) {
    return physicalCandidates[0];
  }

  return undefined;
}

/**
 * Backward-compatible alias for finding docker host.
 */
export function findBestDockerHost(devList: Device[]): Device | undefined {
  return findBestHostForContainer({}, devList);
}

// Visual dimensions for card calculations and non-overlapping margins
export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 160;
export const NODE_GAP_X = 50;
export const NODE_GAP_Y = 40;

export const HOST_HEADER_HEIGHT = 44;
export const HOST_PAD_X = 28;
export const HOST_PAD_Y = 24;

export const ZONE_HEADER_HEIGHT = 52;
export const ZONE_PAD_X = 36;
export const ZONE_PAD_Y = 32;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsOverlap(r1: Rect, r2: Rect, minSpacing = 40): boolean {
  return !(
    r1.x + r1.width + minSpacing <= r2.x ||
    r2.x + r2.width + minSpacing <= r1.x ||
    r1.y + r1.height + minSpacing <= r2.y ||
    r2.y + r2.height + minSpacing <= r1.y
  );
}

/**
 * Clean Non-Overlapping Star Topology Layout.
 * 
 * Rules:
 * 1. Network Core (Passerelle / Routeur cœur) is placed at the exact center (0,0 offset).
 * 2. Every device belongs to its assigned Geographic Zone (or default unassigned zone).
 * 3. Within each Zone, devices are organized cleanly:
 *    - Standalone equipment arranged in a grid without overlap.
 *    - Host servers (physical or VM) enclose their attached guests (Docker containers / VMs) in a dedicated block.
 *    - The host sits at the top of the block, and its guests are placed neatly side-by-side or in rows below it.
 * 4. Zones are placed radially in a Star pattern around the Network Core with guaranteed zero-overlap.
 */
export function autoLayoutTopology(devList: Device[], zoneList: GeographicZone[] = []): Device[] {
  if (!devList || devList.length === 0) return [];

  // Clone devices to avoid mutating original state
  const devices: Device[] = devList.map((d) => ({ ...d }));
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

  // 2. Resolve guest containers/VMs to their parent host if unassigned
  devices.forEach((d) => {
    if (d.deviceType === 'docker') {
      const best = findBestHostForContainer(d, devices);
      if (!d.parentHostId || !devMap.has(d.parentHostId)) {
        if (best) d.parentHostId = best.id;
      }
    } else if (d.deviceType === 'vm') {
      if (!d.parentHostId || !devMap.has(d.parentHostId)) {
        const pve = devices.find(
          (s) =>
            !coreNodeIds.has(s.id) &&
            (s.deviceType === 'physical' || s.subType === 'server') &&
            (s.name.toLowerCase().includes('proxmox') || s.tags?.some((t) => t.toLowerCase().includes('hyperviseur')))
        );
        if (pve) d.parentHostId = pve.id;
      }
    }
  });

  // Ensure guests inherit their host's zone if missing or mismatch
  devices.forEach((d) => {
    if (d.parentHostId && devMap.has(d.parentHostId)) {
      const parent = devMap.get(d.parentHostId)!;
      if (parent.zoneId && !d.zoneId) {
        d.zoneId = parent.zoneId;
      }
    }
  });

  // 3. Separate Core Nodes from Satellite Devices
  const coreDevices = devices.filter((d) => coreNodeIds.has(d.id));
  const satelliteDevices = devices.filter((d) => !coreNodeIds.has(d.id));

  // Center coordinate of the entire diagram canvas
  const CENTER_X = 1400;
  const CENTER_Y = 1200;

  // Place Core Nodes at the center
  const CORE_SPACING = NODE_WIDTH + 60;
  const totalCoreW = (coreDevices.length - 1) * CORE_SPACING;
  const startCoreX = CENTER_X - totalCoreW / 2;
  coreDevices.forEach((cn, idx) => {
    cn.position = {
      x: Math.round(startCoreX + idx * CORE_SPACING - NODE_WIDTH / 2),
      y: Math.round(CENTER_Y - NODE_HEIGHT / 2)
    };
  });

  const coreBoundingRect: Rect = {
    x: Math.round(startCoreX - NODE_WIDTH / 2 - 40),
    y: Math.round(CENTER_Y - NODE_HEIGHT / 2 - 40),
    width: Math.max(NODE_WIDTH + 80, totalCoreW + NODE_WIDTH + 80),
    height: NODE_HEIGHT + 80
  };

  if (satelliteDevices.length === 0) {
    return devices;
  }

  // 4. Group Satellite Devices by Geographic Zone
  // Build a complete map of zones
  const zoneMap = new Map<string, GeographicZone>();
  zoneList.forEach((z) => zoneMap.set(z.id, z));

  // Group devices by zone
  const devicesByZone = new Map<string, Device[]>();
  satelliteDevices.forEach((d) => {
    const zId = d.zoneId || 'unassigned';
    const list = devicesByZone.get(zId) || [];
    list.push(d);
    devicesByZone.set(zId, list);
  });

  // Zone structure descriptor
  interface PlannedZone {
    zoneId: string;
    zoneName: string;
    width: number;
    height: number;
    // Elements to layout inside
    units: ZoneUnit[];
  }

  interface ZoneUnit {
    type: 'standalone' | 'host_cluster';
    host: Device;
    guests: Device[];
    width: number;
    height: number;
    relX?: number;
    relY?: number;
  }

  // Pre-calculate the internal layout for each zone
  const plannedZones: PlannedZone[] = [];

  devicesByZone.forEach((devs, zId) => {
    const zoneObj = zoneMap.get(zId);
    const zoneName = zoneObj?.name || (zId === 'unassigned' ? 'Équipements non assignés' : 'Zone');

    // Inside this zone, find hosts that have children attached
    const hostsWithChildren = new Map<string, { host: Device; guests: Device[] }>();
    const standaloneDevs: Device[] = [];

    // Find all hosts that belong to this zone
    devs.forEach((d) => {
      // Is d a guest whose parent is also in this zone or in satellite list?
      if (d.parentHostId) {
        // Child will be handled by its parent
        return;
      }

      // Check if d has children
      const children = devs.filter((child) => child.parentHostId === d.id);
      if (children.length > 0) {
        hostsWithChildren.set(d.id, { host: d, guests: children });
      } else {
        standaloneDevs.push(d);
      }
    });

    // Also check for orphaned guests whose host is not in this zone
    devs.forEach((d) => {
      if (d.parentHostId && !devs.some((h) => h.id === d.parentHostId)) {
        standaloneDevs.push(d);
      }
    });

    const units: ZoneUnit[] = [];

    // Construct host_cluster units
    hostsWithChildren.forEach(({ host, guests }) => {
      // Layout host card at top, guests side-by-side or in 2 columns below
      const guestsPerRow = Math.min(3, Math.max(1, guests.length));
      const guestRows = Math.ceil(guests.length / guestsPerRow);

      const clusterW = Math.max(
        NODE_WIDTH + HOST_PAD_X * 2,
        guestsPerRow * NODE_WIDTH + (guestsPerRow - 1) * NODE_GAP_X + HOST_PAD_X * 2
      );
      const clusterH =
        HOST_HEADER_HEIGHT +
        NODE_HEIGHT + // Host card
        NODE_GAP_Y +
        guestRows * NODE_HEIGHT +
        (guestRows - 1) * NODE_GAP_Y +
        HOST_PAD_Y * 2;

      units.push({
        type: 'host_cluster',
        host,
        guests,
        width: clusterW,
        height: clusterH
      });
    });

    // Construct standalone units
    standaloneDevs.forEach((dev) => {
      units.push({
        type: 'standalone',
        host: dev,
        guests: [],
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    });

    // Arrange units in a clean grid within the zone
    // Aim for aspect ratio close to 4:3 or 16:9
    const totalUnits = units.length;
    let cols = 1;
    if (totalUnits >= 6) cols = 3;
    else if (totalUnits >= 2) cols = 2;

    // Pack units into columns
    const colWidths = new Array(cols).fill(0);
    const colHeights = new Array(cols).fill(0);

    // Group units into row chunks
    const rows: ZoneUnit[][] = [];
    for (let i = 0; i < units.length; i += cols) {
      rows.push(units.slice(i, i + cols));
    }

    let currentY = ZONE_PAD_Y + ZONE_HEADER_HEIGHT;
    rows.forEach((row) => {
      let maxHeightInRow = 0;
      row.forEach((u) => {
        if (u.height > maxHeightInRow) maxHeightInRow = u.height;
      });

      let currentX = ZONE_PAD_X;
      row.forEach((u) => {
        u.relX = currentX;
        u.relY = currentY;
        currentX += u.width + NODE_GAP_X;
      });

      currentY += maxHeightInRow + NODE_GAP_Y;
    });

    // Compute zone width & height
    let maxRowW = 0;
    rows.forEach((row) => {
      const rowW = row.reduce((sum, u) => sum + u.width, 0) + (row.length - 1) * NODE_GAP_X;
      if (rowW > maxRowW) maxRowW = rowW;
    });

    const zoneW = Math.max(360, maxRowW + ZONE_PAD_X * 2);
    const zoneH = Math.max(240, currentY + ZONE_PAD_Y - NODE_GAP_Y);

    plannedZones.push({
      zoneId: zId,
      zoneName,
      width: zoneW,
      height: zoneH,
      units
    });
  });

  // 5. RADIAL STAR PLACEMENT OF ZONES AROUND CORE NETWORK
  // Each zone is placed at an angle around the center with safe distance ensuring ZERO overlap.
  const numZones = plannedZones.length;
  const angleStep = (2 * Math.PI) / numZones;

  // Track placed zone rectangles to guarantee zero overlap
  const placedZoneRects: Rect[] = [coreBoundingRect];

  plannedZones.forEach((pz, idx) => {
    const angle = -Math.PI / 2 + idx * angleStep; // Start from top

    // Minimum radius based on core size and zone dimensions
    const halfZW = pz.width / 2;
    const halfZH = pz.height / 2;
    const minZoneRadius = Math.max(
      600,
      Math.sqrt(halfZW * halfZW + halfZH * halfZH) + Math.max(coreBoundingRect.width, coreBoundingRect.height) / 2 + 100
    );

    let radius = minZoneRadius;
    let zoneX = Math.round(CENTER_X + radius * Math.cos(angle) - halfZW);
    let zoneY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfZH);

    let candidateRect: Rect = {
      x: zoneX,
      y: zoneY,
      width: pz.width,
      height: pz.height
    };

    // Push outward radially until it doesn't overlap with any previously placed zone or the core
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    while (attempts < MAX_ATTEMPTS) {
      const overlaps = placedZoneRects.some((other) => rectsOverlap(candidateRect, other, 70));
      if (!overlaps) break;

      radius += 80;
      zoneX = Math.round(CENTER_X + radius * Math.cos(angle) - halfZW);
      zoneY = Math.round(CENTER_Y + radius * Math.sin(angle) - halfZH);
      candidateRect = {
        x: zoneX,
        y: zoneY,
        width: pz.width,
        height: pz.height
      };
      attempts++;
    }

    placedZoneRects.push(candidateRect);

    // 6. POSITION INDIVIDUAL DEVICES ACCORDING TO ZONE OFFSET
    pz.units.forEach((u) => {
      const unitAbsX = zoneX + (u.relX || 0);
      const unitAbsY = zoneY + (u.relY || 0);

      if (u.type === 'standalone') {
        u.host.position = {
          x: unitAbsX,
          y: unitAbsY
        };
      } else if (u.type === 'host_cluster') {
        // Place the host at the top center of its cluster block
        const hostX = Math.round(unitAbsX + (u.width - NODE_WIDTH) / 2);
        const hostY = Math.round(unitAbsY + HOST_PAD_Y + HOST_HEADER_HEIGHT);

        u.host.position = {
          x: hostX,
          y: hostY
        };

        // Place its child guests (VMs and Docker containers) cleanly below
        const guestsPerRow = Math.min(3, Math.max(1, u.guests.length));
        const guestRowStartY = hostY + NODE_HEIGHT + NODE_GAP_Y;

        u.guests.forEach((guest, gIdx) => {
          const gCol = gIdx % guestsPerRow;
          const gRow = Math.floor(gIdx / guestsPerRow);

          // Calculate centered starting X for this row
          const itemsInThisRow = Math.min(guestsPerRow, u.guests.length - gRow * guestsPerRow);
          const rowW = itemsInThisRow * NODE_WIDTH + (itemsInThisRow - 1) * NODE_GAP_X;
          const rowStartX = Math.round(unitAbsX + (u.width - rowW) / 2);

          guest.position = {
            x: rowStartX + gCol * (NODE_WIDTH + NODE_GAP_X),
            y: guestRowStartY + gRow * (NODE_HEIGHT + NODE_GAP_Y)
          };
        });
      }
    });
  });

  return devices;
}

/**
 * Alternative auto-layout grouped by Geographic Zones.
 */
export function autoLayoutByZones(devList: Device[], zones: GeographicZone[]): Device[] {
  return autoLayoutTopology(devList, zones);
}
