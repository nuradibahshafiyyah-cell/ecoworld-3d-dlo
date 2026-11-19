import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AvatarId } from '../types/game';
import {
  animateHumanAgent,
  buildHumanEcoAgent,
  HumanAgentRig,
} from '../three/humanAgents';
import { createContactShadowTexture } from '../three/textures';

interface Agent3DStageProps {
  mode: 'lineup' | 'single';
  selectedId: AvatarId;
  hoveredId?: AvatarId | null;
  welcomeBurstKey?: number;
  onHoverAgent?: (id: AvatarId | null) => void;
  onSelectAgent?: (id: AvatarId) => void;
  className?: string;
}

const LINEUP_ORDER: AvatarId[] = ['tirta', 'rimba', 'bayu', 'suara'];
const _rayOrigin = new THREE.Vector2();

export function Agent3DStage({
  mode,
  selectedId,
  hoveredId = null,
  welcomeBurstKey = 0,
  onHoverAgent,
  onSelectAgent,
  className = '',
}: Agent3DStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({
    mode,
    selectedId,
    hoveredId,
    welcomeBurstKey,
    onHoverAgent,
    onSelectAgent,
  });
  propsRef.current = {
    mode,
    selectedId,
    hoveredId,
    welcomeBurstKey,
    onHoverAgent,
    onSelectAgent,
  };

  const lastBurstRef = useRef<number>(welcomeBurstKey);
  const prevSelectedRef = useRef<AvatarId>(selectedId);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

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

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 320;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b2948);
    scene.fog = new THREE.FogExp2(0x0b2948, 0.025);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.2, 60);

    const updateCameraFraming = (w: number, h: number) => {
      const aspect = Math.max(0.6, w / Math.max(1, h));
      if (propsRef.current.mode === 'lineup') {
        // Fit all 4 separate 3D guardians clearly on desktop, tablet, and mobile
        const dist = aspect < 1.3 ? 11.8 : aspect < 1.8 ? 9.5 : 8.2;
        camera.position.set(0, 1.85, dist);
        camera.lookAt(0, 1.25, 0);
      } else {
        camera.position.set(0, 1.62, 4.15);
        camera.lookAt(0, 1.25, 0);
      }
    };
    updateCameraFraming(width, height);

    // Three-point warm/cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f291e, 1.0);
    hemiLight.position.set(0, 12, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    keyLight.position.set(5, 8, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    // EcoWorld Stage Floor & Soft Sky Backdrop Rings
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.6, 0.28, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.42,
        metalness: 0.35,
      })
    );
    floor.position.y = -0.14;
    floor.receiveShadow = true;
    scene.add(floor);

    const floorRim = new THREE.Mesh(
      new THREE.TorusGeometry(7.15, 0.05, 10, 48),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      })
    );
    floorRim.rotation.x = Math.PI / 2;
    floorRim.position.y = 0.01;
    scene.add(floorRim);

    // Decorative Glowing Eco-Particles in Background
    const bgOrbs: THREE.Mesh[] = [];
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.45,
    });
    for (let i = 0; i < 14; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), orbMat);
      orb.position.set(
        (Math.random() - 0.5) * 10,
        0.5 + Math.random() * 3.2,
        -2.2 - Math.random() * 2.5
      );
      orb.userData = { baseY: orb.position.y, phase: i * 0.7 };
      scene.add(orb);
      bgOrbs.push(orb);
    }

    // Build Character Rigs
    const rigs: Partial<Record<AvatarId, HumanAgentRig>> = {};
    const hitProxies: THREE.Mesh[] = [];
    const idsToBuild = mode === 'lineup' ? LINEUP_ORDER : LINEUP_ORDER;

    idsToBuild.forEach((id, idx) => {
      const rig = buildHumanEcoAgent(id, shadowTex, {
        showPedestal: true,
        maxAnisotropy: maxAniso,
      });
      if (mode === 'lineup') {
        const xOffsets = [-3.15, -1.05, 1.05, 3.15];
        rig.group.position.set(xOffsets[idx], 0, idx === 1 || idx === 2 ? 0.18 : 0);
        // Subtle inward turn so outer guardians face camera warmly
        rig.group.rotation.y = (1.5 - idx) * 0.1;
      } else {
        rig.group.position.set(0, 0, 0);
        rig.group.visible = id === propsRef.current.selectedId;
      }
      scene.add(rig.group);
      rigs[id] = rig;

      // Simplified Raycast Proxy Box on Layer 1
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 2.5, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(rig.group.position);
      hit.position.y = 1.25;
      hit.layers.set(1);
      hit.userData = { avatarId: id };
      scene.add(hit);
      hitProxies.push(hit);
    });

    // Raycast Hover & Click on 3D Characters
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let lastHoverCheck = 0;

    const pickAgent = (clientX: number, clientY: number): AvatarId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _rayOrigin.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayOrigin.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayOrigin, camera);
      const visibleProxies =
        propsRef.current.mode === 'lineup'
          ? hitProxies
          : hitProxies.filter((p) => p.userData.avatarId === propsRef.current.selectedId);
      const hits = raycaster.intersectObjects(visibleProxies, false);
      if (hits.length > 0) {
        return hits[0].object.userData.avatarId as AvatarId;
      }
      return null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;
      const hitId = pickAgent(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'default';
      propsRef.current.onHoverAgent?.(hitId);
    };

    const onPointerLeave = () => {
      propsRef.current.onHoverAgent?.(null);
    };

    const onPointerDown = (e: PointerEvent) => {
      const hitId = pickAgent(e.clientX, e.clientY);
      if (hitId) {
        const r = rigs[hitId];
        if (r) r.welcomeTimer = 2.4;
        propsRef.current.onSelectAgent?.(hitId);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Responsive Resize Observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(160, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        updateCameraFraming(w, h);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

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
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const {
        mode: curMode,
        selectedId: curSel,
        hoveredId: curHover,
        welcomeBurstKey: curBurst,
      } = propsRef.current;

      const burstChanged = curBurst !== lastBurstRef.current || curSel !== prevSelectedRef.current;
      if (burstChanged) {
        lastBurstRef.current = curBurst;
        prevSelectedRef.current = curSel;
      }

      LINEUP_ORDER.forEach((id, idx) => {
        const rig = rigs[id];
        if (!rig) return;
        if (curMode === 'single') {
          rig.group.visible = id === curSel;
          if (!rig.group.visible) return;
          rig.group.rotation.y = Math.sin(elapsed * 0.7) * 0.24;
        } else {
          const baseRot = (1.5 - idx) * 0.1;
          const targetScale = id === curSel ? 1.07 : id === curHover ? 1.04 : 0.98;
          rig.group.scale.setScalar(THREE.MathUtils.damp(rig.group.scale.x, targetScale, 8, dt));
          rig.group.rotation.y = THREE.MathUtils.damp(
            rig.group.rotation.y,
            id === curSel ? 0 : baseRot,
            6,
            dt
          );
        }

        animateHumanAgent(rig, elapsed, dt, {
          isMoving: false,
          hovered: curHover === id,
          selected: curSel === id,
          triggerWelcome: burstChanged && curSel === id,
          phaseOffset: idx * 1.15,
        });
      });

      bgOrbs.forEach((orb) => {
        const ud = orb.userData;
        orb.position.y = ud.baseY + Math.sin(elapsed * 1.3 + ud.phase) * 0.24;
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      envRT.dispose();
      shadowTex.dispose();
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
  }, [mode]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full relative overflow-hidden ${className}`}
      aria-label="Pentas Ejen EcoWorld 3D Interaktif"
    />
  );
}
