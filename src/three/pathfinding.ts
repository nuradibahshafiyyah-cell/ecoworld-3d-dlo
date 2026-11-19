import * as THREE from 'three';

export interface CircleObstacle {
  kind: 'circle';
  x: number;
  z: number;
  radius: number;
  label?: string;
}

export interface SegmentObstacle {
  kind: 'segment';
  ax: number;
  az: number;
  bx: number;
  bz: number;
  radius: number;
  label?: string;
}

export type IslandObstacle = CircleObstacle | SegmentObstacle;

export interface MissionPortalWaypoint {
  entrance: [number, number];
  portalCenter: [number, number];
}

// Each mission's physical entrance waypoint (on open walkable ground) and portal focal center
export const MISSION_PORTAL_WAYPOINTS: Record<number, MissionPortalWaypoint> = {
  1: { entrance: [-12.2, 8.6], portalCenter: [-15, 10] },
  2: { entrance: [-13.6, -7.2], portalCenter: [-14, -12] },
  3: { entrance: [13.0, -7.8], portalCenter: [13, -12] },
  4: { entrance: [11.4, 12.6], portalCenter: [15, 10] },
  5: { entrance: [0, 4.6], portalCenter: [0, 0] },
};

// Bridge deck pass-through around [-11.4, 14.5] so agents can cross the river cleanly if needed
function isOnWoodenBridge(x: number, z: number): boolean {
  const bdx = x - -11.4;
  const bdz = z - 14.5;
  const cosB = 0.7518;
  const sinB = 0.6594;
  const localBx = bdx * cosB - bdz * sinB;
  const localBz = bdx * sinB + bdz * cosB;
  return Math.abs(localBx) <= 3.1 && Math.abs(localBz) <= 1.35;
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 0.0001) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
  let t = ((px - ax) * vx + (pz - az) * vz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = px - (ax + vx * t);
  const dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}

// All physical buildings, props, dense tree groves, water pools & river segments on EcoWorld Island
export const ISLAND_OBSTACLES: IslandObstacle[] = [
  // Zone 1: River Boathouse & Textile Factory
  { kind: 'circle', x: -14.2, z: 5.2, radius: 2.35, label: 'Boathouse' },
  { kind: 'circle', x: -20.8, z: 7.6, radius: 3.45, label: 'Textile Factory' },
  // Zone 1 River Segments (skipped when standing on wooden bridge)
  { kind: 'segment', ax: -23.5, az: 3.2, bx: -17.5, bz: 8.8, radius: 2.2, label: 'River1' },
  { kind: 'segment', ax: -17.5, az: 8.8, bx: -12.0, bz: 14.5, radius: 2.2, label: 'River2' },
  { kind: 'segment', ax: -12.0, az: 14.5, bx: -8.2, bz: 21.5, radius: 2.2, label: 'River3' },
  { kind: 'segment', ax: -8.2, az: 21.5, bx: -5.8, bz: 28.4, radius: 2.2, label: 'River4' },

  // Zone 2: Industrial Plant, Research Tower & Car
  { kind: 'circle', x: -15.5, z: -13.5, radius: 3.35, label: 'Industrial Plant' },
  { kind: 'circle', x: -10.8, z: -11.2, radius: 2.55, label: 'Research Tower' },
  { kind: 'circle', x: -12.8, z: -8.6, radius: 1.35, label: 'Zone2 Car' },

  // Zone 3: Treehouse, Wind Turbine, Solar Arrays & Forest Grove Trees
  { kind: 'circle', x: 10.8, z: -11.5, radius: 2.35, label: 'Treehouse' },
  { kind: 'circle', x: 16.2, z: -13.8, radius: 1.25, label: 'Wind Turbine' },
  { kind: 'circle', x: 15.0, z: -9.6, radius: 1.15, label: 'Solar 1' },
  { kind: 'circle', x: 17.2, z: -9.6, radius: 1.15, label: 'Solar 2' },
  { kind: 'circle', x: 8.5, z: -15.5, radius: 1.3, label: 'Forest Tree' },
  { kind: 'circle', x: 16.2, z: -16.2, radius: 1.3, label: 'Forest Tree' },
  { kind: 'circle', x: 18.5, z: -9.2, radius: 1.3, label: 'Forest Tree' },
  { kind: 'circle', x: 10.2, z: -7.8, radius: 1.25, label: 'Forest Tree' },
  { kind: 'circle', x: 15.4, z: -14.8, radius: 1.3, label: 'Forest Tree' },
  { kind: 'circle', x: 7.8, z: -11.4, radius: 1.25, label: 'Forest Tree' },
  { kind: 'circle', x: 19.5, z: -13.2, radius: 1.3, label: 'Forest Tree' },
  { kind: 'circle', x: 18.6, z: -17.0, radius: 3.1, label: 'Highland Pool' },

  // Zone 4: Makmal Suara Dome & Satellite Dish
  { kind: 'circle', x: 15.0, z: 10.0, radius: 3.7, label: 'Makmal Suara Dome' },
  { kind: 'circle', x: 11.8, z: 7.5, radius: 1.3, label: 'Satellite Dish' },

  // Zone 5: Central Eco-Headquarters Pedestal & 4 Torch Pillars
  { kind: 'circle', x: 0, z: 0, radius: 2.45, label: 'Eco Monument Plinth' },
  { kind: 'circle', x: -4.6, z: 4.6, radius: 0.75, label: 'Torch SW' },
  { kind: 'circle', x: 4.6, z: 4.6, radius: 0.75, label: 'Torch SE' },
  { kind: 'circle', x: -4.6, z: -4.6, radius: 0.75, label: 'Torch NW' },
  { kind: 'circle', x: 4.6, z: -4.6, radius: 0.75, label: 'Torch NE' },

  // Mission Wooden Signboards beside each beacon
  { kind: 'circle', x: -12.1, z: 11.8, radius: 0.95, label: 'Sign1' },
  { kind: 'circle', x: -11.1, z: -10.2, radius: 0.95, label: 'Sign2' },
  { kind: 'circle', x: 15.9, z: -10.2, radius: 0.95, label: 'Sign3' },
  { kind: 'circle', x: 17.9, z: 11.8, radius: 0.95, label: 'Sign4' },
  { kind: 'circle', x: 2.9, z: 1.8, radius: 0.95, label: 'Sign5' },
];

export function isPointWalkable(x: number, z: number, agentPadding = 0.55): boolean {
  // Keep inside playable perimeter (inside outer ring of perimeter trees at r~23.2)
  if (x * x + z * z > 24.4 * 24.4) return false;

  const onBridge = isOnWoodenBridge(x, z);

  for (let i = 0; i < ISLAND_OBSTACLES.length; i++) {
    const obs = ISLAND_OBSTACLES[i];
    if (obs.kind === 'circle') {
      const lim = obs.radius + agentPadding;
      const dx = x - obs.x;
      const dz = z - obs.z;
      if (dx * dx + dz * dz < lim * lim) return false;
    } else {
      if (onBridge) continue;
      const lim = obs.radius + agentPadding;
      if (pointToSegmentDistSq(x, z, obs.ax, obs.az, obs.bx, obs.bz) < lim * lim) {
        return false;
      }
    }
  }
  return true;
}

export function resolveAgentCollisions(
  x: number,
  z: number,
  agentRadius = 0.52
): { x: number; z: number } {
  let nx = x;
  let nz = z;
  const onBridge = isOnWoodenBridge(nx, nz);

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < ISLAND_OBSTACLES.length; i++) {
      const obs = ISLAND_OBSTACLES[i];
      if (obs.kind === 'circle') {
        const minD = obs.radius + agentRadius;
        const dx = nx - obs.x;
        const dz = nz - obs.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq) || 0.001;
          const push = minD - d;
          nx += (dx / d) * push;
          nz += (dz / d) * push;
        }
      } else if (!onBridge) {
        const vx = obs.bx - obs.ax;
        const vz = obs.bz - obs.az;
        const lenSq = vx * vx + vz * vz || 1;
        let t = ((nx - obs.ax) * vx + (nz - obs.az) * vz) / lenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const cx = obs.ax + vx * t;
        const cz = obs.az + vz * t;
        const dx = nx - cx;
        const dz = nz - cz;
        const minD = obs.radius + agentRadius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq) || 0.001;
          const push = minD - d;
          nx += (dx / d) * push;
          nz += (dz / d) * push;
        }
      }
    }

    const r = Math.hypot(nx, nz);
    if (r > 24.5) {
      nx *= 24.5 / r;
      nz *= 24.5 / r;
    }
  }

  return { x: nx, z: nz };
}

// Grid configuration for fast A* pathfinding (-26..+26 at 1.0m cell size -> 53x53)
const GRID_MIN = -26;
const GRID_SIZE = 53;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

function worldToCell(v: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.round(v - GRID_MIN)));
}

function cellToWorld(c: number): number {
  return GRID_MIN + c;
}

function findNearestWalkableCell(cx: number, cz: number, blocked: Uint8Array): [number, number] | null {
  if (!blocked[cz * GRID_SIZE + cx]) return [cx, cz];
  for (let rad = 1; rad <= 8; rad++) {
    let best: [number, number] | null = null;
    let bestDistSq = Infinity;
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) continue;
        if (blocked[nz * GRID_SIZE + nx]) continue;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = [nx, nz];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(2, Math.ceil(dist / 0.45));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + (bx - ax) * t;
    const pz = az + (bz - az) * t;
    if (!isPointWalkable(px, pz, 0.55)) return false;
  }
  return true;
}

export function findIslandPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number
): THREE.Vector3[] | null {
  // Build lightweight navigation grid
  const blocked = new Uint8Array(TOTAL_CELLS);
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    const wz = cellToWorld(gz);
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const wx = cellToWorld(gx);
      if (!isPointWalkable(wx, wz, 0.52)) {
        blocked[gz * GRID_SIZE + gx] = 1;
      }
    }
  }

  const startCell = findNearestWalkableCell(worldToCell(startX), worldToCell(startZ), blocked);
  const goalCell = findNearestWalkableCell(worldToCell(goalX), worldToCell(goalZ), blocked);
  if (!startCell || !goalCell) return null;

  const startIdx = startCell[1] * GRID_SIZE + startCell[0];
  const goalIdx = goalCell[1] * GRID_SIZE + goalCell[0];

  if (startIdx === goalIdx) {
    return [new THREE.Vector3(goalX, 0, goalZ)];
  }

  const gScore = new Float32Array(TOTAL_CELLS).fill(Infinity);
  const fScore = new Float32Array(TOTAL_CELLS).fill(Infinity);
  const cameFrom = new Int32Array(TOTAL_CELLS).fill(-1);
  const closed = new Uint8Array(TOTAL_CELLS);
  const openSet: number[] = [startIdx];
  const inOpen = new Uint8Array(TOTAL_CELLS);
  inOpen[startIdx] = 1;

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(goalCell[0] - startCell[0], goalCell[1] - startCell[1]);

  const dirs: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let found = false;
  while (openSet.length > 0) {
    // Pop lowest fScore
    let bestPos = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (fScore[openSet[i]] < fScore[openSet[bestPos]]) bestPos = i;
    }
    const current = openSet[bestPos];
    openSet.splice(bestPos, 1);
    inOpen[current] = 0;

    if (current === goalIdx) {
      found = true;
      break;
    }

    closed[current] = 1;
    const cx = current % GRID_SIZE;
    const cz = Math.floor(current / GRID_SIZE);

    for (let i = 0; i < dirs.length; i++) {
      const [dx, dz, cost] = dirs[i];
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) continue;
      const nIdx = nz * GRID_SIZE + nx;
      if (closed[nIdx] || blocked[nIdx]) continue;

      // Prevent diagonal corner cutting through obstacles
      if (dx !== 0 && dz !== 0) {
        if (blocked[cz * GRID_SIZE + nx] || blocked[nz * GRID_SIZE + cx]) continue;
      }

      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(goalCell[0] - nx, goalCell[1] - nz);
        if (!inOpen[nIdx]) {
          openSet.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  if (!found) return null;

  // Reconstruct raw grid path
  const rawPoints: THREE.Vector3[] = [];
  let cur = goalIdx;
  while (cur !== -1 && cur !== startIdx) {
    const cx = cur % GRID_SIZE;
    const cz = Math.floor(cur / GRID_SIZE);
    rawPoints.push(new THREE.Vector3(cellToWorld(cx), 0, cellToWorld(cz)));
    cur = cameFrom[cur];
  }
  rawPoints.reverse();
  if (rawPoints.length > 0) {
    rawPoints[rawPoints.length - 1].set(goalX, 0, goalZ);
  } else {
    rawPoints.push(new THREE.Vector3(goalX, 0, goalZ));
  }

  // Smooth path with greedy line-of-sight string-pulling
  const smoothed: THREE.Vector3[] = [];
  let anchorX = startX;
  let anchorZ = startZ;
  let idx = 0;

  while (idx < rawPoints.length) {
    let farthest = idx;
    for (let j = rawPoints.length - 1; j > idx; j--) {
      if (hasLineOfSight(anchorX, anchorZ, rawPoints[j].x, rawPoints[j].z)) {
        farthest = j;
        break;
      }
    }
    const chosen = rawPoints[farthest].clone();
    smoothed.push(chosen);
    anchorX = chosen.x;
    anchorZ = chosen.z;
    idx = farthest + 1;
  }

  return smoothed;
}
