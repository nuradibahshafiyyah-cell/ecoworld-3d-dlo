import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AvatarId, CameraMode, Clue3D, MissionDef, UserAccount } from '../types/game';
import { M1_CLUES_3D } from '../data/gameData';
import {
  buildZone1RiverFactory,
  buildZone2ToxicCity,
  buildZone3HopeForest,
  buildZone4VoiceLab,
  buildZone5EcoMonument,
  buildZoneBeacon,
} from './models';
import { buildAdventureWorld } from './adventureWorld';
import {
  animateHumanAgent,
  buildHumanEcoAgent,
  HumanAgentRig,
} from './humanAgents';
import { buildMissionRoom, MissionRoomHandle } from './missionRooms';
import { createContactShadowTexture } from './textures';
import {
  findIslandPath,
  MISSION_PORTAL_WAYPOINTS,
  resolveAgentCollisions,
} from './pathfinding';
import {
  FootstepSurface,
  playFootstep,
  playSFX,
  unlockAudioOnUserGesture,
} from '../utils/sound';

export interface EcoWorldCanvasProps {
  user: UserAccount | null;
  missions: MissionDef[];
  cameraMode: CameraMode;
  focusedMissionId: number;
  activeRoomId: number | null;
  m1CluesFound: string[];
  dpadVector: { x: number; z: number };
  travelTargetMissionId?: number | null;
  teleportOutMissionId?: number | null;
  onSelectMission: (missionId: number) => void;
  onArriveAtMission?: (missionId: number) => void;
  onTeleportDeparted?: (missionId: number) => void;
  onTravelPhaseChange?: (phase: 'walking' | 'activating' | null) => void;
  onTravelFailed?: (missionId: number) => void;
  onCollectClue: (clue: Clue3D) => void;
  onHoverInfo: (label: string | null) => void;
  onProximityZoneChange?: (zoneId: number) => void;
  onMission5IntroChange?: (status: { phase: 1 | 2 | 3 | 4 | 5; done: boolean }) => void;
  m5SkipTrigger?: number;
  paused?: boolean;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _moveDir = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _rayOrigin = new THREE.Vector2();

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-lambda * dt));
}

// Zero-allocation point-to-segment squared distance helper for river & stone trails
function distToSegmentSq(
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

const RIVER_POINTS: [number, number][] = [
  [-23.5, 3.2],
  [-17.5, 8.8],
  [-12.0, 14.5],
  [-8.2, 21.5],
  [-5.8, 28.4],
];

const TRAIL_ROUTES: [number, number][] = [
  [-15, 10],
  [-14, -12],
  [13, -12],
  [15, 10],
  [0, 26.5],
];

function detectIslandSurface(x: number, z: number): FootstepSurface {
  // 1. Wooden structures: River Bridge (rotated 0.72 rad at [-11.4, 14.5]), Jetty, Front Pier
  const bdx = x - -11.4;
  const bdz = z - 14.5;
  const cosB = 0.7518; // cos(0.72)
  const sinB = 0.6594; // sin(0.72)
  const localBx = bdx * cosB - bdz * sinB;
  const localBz = bdx * sinB + bdz * cosB;
  if (Math.abs(localBx) <= 3.0 && Math.abs(localBz) <= 1.25) {
    return 'wood';
  }
  if (Math.abs(x - -14.2) <= 1.4 && Math.abs(z - 10.6) <= 0.9) {
    return 'wood';
  }
  if (Math.abs(x) <= 2.3 && z >= 26.8 && z <= 31.2) {
    return 'wood';
  }

  // 2. Lab / Futuristic Tile Platforms: Central Eco-Plaza, Makmal Suara (Zone 4), Bandar Eco-City (Zone 2)
  if (x * x + z * z <= 7.6 * 7.6) {
    return 'lab';
  }
  const dx4 = x - 15;
  const dz4 = z - 10;
  if (dx4 * dx4 + dz4 * dz4 <= 5.0 * 5.0) {
    return 'lab';
  }
  const dx2 = x - -14;
  const dz2 = z - -12;
  if (dx2 * dx2 + dz2 * dz2 <= 6.2 * 6.2) {
    return 'lab';
  }

  // 3. Shallow River / Highland Pool Water
  const dpx = x - 18.6;
  const dpz = z - -17.0;
  if (dpx * dpx + dpz * dpz <= 3.3 * 3.3) {
    return 'water';
  }
  for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
    const [ax, az] = RIVER_POINTS[i];
    const [bx, bz] = RIVER_POINTS[i + 1];
    if (distToSegmentSq(x, z, ax, az, bx, bz) <= 2.55 * 2.55) {
      return 'water';
    }
  }

  // 4. Soil / Cobblestone Walkways, Factory Dirt Yard, Forest Clearing & Rocky Cliff Rim
  for (let i = 0; i < TRAIL_ROUTES.length; i++) {
    const [tx, tz] = TRAIL_ROUTES[i];
    if (distToSegmentSq(x, z, 0, 0, tx, tz) <= 1.45 * 1.45) {
      return 'soil';
    }
  }
  const dfx = x - -20.8;
  const dfz = z - 7.6;
  if (dfx * dfx + dfz * dfz <= 4.4 * 4.4) {
    return 'soil';
  }
  const d3x = x - 13;
  const d3z = z - -12;
  if (d3x * d3x + d3z * d3z <= 4.6 * 4.6) {
    return 'soil';
  }
  if (x * x + z * z >= 22.8 * 22.8) {
    return 'soil';
  }

  // 5. Lush Island Grass Meadow (Default)
  return 'grass';
}

interface PortalSequenceState {
  missionId: number;
  elapsed: number;
  duration: number;
  ignited: boolean;
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  portalCenterX: number;
  portalCenterZ: number;
}

interface TeleportOutState {
  missionId: number;
  elapsed: number;
  duration: number;
  warped: boolean;
}

export function EcoWorldCanvas({
  user,
  missions,
  cameraMode,
  focusedMissionId,
  activeRoomId,
  m1CluesFound,
  dpadVector,
  travelTargetMissionId = null,
  teleportOutMissionId = null,
  onSelectMission,
  onArriveAtMission,
  onTeleportDeparted,
  onTravelPhaseChange,
  onTravelFailed,
  onCollectClue,
  onHoverInfo,
  onProximityZoneChange,
  onMission5IntroChange,
  m5SkipTrigger = 0,
  paused = false,
}: EcoWorldCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Store latest props in refs so WebGL loop reads live state without tearing down scene
  const propsRef = useRef({
    user,
    missions,
    cameraMode,
    focusedMissionId,
    activeRoomId,
    m1CluesFound,
    dpadVector,
    travelTargetMissionId,
    teleportOutMissionId,
    onSelectMission,
    onArriveAtMission,
    onTeleportDeparted,
    onTravelPhaseChange,
    onTravelFailed,
    onCollectClue,
    onHoverInfo,
    onProximityZoneChange,
    onMission5IntroChange,
    m5SkipTrigger,
    paused,
  });
  propsRef.current = {
    user,
    missions,
    cameraMode,
    focusedMissionId,
    activeRoomId,
    m1CluesFound,
    dpadVector,
    travelTargetMissionId,
    teleportOutMissionId,
    onSelectMission,
    onArriveAtMission,
    onTeleportDeparted,
    onTravelPhaseChange,
    onTravelFailed,
    onCollectClue,
    onHoverInfo,
    onProximityZoneChange,
    onMission5IntroChange,
    m5SkipTrigger,
    paused,
  };
  const lastProxZoneRef = useRef<number>(0);
  const hoveredMissionIdRef = useRef<number | null>(null);

  // Live avatar position + A* waypoint queue + portal activation sequence
  const agentPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 5.2 });
  const waypointsRef = useRef<THREE.Vector3[]>([]);
  const pendingArrivalMissionIdRef = useRef<number | null>(null);
  const portalAnimRef = useRef<PortalSequenceState | null>(null);
  const teleportOutRef = useRef<TeleportOutState | null>(null);
  const userOrbitingRef = useRef(false);
  const prevFocusRef = useRef<number>(focusedMissionId);
  const prevCamModeRef = useRef<CameraMode>(cameraMode);
  const prevRoomIdRef = useRef<number | null>(activeRoomId);

  useEffect(() => {
    if (travelTargetMissionId) {
      userOrbitingRef.current = false;
      portalAnimRef.current = null;
      const wp = MISSION_PORTAL_WAYPOINTS[travelTargetMissionId];
      if (!wp) {
        propsRef.current.onTravelFailed?.(travelTargetMissionId);
        return;
      }
      const path = findIslandPath(
        agentPosRef.current.x,
        agentPosRef.current.z,
        wp.entrance[0],
        wp.entrance[1]
      );
      if (!path || path.length === 0) {
        waypointsRef.current = [];
        pendingArrivalMissionIdRef.current = null;
        propsRef.current.onTravelPhaseChange?.(null);
        propsRef.current.onTravelFailed?.(travelTargetMissionId);
        return;
      }
      waypointsRef.current = path;
      pendingArrivalMissionIdRef.current = travelTargetMissionId;
      propsRef.current.onTravelPhaseChange?.('walking');
    } else {
      pendingArrivalMissionIdRef.current = null;
      portalAnimRef.current = null;
      waypointsRef.current = [];
      propsRef.current.onTravelPhaseChange?.(null);
    }
  }, [travelTargetMissionId]);

  useEffect(() => {
    if (prevRoomIdRef.current !== activeRoomId) {
      userOrbitingRef.current = false;
      prevRoomIdRef.current = activeRoomId;
    }
    if (
      prevFocusRef.current !== focusedMissionId ||
      prevCamModeRef.current !== cameraMode
    ) {
      userOrbitingRef.current = false;
      const wp = MISSION_PORTAL_WAYPOINTS[focusedMissionId];
      if (
        !travelTargetMissionId &&
        !portalAnimRef.current &&
        wp &&
        (cameraMode === 'zone' || prevFocusRef.current !== focusedMissionId)
      ) {
        // Walk agent near the focused zone entrance smoothly without entering portal
        const path = findIslandPath(
          agentPosRef.current.x,
          agentPosRef.current.z,
          wp.entrance[0],
          wp.entrance[1]
        );
        if (path && path.length > 0) {
          waypointsRef.current = path;
        }
      }
      prevFocusRef.current = focusedMissionId;
      prevCamModeRef.current = cameraMode;
    }
  }, [focusedMissionId, cameraMode, activeRoomId, travelTargetMissionId]);

  useEffect(() => {
    if (teleportOutMissionId) {
      userOrbitingRef.current = false;
      waypointsRef.current = [];
      pendingArrivalMissionIdRef.current = null;
      portalAnimRef.current = null;
      teleportOutRef.current = {
        missionId: teleportOutMissionId,
        elapsed: 0,
        duration: 1.45,
        warped: false,
      };
      playSFX('portal_charge');
    } else {
      teleportOutRef.current = null;
    }
  }, [teleportOutMissionId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Detection (GPU renderer string, never userAgent)
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x38bdf8);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0048);

    // Studio Environment Reflection (PMREM RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 240);
    camera.position.set(0, 26, 42);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = 0.25;
    controls.minDistance = 8;
    controls.maxDistance = 78;
    controls.target.set(0, 1.5, 0);

    controls.addEventListener('start', () => {
      userOrbitingRef.current = true;
    });

    // 2. Cheerful Warm/Cool Sunlit Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3f8f4e, 1.05);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.05);
    sunLight.position.set(26, 40, 24);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 115;
    const d = 35;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.65);
    rimLight.position.set(-28, 22, -28);
    scene.add(rimLight);

    // 3. Floating 3D Adventure Island World (inside islandWorldGroup so rooms replace view cleanly)
    const islandWorldGroup = new THREE.Group();
    scene.add(islandWorldGroup);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();

    const advWorld = buildAdventureWorld(propsRef.current.missions, maxAnisotropy);
    islandWorldGroup.add(advWorld.group);

    // 4. Build All 5 Interactive 3D Zones
    const zone1 = buildZone1RiverFactory(maxAnisotropy);
    islandWorldGroup.add(zone1.group);

    const zone2 = buildZone2ToxicCity(maxAnisotropy);
    islandWorldGroup.add(zone2.group);

    const zone3 = buildZone3HopeForest();
    islandWorldGroup.add(zone3.group);

    const zone4 = buildZone4VoiceLab();
    islandWorldGroup.add(zone4.group);

    const zone5 = buildZone5EcoMonument(maxAnisotropy);
    islandWorldGroup.add(zone5.group);

    // Zone Waypoint Beacons & Vertical Portal Gateways
    const beacons = propsRef.current.missions.map((m) => {
      const wp = MISSION_PORTAL_WAYPOINTS[m.id];
      const facingOffset: [number, number] | undefined = wp
        ? [wp.entrance[0] - m.position[0], wp.entrance[1] - m.position[2]]
        : undefined;
      const b = buildZoneBeacon(m.id, m.shortTitle, `Misi ${m.id}`, m.color, facingOffset);
      b.group.position.set(m.position[0], 0, m.position[2]);
      islandWorldGroup.add(b.group);
      return { missionId: m.id, baseColor: new THREE.Color(m.color), ...b };
    });

    // 5. Playable 3D Human Eco-Guardian Avatar
    let currentAvatarId: AvatarId = propsRef.current.user?.avatar || 'rimba';
    let agentRig: HumanAgentRig = buildHumanEcoAgent(currentAvatarId, shadowTex, {
      maxAnisotropy,
      showPedestal: false,
    });
    agentRig.group.position.set(0, 0, 5.2);
    islandWorldGroup.add(agentRig.group);

    const rebuildAgentIfChanged = (nextId: AvatarId) => {
      if (nextId === currentAvatarId) return;
      const pos = agentRig.group.position.clone();
      const rotY = agentRig.group.rotation.y;
      islandWorldGroup.remove(agentRig.group);
      currentAvatarId = nextId;
      agentRig = buildHumanEcoAgent(nextId, shadowTex, {
        maxAnisotropy,
        showPedestal: false,
      });
      agentRig.group.position.copy(pos);
      agentRig.group.rotation.y = rotY;
      islandWorldGroup.add(agentRig.group);
    };

    const applyAgentOpacity = (alpha: number) => {
      agentRig.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if (!mat) return;
            if (mat.userData.__origTransparent === undefined) {
              mat.userData.__origTransparent = mat.transparent;
              mat.userData.__origOpacity = mat.opacity;
            }
            const origTransparent = Boolean(mat.userData.__origTransparent);
            const origOpacity =
              typeof mat.userData.__origOpacity === 'number' ? mat.userData.__origOpacity : 1;
            if (alpha >= 0.999) {
              mat.transparent = origTransparent;
              mat.opacity = origOpacity;
            } else {
              mat.transparent = true;
              mat.opacity = origOpacity * Math.max(0, Math.min(1, alpha));
            }
          });
        }
      });
    };

    // Blue Energy Teleportation FX Rig (light beam, energy rings & digital particles around agent)
    const teleportFxGroup = new THREE.Group();
    teleportFxGroup.visible = false;
    islandWorldGroup.add(teleportFxGroup);

    const teleBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const teleBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.45, 12, 28, 1, true),
      teleBeamMat
    );
    teleBeam.position.y = 6.0;
    teleportFxGroup.add(teleBeam);

    const teleInnerBeamMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const teleInnerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.72, 12, 20, 1, true),
      teleInnerBeamMat
    );
    teleInnerBeam.position.y = 6.0;
    teleportFxGroup.add(teleInnerBeam);

    const teleRings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
    [0x38bdf8, 0x22d3ee, 0x60a5fa].forEach((hex, idx) => {
      const rMat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const rMesh = new THREE.Mesh(new THREE.TorusGeometry(1.18 + idx * 0.22, 0.055, 12, 48), rMat);
      rMesh.rotation.x = Math.PI / 2;
      rMesh.position.y = 0.35 + idx * 0.75;
      teleportFxGroup.add(rMesh);
      teleRings.push({ mesh: rMesh, mat: rMat, phase: idx * 0.33 });
    });

    const teleParticles: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      angle: number;
      radius: number;
      speed: number;
      yOffset: number;
    }[] = [];
    const telePartGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < 28; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xe0f2fe : i % 2 === 0 ? 0x38bdf8 : 0x22d3ee,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pMesh = new THREE.Mesh(telePartGeo, pMat);
      teleportFxGroup.add(pMesh);
      teleParticles.push({
        mesh: pMesh,
        mat: pMat,
        angle: (i / 28) * Math.PI * 2,
        radius: 0.85 + (i % 5) * 0.24,
        speed: 3.2 + (i % 4) * 0.9,
        yOffset: (i % 7) * 0.42,
      });
    }

    // Cached 3D Virtual Mission Rooms (built lazily on first visit to keep startup fast)
    const roomCache = new Map<number, MissionRoomHandle>();
    const getOrBuildRoom = (roomId: number): MissionRoomHandle | null => {
      if (roomId < 1 || roomId > 5) return null;
      let handle = roomCache.get(roomId);
      if (!handle) {
        handle = buildMissionRoom(roomId as 1 | 2 | 3 | 4 | 5, maxAnisotropy);
        handle.group.visible = false;
        scene.add(handle.group);
        roomCache.set(roomId, handle);
      }
      return handle;
    };

    // 6. Keyboard & Pointer Raycasting Interaction
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      keys[e.code] = true;
      if (
        !pendingArrivalMissionIdRef.current &&
        !portalAnimRef.current &&
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code
        )
      ) {
        waypointsRef.current = [];
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const groundRaycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const getInteractiveTargets = () => {
      const list: THREE.Object3D[] = beacons.map((b) => b.hitProxy);
      Object.values(zone1.clueMeshes).forEach((g) => {
        const hit = g.children.find((ch) => ch.userData.type === 'clue');
        if (hit) list.push(hit);
      });
      return list;
    };

    const updateMouseCoords = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _rayOrigin.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayOrigin.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      unlockAudioOnUserGesture();
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (propsRef.current.activeRoomId) {
        hoveredMissionIdRef.current = null;
        renderer.domElement.style.cursor = 'grab';
        propsRef.current.onHoverInfo(null);
        return;
      }
      const now = performance.now();
      if (now - lastHoverTime < 60) return;
      lastHoverTime = now;

      updateMouseCoords(e.clientX, e.clientY);
      raycaster.setFromCamera(_rayOrigin, camera);
      const hits = raycaster.intersectObjects(getInteractiveTargets(), false);

      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        renderer.domElement.style.cursor = 'pointer';
        if (ud.type === 'zone') {
          hoveredMissionIdRef.current = ud.missionId;
          const m = propsRef.current.missions.find((x) => x.id === ud.missionId);
          propsRef.current.onHoverInfo(m ? `Klik untuk buka Misi ${m.id}: ${m.title}` : null);
        } else if (ud.type === 'clue') {
          hoveredMissionIdRef.current = null;
          const clue = M1_CLUES_3D.find((c) => c.id === ud.clueId);
          propsRef.current.onHoverInfo(clue ? `🔍 Bukti 3D: ${clue.title}` : null);
        }
      } else {
        hoveredMissionIdRef.current = null;
        renderer.domElement.style.cursor = 'grab';
        propsRef.current.onHoverInfo(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (propsRef.current.activeRoomId) return;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 8) return; // Was a camera drag, not a click

      updateMouseCoords(e.clientX, e.clientY);
      raycaster.setFromCamera(_rayOrigin, camera);
      const hits = raycaster.intersectObjects(getInteractiveTargets(), false);

      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        if (ud.type === 'clue') {
          const clue = M1_CLUES_3D.find((c) => c.id === ud.clueId);
          if (clue && !pendingArrivalMissionIdRef.current && !portalAnimRef.current) {
            const cluePath = findIslandPath(
              agentRig.group.position.x,
              agentRig.group.position.z,
              clue.position[0],
              clue.position[2] + 1.8
            );
            if (cluePath && cluePath.length > 0) {
              waypointsRef.current = cluePath;
            }
            propsRef.current.onCollectClue(clue);
          }
          return;
        }
        if (ud.type === 'zone') {
          propsRef.current.onSelectMission(ud.missionId);
          return;
        }
      }

      // Click-to-walk on island ground if logged in as student (disabled during auto-walk / portal entry)
      if (
        propsRef.current.user?.role === 'murid' &&
        !pendingArrivalMissionIdRef.current &&
        !portalAnimRef.current
      ) {
        groundRaycaster.setFromCamera(_rayOrigin, camera);
        const groundHits = groundRaycaster.intersectObject(advWorld.islandGround, false);
        if (groundHits.length > 0) {
          const pt = groundHits[0].point;
          const distFromCenter = Math.hypot(pt.x, pt.z);
          if (distFromCenter < 24.4) {
            const walkPath = findIslandPath(
              agentRig.group.position.x,
              agentRig.group.position.z,
              pt.x,
              pt.z
            );
            if (walkPath && walkPath.length > 0) {
              waypointsRef.current = walkPath;
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // WebGL Context Loss Safety
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Resize Handler
    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Continuous Animation & Physics Loop (Software-WebGL paced via afterDraw)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastFootstepIdx = -1;
    let lastTickRoomId: number | null = null;
    let lastM5SkipTrigger = propsRef.current.m5SkipTrigger ?? 0;
    let lastM5Phase = 0;
    let lastM5Done = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      if (propsRef.current.paused) {
        lastFootstepIdx = -1;
        clock.getDelta();
        frameId = window.setTimeout(tick, 120);
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const {
        user: curUser,
        cameraMode: curCamMode,
        focusedMissionId: curFocusId,
        activeRoomId: curRoomId,
        m1CluesFound: curClues,
        dpadVector: curDpad,
        missions: curMissions,
      } = propsRef.current;

      // Switch between EcoWorld Island Map and dedicated 3D Virtual Mission Room
      const activeRoom = curRoomId ? getOrBuildRoom(curRoomId) : null;
      islandWorldGroup.visible = !activeRoom;
      roomCache.forEach((rm, rid) => {
        rm.group.visible = Boolean(activeRoom && rid === activeRoom.id);
      });

      if (activeRoom) {
        if (lastTickRoomId !== activeRoom.id) {
          lastTickRoomId = activeRoom.id;
          userOrbitingRef.current = false;
          if (activeRoom.id === 5) {
            activeRoom.resetIntro?.();
            lastM5Phase = 0;
            lastM5Done = false;
          }
        }
        if (activeRoom.id === 5) {
          if (curUser?.avatar) {
            activeRoom.setAvatarId?.(curUser.avatar);
          }
          const curSkip = propsRef.current.m5SkipTrigger ?? 0;
          if (curSkip !== lastM5SkipTrigger) {
            lastM5SkipTrigger = curSkip;
            activeRoom.skipIntro?.();
          }
        }

        skyColor.setHex(activeRoom.bgColor);
        (scene.fog as THREE.FogExp2).color.setHex(activeRoom.fogColor);
        (scene.fog as THREE.FogExp2).density = activeRoom.id === 5 ? 0.0085 : 0.012;
        controls.minDistance = 4;
        controls.maxDistance = 24;
        controls.maxPolarAngle = Math.PI / 2.02;

        const mKey = `m${activeRoom.id}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
        const mp = curUser?.progress?.[mKey];
        const roomRestored = Boolean(mp && ('submitted' in mp ? mp.submitted : mp.completed));
        activeRoom.animate(elapsed, dt, roomRestored);

        if (activeRoom.updateIntroCamera) {
          const status = activeRoom.updateIntroCamera(
            camera,
            controls.target,
            dt,
            userOrbitingRef.current
          );
          if (status.phase !== lastM5Phase || status.done !== lastM5Done) {
            lastM5Phase = status.phase;
            lastM5Done = status.done;
            propsRef.current.onMission5IntroChange?.(status);
          }
        } else if (!userOrbitingRef.current) {
          _desiredCamPos.set(...activeRoom.cameraPos);
          _desiredTarget.set(...activeRoom.cameraTarget);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 5.2, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 5.2, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 5.2, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredTarget.x, 5.5, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredTarget.y, 5.5, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredTarget.z, 5.5, dt);
        }

        controls.update();
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      } else {
        lastTickRoomId = null;
        skyColor.setHex(0x38bdf8);
        (scene.fog as THREE.FogExp2).color.setHex(0x7dd3fc);
        (scene.fog as THREE.FogExp2).density = 0.0048;
        controls.minDistance = 8;
        controls.maxDistance = 78;
        controls.maxPolarAngle = Math.PI / 2.15;
      }

      // Animate floating island environment (clouds, waterfalls, birds, butterflies, sun, portal)
      advWorld.animate(elapsed, dt);

      // Update Avatar appearance if student switched avatar
      if (curUser?.avatar) {
        rebuildAgentIfChanged(curUser.avatar);
      }

      // Show 3D avatar unless viewing in First-Person POV (always visible during scripted portal travel/teleport)
      const isTeleportingOut = teleportOutRef.current !== null;
      const isFpsMode =
        curUser?.role === 'murid' &&
        curCamMode === 'firstPerson' &&
        pendingArrivalMissionIdRef.current === null &&
        portalAnimRef.current === null &&
        !isTeleportingOut;
      agentRig.group.visible = !isFpsMode;

      // Keyboard / D-Pad / A* Pathfinding / Portal Ignition Sequence
      let inputX = curDpad.x;
      let inputZ = curDpad.z;
      if (keys['KeyW'] || keys['ArrowUp']) inputZ -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) inputZ += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) inputX -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) inputX += 1;

      let isMoving = false;
      const portalSeq = portalAnimRef.current;
      const teleSeq = teleportOutRef.current;

      if (teleSeq) {
        // Blue Energy Beam + Rings + Digital Particles + Gradual Agent Dissolve
        teleSeq.elapsed += dt;
        const p = Math.min(1, teleSeq.elapsed / teleSeq.duration);
        teleportFxGroup.visible = true;
        teleportFxGroup.position.set(agentRig.group.position.x, 0, agentRig.group.position.z);

        const beamEnvelope = Math.sin(Math.min(1, p * 1.05) * Math.PI);
        teleBeamMat.opacity = 0.22 + beamEnvelope * 0.52;
        teleInnerBeamMat.opacity = 0.3 + beamEnvelope * 0.65;
        teleBeam.rotation.y += dt * 3.8;
        teleBeam.scale.set(0.85 + Math.sin(p * Math.PI) * 0.35, 1, 0.85 + Math.sin(p * Math.PI) * 0.35);

        teleRings.forEach((rg, idx) => {
          const cycle = (p * 1.8 + rg.phase) % 1;
          rg.mesh.position.y = 0.2 + cycle * 3.1;
          rg.mesh.rotation.z += dt * (4.5 + idx * 1.6);
          const s = 0.8 + Math.sin(cycle * Math.PI) * 0.45;
          rg.mesh.scale.setScalar(s);
          rg.mat.opacity = Math.sin(cycle * Math.PI) * 0.9;
        });

        teleParticles.forEach((pt) => {
          pt.angle += dt * pt.speed;
          const swirlR = pt.radius * (1.05 - p * 0.35);
          pt.mesh.position.x = Math.cos(pt.angle) * swirlR;
          pt.mesh.position.z = Math.sin(pt.angle) * swirlR;
          pt.mesh.position.y = ((pt.yOffset + p * 3.6) % 3.4) + 0.15;
          pt.mesh.rotation.x += dt * 5;
          pt.mesh.rotation.y += dt * 6;
          pt.mat.opacity = Math.max(0.15, beamEnvelope * 0.95);
        });

        const fadeAlpha = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.72);
        applyAgentOpacity(fadeAlpha);
        agentRig.group.position.y = p * 0.65;
        agentRig.group.rotation.y += dt * (2.2 + p * 5.5);
        agentRig.group.scale.setScalar(1 - Math.max(0, p - 0.55) * 0.42);

        if (p >= 0.55 && !teleSeq.warped) {
          teleSeq.warped = true;
          playSFX('warp');
        }

        if (p >= 1) {
          const departedMissionId = teleSeq.missionId;
          teleportOutRef.current = null;
          teleportFxGroup.visible = false;
          applyAgentOpacity(1);
          agentRig.group.position.y = 0;
          agentRig.group.scale.setScalar(1);
          propsRef.current.onTeleportDeparted?.(departedMissionId);
        }
      } else {
        if (teleportFxGroup.visible) {
          teleportFxGroup.visible = false;
          applyAgentOpacity(1);
        }
      }

      if (teleSeq) {
        // Skip normal walking/portal controls while teleport beam dissolves agent
      } else if (portalSeq) {
        // Cinematic Portal Entrance Sequence: stop -> face portal -> ignite -> step into portal
        portalSeq.elapsed += dt;
        const p = Math.min(1, portalSeq.elapsed / portalSeq.duration);
        const faceAngle = Math.atan2(
          portalSeq.portalCenterX - agentRig.group.position.x,
          portalSeq.portalCenterZ - agentRig.group.position.z
        );
        agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, faceAngle, 12, dt);

        if (p > 0.36) {
          const stepT = Math.min(1, (p - 0.36) / 0.56);
          const smoothT = stepT * stepT * (3 - 2 * stepT);
          agentRig.group.position.x = THREE.MathUtils.lerp(portalSeq.startX, portalSeq.targetX, smoothT);
          agentRig.group.position.z = THREE.MathUtils.lerp(portalSeq.startZ, portalSeq.targetZ, smoothT);
          agentRig.group.position.y = Math.sin(stepT * Math.PI) * 0.38;
          isMoving = stepT < 0.85;
        }
        if (p > 0.85) {
          const shrink = Math.max(0.25, 1 - ((p - 0.85) / 0.15) * 0.72);
          agentRig.group.scale.setScalar(shrink);
        }
        if (p >= 0.62 && !portalSeq.ignited) {
          portalSeq.ignited = true;
          playSFX('portal');
        }
        if (p >= 1) {
          const arrivedId = portalSeq.missionId;
          agentRig.group.position.y = 0;
          agentRig.group.scale.setScalar(1);
          portalAnimRef.current = null;
          pendingArrivalMissionIdRef.current = null;
          propsRef.current.onTravelPhaseChange?.(null);
          propsRef.current.onArriveAtMission?.(arrivedId);
        }
      } else if (
        pendingArrivalMissionIdRef.current === null &&
        curUser?.role === 'murid' &&
        (Math.abs(inputX) > 0.05 || Math.abs(inputZ) > 0.05)
      ) {
        agentRig.group.position.y = 0;
        agentRig.group.scale.setScalar(1);
        if (isFpsMode) {
          userOrbitingRef.current = false;
          // In First-Person POV: A/D rotates view, W/S walks forward/backward along facing vector
          if (Math.abs(inputX) > 0.05) {
            agentRig.group.rotation.y -= inputX * 2.4 * dt;
          }
          if (Math.abs(inputZ) > 0.05) {
            const rotY = agentRig.group.rotation.y;
            _moveDir.set(Math.sin(rotY), 0, Math.cos(rotY)).multiplyScalar(-inputZ);
            const speed = 9.5;
            agentRig.group.position.addScaledVector(_moveDir, speed * dt);
            const resolved = resolveAgentCollisions(
              agentRig.group.position.x,
              agentRig.group.position.z,
              0.52
            );
            agentRig.group.position.x = resolved.x;
            agentRig.group.position.z = resolved.z;
            isMoving = true;
          }
        } else {
          // Camera-relative movement on XZ plane with smooth obstacle collision sliding
          camera.getWorldDirection(_forwardVec);
          _forwardVec.y = 0;
          _forwardVec.normalize();
          _rightVec.crossVectors(_forwardVec, THREE.Object3D.DEFAULT_UP).normalize();

          _moveDir
            .set(0, 0, 0)
            .addScaledVector(_forwardVec, -inputZ)
            .addScaledVector(_rightVec, inputX);
          if (_moveDir.lengthSq() > 0.001) {
            _moveDir.normalize();
            const speed = 9.5;
            agentRig.group.position.addScaledVector(_moveDir, speed * dt);
            const resolved = resolveAgentCollisions(
              agentRig.group.position.x,
              agentRig.group.position.z,
              0.52
            );
            agentRig.group.position.x = resolved.x;
            agentRig.group.position.z = resolved.z;
            const targetRot = Math.atan2(_moveDir.x, _moveDir.z);
            agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 11, dt);
            isMoving = true;
          }
        }
      } else if (waypointsRef.current.length > 0) {
        agentRig.group.position.y = 0;
        agentRig.group.scale.setScalar(1);
        const currentWp = waypointsRef.current[0];
        _moveDir.subVectors(currentWp, agentRig.group.position);
        _moveDir.y = 0;
        const dist = _moveDir.length();
        const isFinalWp = waypointsRef.current.length === 1;
        const arriveThreshold = isFinalWp ? (pendingArrivalMissionIdRef.current ? 0.55 : 0.4) : 0.48;

        if (dist > arriveThreshold) {
          _moveDir.normalize();
          const speed = pendingArrivalMissionIdRef.current ? 11.8 : 9.8;
          agentRig.group.position.addScaledVector(_moveDir, Math.min(speed * dt, dist));
          const targetRot = Math.atan2(_moveDir.x, _moveDir.z);
          agentRig.group.rotation.y = dampAngle(agentRig.group.rotation.y, targetRot, 12, dt);
          isMoving = true;
        } else {
          waypointsRef.current.shift();
          if (waypointsRef.current.length === 0) {
            const arrivedId = pendingArrivalMissionIdRef.current;
            if (arrivedId !== null) {
              const wp = MISSION_PORTAL_WAYPOINTS[arrivedId];
              const pc = wp ? wp.portalCenter : [agentRig.group.position.x, agentRig.group.position.z];
              playSFX('portal_charge');
              propsRef.current.onTravelPhaseChange?.('activating');
              portalAnimRef.current = {
                missionId: arrivedId,
                elapsed: 0,
                duration: 1.15,
                ignited: false,
                startX: agentRig.group.position.x,
                startZ: agentRig.group.position.z,
                targetX: agentRig.group.position.x * 0.62 + pc[0] * 0.38,
                targetZ: agentRig.group.position.z * 0.62 + pc[1] * 0.38,
                portalCenterX: pc[0],
                portalCenterZ: pc[1],
              };
            }
          }
        }
      } else {
        agentRig.group.position.y = 0;
        agentRig.group.scale.setScalar(1);
      }

      agentPosRef.current.x = agentRig.group.position.x;
      agentPosRef.current.z = agentRig.group.position.z;

      // Human Guardian Natural Idle, Blinking, Breathing, Greeting Wave & Walk Cycle
      animateHumanAgent(agentRig, elapsed, dt, {
        isMoving,
        hovered: false,
        selected: true,
      });

      // Surface-specific 3D Footstep SFX synced with agent walk cycle
      if (isMoving && curUser?.role === 'murid') {
        const stepIdx = Math.floor((elapsed * 11.5) / Math.PI);
        if (stepIdx !== lastFootstepIdx) {
          lastFootstepIdx = stepIdx;
          const surface = detectIslandSurface(
            agentRig.group.position.x,
            agentRig.group.position.z
          );
          playFootstep(surface, stepIdx % 2 === 0 ? 'left' : 'right');
        }
      } else {
        lastFootstepIdx = -1;
      }

      // Proximity Zone Detection for Adaptive Ambient Music
      if (curUser?.role === 'murid' && propsRef.current.onProximityZoneChange) {
        let nearZone = 0;
        let bestDistSq = 64; // 8 units radius
        for (let i = 0; i < curMissions.length; i++) {
          const m = curMissions[i];
          const dx = agentRig.group.position.x - m.position[0];
          const dz = agentRig.group.position.z - m.position[2];
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            nearZone = m.id;
          }
        }
        if (nearZone !== lastProxZoneRef.current) {
          lastProxZoneRef.current = nearZone;
          propsRef.current.onProximityZoneChange(nearZone);
        }
      }

      // Zone Visual Restoration States (Reflects real student progress!)
      const m1Done = Boolean(curUser?.progress?.m1.completed);
      const m2Done = Boolean(curUser?.progress?.m2.completed);
      const m3Done = Boolean(curUser?.progress?.m3.completed);
      const m4Done = Boolean(curUser?.progress?.m4.completed);

      // Bright flowing turquoise river & bobbing rescue boat (factory pipe signals pollution until solved)
      zone1.riverTex.offset.x -= dt * 0.42;
      zone1.rescueBoat.position.y = 0.24 + Math.sin(elapsed * 2.2) * 0.06;
      zone1.rescueBoat.rotation.z = Math.sin(elapsed * 1.8) * 0.04;
      zone1.riverMat.color.lerp(
        new THREE.Color(m1Done ? 0x38bdf8 : 0x06b6d4),
        Math.min(1, dt * 2.5)
      );
      zone1.riverMat.emissive.lerp(
        new THREE.Color(m1Done ? 0x0ea5e9 : 0x0284c7),
        Math.min(1, dt * 2.5)
      );
      zone1.sludgeStream.visible = !m1Done;

      // Update 3D Clue crystals in Zone 1 (turn bright green once collected)
      (['paip', 'ikan', 'bau'] as const).forEach((cid, idx) => {
        const g = zone1.clueMeshes[cid];
        const orb = g.getObjectByName('clueOrb') as THREE.Mesh | undefined;
        if (orb) {
          orb.rotation.y += dt * 1.8;
          orb.position.y = 1.05 + Math.sin(elapsed * 3 + idx) * 0.16;
          const found = curClues.includes(cid);
          const mat = orb.material as THREE.MeshStandardMaterial;
          if (found) {
            mat.color.setHex(0x22c55e);
            mat.emissive.setHex(0x22c55e);
          }
        }
      });

      // Zone 2 Smog Animation (Clears when Misi 2 completed)
      zone2.smogGroup.children.forEach((p) => {
        const mesh = p as THREE.Mesh;
        const baseY = mesh.userData.baseY as number;
        const phase = mesh.userData.phase as number;
        mesh.position.y = baseY + Math.sin(elapsed * 1.4 + phase) * 0.45;
        mesh.scale.setScalar(
          THREE.MathUtils.damp(mesh.scale.x, m2Done ? 0.05 : 1.0, 3, dt)
        );
        mesh.visible = !m2Done || mesh.scale.x > 0.1;
      });

      // Zone 3 Wind Turbine spin (Spins faster once Hutan Harapan restored)
      zone3.turbineBlades.rotation.z -= dt * (m3Done ? 2.6 : 0.7);

      // Zone 4 Makmal Suara harmonic wave rings
      zone4.dish.rotation.y = Math.sin(elapsed * 0.5) * 0.35;
      zone4.waveRings.forEach((ring, idx) => {
        const baseY = ring.userData.baseY as number;
        ring.position.y = baseY + Math.sin(elapsed * 2.5 + idx * 0.9) * 0.22;
        const pulseScale = 1 + Math.sin(elapsed * (m4Done ? 4 : 1.8) + idx) * 0.09;
        ring.scale.set(pulseScale, pulseScale, 1);
      });

      // Zone 5 Central Eco-Globe Monument rotation
      zone5.earthGlobe.rotation.y += dt * 0.35;
      zone5.goldRing.rotation.z += dt * 0.5;

      // Zone Beacons floating crystal, portal gateway arches, swirling vortex, light beam & shockwave
      const activeSelectId = propsRef.current.travelTargetMissionId ?? curFocusId;
      const activePortalSeq = portalAnimRef.current;
      beacons.forEach((b, idx) => {
        const isHighlighted =
          hoveredMissionIdRef.current === b.missionId || activeSelectId === b.missionId;
        const isActivating = Boolean(activePortalSeq && activePortalSeq.missionId === b.missionId);
        const actProg = isActivating && activePortalSeq
          ? Math.min(1, activePortalSeq.elapsed / activePortalSeq.duration)
          : 0;

        const mKey = `m${b.missionId}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
        const mp = curUser?.progress?.[mKey];
        const done = Boolean(mp && ('submitted' in mp ? mp.submitted : mp.completed));
        const unlocked = (curUser?.unlockedMission ?? 1) >= b.missionId;
        const lockedForStudent = !unlocked && curUser?.role === 'murid';

        const hoverScale = THREE.MathUtils.damp(
          b.crystal.scale.x,
          isActivating ? 1.38 : isHighlighted ? 1.24 : 1.0,
          8,
          dt
        );
        b.crystal.scale.setScalar(hoverScale);
        b.crystal.rotation.y += dt * (isActivating ? 5.2 : isHighlighted ? 2.4 : 1.4);
        b.crystal.position.y =
          (isHighlighted ? 4.9 : 4.6) + Math.sin(elapsed * 2.4 + idx) * 0.32;

        b.starMesh.rotation.y += dt * (isActivating ? 5.6 : isHighlighted ? 3.0 : 1.9);
        b.starMesh.position.y =
          (isHighlighted ? 5.95 : 5.65) + Math.sin(elapsed * 2.6 + idx) * 0.26;
        b.starMesh.scale.setScalar(isActivating ? 1.35 : isHighlighted ? 1.22 : 1.0);

        b.ring.rotation.z += dt * (isActivating ? 2.4 : 0.45);
        b.outerRing.rotation.z -= dt * (isActivating ? 2.8 : 0.55);
        const ringPulse = isActivating
          ? 1.24 + Math.sin(elapsed * 16) * 0.08
          : isHighlighted
          ? 1.12 + Math.sin(elapsed * 5) * 0.06
          : 1.0;
        b.ring.scale.setScalar(THREE.MathUtils.damp(b.ring.scale.x, ringPulse, 8, dt));
        b.outerRing.scale.setScalar(THREE.MathUtils.damp(b.outerRing.scale.x, ringPulse, 8, dt));

        const rMat = b.ring.material as THREE.MeshStandardMaterial;
        rMat.emissiveIntensity = isActivating
          ? 2.2
          : lockedForStudent
          ? 0.28
          : isHighlighted
          ? 1.45 + Math.sin(elapsed * 5) * 0.35
          : 0.85;

        const cMat = b.crystal.material as THREE.MeshPhysicalMaterial;
        if (done) {
          cMat.color.setHex(0xfacc15);
          cMat.emissive.setHex(0xeab308);
        } else if (lockedForStudent) {
          cMat.color.setHex(0x64748b);
          cMat.emissive.setHex(0x334155);
        } else {
          cMat.color.copy(b.baseColor);
          cMat.emissive.copy(b.baseColor);
        }
        cMat.emissiveIntensity = isActivating ? 1.6 : isHighlighted ? 1.15 : 0.65;

        // Vertical Portal Gateway Arch, Vortex Disc, Light Beam & Orbiting Sparks
        const archMat = b.portalArchRing.material as THREE.MeshStandardMaterial;
        archMat.emissiveIntensity = isActivating
          ? 2.3
          : lockedForStudent
          ? 0.18
          : isHighlighted
          ? 1.25
          : 0.72;
        const archScale = THREE.MathUtils.damp(
          b.portalArchGroup.scale.x,
          isActivating ? 1.16 : isHighlighted ? 1.06 : 1.0,
          8,
          dt
        );
        b.portalArchGroup.scale.setScalar(archScale);

        const vortexMat = b.portalVortex.material as THREE.MeshBasicMaterial;
        vortexMat.opacity = isActivating
          ? 0.28 + actProg * 0.66
          : lockedForStudent
          ? 0.05
          : isHighlighted
          ? 0.28 + Math.sin(elapsed * 4.5) * 0.08
          : 0.14 + Math.sin(elapsed * 2.5 + idx) * 0.04;
        b.portalVortex.rotation.z += dt * (isActivating ? 6.5 : 1.4);

        const beamMat = b.lightBeam.material as THREE.MeshBasicMaterial;
        beamMat.opacity = isActivating
          ? Math.sin(actProg * Math.PI) * 0.45 + actProg * 0.35
          : isHighlighted && !lockedForStudent
          ? 0.12 + Math.sin(elapsed * 4) * 0.04
          : 0;
        b.lightBeam.scale.set(
          1 + actProg * 0.35,
          1,
          1 + actProg * 0.35
        );
        b.lightBeam.rotation.y += dt * (isActivating ? 3.2 : 0.6);

        const shockMat = b.shockwaveRing.material as THREE.MeshBasicMaterial;
        if (isActivating) {
          const waveScale = 1 + actProg * 2.5;
          b.shockwaveRing.scale.setScalar(waveScale);
          shockMat.opacity = Math.sin(actProg * Math.PI) * 0.75;
        } else {
          b.shockwaveRing.scale.setScalar(1);
          shockMat.opacity = 0;
        }

        b.sparkGroup.visible = !lockedForStudent;
        if (!lockedForStudent) {
          b.sparkGroup.children.forEach((sp, sIdx) => {
            const spData = sp.userData as { angle: number; baseY: number; speed: number };
            const mult = isActivating ? 3.8 : isHighlighted ? 1.7 : 1.0;
            spData.angle += dt * spData.speed * mult;
            const orbitR = isActivating ? 2.2 - actProg * 0.5 : 2.1;
            sp.position.x = Math.cos(spData.angle) * orbitR;
            sp.position.z = Math.sin(spData.angle) * orbitR;
            sp.position.y =
              spData.baseY +
              (isActivating ? actProg * 2.4 : Math.sin(elapsed * 3.2 + sIdx) * 0.25);
            sp.rotation.y += dt * 4;
            sp.scale.setScalar(isActivating ? 1.45 : isHighlighted ? 1.15 : 0.9);
          });
        }
      });

      // Camera Choreography (Smooth damping; pauses when user manually drags OrbitControls)
      if (!curUser) {
        // Login Backdrop: gentle scenic isometric orbit around Floating EcoWorld Island
        const angle = elapsed * 0.14;
        camera.position.set(Math.cos(angle) * 40, 24, Math.sin(angle) * 40);
        controls.target.set(0, 2, 0);
      } else if (!userOrbitingRef.current) {
        if (teleportOutRef.current) {
          const tp = Math.min(1, teleportOutRef.current.elapsed / teleportOutRef.current.duration);
          _desiredTarget.set(
            agentRig.group.position.x,
            1.6 + tp * 0.4,
            agentRig.group.position.z
          );
          _desiredCamPos.set(
            agentRig.group.position.x + 2.6,
            THREE.MathUtils.lerp(8.5, 5.2, tp),
            agentRig.group.position.z + THREE.MathUtils.lerp(11.5, 7.2, tp)
          );
        } else if (portalAnimRef.current) {
          // Dramatic cinematic close-up zoom as portal ignites
          const ps = portalAnimRef.current;
          const p = Math.min(1, ps.elapsed / ps.duration);
          const dx = ps.startX - ps.portalCenterX;
          const dz = ps.startZ - ps.portalCenterZ;
          const dLen = Math.hypot(dx, dz) || 1;
          const zoomDist = THREE.MathUtils.lerp(13.5, 8.8, p);
          _desiredTarget.set(
            THREE.MathUtils.lerp(agentRig.group.position.x, ps.portalCenterX, 0.55),
            2.1,
            THREE.MathUtils.lerp(agentRig.group.position.z, ps.portalCenterZ, 0.55)
          );
          _desiredCamPos.set(
            ps.portalCenterX + (dx / dLen) * zoomDist + 3.2,
            THREE.MathUtils.lerp(10.0, 6.2, p),
            ps.portalCenterZ + (dz / dLen) * zoomDist + 3.8
          );
        } else if (curCamMode === 'firstPerson') {
          controls.minDistance = 0.5;
          controls.maxDistance = 12;
          controls.maxPolarAngle = Math.PI * 0.82;
          const rotY = agentRig.group.rotation.y;
          const ax = agentRig.group.position.x;
          const ay = agentRig.bodyRoot.position.y;
          const az = agentRig.group.position.z;
          _desiredCamPos.set(ax + Math.sin(rotY) * 0.25, 1.86 + ay, az + Math.cos(rotY) * 0.25);
          _desiredTarget.set(ax + Math.sin(rotY) * 7.0, 1.7 + ay, az + Math.cos(rotY) * 7.0);
        } else if (curCamMode === 'follow' || pendingArrivalMissionIdRef.current !== null) {
          _desiredTarget.set(
            agentRig.group.position.x,
            1.6,
            agentRig.group.position.z
          );
          _desiredCamPos.set(
            agentRig.group.position.x,
            12.0,
            agentRig.group.position.z + 16.5
          );
        } else if (curCamMode === 'zone') {
          const zm = curMissions.find((m) => m.id === curFocusId) || curMissions[0];
          const [zx, , zz] = zm.position;
          _desiredTarget.set(zx, 2.0, zz);
          _desiredCamPos.set(zx + (zx >= 0 ? 11 : -11), 13.5, zz + 16);
        } else {
          // Isometric Adventure Overview
          _desiredTarget.set(0, 1.5, 0);
          _desiredCamPos.set(0, 26, 42);
        }

        const camDamp = portalAnimRef.current ? 6.5 : curCamMode === 'firstPerson' ? 12.0 : 4.2;
        const tgtDamp = portalAnimRef.current ? 7.5 : curCamMode === 'firstPerson' ? 14.0 : 5.0;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, camDamp, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, camDamp, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, camDamp, dt);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredTarget.x, tgtDamp, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredTarget.y, tgtDamp, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredTarget.z, tgtDamp, dt);
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    // Cleanup on unmount
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      envRT.dispose();
      roomCache.forEach((rm) => rm.dispose());
      roomCache.clear();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`fixed inset-0 z-0 w-full h-full select-none ${paused ? 'hidden' : ''}`}
      aria-label="Dunia 3D Interaktif EcoWorld"
    />
  );
}
