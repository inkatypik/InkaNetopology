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
// Real card rendered size: w-64 (256px) + borders/ring/padding = ~268px
// Real card rendered height: Header + Name + IP + Status + Vendor + Link + Role + Tags = 190-230px
export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 220;
export const NODE_GAP_X = 60;
export const NODE_GAP_Y = 50;

export const HOST_HEADER_HEIGHT = 48;
export const HOST_PAD_X = 36;
export const HOST_PAD_Y = 32;

export const ZONE_HEADER_HEIGHT = 52;
export const ZONE_PAD_X = 40;
export const ZONE_PAD_Y = 36;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsOverlap(r1: Rect, r2: Rect, minSpacing = 50): boolean {
  return !(
    r1.x + r1.width + minSpacing <= r2.x ||
    r2.x + r2.width + minSpacing <= r1.x ||
    r1.y + r1.height + minSpacing <= r2.y ||
    r2.y + r2.height + minSpacing <= r1.y
  );
}

// Unit representing either a standalone equipment, or a host with all its guests (VMs and containers)
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

/**
 * Clean Non-Overlapping Star Topology Layout.
 * 
 * Rules:
 * 1. Network Core (Passerelle / Routeur cœur) is placed at the exact 2D center (CENTER_X, CENTER_Y).
 * 2. Surrounding entities radiate symmetrically in all 4 quadrants (top, bottom, left, right).
 * 3. Every host cleanly encloses all its VMs and containers with guaranteed zero overlap.
 *    - If a VM has Docker containers, those containers are placed neatly beneath that VM.
 *    - All rows and columns have generous clearance so cards never touch or superimpose.
 * 4. Folding/unfolding preserves pre-allocated spatial reservations so expanding never collides.
 */
export function autoLayoutTopology(devList: Device[], zoneList: GeographicZone[] = []): Device[] {
  if (!devList || devList.length === 0) return [];

  // Clone devices to avoid mutating original state directly
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
    if (d.parentHostId && devMap.has(d.parentHostId)) {
      const parentZone = resolveZoneId(d);
      if (parentZone) {
        d.zoneId = parentZone;
      }
    }
  });

  // 3. Separate Core Nodes from Satellite Devices
  const coreDevices = devices.filter((d) => coreNodeIds.has(d.id));
  const satelliteDevices = devices.filter((d) => !coreNodeIds.has(d.id));

  // Geometric center of the topology canvas
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
  // A layout unit is either:
  // - A standalone equipment
  // - A Host Cluster (Physical server or standalone host with all its VMs and Docker containers structured cleanly)
  function buildLayoutUnits(devs: Device[]): LayoutUnit[] {
    const units: LayoutUnit[] = [];
    const handledDevIds = new Set<string>();

    // Top-level hosts (devices that have children attached and are not guests of another host in devs)
    const hostCandidates = devs.filter((d) => {
      // Must not be a guest of another device in this devs set
      if (d.parentHostId && devs.some((p) => p.id === d.parentHostId)) return false;
      // Has children in devs
      return devs.some((c) => c.parentHostId === d.id);
    });

    hostCandidates.forEach((host) => {
      handledDevIds.add(host.id);

      // Direct children of this host
      const directChildren = devs.filter((c) => c.parentHostId === host.id);
      const guestItems: GuestTreeItem[] = [];

      directChildren.forEach((guest) => {
        handledDevIds.add(guest.id);

        // Does this guest (e.g. a VM) itself have Docker containers?
        const subContainers = devs.filter((c) => c.parentHostId === guest.id);
        subContainers.forEach((sc) => handledDevIds.add(sc.id));

        if (subContainers.length === 0) {
          // Plain standalone guest card
          guestItems.push({
            guest,
            subContainers: [],
            width: NODE_WIDTH,
            height: NODE_HEIGHT
          });
        } else {
          // Guest with sub-containers (e.g. VM hosting Docker microservices)
          const scPerRow = Math.min(3, Math.max(1, subContainers.length));
          const scRows = Math.ceil(subContainers.length / scPerRow);
          const scW = Math.max(
            NODE_WIDTH + 30,
            scPerRow * NODE_WIDTH + (scPerRow - 1) * NODE_GAP_X + 40
          );
          const scH =
            NODE_HEIGHT + // Guest (VM) card
            55 + // Vertical space
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

      // Layout guest items in neat rows beneath the host
      // Max items per row: 3 if small, 2 if wide
      const maxCol = guestItems.some((gi) => gi.width > 400) ? 2 : Math.min(3, Math.max(1, guestItems.length));
      const guestRows: GuestTreeItem[][] = [];
      for (let i = 0; i < guestItems.length; i += maxCol) {
        guestRows.push(guestItems.slice(i, i + maxCol));
      }

      // Compute row dimensions
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
        NODE_HEIGHT + // Host card
        55 + // Gap below host
        totalGuestsH +
        HOST_PAD_Y;

      // Position guest items relatively inside the cluster
      let currentItemY = HOST_HEADER_HEIGHT + HOST_PAD_Y + NODE_HEIGHT + 55;
      guestRows.forEach((row) => {
        const rowW = row.reduce((sum, item) => sum + item.width, 0) + (row.length - 1) * NODE_GAP_X;
        const rowMaxH = Math.max(...row.map((item) => item.height));
        let currentItemX = Math.round((clusterW - rowW) / 2);

        row.forEach((item) => {
          item.relX = currentItemX;
          item.relY = currentItemY;

          // If this item has sub-containers, lay them out relatively inside the item block
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

    // Standalone equipment (and any remaining unhandled devices)
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

  // 5. RADIAL QUADRANT ANGLE GENERATOR (Top, Bottom, Left, Right & Diagonals)
  // Generates angles alternating evenly across all 4 quadrants
  function getQuadrantAngles(count: number): number[] {
    if (count <= 0) return [];
    if (count === 1) return [0]; // Right (East)
    if (count === 2) return [0, Math.PI]; // Right (East) & Left (West)
    if (count === 3) return [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]; // Top, Bottom-Right, Bottom-Left
    if (count === 4) return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]; // East, South, West, North

    // For N entities, space evenly around 360 degrees starting from 0 (East)
    const angles: number[] = [];
    const step = (2 * Math.PI) / count;
    for (let i = 0; i < count; i++) {
      angles.push(i * step);
    }
    return angles;
  }

  // 6. ZONE PACKING OR MULTI-DIRECTIONAL STAR DISTRIBUTION
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

  // Helper to commit absolute positions to devices within a unit
  function applyUnitPositions(unit: LayoutUnit, absX: number, absY: number) {
    if (unit.type === 'standalone') {
      unit.host.position = { x: absX, y: absY };
    } else {
      // Host card at top-center of cluster
      const hostX = Math.round(absX + (unit.width - NODE_WIDTH) / 2);
      const hostY = Math.round(absY + HOST_PAD_Y + HOST_HEADER_HEIGHT);
      unit.host.position = { x: hostX, y: hostY };

      // Each guest item
      unit.guestItems.forEach((item) => {
        const itemAbsX = absX + (item.relX ?? 0);
        const itemAbsY = absY + (item.relY ?? 0);

        // Guest card (e.g. VM) at top-center of item block
        item.guest.position = {
          x: Math.round(itemAbsX + (item.width - NODE_WIDTH) / 2),
          y: itemAbsY
        };

        // Sub-containers already had relative calculations, apply unit offset
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

  // CASE A: Only 1 Zone or unassigned devices (All devices belong to 1 group)
  // Distribute individual units in a balanced 4-quadrant star directly around the center core!
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
  // Pre-calculate zone internal grid layouts, then place zones radially in all directions around the core
  interface PlannedZone {
    zoneId: string;
    width: number;
    height: number;
    units: LayoutUnit[];
  }

  const plannedZones: PlannedZone[] = [];

  devicesByZone.forEach((devs, zId) => {
    const units = buildLayoutUnits(devs);

    // Arrange units in a clean grid within the zone
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

  // Distribute planned zones across all 4 quadrants symmetrically around the center core
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

    // Apply positions to all units inside this zone
    pz.units.forEach((u) => {
      const unitAbsX = zoneX + (u.relX || 0);
      const unitAbsY = zoneY + (u.relY || 0);
      applyUnitPositions(u, unitAbsX, unitAbsY);
    });
  });

  return devices;
}

/**
 * Backward-compatible alias.
 */
export function autoLayoutByZones(devList: Device[], zones: GeographicZone[]): Device[] {
  return autoLayoutTopology(devList, zones);
}
