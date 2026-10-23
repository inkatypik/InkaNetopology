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

  // 2. Exact IP match with a physical server / host machine (Docker bridge/host port forwarding)
  if (container.ip) {
    const hostWithSameIp = devList.find(
      (d) =>
        d.id !== container.id &&
        d.ip === container.ip &&
        d.deviceType === 'physical' &&
        d.subType !== 'switch' &&
        d.subType !== 'router' &&
        d.subType !== 'access_point'
    );
    if (hostWithSameIp) return hostWithSameIp;
  }

  // 3. Name or location reference match (e.g. location "Conteneur sur HP ProDesk" -> matches server "HP ProDesk")
  const locOrName = `${container.location || ''} ${container.name || ''}`.toLowerCase();
  const hostByRef = devList.find(
    (d) =>
      d.id !== container.id &&
      (d.deviceType === 'physical' || d.subType === 'server') &&
      d.subType !== 'switch' &&
      d.subType !== 'router' &&
      (locOrName.includes(d.name.toLowerCase()) ||
        (d.metadata && Object.values(d.metadata).some((v) => typeof v === 'string' && locOrName.includes(v.toLowerCase()))))
  );
  if (hostByRef) return hostByRef;

  // 4. Server explicitly tagged with 'docker' or named 'docker'
  const byDockerTag = devList.find(
    (d) =>
      d.id !== container.id &&
      d.deviceType === 'physical' &&
      (d.name.toLowerCase().includes('docker') ||
        d.tags?.some((t) => t.toLowerCase().includes('docker')))
  );
  if (byDockerTag) return byDockerTag;

  // 5. Host with docker/portainer open ports (2375, 2376, 9000, 9443)
  const byPort = devList.find(
    (d) =>
      d.id !== container.id &&
      d.deviceType === 'physical' &&
      d.openPorts &&
      d.openPorts.some((p) => [2375, 2376, 9000, 9443].includes(p))
  );
  if (byPort) return byPort;

  // 6. Any dedicated physical server or NAS
  const byServer = devList.find(
    (d) =>
      d.id !== container.id &&
      d.deviceType === 'physical' &&
      (d.subType === 'server' || d.subType === 'nas')
  );
  if (byServer) return byServer;

  // 7. General physical host fallback
  return devList.find(
    (d) =>
      d.id !== container.id &&
      d.deviceType === 'physical' &&
      d.subType !== 'switch' &&
      d.subType !== 'router' &&
      d.subType !== 'access_point'
  );
}

/**
 * Backward-compatible alias for finding docker host.
 */
export function findBestDockerHost(devList: Device[]): Device | undefined {
  return findBestHostForContainer({}, devList);
}

/**
 * TOPOLOGIE EN ÉTOILE (Star Topology Layout):
 * The network core ("cœur de réseau" / router / gateway) sits directly at the CENTER of the star.
 * Radial branches radiate outwards in concentric rings and sectors:
 * - Center: Cœur de réseau (Passerelle / Routeur principal / Switch cœur)
 * - Ring 1 (Radius ~450px): Distribution switches, Wi-Fi APs, hypervisors & servers
 * - Ring 2 (Radius ~840px): VMs, Docker containers, workstations, NAS
 * - Ring 3 (Radius ~1220px): Peripheral IoT, smart sensors, cameras, printers
 */
export function autoLayoutTopology(devList: Device[]): Device[] {
  if (!devList || devList.length === 0) return [];

  // Clone devices to avoid mutating inputs
  const devices: Device[] = devList.map((d) => ({ ...d }));
  const devMap = new Map<string, Device>();
  devices.forEach((d) => devMap.set(d.id, d));

  // 1. Identify Root Cœur de Réseau (Gateway / Core Router)
  let coreNode = devices.find(
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

  if (!coreNode) {
    coreNode =
      devices.find((d) => d.subType === 'switch') ||
      devices.find((d) => d.deviceType === 'physical') ||
      devices[0];
  }

  // 2. Identify Switches & Access points
  const switches = devices.filter(
    (d) => d.id !== coreNode?.id && (d.subType === 'switch' || d.subType === 'access_point')
  );
  const primarySwitch = switches[0] || coreNode;

  // 3. Identify Physical Servers, Hypervisors, NAS
  const servers = devices.filter(
    (d) =>
      d.id !== coreNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      d.deviceType === 'physical' &&
      (d.subType === 'server' || d.subType === 'nas')
  );

  // 4. Identify Virtual Machines & Docker Containers
  const vms = devices.filter((d) => d.deviceType === 'vm');
  const dockers = devices.filter((d) => d.deviceType === 'docker');

  // Accurately assign parent hosts for containers and VMs if missing or invalid
  dockers.forEach((ct) => {
    const bestHost = findBestHostForContainer(ct, devices);
    if (!ct.parentHostId || !devMap.has(ct.parentHostId)) {
      if (bestHost) ct.parentHostId = bestHost.id;
    } else {
      const currentParent = devMap.get(ct.parentHostId);
      if (currentParent && (currentParent.subType === 'switch' || currentParent.subType === 'router')) {
        if (bestHost) ct.parentHostId = bestHost.id;
      }
    }
  });

  vms.forEach((vm) => {
    if (!vm.parentHostId || !devMap.has(vm.parentHostId)) {
      // Attach to first hypervisor/server or server with 'proxmox'/'vm' in name
      const pve = servers.find((s) => s.name.toLowerCase().includes('proxmox') || s.tags?.includes('Hyperviseur')) || servers[0];
      if (pve) vm.parentHostId = pve.id;
    }
  });

  // Ensure switch connections exist
  switches.forEach((sw) => {
    if (!sw.connectedToSwitchId && coreNode && sw.id !== coreNode.id) {
      sw.connectedToSwitchId = coreNode.id;
    }
  });

  servers.forEach((srv) => {
    if (!srv.connectedToSwitchId && primarySwitch && srv.id !== primarySwitch.id) {
      srv.connectedToSwitchId = primarySwitch.id;
    }
  });

  // 5. Workstations, IoT, Printers
  const workstations = devices.filter(
    (d) =>
      d.id !== coreNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      !servers.some((s) => s.id === d.id) &&
      d.deviceType === 'physical' &&
      (d.subType === 'workstation' || d.subType === 'printer')
  );

  const iotAndOthers = devices.filter(
    (d) =>
      d.id !== coreNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      !servers.some((s) => s.id === d.id) &&
      !vms.some((v) => v.id === d.id) &&
      !dockers.some((c) => c.id === d.id) &&
      !workstations.some((w) => w.id === d.id)
  );

  workstations.forEach((ws) => {
    if (!ws.connectedToSwitchId && primarySwitch && ws.id !== primarySwitch.id) {
      ws.connectedToSwitchId = primarySwitch.id;
    }
  });

  iotAndOthers.forEach((iot) => {
    if (!iot.connectedToSwitchId && primarySwitch && iot.id !== primarySwitch.id) {
      iot.connectedToSwitchId = primarySwitch.id;
    }
  });

  // ---------------- STAR GEOMETRY ----------------
  // Geometric center of the star canvas
  const centerX = 1350;
  const centerY = 1200;

  // Node dimensions for centering card bounding boxes
  const halfNodeW = 128;
  const halfNodeH = 85;

  // Tier radii in pixels
  const R_RING1 = 440; // Direct primary switches & main physical servers
  const R_RING2 = 850; // Second-tier switches, VMs, Docker containers, workstations
  const R_RING3 = 1240; // Outer IoT devices, sensors, peripheral equipment

  // 1. PLACE CORE AT THE EXACT CENTER
  if (coreNode) {
    coreNode.position = {
      x: Math.round(centerX - halfNodeW),
      y: Math.round(centerY - halfNodeH)
    };
  }

  // 2. BUILD MAIN STAR RAYS (Branches)
  // Each major distribution element forms a ray of the star
  interface StarBranch {
    head: Device;
    children: Device[]; // VMs, containers, or connected devices
    preferredAngle?: number;
  }

  const starBranches: StarBranch[] = [];

  // Branch A: Primary Switches
  switches.forEach((sw) => {
    // Collect endpoints attached to this switch (that aren't servers or virtuals)
    const attachedEndpoints = [...workstations, ...iotAndOthers].filter(
      (e) => e.connectedToSwitchId === sw.id
    );
    starBranches.push({
      head: sw,
      children: attachedEndpoints
    });
  });

  // Branch B: Physical Servers with their child VMs or Containers
  servers.forEach((srv) => {
    const srvChildren = [...vms, ...dockers].filter((c) => c.parentHostId === srv.id);
    starBranches.push({
      head: srv,
      children: srvChildren
    });
  });

  // Branch C: Any remaining workstations/devices directly attached to core
  const directCoreEndpoints = [...workstations, ...iotAndOthers].filter(
    (e) => !starBranches.some((b) => b.children.some((c) => c.id === e.id))
  );

  // Group standalone direct endpoints into 1 or 2 small branches if any exist
  if (directCoreEndpoints.length > 0) {
    const chunkSize = Math.ceil(directCoreEndpoints.length / 2);
    for (let i = 0; i < directCoreEndpoints.length; i += chunkSize) {
      const slice = directCoreEndpoints.slice(i, i + chunkSize);
      const head = slice[0];
      starBranches.push({
        head,
        children: slice.slice(1)
      });
    }
  }

  // If there are orphaned VMs or containers not attached to any positioned server
  const placedIds = new Set<string>();
  if (coreNode) placedIds.add(coreNode.id);
  starBranches.forEach((b) => {
    placedIds.add(b.head.id);
    b.children.forEach((c) => placedIds.add(c.id));
  });

  const unassigned = devices.filter((d) => !placedIds.has(d.id));
  if (unassigned.length > 0) {
    unassigned.forEach((u) => {
      starBranches.push({
        head: u,
        children: []
      });
    });
  }

  // 3. RADIAL DISTRIBUTION OF BRANCHES (0° to 360°)
  const branchCount = Math.max(1, starBranches.length);
  // Start from top-left (-135°) to give a balanced star orientation
  const angleStep = (2 * Math.PI) / branchCount;

  starBranches.forEach((branch, bIdx) => {
    const baseAngle = -Math.PI / 2 + bIdx * angleStep;

    // Place Branch Head at Ring 1
    const headX = centerX + R_RING1 * Math.cos(baseAngle) - halfNodeW;
    const headY = centerY + R_RING1 * Math.sin(baseAngle) - halfNodeH;
    branch.head.position = {
      x: Math.round(headX),
      y: Math.round(headY)
    };

    // Place Children at Ring 2 / Ring 3 in a fan outward from the branch head
    const childCount = branch.children.length;
    if (childCount === 0) return;

    // Fan children outward along baseAngle with safe angular width
    // Angular span proportional to number of children, capped so branches don't collide
    const maxSpan = Math.min(angleStep * 0.85, 0.35 * childCount);
    const halfSpan = maxSpan / 2;

    branch.children.forEach((child, cIdx) => {
      let childAngle = baseAngle;
      if (childCount > 1) {
        childAngle = baseAngle - halfSpan + (cIdx / (childCount - 1)) * maxSpan;
      }

      // If more than 4 children, stagger in Ring 2 and Ring 3 to prevent crowding
      const useRing3 = cIdx >= 4;
      const radius = useRing3 ? R_RING3 : R_RING2;

      const cX = centerX + radius * Math.cos(childAngle) - halfNodeW;
      const cY = centerY + radius * Math.sin(childAngle) - halfNodeH;

      child.position = {
        x: Math.round(cX),
        y: Math.round(cY)
      };
    });
  });

  return devices;
}

/**
 * Alternative auto-layout grouped by Geographic Zones (Pièces, Baies, Sous-répartiteurs, Sites).
 * Positions devices inside zone clusters while maintaining clean spacing.
 */
export function autoLayoutByZones(devList: Device[], zones: GeographicZone[]): Device[] {
  if (!devList || devList.length === 0) return [];
  const devices: Device[] = devList.map((d) => ({ ...d }));

  // Create a map of zones
  const zoneMap = new Map<string, GeographicZone>();
  zones.forEach((z) => zoneMap.set(z.id, z));

  // Group devices by zoneId (including unassigned)
  const devicesByZone = new Map<string, Device[]>();
  devices.forEach((d) => {
    const zId = d.zoneId || 'unassigned';
    const list = devicesByZone.get(zId) || [];
    list.push(d);
    devicesByZone.set(zId, list);
  });

  const zoneIds = Array.from(devicesByZone.keys());
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(zoneIds.length))));
  const zoneBoxWidth = 820;
  const zoneBoxHeight = 620;
  const gap = 120;

  zoneIds.forEach((zId, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const startX = 100 + col * (zoneBoxWidth + gap);
    const startY = 100 + row * (zoneBoxHeight + gap);

    const devInZone = devicesByZone.get(zId) || [];
    const itemsPerRow = 2;
    const colW = 340;
    const rowH = 220;

    devInZone.forEach((dev, dIdx) => {
      const devCol = dIdx % itemsPerRow;
      const devRow = Math.floor(dIdx / itemsPerRow);
      dev.position = {
        x: Math.round(startX + 40 + devCol * colW),
        y: Math.round(startY + 80 + devRow * rowH)
      };
    });
  });

  return devices;
}
