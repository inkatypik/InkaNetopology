import type { Device } from '../types/network';

/**
 * Intelligent tiered auto-layout algorithm for network topology.
 * Organizes devices into logical network hierarchy:
 * - Tier 0: Gateway / Core Router
 * - Tier 1: Network Switches & Wi-Fi Access Points
 * - Tier 2: Physical Servers, Hypervisors, NAS
 * - Tier 3: Virtual Machines & Docker Containers (grouped under parent host)
 * - Tier 4: Client Workstations, PCs, Printers
 * - Tier 5: IoT Devices (Cameras, Sensors, Smart Plugs)
 */
export function autoLayoutTopology(devList: Device[]): Device[] {
  if (!devList || devList.length === 0) return [];

  // Clone devices to avoid direct mutations
  const devices: Device[] = devList.map((d) => ({ ...d }));
  const devMap = new Map<string, Device>();
  devices.forEach((d) => devMap.set(d.id, d));

  // 1. Identify Root Gateway / Router
  let rootNode = devices.find(
    (d) =>
      d.subType === 'router' ||
      d.ip.endsWith('.1') ||
      d.ip.endsWith('.254') ||
      d.name.toLowerCase().includes('passerelle') ||
      d.name.toLowerCase().includes('router') ||
      d.name.toLowerCase().includes('gateway') ||
      d.name.toLowerCase().includes('box') ||
      d.name.toLowerCase().includes('udm')
  );

  if (!rootNode) {
    rootNode =
      devices.find((d) => d.subType === 'switch') ||
      devices.find((d) => d.deviceType === 'physical') ||
      devices[0];
  }

  // 2. Identify Switches & Access points
  const switches = devices.filter(
    (d) => d.id !== rootNode?.id && (d.subType === 'switch' || d.subType === 'access_point')
  );
  const primarySwitch = switches[0] || rootNode;

  // 3. Identify Physical Servers, Hypervisors, NAS
  const servers = devices.filter(
    (d) =>
      d.id !== rootNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      d.deviceType === 'physical' &&
      (d.subType === 'server' || d.subType === 'nas')
  );
  const primaryServer = servers[0];

  // 4. Identify Virtual Machines
  const vms = devices.filter((d) => d.deviceType === 'vm');

  // 5. Identify Docker Containers
  const dockers = devices.filter((d) => d.deviceType === 'docker');

  // 6. Identify Client Workstations & PCs
  const workstations = devices.filter(
    (d) =>
      d.id !== rootNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      !servers.some((s) => s.id === d.id) &&
      d.deviceType === 'physical' &&
      (d.subType === 'workstation' || d.subType === 'printer')
  );

  // 7. Identify IoT Devices & Others
  const iotAndOthers = devices.filter(
    (d) =>
      d.id !== rootNode?.id &&
      !switches.some((s) => s.id === d.id) &&
      !servers.some((s) => s.id === d.id) &&
      !vms.some((v) => v.id === d.id) &&
      !dockers.some((c) => c.id === d.id) &&
      !workstations.some((w) => w.id === d.id)
  );

  // Auto-connect missing links so lines are guaranteed to be drawn
  switches.forEach((sw) => {
    if (!sw.connectedToSwitchId && rootNode && sw.id !== rootNode.id) {
      sw.connectedToSwitchId = rootNode.id;
    }
  });

  servers.forEach((srv) => {
    if (!srv.connectedToSwitchId && primarySwitch && srv.id !== primarySwitch.id) {
      srv.connectedToSwitchId = primarySwitch.id;
    }
  });

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

  // Attach orphan VMs & Containers to primary hypervisor/docker host
  vms.forEach((vm) => {
    if (!vm.parentHostId && primaryServer) {
      vm.parentHostId = primaryServer.id;
    } else if (!vm.parentHostId && !vm.connectedToSwitchId && primarySwitch) {
      vm.connectedToSwitchId = primarySwitch.id;
    }
  });

  dockers.forEach((ct) => {
    const dockerHost = servers.find((s) => s.name.toLowerCase().includes('docker')) || primaryServer;
    if (!ct.parentHostId && dockerHost) {
      ct.parentHostId = dockerHost.id;
    } else if (!ct.parentHostId && !ct.connectedToSwitchId && primarySwitch) {
      ct.connectedToSwitchId = primarySwitch.id;
    }
  });

  // Layout parameters
  const colWidth = 290;
  const rowHeight = 180;

  // Compute graph width and center
  const maxRowItems = Math.max(
    1,
    switches.length,
    servers.length,
    Math.min(vms.length + dockers.length, 5),
    Math.min(workstations.length, 5),
    Math.min(iotAndOthers.length, 5)
  );

  const graphCenterX = Math.max(500, (maxRowItems * colWidth) / 2 + 50);

  // Helper to layout a list of nodes centered on a row
  const layoutRow = (nodes: Device[], y: number, maxPerRow = 5) => {
    if (nodes.length === 0) return y;
    let currY = y;
    for (let i = 0; i < nodes.length; i += maxPerRow) {
      const chunk = nodes.slice(i, i + maxPerRow);
      const totalW = chunk.length * colWidth;
      const startX = graphCenterX - totalW / 2 + (colWidth - 260) / 2;
      chunk.forEach((node, idx) => {
        node.position = {
          x: Math.round(startX + idx * colWidth),
          y: currY
        };
      });
      currY += rowHeight;
    }
    return currY;
  };

  let currentY = 50;

  // Tier 0: Root Gateway / Router
  if (rootNode) {
    rootNode.position = { x: Math.round(graphCenterX - 130), y: currentY };
    currentY += rowHeight;
  }

  // Tier 1: Switches & Access Points
  if (switches.length > 0) {
    currentY = layoutRow(switches, currentY, 4);
  }

  // Tier 2: Physical Servers & Hypervisors & NAS
  if (servers.length > 0) {
    currentY = layoutRow(servers, currentY, 4);
  }

  // Tier 3: Virtual Machines & Containers
  const virtualNodes = [...vms, ...dockers];
  if (virtualNodes.length > 0) {
    currentY = layoutRow(virtualNodes, currentY, 5);
  }

  // Tier 4: Workstations, PCs & Printers
  if (workstations.length > 0) {
    currentY = layoutRow(workstations, currentY, 5);
  }

  // Tier 5: IoT & Others
  if (iotAndOthers.length > 0) {
    currentY = layoutRow(iotAndOthers, currentY, 5);
  }

  return devices;
}
