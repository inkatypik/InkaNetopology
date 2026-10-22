import type { Device } from '../types/network';

/**
 * Find the best candidate Docker host among physical servers/hosts.
 */
export function findBestDockerHost(devList: Device[]): Device | undefined {
  // 1. Host with docker/portainer open ports (2375, 2376, 9000, 9443)
  const byPort = devList.find(
    (d) =>
      d.deviceType === 'physical' &&
      d.openPorts &&
      d.openPorts.some((p) => [2375, 2376, 9000, 9443].includes(p))
  );
  if (byPort) return byPort;

  // 2. Server with 'docker' in name or tags
  const byName = devList.find(
    (d) =>
      d.deviceType === 'physical' &&
      (d.name.toLowerCase().includes('docker') ||
        d.tags?.some((t) => t.toLowerCase().includes('docker')))
  );
  if (byName) return byName;

  // 3. Any physical server or NAS
  const byServer = devList.find(
    (d) => d.deviceType === 'physical' && (d.subType === 'server' || d.subType === 'nas')
  );
  if (byServer) return byServer;

  // 4. Any physical host (excluding switches and routers)
  return devList.find(
    (d) =>
      d.deviceType === 'physical' &&
      d.subType !== 'switch' &&
      d.subType !== 'router' &&
      d.subType !== 'access_point'
  );
}

/**
 * Intelligent tiered auto-layout algorithm for network topology.
 * Generates an airy, well-spaced, hierarchical layout with host-clustered VMs and containers.
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

  // Fallback server if none found
  const defaultDockerHost = findBestDockerHost(devices);

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

  // Clean up invalid host attachments (e.g. docker container attached to a switch)
  dockers.forEach((ct) => {
    if (ct.parentHostId) {
      const parent = devMap.get(ct.parentHostId);
      if (parent && (parent.subType === 'switch' || parent.subType === 'router')) {
        // Disconnect from switch as host, reassign to real docker host
        ct.parentHostId = defaultDockerHost ? defaultDockerHost.id : undefined;
      }
    } else if (defaultDockerHost) {
      ct.parentHostId = defaultDockerHost.id;
    }
  });

  vms.forEach((vm) => {
    if (vm.parentHostId) {
      const parent = devMap.get(vm.parentHostId);
      if (parent && (parent.subType === 'switch' || parent.subType === 'router')) {
        vm.parentHostId = servers[0] ? servers[0].id : undefined;
      }
    } else if (servers[0]) {
      vm.parentHostId = servers[0].id;
    }
  });

  // Auto-connect missing switch links
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

  // Generous, airy layout parameters:
  // Node card width is 256px -> colWidth 360px gives 104px horizontal breathing room
  // Node card height is ~160px -> rowHeight 260px gives 100px vertical clearance for bezier lines and labels
  const colWidth = 360;
  const rowHeight = 260;

  // Maximum items on any row to calculate canvas center
  const maxRowItems = Math.max(
    1,
    switches.length,
    servers.length,
    Math.min(vms.length + dockers.length, 4),
    Math.min(workstations.length, 4),
    Math.min(iotAndOthers.length, 4)
  );

  const graphCenterX = Math.max(600, (maxRowItems * colWidth) / 2 + 100);

  // Helper to layout a list of nodes centered on rows
  const layoutRow = (nodes: Device[], y: number, maxPerRow = 4) => {
    if (nodes.length === 0) return y;
    let currY = y;
    for (let i = 0; i < nodes.length; i += maxPerRow) {
      const chunk = nodes.slice(i, i + maxPerRow);
      const totalW = chunk.length * colWidth;
      const startX = graphCenterX - totalW / 2 + (colWidth - 256) / 2;
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

  let currentY = 60;

  // Tier 0: Root Gateway / Router
  if (rootNode) {
    rootNode.position = { x: Math.round(graphCenterX - 128), y: currentY };
    currentY += rowHeight;
  }

  // Tier 1: Network Switches & Wi-Fi Access Points
  if (switches.length > 0) {
    currentY = layoutRow(switches, currentY, 4);
  }

  // Tier 2: Physical Servers & Hypervisors & NAS
  // Clustered Virtualization: Place child VMs / containers clustered beneath their specific parent host!
  if (servers.length > 0) {
    // If we have servers with children, space them comfortably
    const serverSpacing = Math.max(colWidth, 380);
    const totalServerWidth = servers.length * serverSpacing;
    const startServerX = graphCenterX - totalServerWidth / 2 + (serverSpacing - 256) / 2;

    const serverY = currentY;
    servers.forEach((srv, sIdx) => {
      const srvX = Math.round(startServerX + sIdx * serverSpacing);
      srv.position = { x: srvX, y: serverY };
    });

    currentY += rowHeight;

    // Place children for each server directly beneath it
    let maxChildY = currentY;
    servers.forEach((srv) => {
      const children = [...vms, ...dockers].filter((c) => c.parentHostId === srv.id);
      if (children.length > 0) {
        const childColW = 310;
        const maxChildPerRow = 2;
        let cY = currentY;
        for (let i = 0; i < children.length; i += maxChildPerRow) {
          const chunk = children.slice(i, i + maxChildPerRow);
          const totalW = chunk.length * childColW;
          const startX = (srv.position?.x ?? 0) + 128 - totalW / 2 + (childColW - 256) / 2;
          chunk.forEach((child, idx) => {
            child.position = {
              x: Math.round(startX + idx * childColW),
              y: cY
            };
          });
          cY += rowHeight - 20;
        }
        if (cY > maxChildY) maxChildY = cY;
      }
    });

    // Place any orphan VMs / Docker containers that don't belong to any positioned server
    const orphanVirtuals = [...vms, ...dockers].filter(
      (c) => !servers.some((s) => s.id === c.parentHostId)
    );
    if (orphanVirtuals.length > 0) {
      maxChildY = layoutRow(orphanVirtuals, maxChildY, 4);
    }

    currentY = Math.max(currentY + rowHeight, maxChildY);
  } else {
    // If no physical servers exist, layout virtual nodes in their own tier
    const virtualNodes = [...vms, ...dockers];
    if (virtualNodes.length > 0) {
      currentY = layoutRow(virtualNodes, currentY, 4);
    }
  }

  // Tier 4: Workstations, PCs & Printers
  if (workstations.length > 0) {
    currentY = layoutRow(workstations, currentY, 4);
  }

  // Tier 5: IoT & Others
  if (iotAndOthers.length > 0) {
    currentY = layoutRow(iotAndOthers, currentY, 4);
  }

  return devices;
}
