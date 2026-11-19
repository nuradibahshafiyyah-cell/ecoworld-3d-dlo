import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Lightbulb,
  MessageSquareQuote,
  Music,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AVATARS } from '../data/gameData';
import { animateHumanAgent, buildHumanEcoAgent } from '../three/humanAgents';
import { buildSoundStudioWorld, StudioCameraPreset } from '../three/soundStudioWorld';
import { MissionDef, UserAccount } from '../types/game';
import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from '../utils/malayVoice';
import { playSFX, setMusicState } from '../utils/sound';

export interface Mission4VoiceLabAdventureProps {
  mission: MissionDef;
  user: UserAccount;
  musicOn: boolean;
  musicVolume: number;
  onToggleMusic: () => void;
  onChangeMusicVolume: (vol: number) => void;
  onClose: () => void;
  onCompleteMission4: (
    score: number,
    argument: { pendirian: string; bukti: string; huraian: string; kesimpulan: string },
    hasRecording: boolean,
    peerFeedback: string,
    afterAction?: 'map' | 'next_mission'
  ) => void;
}

type Mission4Stage = 'call' | 'report' | 'builder' | 'transfer_success';
type AudioPlayStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked';

interface ArgumentDraft {
  pendirian: string;
  bukti: string;
  huraian: string;
  kesimpulan: string;
}

const CALL_SCRIPT =
  'Selamat datang, Ejen! Sebelum menghasilkan kempen kesedaran alam sekitar, kamu perlu menyediakan hujah yang bernas. Dengar laporan pencemaran yang diberikan dengan teliti. Kemudian, gunakan maklumat tersebut untuk membina hujah kamu. Hujah ini akan menjadi panduan dalam misi seterusnya. Bersedia, Ejen?';

const REPORT_SCRIPT =
  'Penduduk di kawasan Taman Harmoni semakin bimbang dengan masalah pencemaran udara. Banyak kenderaan mengeluarkan asap hitam, manakala aktiviti pembakaran terbuka masih berlaku. Keadaan ini menyebabkan udara menjadi tidak bersih dan mengganggu keselesaan penduduk. Penduduk berharap agar tindakan segera diambil untuk mengatasi masalah ini.';

const CONGRATS_MESSAGE =
  'TAHNIAH, EJEN! Hujah kamu berjaya disimpan. Kini, gunakan idea tersebut untuk menghasilkan kempen kesedaran alam sekitar dalam misi terakhir!';

const ARGUMENT_FIELDS: {
  key: keyof ArgumentDraft;
  numberLabel: string;
  title: string;
  question: string;
  example: string;
  accentCard: string;
  accentBadge: string;
  accentInput: string;
}[] = [
  {
    key: 'pendirian',
    numberLabel: '1',
    title: 'PENDIRIAN',
    question: 'Apakah pandangan kamu tentang isu pencemaran tersebut?',
    example: 'Contoh: Saya berpendapat pencemaran udara perlu dibendung.',
    accentCard: 'border-emerald-400/60 bg-slate-900/90',
    accentBadge: 'from-emerald-400 to-green-500 text-slate-950',
    accentInput: 'focus:border-emerald-400 focus:ring-emerald-400/30',
  },
  {
    key: 'bukti',
    numberLabel: '2',
    title: 'BUKTI UTAMA',
    question: 'Apakah maklumat daripada laporan yang menyokong pandangan kamu?',
    example:
      'Contoh: Buktinya, terdapat kenderaan yang mengeluarkan asap hitam dan aktiviti pembakaran terbuka.',
    accentCard: 'border-cyan-400/60 bg-slate-900/90',
    accentBadge: 'from-cyan-400 to-sky-500 text-slate-950',
    accentInput: 'focus:border-cyan-400 focus:ring-cyan-400/30',
  },
  {
    key: 'huraian',
    numberLabel: '3',
    title: 'HURAIAN DAN CADANGAN',
    question: 'Apakah tindakan yang boleh dilakukan untuk mengatasi masalah tersebut?',
    example:
      'Contoh: Oleh itu, masyarakat perlu mengurangkan pembakaran terbuka dan menggunakan pengangkutan awam.',
    accentCard: 'border-amber-400/60 bg-slate-900/90',
    accentBadge: 'from-amber-300 to-yellow-500 text-slate-950',
    accentInput: 'focus:border-amber-400 focus:ring-amber-400/30',
  },
  {
    key: 'kesimpulan',
    numberLabel: '4',
    title: 'SERUAN / KESIMPULAN',
    question: 'Apakah seruan kamu kepada masyarakat?',
    example: 'Contoh: Tegasnya, marilah kita bersama-sama menjaga kebersihan udara.',
    accentCard: 'border-violet-400/60 bg-slate-900/90',
    accentBadge: 'from-violet-400 to-purple-500 text-white',
    accentInput: 'focus:border-violet-400 focus:ring-violet-400/30',
  },
];


/* ============================================================================
   CUSTOM ILLUSTRATION: LAPORAN PENCEMARAN TAMAN HARMONI
   ============================================================================ */
function TamanHarmoniPollutionIllustration() {
  return (
    <svg
      viewBox="0 0 420 220"
      className="w-full h-44 sm:h-52 rounded-2xl border border-cyan-400/40 shadow-inner"
      aria-label="Ilustrasi pencemaran udara di Taman Harmoni akibat asap kenderaan dan pembakaran terbuka"
    >
      <defs>
        <linearGradient id="m4PollutedSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="55%" stopColor="#475569" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="m4SmokeDark" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="m4FireGlow" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="60%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#facc15" />
        </linearGradient>
      </defs>

      {/* Hazy Polluted Sky */}
      <rect width="420" height="220" fill="url(#m4PollutedSky)" />
      {/* Dimmed sun behind smog */}
      <circle cx="355" cy="42" r="22" fill="#fde047" opacity="0.45" />

      {/* Taman Harmoni neighborhood houses */}
      <rect x="20" y="96" width="58" height="44" rx="4" fill="#cbd5e1" />
      <polygon points="14,98 49,72 84,98" fill="#0f766e" />
      <rect x="38" y="114" width="16" height="26" rx="2" fill="#334155" />

      <rect x="92" y="102" width="54" height="38" rx="4" fill="#e2e8f0" />
      <polygon points="86,104 119,80 152,104" fill="#0284c7" />
      <rect x="108" y="114" width="14" height="14" rx="2" fill="#38bdf8" opacity="0.7" />

      {/* Ground & Road */}
      <rect x="0" y="140" width="420" height="24" fill="#15803d" />
      <rect x="0" y="164" width="420" height="56" fill="#1e293b" />
      {/* Road dashed lines */}
      <rect x="18" y="190" width="42" height="5" rx="2.5" fill="#fde047" opacity="0.8" />
      <rect x="90" y="190" width="42" height="5" rx="2.5" fill="#fde047" opacity="0.8" />
      <rect x="162" y="190" width="42" height="5" rx="2.5" fill="#fde047" opacity="0.8" />
      <rect x="234" y="190" width="42" height="5" rx="2.5" fill="#fde047" opacity="0.8" />

      {/* Open Burning Scene (Right side) */}
      <ellipse cx="336" cy="152" rx="42" ry="11" fill="#3f3f46" />
      {/* Thick open-burning smoke plumes */}
      <circle cx="322" cy="112" r="18" fill="url(#m4SmokeDark)" />
      <circle cx="342" cy="88" r="24" fill="url(#m4SmokeDark)" />
      <circle cx="326" cy="58" r="28" fill="url(#m4SmokeDark)" />
      <circle cx="358" cy="48" r="22" fill="url(#m4SmokeDark)" />
      {/* Flames */}
      <path
        d="M312 152 Q320 120 332 138 Q340 112 350 138 Q360 122 362 152 Z"
        fill="url(#m4FireGlow)"
      />

      {/* Vehicle 1 emitting heavy black smoke */}
      <circle cx="32" cy="166" r="10" fill="url(#m4SmokeDark)" />
      <circle cx="20" cy="148" r="15" fill="url(#m4SmokeDark)" />
      <circle cx="14" cy="126" r="19" fill="url(#m4SmokeDark)" />
      <rect x="44" y="156" width="84" height="28" rx="8" fill="#ef4444" />
      <rect x="64" y="142" width="44" height="16" rx="5" fill="#f87171" />
      <rect x="70" y="145" width="14" height="10" rx="2" fill="#bae6fd" />
      <rect x="88" y="145" width="14" height="10" rx="2" fill="#bae6fd" />
      <circle cx="62" cy="184" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />
      <circle cx="110" cy="184" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />

      {/* Vehicle 2 (Truck/Van) emitting dark exhaust */}
      <circle cx="146" cy="160" r="11" fill="url(#m4SmokeDark)" />
      <circle cx="136" cy="138" r="16" fill="url(#m4SmokeDark)" />
      <circle cx="152" cy="114" r="20" fill="url(#m4SmokeDark)" />
      <rect x="164" y="144" width="96" height="38" rx="7" fill="#0284c7" />
      <rect x="228" y="150" width="24" height="15" rx="3" fill="#bae6fd" />
      <circle cx="186" cy="184" r="10" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />
      <circle cx="240" cy="184" r="10" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />

      {/* Resident covering nose / concerned */}
      <circle cx="282" cy="126" r="8" fill="#fde68a" />
      <rect x="275" y="135" width="14" height="22" rx="4" fill="#14b8a6" />
      <rect x="277" y="128" width="9" height="4" rx="2" fill="#ffffff" />

      {/* Labels inside SVG */}
      <rect x="12" y="12" width="144" height="24" rx="8" fill="#0f172a" fillOpacity="0.82" />
      <text x="84" y="28" textAnchor="middle" fill="#67e8f9" fontSize="10.5" fontWeight="bold">
        ASAP HITAM KENDERAAN
      </text>
      <rect x="262" y="12" width="146" height="24" rx="8" fill="#0f172a" fillOpacity="0.82" />
      <text x="335" y="28" textAnchor="middle" fill="#fcd34d" fontSize="10.5" fontWeight="bold">
        PEMBAKARAN TERBUKA
      </text>
    </svg>
  );
}

/* ============================================================================
   MAIN COMPONENT: MISI 4 – MAKMAL SUARA
   ============================================================================ */
export function Mission4VoiceLabAdventure({
  mission,
  user,
  musicOn,
  musicVolume,
  onToggleMusic,
  onChangeMusicVolume,
  onClose,
  onCompleteMission4,
}: Mission4VoiceLabAdventureProps) {
  const existingArg = user.progress?.m4.argument;

  const [stage, setStage] = useState<Mission4Stage>('call');

  // Continuous Bahasa Melayu Audio Controller
  const [audioKey, setAudioKey] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioPlayStatus>('idle');
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [reportListenCount, setReportListenCount] = useState(0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ttsBlobCacheRef = useRef<Record<string, string>>({});
  const audioModeRef = useRef<'none' | 'tts' | 'speech' | 'silent'>('none');
  const silentTimerRef = useRef<number | null>(null);
  const callAutoStartedRef = useRef(false);
  const reportAutoStartedRef = useRef(false);

  // Stage 3: 4-Component Argument Builder State (isolated per logged-in student)
  const [draft, setDraft] = useState<ArgumentDraft>(() => ({
    pendirian: existingArg?.pendirian || '',
    bukti: existingArg?.bukti || '',
    huraian: existingArg?.huraian || '',
    kesimpulan: existingArg?.kesimpulan || '',
  }));
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ArgumentDraft, string>>>({});
  const [formBannerError, setFormBannerError] = useState<string | null>(null);
  const [showReportDrawerInBuilder, setShowReportDrawerInBuilder] = useState(false);

  // Stage 4: Holographic Transfer Animation State
  const [transferPhase, setTransferPhase] = useState<'sending' | 'done'>('sending');
  const transferTimerRef = useRef<number | null>(null);

  // Three.js Interactive Future Sound Studio Backdrop + Exploration State
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Mission4Stage>(stage);
  stageRef.current = stage;

  const [entrancePhase, setEntrancePhase] = useState<'entering' | 'ready'>('entering');
  const entrancePhaseRef = useRef<'entering' | 'ready'>('entering');
  const skipEntranceRef = useRef(false);

  const [exploreStudioMode, setExploreStudioMode] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<StudioCameraPreset>('follow');
  const cameraPresetRef = useRef<StudioCameraPreset>('follow');
  cameraPresetRef.current = cameraPreset;

  const audioStatusRef = useRef<AudioPlayStatus>(audioStatus);
  audioStatusRef.current = audioStatus;

  const keysRef = useRef<Record<string, boolean>>({});
  const dpadRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const yawOffsetRef = useRef<number>(0);

  const avatarDef = AVATARS.find((a) => a.id === user.avatar) || AVATARS[0];

  const handleSkipEntrance = useCallback(() => {
    skipEntranceRef.current = true;
    entrancePhaseRef.current = 'ready';
    setEntrancePhase('ready');
  }, []);

  const setTouchDirection = useCallback((x: number, z: number) => {
    dpadRef.current.x = x;
    dpadRef.current.z = z;
  }, []);

  // Keyboard movement listeners (WASD + Arrow Keys), safely disabled inside form inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd' ||
        key === 'arrowup' ||
        key === 'arrowdown' ||
        key === 'arrowleft' ||
        key === 'arrowright'
      ) {
        if (key.startsWith('arrow')) {
          e.preventDefault();
        }
        keysRef.current[key] = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      delete keysRef.current[key];
    };

    const onBlur = () => {
      keysRef.current = {};
      dpadRef.current = { x: 0, z: 0 };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // =========================================================================
  // LIVE 3D INTERACTIVE FUTURE SOUND STUDIO SCENE
  // =========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    const glName = dbg ? String(gl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe/i.test(glName);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

    const scene = new THREE.Scene();
    const baseBgColor = new THREE.Color('#0b1a3d');
    const transferBgColor = new THREE.Color('#0c2f44');
    scene.background = baseBgColor.clone();
    scene.fog = new THREE.FogExp2('#0e214d', 0.014);

    // Environment reflection map for realistic metallic & glass surfaces
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      140
    );
    camera.position.set(0, 2.75, 16.5);

    // Vibrant Neon Studio Lighting (Cyan, Turquoise, Purple, Magenta, Emerald, Yellow accent)
    const hemi = new THREE.HemisphereLight('#67e8f9', '#4c1d95', 1.35);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fef9c3', 1.45);
    keyLight.position.set(7, 14, 11);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 42;
      keyLight.shadow.camera.left = -13;
      keyLight.shadow.camera.right = 13;
      keyLight.shadow.camera.top = 13;
      keyLight.shadow.camera.bottom = -13;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight('#22d3ee', 3.4, 38);
    cyanLight.position.set(-6.2, 5.2, -1.5);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight('#ec4899', 3.0, 38);
    magentaLight.position.set(6.5, 5.4, -2.5);
    scene.add(magentaLight);

    const emeraldLight = new THREE.PointLight('#34d399', 2.6, 36);
    emeraldLight.position.set(0, 4.8, 6.2);
    scene.add(emeraldLight);

    const purpleLight = new THREE.PointLight('#a855f7', 2.8, 36);
    purpleLight.position.set(0, 7.6, -7.2);
    scene.add(purpleLight);

    // Build Future Sound Studio 3D Environment
    const studio = buildSoundStudioWorld(maxAnisotropy, isSoftwareGl);
    scene.add(studio.group);

    // Contact shadow + 3D EcoWorld Agent (spawns outside studio airlock doorway)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
    sGrad.addColorStop(0, 'rgba(2, 6, 23, 0.75)');
    sGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const agentRig = buildHumanEcoAgent(avatarDef.id, shadowTex, { showPedestal: false });
    agentRig.group.position.set(0, 0, 12.6);
    agentRig.group.rotation.y = Math.PI;
    agentRig.group.scale.setScalar(1.22);
    scene.add(agentRig.group);

    // Pointer-drag camera orbit angle on canvas (allows inspecting studio corners smoothly)
    let isDragging = false;
    let lastPointerX = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDragging = true;
      lastPointerX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      yawOffsetRef.current = THREE.MathUtils.clamp(
        yawOffsetRef.current - dx * 0.0055,
        -1.35,
        1.35
      );
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Pre-allocated vectors for GC-free animation loop
    const desiredCamPos = new THREE.Vector3();
    const desiredLookAt = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3(0, 1.9, 6.0);
    const camForward = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const moveVec = new THREE.Vector3();

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let entranceCompleteSignaled = false;
    let doorOpenProgress = 0;

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    function renderLoop() {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const st = stageRef.current;
      const isTransfer = st === 'transfer_success';

      (scene.background as THREE.Color).lerp(
        isTransfer ? transferBgColor : baseBgColor,
        dt * 2.4
      );

      let isMoving = false;
      const preset = cameraPresetRef.current;

      // -------------------------------------------------------------------
      // 1. CINEMATIC STUDIO DOOR ENTRANCE SEQUENCE (0 -> 2.35s)
      // -------------------------------------------------------------------
      if (entrancePhaseRef.current === 'entering' && !skipEntranceRef.current) {
        doorOpenProgress = THREE.MathUtils.clamp(elapsed / 1.05, 0, 1);

        if (elapsed < 0.35) {
          agentRig.group.position.set(0, 0, 12.6);
          agentRig.group.rotation.y = Math.PI;
          desiredCamPos.set(0, 2.75, 16.5);
          desiredLookAt.set(0, 2.1, 8.2);
        } else if (elapsed < 2.25) {
          const walkT = THREE.MathUtils.clamp((elapsed - 0.35) / 1.9, 0, 1);
          const smoothT = walkT * walkT * (3 - 2 * walkT);
          const nx = THREE.MathUtils.lerp(0, -2.6, smoothT);
          const nz = THREE.MathUtils.lerp(12.6, 2.8, smoothT);
          const ny = studio.getFloorHeightAt(nx, nz);
          agentRig.group.position.set(nx, ny, nz);
          agentRig.group.rotation.y = THREE.MathUtils.lerp(Math.PI, Math.PI + 0.27, smoothT);
          isMoving = true;

          // Cinematic follow camera gliding smoothly through doorway into the studio
          desiredCamPos.set(
            THREE.MathUtils.lerp(0, -1.6, smoothT),
            THREE.MathUtils.lerp(2.75, 3.65, smoothT),
            THREE.MathUtils.lerp(15.2, 8.9, smoothT)
          );
          desiredLookAt.set(
            THREE.MathUtils.lerp(0, 0, smoothT),
            THREE.MathUtils.lerp(2.0, 2.3, smoothT),
            THREE.MathUtils.lerp(6.5, -2.8, smoothT)
          );
        } else {
          agentRig.group.position.set(-2.6, studio.getFloorHeightAt(-2.6, 2.8), 2.8);
          agentRig.group.rotation.y = 0.32;
          if (!entranceCompleteSignaled) {
            entranceCompleteSignaled = true;
            entrancePhaseRef.current = 'ready';
            setEntrancePhase('ready');
          }
        }
      } else {
        // Ensure agent is inside the studio if user skipped entrance early
        if (agentRig.group.position.z > 9.8) {
          agentRig.group.position.set(-2.6, studio.getFloorHeightAt(-2.6, 2.8), 2.8);
          agentRig.group.rotation.y = 0.32;
        }
        doorOpenProgress = THREE.MathUtils.damp(doorOpenProgress, 1, 4.5, dt);

        // -----------------------------------------------------------------
        // 2. INTERACTIVE AGENT EXPLORATION (WASD / ARROWS / MOBILE D-PAD)
        // -----------------------------------------------------------------
        const k = keysRef.current;
        const inputRight =
          (k['d'] || k['arrowright'] ? 1 : 0) -
          (k['a'] || k['arrowleft'] ? 1 : 0) +
          dpadRef.current.x;
        const inputFwd =
          (k['w'] || k['arrowup'] ? 1 : 0) -
          (k['s'] || k['arrowdown'] ? 1 : 0) +
          dpadRef.current.z;

        const mag = Math.hypot(inputRight, inputFwd);
        if (mag > 0.05) {
          isMoving = true;
          const normR = inputRight / Math.max(1, mag);
          const normF = inputFwd / Math.max(1, mag);

          // Camera-relative ground plane movement
          camera.getWorldDirection(camForward);
          camForward.y = 0;
          if (camForward.lengthSq() < 0.0001) camForward.set(0, 0, -1);
          camForward.normalize();
          camRight.set(-camForward.z, 0, camForward.x);

          moveVec
            .set(0, 0, 0)
            .addScaledVector(camForward, normF)
            .addScaledVector(camRight, normR)
            .normalize();

          const speed = 4.6;
          const nextRawX = agentRig.group.position.x + moveVec.x * speed * dt;
          const nextRawZ = agentRig.group.position.z + moveVec.z * speed * dt;
          const clamped = studio.clampPosition(nextRawX, nextRawZ);
          const targetY = studio.getFloorHeightAt(clamped.x, clamped.z);

          agentRig.group.position.x = clamped.x;
          agentRig.group.position.z = clamped.z;
          agentRig.group.position.y = THREE.MathUtils.damp(
            agentRig.group.position.y,
            targetY,
            12,
            dt
          );

          const targetRot = Math.atan2(moveVec.x, moveVec.z);
          let diff = targetRot - agentRig.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          agentRig.group.rotation.y += diff * Math.min(1, dt * 11);
        }

        // -----------------------------------------------------------------
        // 3. SMOOTH MULTI-ANGLE CAMERA FOLLOW
        // -----------------------------------------------------------------
        const ax = agentRig.group.position.x;
        const ay = agentRig.group.position.y;
        const az = agentRig.group.position.z;
        const yaw = yawOffsetRef.current;

        if (preset === 'wide') {
          const dist = 14.2;
          desiredCamPos.set(
            Math.sin(yaw * 0.9) * dist * 0.65,
            5.4 + Math.cos(elapsed * 0.25) * 0.15,
            8.8 + Math.cos(yaw * 0.6) * 2.2
          );
          desiredLookAt.set(ax * 0.35, 2.3, -2.5);
        } else if (preset === 'console') {
          desiredCamPos.set(
            1.6 + Math.sin(yaw) * 3.2,
            3.35,
            3.4 + Math.cos(yaw) * 1.4
          );
          desiredLookAt.set(3.4, 1.85, -2.2);
        } else {
          // 'follow': smooth third-person studio camera following agent
          const followDist = 6.8;
          desiredCamPos.set(
            THREE.MathUtils.clamp(ax * 0.72 + Math.sin(yaw) * followDist, -9.8, 9.8),
            ay + 3.45,
            THREE.MathUtils.clamp(az + Math.cos(yaw) * followDist, -1.8, 10.6)
          );
          desiredLookAt.set(
            ax * 0.65,
            ay + 1.85,
            az - 3.4
          );
        }
      }

      // Smoothly damp camera position and look-at target
      const dampSpeed = entrancePhaseRef.current === 'entering' ? 3.8 : 5.2;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, dampSpeed, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, dampSpeed, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, dampSpeed, dt);

      currentLookAt.x = THREE.MathUtils.damp(currentLookAt.x, desiredLookAt.x, dampSpeed, dt);
      currentLookAt.y = THREE.MathUtils.damp(currentLookAt.y, desiredLookAt.y, dampSpeed, dt);
      currentLookAt.z = THREE.MathUtils.damp(currentLookAt.z, desiredLookAt.z, dampSpeed, dt);
      camera.lookAt(currentLookAt);

      // Animate studio screens, hologram, faders, equalizer bars, doors, light beams & particles
      studio.animate(elapsed, dt, {
        doorOpen: doorOpenProgress,
        audioActive: audioStatusRef.current === 'playing',
        transferMode: isTransfer,
      });

      // Animate EcoWorld Agent
      animateHumanAgent(agentRig, elapsed, dt, {
        isMoving,
        hovered: isTransfer || st === 'call',
        selected: true,
      });

      // Dynamic RGB neon point light pulsing
      cyanLight.intensity = 3.1 + Math.sin(elapsed * 2.1) * 0.55;
      magentaLight.intensity = 2.8 + Math.cos(elapsed * 1.7) * 0.55;
      emeraldLight.intensity = (isTransfer ? 3.6 : 2.5) + Math.sin(elapsed * 2.6) * 0.45;

      renderer.render(scene, camera);

      if (isSoftwareGl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const pollFence = () => {
            if (disposed) {
              gl.deleteSync(sync);
              return;
            }
            const status = gl.clientWaitSync(sync, 0, 0);
            if (status === gl.WAIT_FAILED || status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
              gl.deleteSync(sync);
              frameId = window.setTimeout(() => requestAnimationFrame(renderLoop), 20);
            } else {
              frameId = window.setTimeout(pollFence, 8);
            }
          };
          frameId = window.setTimeout(pollFence, 8);
          return;
        }
        frameId = window.setTimeout(() => requestAnimationFrame(renderLoop), 65);
      } else if (isSoftwareGl) {
        frameId = window.setTimeout(() => requestAnimationFrame(renderLoop), 65);
      } else {
        frameId = requestAnimationFrame(renderLoop);
      }
    }

    renderLoop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      studio.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [avatarDef.id]);

  // =========================================================================
  // CONTINUOUS BAHASA MELAYU AUDIO ENGINE (NEVER ENGLISH, NEVER SPLIT)
  // =========================================================================
  const stopCurrentAudio = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
      audioElRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (silentTimerRef.current) {
      clearTimeout(silentTimerRef.current);
      silentTimerRef.current = null;
    }
    audioModeRef.current = 'none';
    setAudioStatus('idle');
    setMusicState({ suppressedForAudio: false });
  }, []);

  const markAudioEnded = useCallback((key: string) => {
    setAudioStatus('ended');
    setMusicState({ suppressedForAudio: false });
    if (key === 'report') {
      setReportListenCount((c) => c + 1);
    }
  }, []);

  const playContinuousMalaySpeechFallback = useCallback(
    (key: string, scriptText: string) => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const { voice: malayVoice } = pickMalaysianSpeechVoice(voices);
        if (malayVoice) {
          window.speechSynthesis.cancel();
          audioModeRef.current = 'speech';

          const utter = new SpeechSynthesisUtterance(scriptText);
          utter.voice = malayVoice;
          utter.lang = malayVoice.lang;
          utter.rate = 0.95;
          utter.pitch = 1.03;

          utter.onstart = () => {
            setAudioStatus('playing');
            setMusicState({ suppressedForAudio: true });
          };
          utter.onend = () => {
            if (audioModeRef.current === 'speech') {
              markAudioEnded(key);
            }
          };
          utter.onerror = () => {
            if (audioModeRef.current === 'speech') {
              markAudioEnded(key);
            }
          };

          setAudioStatus('playing');
          setMusicState({ suppressedForAudio: true });
          window.speechSynthesis.speak(utter);
          return;
        }
      }

      // Strict Bahasa Melayu Malaysia (ms-MY) guard: Never fall back to Indonesian (id-ID) or English voice!
      audioModeRef.current = 'silent';
      setAudioStatus('playing');
      setMusicState({ suppressedForAudio: false });
      setAudioNotice(
        'Pelayar ini tidak mempunyai enjin suara Bahasa Melayu Malaysia (ms-MY) tempatan. Sila baca teks lengkap pada skrin (tiada suara Bahasa Indonesia atau Inggeris digunakan).'
      );
      silentTimerRef.current = window.setTimeout(() => {
        markAudioEnded(key);
      }, 6500);
    },
    [markAudioEnded]
  );

  const playContinuousAudio = useCallback(
    async (key: string, scriptText: string, stylePrompt: string) => {
      stopCurrentAudio();
      setAudioKey(key);
      setAudioNotice(null);
      setAudioStatus('loading');

      try {
        let url = ttsBlobCacheRef.current[key];
        if (!url) {
          const resp = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: scriptText, style: buildMalaysianTtsStyle(stylePrompt) }),
          });
          if (!resp.ok) throw new Error('TTS unavailable');
          const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
          if (!data.audioBase64) throw new Error('Empty audio payload');

          const bin = atob(data.audioBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
          ttsBlobCacheRef.current[key] = url;
        }

        const audio = new Audio(url);
        audioElRef.current = audio;
        audioModeRef.current = 'tts';

        audio.onplay = () => {
          setAudioStatus('playing');
          setMusicState({ suppressedForAudio: true });
        };
        audio.onended = () => {
          markAudioEnded(key);
        };
        audio.onerror = () => {
          playContinuousMalaySpeechFallback(key, scriptText);
        };

        try {
          await audio.play();
        } catch {
          setAudioStatus('blocked');
          setMusicState({ suppressedForAudio: false });
        }
      } catch {
        playContinuousMalaySpeechFallback(key, scriptText);
      }
    },
    [stopCurrentAudio, markAudioEnded, playContinuousMalaySpeechFallback]
  );

  const handlePauseAudio = () => {
    playSFX('click');
    setAudioStatus('paused');
    setMusicState({ suppressedForAudio: false });

    if (audioModeRef.current === 'tts' && audioElRef.current) {
      audioElRef.current.pause();
    } else if (audioModeRef.current === 'speech' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    } else if (audioModeRef.current === 'silent' && silentTimerRef.current) {
      clearTimeout(silentTimerRef.current);
      silentTimerRef.current = null;
    }
  };

  const handleResumeAudio = (key: string, scriptText: string, stylePrompt: string) => {
    playSFX('click');

    if (audioModeRef.current === 'tts' && audioElRef.current) {
      audioElRef.current.play().catch(() => {
        setAudioStatus('blocked');
      });
      setAudioStatus('playing');
      setMusicState({ suppressedForAudio: true });
    } else if (
      audioModeRef.current === 'speech' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.paused
    ) {
      window.speechSynthesis.resume();
      setAudioStatus('playing');
      setMusicState({ suppressedForAudio: true });
    } else {
      playContinuousAudio(key, scriptText, stylePrompt);
    }
  };

  // Auto-play Langkah 1 audio ONCE after entrance completes
  useEffect(() => {
    if (stage === 'call' && entrancePhase === 'ready' && !callAutoStartedRef.current) {
      callAutoStartedRef.current = true;
      playContinuousAudio(
        'call',
        CALL_SCRIPT,
        'Speak in clear, warm, inspiring standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like the Makmal Suara Commander welcoming Year 6 primary school hero agents.'
      );
    }
  }, [stage, entrancePhase, playContinuousAudio]);

  // Auto-play Langkah 2 pollution report ONCE on first entry
  useEffect(() => {
    if (stage === 'report' && !reportAutoStartedRef.current) {
      reportAutoStartedRef.current = true;
      playContinuousAudio(
        'report',
        REPORT_SCRIPT,
        'Speak in clear, calm, expressive standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like a news field reporter reporting air pollution in Taman Harmoni for primary school pupils.'
      );
    }
  }, [stage, playContinuousAudio]);

  // Cleanup audio, blob cache & timers on unmount
  useEffect(() => {
    const cacheMap = ttsBlobCacheRef.current;
    return () => {
      stopCurrentAudio();
      Object.values(cacheMap).forEach((u) => URL.revokeObjectURL(u));
      if (transferTimerRef.current) {
        clearTimeout(transferTimerRef.current);
      }
    };
  }, [stopCurrentAudio]);

  // =========================================================================
  // STAGE NAVIGATION & ARGUMENT VALIDATION
  // =========================================================================
  const goToReportStage = () => {
    playSFX('click');
    stopCurrentAudio();
    setStage('report');
  };

  const goToBuilderStage = () => {
    playSFX('click');
    stopCurrentAudio();
    setStage('builder');
  };

  const handleDraftChange = (key: keyof ArgumentDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formBannerError) setFormBannerError(null);
  };

  const handleValidateAndTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: ArgumentDraft = {
      pendirian: draft.pendirian.trim(),
      bukti: draft.bukti.trim(),
      huraian: draft.huraian.trim(),
      kesimpulan: draft.kesimpulan.trim(),
    };

    const errs: Partial<Record<keyof ArgumentDraft, string>> = {};
    if (cleaned.pendirian.length < 5) {
      errs.pendirian = 'Sila tulis pendirian kamu dengan ayat yang lengkap.';
    }
    if (cleaned.bukti.length < 5) {
      errs.bukti = 'Sila nyatakan bukti utama daripada laporan Taman Harmoni.';
    }
    if (cleaned.huraian.length < 5) {
      errs.huraian = 'Sila tulis huraian atau cadangan tindakan yang munasabah.';
    }
    if (cleaned.kesimpulan.length < 5) {
      errs.kesimpulan = 'Sila tulis seruan atau kesimpulan untuk masyarakat.';
    }

    if (Object.keys(errs).length > 0) {
      playSFX('error');
      setValidationErrors(errs);
      setFormBannerError(
        'Lengkapkan kesemua 4 komponen hujah terlebih dahulu sebelum menyimpan ke Misi 5!'
      );
      return;
    }

    playSFX('xp');
    stopCurrentAudio();
    setDraft(cleaned);
    setTransferPhase('sending');
    setStage('transfer_success');

    if (transferTimerRef.current) clearTimeout(transferTimerRef.current);
    transferTimerRef.current = window.setTimeout(() => {
      playSFX('win');
      setTransferPhase('done');
    }, 1500);
  };

  const handleCommitMission4 = (afterAction: 'map' | 'next_mission') => {
    stopCurrentAudio();
    const cleaned: ArgumentDraft = {
      pendirian: draft.pendirian.trim(),
      bukti: draft.bukti.trim(),
      huraian: draft.huraian.trim(),
      kesimpulan: draft.kesimpulan.trim(),
    };
    onCompleteMission4(
      95,
      cleaned,
      false,
      'Hujah berstruktur daripada laporan pencemaran udara Taman Harmoni berjaya dihantar ke Misi 5.',
      afterAction
    );
  };

  const completedFieldCount = ARGUMENT_FIELDS.filter(
    (f) => draft[f.key].trim().length >= 5
  ).length;

  const currentStageIndex =
    stage === 'call' ? 1 : stage === 'report' ? 2 : stage === 'builder' ? 3 : 4;

  const isAudioPlaying = audioStatus === 'playing';
  const isAudioLoading = audioStatus === 'loading';
  const isAudioPaused = audioStatus === 'paused';

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-950 select-none">
      {/* Live 3D Makmal Suara Interactive Canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        aria-hidden="true"
      />

      {/* Top HUD Bar */}
      <header className="relative z-20 px-3 sm:px-6 pt-3 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        <div className="flex items-center gap-2.5 flex-wrap pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              playSFX('click');
              stopCurrentAudio();
              onClose();
            }}
            className="btn-game-slate btn-game-sm px-3.5 py-2 text-xs font-game font-black text-white flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-300" /> Peta Misi
          </button>

          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-950/75 border border-cyan-400/60 backdrop-blur-xl flex items-center gap-2 shadow-[0_0_25px_rgba(34,211,238,0.28)]">
            <Radio className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span className="font-game text-xs sm:text-sm font-black text-white tracking-wide uppercase">
              MISI 04: {mission.shortTitle || 'MAKMAL SUARA'}
            </span>
          </div>
        </div>

        {/* Stepper, Studio Explore Toggle & Audio Controls */}
        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          {entrancePhase === 'ready' && (
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setExploreStudioMode((v) => !v);
              }}
              className={`px-3 py-1.5 rounded-2xl border backdrop-blur-xl text-xs font-game font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-lg ${
                exploreStudioMode
                  ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.5)]'
                  : 'bg-slate-950/75 text-cyan-200 border-purple-400/60 hover:border-cyan-300 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
              }`}
              title={exploreStudioMode ? 'Kembali ke Panel Misi' : 'Teroka Studio 3D dengan Ejen'}
            >
              {exploreStudioMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Panel Misi</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-fuchsia-300" />
                  <span>Teroka Studio</span>
                </>
              )}
            </button>
          )}

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/75 border border-cyan-400/35 backdrop-blur-xl text-[11px] font-game font-bold shadow-[0_0_20px_rgba(34,211,238,0.18)]">
            {[
              { n: 1, label: 'Panggilan' },
              { n: 2, label: 'Laporan' },
              { n: 3, label: 'Bina Hujah' },
              { n: 4, label: 'Simpan' },
            ].map((step) => {
              const active = currentStageIndex === step.n;
              const done = currentStageIndex > step.n;
              return (
                <span
                  key={step.n}
                  className={`px-2 py-0.5 rounded-lg transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 font-black shadow-[0_0_12px_rgba(34,211,238,0.55)]'
                      : done
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                      : 'text-slate-300'
                  }`}
                >
                  {step.n}. {step.label}
                </span>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-950/75 border border-purple-400/40 backdrop-blur-xl shadow-lg">
            <button
              type="button"
              onClick={() => {
                onToggleMusic();
              }}
              title={musicOn ? 'Tutup Muzik Latar' : 'Buka Muzik Latar'}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-cyan-300 cursor-pointer"
            >
              {musicOn ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVolume}
              onChange={(e) => onChangeMusicVolume(parseFloat(e.target.value))}
              aria-label="Kelantangan Muzik"
              className="w-14 sm:w-16 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </header>

      {/* Entrance Intro Banner & Skip Button */}
      {entrancePhase === 'entering' && (
        <div className="fixed inset-x-0 bottom-6 z-20 px-4 flex flex-col sm:flex-row items-center justify-center gap-3 pointer-events-none">
          <div className="px-5 py-2.5 rounded-2xl bg-slate-950/75 border border-cyan-400/60 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.35)] flex items-center gap-2.5 pointer-events-auto">
            <Sparkles className="w-4 h-4 text-fuchsia-300 animate-spin" />
            <span className="font-game text-xs sm:text-sm font-black text-cyan-100 tracking-wide">
              Ejen {user.fullName.split(' ')[0]} memasuki Studio Penyiaran Masa Hadapan...
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playSFX('click');
              handleSkipEntrance();
            }}
            className="pointer-events-auto px-4 py-2 rounded-2xl bg-slate-950/80 border border-fuchsia-400/60 text-fuchsia-200 hover:text-white hover:border-cyan-300 font-game text-xs font-black backdrop-blur-xl shadow-lg cursor-pointer"
          >
            Langkau Intro →
          </button>
        </div>
      )}

      {/* Main Centered Content Area (pointer-events-none so surrounding 3D studio can be dragged/inspected) */}
      <main className="relative z-10 h-[calc(100vh-76px)] overflow-y-auto px-3 sm:px-6 py-4 flex items-center justify-center pointer-events-none">
        {/* ================================================================
            LANGKAH 1: PANGGILAN MAKMAL SUARA
           ================================================================ */}
        {entrancePhase === 'ready' && !exploreStudioMode && stage === 'call' && (
          <div className="pointer-events-auto w-full max-w-4xl rounded-3xl bg-slate-950/72 border-2 border-cyan-400/65 shadow-[0_0_55px_rgba(34,211,238,0.32),0_0_30px_rgba(168,85,247,0.22)] backdrop-blur-xl p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/25 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-lg">
                  <Headphones className="w-6 h-6 text-slate-950" />
                </div>
                <div>
                  <span className="inline-block text-[11px] font-game font-black uppercase tracking-widest text-cyan-300">
                    LANGKAH 1 · PANGGILAN MAKMAL SUARA
                  </span>
                  <h1 className="font-game text-xl sm:text-2xl font-black text-white">
                    PUSAT KAWALAN MAKMAL SUARA
                  </h1>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 text-xs font-game font-bold flex items-center gap-1.5">
                <span className="text-base">{avatarDef.emoji}</span>
                <span>EJEN {user.fullName.split(' ')[0].toUpperCase()}</span>
              </div>
            </div>

            {/* Hologram Commander Message Box */}
            <div className="rounded-2xl bg-slate-900/90 border border-cyan-400/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-game font-bold text-amber-300 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Arahan Komander Makmal Suara</span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                  {audioKey === 'call' && isAudioLoading
                    ? 'Menjana suara Melayu...'
                    : audioKey === 'call' && isAudioPlaying
                    ? '🔊 Sedang dimainkan'
                    : audioKey === 'call' && isAudioPaused
                    ? '⏸ Dijeda'
                    : 'Sedia dimainkan'}
                </span>
              </div>

              <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
                {CALL_SCRIPT}
              </p>

              {audioNotice && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs text-amber-200">
                  {audioNotice}
                </div>
              )}

              {/* Audio Controls */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {audioKey === 'call' && isAudioPlaying ? (
                  <button
                    type="button"
                    onClick={handlePauseAudio}
                    className="btn-game-gold btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" /> Jeda Audio
                  </button>
                ) : audioKey === 'call' && isAudioPaused ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleResumeAudio(
                        'call',
                        CALL_SCRIPT,
                        'Speak in clear, warm, inspiring standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like the Makmal Suara Commander welcoming Year 6 primary school hero agents.'
                      )
                    }
                    className="btn-game-cyan btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" /> Sambung Audio
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      playContinuousAudio(
                        'call',
                        CALL_SCRIPT,
                        'Speak in clear, warm, inspiring standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like the Makmal Suara Commander welcoming Year 6 primary school hero agents.'
                      );
                    }}
                    disabled={isAudioLoading}
                    className="btn-game-cyan btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Volume2 className="w-4 h-4" />
                    {audioStatus === 'blocked'
                      ? 'Mainkan Audio Arahan'
                      : 'Dengar Semula Arahan'}
                  </button>
                )}

                <span className="text-xs text-slate-400">
                  Konsep Misi 4: <strong className="text-emerald-300">Dengar Laporan → Bina Hujah → Simpan Hujah</strong>
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={goToReportStage}
                className="btn-game-emerald px-6 py-3.5 rounded-2xl text-slate-950 font-game text-sm sm:text-base font-black tracking-wide flex items-center gap-2 shadow-[0_0_25px_rgba(52,211,153,0.45)] cursor-pointer"
              >
                <span>DENGAR LAPORAN</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            LANGKAH 2: DENGAR LAPORAN PENCEMARAN (TAMAN HARMONI)
           ================================================================ */}
        {entrancePhase === 'ready' && !exploreStudioMode && stage === 'report' && (
          <div className="pointer-events-auto w-full max-w-4xl rounded-3xl bg-slate-950/74 border-2 border-cyan-400/65 shadow-[0_0_55px_rgba(34,211,238,0.32),0_0_30px_rgba(168,85,247,0.22)] backdrop-blur-xl p-5 sm:p-7 space-y-5 my-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/25 pb-3.5">
              <div>
                <span className="text-[11px] font-game font-black uppercase tracking-widest text-amber-300">
                  LANGKAH 2 · DENGAR LAPORAN PENCEMARAN
                </span>
                <h2 className="font-game text-xl sm:text-2xl font-black text-white">
                  LAPORAN SITUASI: PENCEMARAN UDARA TAMAN HARMONI
                </h2>
              </div>
              <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs font-game font-bold text-cyan-200">
                Didengar: {reportListenCount}x
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-6 space-y-2">
                <TamanHarmoniPollutionIllustration />
                <p className="text-[11px] text-slate-400 text-center">
                  Paparan situasi pencemaran udara di kawasan Taman Harmoni
                </p>
              </div>

              <div className="lg:col-span-6 rounded-2xl bg-slate-900/90 border border-slate-700/80 p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-game font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Transkrip Laporan Audio
                  </span>
                  {audioKey === 'report' && isAudioPlaying && (
                    <span className="text-[11px] font-bold text-emerald-300 animate-pulse">
                      ● Audio Sedang Berjalan
                    </span>
                  )}
                </div>

                <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-medium">
                  “{REPORT_SCRIPT}”
                </p>

                {audioNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs text-amber-200">
                    {audioNotice}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {audioKey === 'report' && isAudioPlaying ? (
                    <button
                      type="button"
                      onClick={handlePauseAudio}
                      className="btn-game-gold btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pause className="w-4 h-4" /> Jeda
                    </button>
                  ) : audioKey === 'report' && isAudioPaused ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleResumeAudio(
                          'report',
                          REPORT_SCRIPT,
                          'Speak in clear, calm, expressive standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like a news field reporter reporting air pollution in Taman Harmoni for primary school pupils.'
                        )
                      }
                      className="btn-game-cyan btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" /> Sambung
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        playContinuousAudio(
                          'report',
                          REPORT_SCRIPT,
                          'Speak in clear, calm, expressive standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like a news field reporter reporting air pollution in Taman Harmoni for primary school pupils.'
                        );
                      }}
                      disabled={isAudioLoading}
                      className="btn-game-cyan btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Volume2 className="w-4 h-4" />
                      {isAudioLoading ? 'Memuatkan...' : 'Mainkan Laporan'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      playContinuousAudio(
                        'report',
                        REPORT_SCRIPT,
                        'Speak in clear, calm, expressive standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like a news field reporter reporting air pollution in Taman Harmoni for primary school pupils.'
                      );
                    }}
                    disabled={isAudioLoading}
                    className="btn-game-slate btn-game-sm px-3.5 py-2 text-slate-100 font-game text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-300" /> Ulang Semula
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-emerald-100 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  Dengar maklumat tentang <strong>asap kenderaan</strong> dan{' '}
                  <strong>pembakaran terbuka</strong> sebelum membina hujah kamu.
                </span>
              </div>

              <button
                type="button"
                onClick={goToBuilderStage}
                className="btn-game-emerald px-6 py-3 rounded-2xl text-slate-950 font-game text-sm sm:text-base font-black tracking-wide flex items-center gap-2 shadow-[0_0_25px_rgba(52,211,153,0.45)] cursor-pointer ml-auto"
              >
                <span>BINA HUJAH SAYA</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            LANGKAH 3: MAKMAL PEMBINAAN HUJAH (4 KOMPONEN, TIADA RAKAMAN SUARA)
           ================================================================ */}
        {entrancePhase === 'ready' && !exploreStudioMode && stage === 'builder' && (
          <form
            onSubmit={handleValidateAndTransfer}
            className="pointer-events-auto w-full max-w-5xl rounded-3xl bg-slate-950/78 border-2 border-emerald-400/65 shadow-[0_0_55px_rgba(16,185,129,0.28),0_0_30px_rgba(34,211,238,0.2)] backdrop-blur-xl p-4 sm:p-6 space-y-4 my-auto"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <span className="text-[11px] font-game font-black uppercase tracking-widest text-emerald-300">
                  LANGKAH 3 · MAKMAL PEMBINAAN HUJAH
                </span>
                <h2 className="font-game text-lg sm:text-2xl font-black text-white">
                  SUSUN 4 KOMPONEN HUJAH KRITIS KAMU
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    setShowReportDrawerInBuilder((v) => !v);
                  }}
                  className="btn-game-cyan btn-game-sm px-3.5 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {showReportDrawerInBuilder ? 'Tutup Rujukan Laporan' : 'Rujuk Laporan Semula'}
                </button>
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-400/50 text-xs font-game font-black text-emerald-300">
                  Siap: {completedFieldCount}/4
                </span>
              </div>
            </div>

            {/* Optional quick reference strip to re-read / re-listen to the report */}
            {showReportDrawerInBuilder && (
              <div className="rounded-2xl bg-slate-900/95 border border-cyan-400/45 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed flex-1 min-w-[240px]">
                  <strong className="text-cyan-300 block mb-0.5">Laporan Taman Harmoni:</strong>
                  “{REPORT_SCRIPT}”
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    if (audioKey === 'report' && isAudioPlaying) {
                      stopCurrentAudio();
                    } else {
                      playContinuousAudio(
                        'report',
                        REPORT_SCRIPT,
                        'Speak in clear, calm, expressive standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia) like a news field reporter reporting air pollution in Taman Harmoni for primary school pupils.'
                      );
                    }
                  }}
                  className="btn-game-slate btn-game-sm px-3.5 py-2 text-white font-game text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                  {audioKey === 'report' && isAudioPlaying ? 'Henti Audio' : 'Dengar Laporan'}
                </button>
              </div>
            )}

            {formBannerError && (
              <div className="rounded-2xl bg-rose-500/15 border border-rose-400/60 px-4 py-2.5 text-xs sm:text-sm text-rose-200 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{formBannerError}</span>
              </div>
            )}

            {/* 4 Interactive Argument Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ARGUMENT_FIELDS.map((field) => {
                const value = draft[field.key];
                const err = validationErrors[field.key];
                const isReady = value.trim().length >= 5;

                return (
                  <div
                    key={field.key}
                    className={`rounded-2xl border p-4 space-y-2.5 transition-all ${
                      err
                        ? 'border-rose-400/80 bg-rose-950/20'
                        : isReady
                        ? 'border-emerald-400/75 bg-slate-900/95 shadow-[0_0_20px_rgba(16,185,129,0.14)]'
                        : field.accentCard
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-xl bg-gradient-to-br ${field.accentBadge} font-game text-xs font-black flex items-center justify-center shadow`}
                        >
                          {field.numberLabel}
                        </span>
                        <h3 className="font-game text-sm font-black text-white tracking-wide">
                          {field.title}
                        </h3>
                      </div>

                      {isReady ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <MessageSquareQuote className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs font-semibold text-cyan-200">{field.question}</p>

                    <textarea
                      rows={3}
                      value={value}
                      onChange={(e) => handleDraftChange(field.key, e.target.value)}
                      placeholder={field.example}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/95 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all resize-none ${field.accentInput}`}
                    />

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 italic">{field.example}</span>
                    </div>

                    {err && (
                      <p className="text-xs font-bold text-rose-300 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{err}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  stopCurrentAudio();
                  setStage('report');
                }}
                className="btn-game-slate btn-game-sm px-4 py-2.5 text-slate-200 font-game text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali ke Laporan
              </button>

              <button
                type="submit"
                className="btn-game-gold px-6 py-3.5 rounded-2xl text-slate-950 font-game text-sm sm:text-base font-black tracking-wide flex items-center gap-2 shadow-[0_0_30px_rgba(250,204,21,0.45)] cursor-pointer ml-auto"
              >
                <Save className="w-5 h-5" />
                <span>SIMPAN HUJAH &amp; TERUSKAN KE MISI 5</span>
              </button>
            </div>
          </form>
        )}

        {/* ================================================================
            LANGKAH 4: ANIMASI PEMINDAHAN HOLOGRAM & TAHNIAH KE MISI 5
           ================================================================ */}
        {entrancePhase === 'ready' && !exploreStudioMode && stage === 'transfer_success' && (
          <div className="pointer-events-auto w-full max-w-4xl rounded-3xl bg-slate-950/76 border-2 border-emerald-400/70 shadow-[0_0_60px_rgba(16,185,129,0.35),0_0_30px_rgba(236,72,153,0.22)] backdrop-blur-xl p-6 sm:p-8 space-y-6 text-center my-auto">
            {transferPhase === 'sending' ? (
              <div className="py-10 space-y-6">
                <div className="flex items-center justify-center gap-4 sm:gap-8">
                  <div className="px-4 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/70 text-cyan-200 font-game text-xs sm:text-sm font-black">
                    🎙️ MAKMAL SUARA
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                    <span className="w-12 sm:w-24 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 animate-pulse" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/70 text-emerald-200 font-game text-xs sm:text-sm font-black">
                    🚀 PUSAT OPERASI MISI 5
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="font-game text-xl sm:text-2xl font-black text-white">
                    MEMINDAHKAN DATA HUJAH HOLOGRAM...
                  </h2>
                  <p className="text-sm text-cyan-200">
                    Menyimpan Pendirian, Bukti Utama, Huraian &amp; Seruan ke Misi 5 secara automatik.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/70 text-amber-200 font-game text-xs sm:text-sm font-black shadow-lg">
                    <Award className="w-4 h-4 text-amber-300" />
                    <span>LENCANA BAHARU: EJEN PEMBINA HUJAH</span>
                  </div>

                  <h2 className="font-game text-2xl sm:text-3xl font-black text-emerald-300 tracking-wide">
                    MISI 4 SELESAI!
                  </h2>

                  <p className="text-sm sm:text-base text-slate-100 max-w-2xl mx-auto leading-relaxed font-medium">
                    {CONGRATS_MESSAGE}
                  </p>
                </div>

                {/* Summary Preview of Saved Arguments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {ARGUMENT_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-2xl bg-slate-900/90 border border-emerald-400/40 p-3.5 space-y-1"
                    >
                      <div className="text-[11px] font-game font-black text-amber-300 uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          {field.numberLabel}. {field.title}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
                        {draft[field.key]}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      handleCommitMission4('map');
                    }}
                    className="btn-game-slate px-5 py-3 rounded-2xl text-white font-game text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-cyan-300" />
                    <span>KEMBALI KE PETA MISI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSFX('warp');
                      handleCommitMission4('next_mission');
                    }}
                    className="btn-game-emerald px-6 py-3.5 rounded-2xl text-slate-950 font-game text-sm sm:text-base font-black flex items-center gap-2 shadow-[0_0_30px_rgba(52,211,153,0.5)] cursor-pointer"
                  >
                    <span>TERUSKAN KE MISI 5</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Studio Exploration Bar + Touch D-Pad + Camera Angle Presets (Non-intrusive) */}
      {entrancePhase === 'ready' && (
        <>
          {/* Compact Left Touch / Mouse D-Pad (Shown prominently in Explore Mode, or on bottom-left corner) */}
          <div
            className={`fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 transition-opacity ${
              exploreStudioMode ? 'flex opacity-100' : 'opacity-85 hover:opacity-100 hidden sm:flex'
            } flex-col items-center gap-1 p-2 rounded-2xl bg-slate-950/70 border border-cyan-400/45 backdrop-blur-xl shadow-[0_0_25px_rgba(34,211,238,0.22)]`}
          >
            <span className="text-[9px] font-game font-black uppercase tracking-wider text-cyan-300">
              Gerak Ejen
            </span>
            <button
              type="button"
              onPointerDown={() => setTouchDirection(0, 1)}
              onPointerUp={() => setTouchDirection(0, 0)}
              onPointerLeave={() => setTouchDirection(0, 0)}
              onPointerCancel={() => setTouchDirection(0, 0)}
              aria-label="Gerak Ke Hadapan"
              className="w-8 h-8 rounded-xl bg-slate-900/90 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 active:bg-cyan-400 active:text-slate-950 flex items-center justify-center cursor-pointer touch-none"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onPointerDown={() => setTouchDirection(-1, 0)}
                onPointerUp={() => setTouchDirection(0, 0)}
                onPointerLeave={() => setTouchDirection(0, 0)}
                onPointerCancel={() => setTouchDirection(0, 0)}
                aria-label="Gerak Ke Kiri"
                className="w-8 h-8 rounded-xl bg-slate-900/90 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 active:bg-cyan-400 active:text-slate-950 flex items-center justify-center cursor-pointer touch-none"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onPointerDown={() => setTouchDirection(0, -1)}
                onPointerUp={() => setTouchDirection(0, 0)}
                onPointerLeave={() => setTouchDirection(0, 0)}
                onPointerCancel={() => setTouchDirection(0, 0)}
                aria-label="Gerak Ke Belakang"
                className="w-8 h-8 rounded-xl bg-slate-900/90 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 active:bg-cyan-400 active:text-slate-950 flex items-center justify-center cursor-pointer touch-none"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onPointerDown={() => setTouchDirection(1, 0)}
                onPointerUp={() => setTouchDirection(0, 0)}
                onPointerLeave={() => setTouchDirection(0, 0)}
                onPointerCancel={() => setTouchDirection(0, 0)}
                aria-label="Gerak Ke Kanan"
                className="w-8 h-8 rounded-xl bg-slate-900/90 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30 active:bg-cyan-400 active:text-slate-950 flex items-center justify-center cursor-pointer touch-none"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <span className="hidden md:block text-[9px] text-slate-400 font-medium">
              WASD / Anak Panah
            </span>
          </div>

          {/* Camera Angle Switcher + Explore Mode Return Pill */}
          <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex flex-wrap items-center justify-end gap-1.5">
            {exploreStudioMode && (
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setExploreStudioMode(false);
                }}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 shadow-[0_0_25px_rgba(52,211,153,0.45)] cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Kembali ke Panel Misi</span>
              </button>
            )}

            <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-slate-950/70 border border-purple-400/45 backdrop-blur-xl shadow-[0_0_25px_rgba(168,85,247,0.22)]">
              <Camera className="w-3.5 h-3.5 text-fuchsia-300 ml-1 hidden sm:block" />
              {(
                [
                  { id: 'follow', label: 'Ikut Ejen' },
                  { id: 'wide', label: 'Luas Studio' },
                  { id: 'console', label: 'Meja Audio' },
                ] as { id: StudioCameraPreset; label: string }[]
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    yawOffsetRef.current = 0;
                    setCameraPreset(cam.id);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-game font-black cursor-pointer transition-colors ${
                    cameraPreset === cam.id
                      ? 'bg-gradient-to-r from-cyan-400 to-purple-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
