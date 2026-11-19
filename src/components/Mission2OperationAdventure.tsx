import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Camera,
  CheckCircle2,
  Compass,
  Droplets,
  Eye,
  Leaf,
  Mic,
  Music,
  Play,
  Puzzle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { AVATARS } from '../data/gameData';
import {
  buildSungaiTercemarWorld,
  RiverStageMode,
  SungaiTercemarWorldHandle,
} from '../three/sungaiTercemarWorld';
import { MissionDef, UserAccount } from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from '../utils/malayVoice';

export interface Mission2OperationAdventureProps {
  mission: MissionDef;
  user: UserAccount;
  musicOn: boolean;
  musicVolume: number;
  justTeleported?: boolean;
  onToggleMusic: () => void;
  onChangeMusicVolume: (vol: number) => void;
  onClose: () => void;
  onCompleteMission2: (
    score: number,
    kbatScore: number,
    punca: string,
    kesan: string,
    kbatAnswer: string,
    afterAction?: 'map' | 'next_mission'
  ) => void;
}

type Mission2Stage =
  | 'portal'
  | 'travel_intro'
  | 'audio_clues'
  | 'puzzle_lab'
  | 'voice_challenge'
  | 'victory';

interface AudioClueItem {
  id: 'fire' | 'river' | 'forest' | 'vehicles';
  title: string;
  subtitle: string;
  script: string;
  badgeColor: string;
  borderColor: string;
}

interface PuzzleCardItem {
  id: string;
  text: string;
  category: 'punca' | 'kesan';
  clueTag: string;
}

const AUDIO_CLUES: AudioClueItem[] = [
  {
    id: 'fire',
    title: 'Audio 1: Pembakaran Terbuka',
    subtitle: 'Imbasan Udara Zon Bandar',
    script:
      'Penduduk di sebuah kawasan sering melakukan pembakaran terbuka. Asap daripada pembakaran tersebut mencemarkan udara dan menyebabkan penduduk mengalami kesukaran untuk bernafas.',
    badgeColor: 'from-orange-400 to-rose-500',
    borderColor: 'border-orange-400/70',
  },
  {
    id: 'river',
    title: 'Audio 2: Pembuangan Sampah ke Sungai',
    subtitle: 'Imbasan Aliran Sungai',
    script:
      'Sesetengah orang membuang sampah ke dalam sungai. Sampah yang terkumpul menyebabkan air sungai menjadi kotor dan hidupan akuatik terancam.',
    badgeColor: 'from-cyan-400 to-blue-500',
    borderColor: 'border-cyan-400/70',
  },
  {
    id: 'forest',
    title: 'Audio 3: Penebangan Pokok',
    subtitle: 'Imbasan Hutan Simpan',
    script:
      'Pokok-pokok di kawasan hutan ditebang secara berlebihan. Keadaan ini menyebabkan haiwan kehilangan tempat tinggal dan kawasan hutan semakin berkurangan.',
    badgeColor: 'from-emerald-400 to-teal-500',
    borderColor: 'border-emerald-400/70',
  },
  {
    id: 'vehicles',
    title: 'Audio 4: Penggunaan Kenderaan yang Banyak',
    subtitle: 'Imbasan Jalan Utama',
    script:
      'Banyak kenderaan mengeluarkan asap setiap hari. Asap tersebut menyumbang kepada pencemaran udara dan menjejaskan kesihatan manusia.',
    badgeColor: 'from-purple-400 to-indigo-500',
    borderColor: 'border-purple-400/70',
  },
];

const INITIAL_PUZZLE_CARDS: PuzzleCardItem[] = [
  { id: 'c1', text: 'Pembakaran terbuka.', category: 'punca', clueTag: 'Audio 1' },
  { id: 'c2', text: 'Asap mencemarkan udara.', category: 'kesan', clueTag: 'Audio 1' },
  { id: 'c3', text: 'Pembuangan sampah ke dalam sungai.', category: 'punca', clueTag: 'Audio 2' },
  { id: 'c4', text: 'Air sungai menjadi kotor.', category: 'kesan', clueTag: 'Audio 2' },
  { id: 'c5', text: 'Penebangan pokok secara berlebihan.', category: 'punca', clueTag: 'Audio 3' },
  { id: 'c6', text: 'Haiwan kehilangan tempat tinggal.', category: 'kesan', clueTag: 'Audio 3' },
  { id: 'c7', text: 'Asap daripada kenderaan.', category: 'punca', clueTag: 'Audio 4' },
  { id: 'c8', text: 'Kesihatan manusia terjejas.', category: 'kesan', clueTag: 'Audio 4' },
];

const VOICE_QUESTIONS = [
  {
    id: 'q1',
    label: 'Soalan 1',
    title: 'Kebersihan Sungai Kita',
    question:
      'Pada pendapat kamu, mengapakah kita tidak boleh membuang sampah ke dalam sungai? Jelaskan jawapan kamu.',
    hint: 'Ceritakan sebab dan kesannya kepada air, ikan atau penduduk kampung.',
  },
  {
    id: 'q2',
    label: 'Soalan 2',
    title: 'Masa Depan Penghuni Hutan',
    question:
      'Bayangkan semua pokok di kawasan hutan ditebang. Apakah yang mungkin berlaku kepada haiwan yang tinggal di situ? Mengapa?',
    hint: 'Fikirkan tentang tempat tinggal, makanan dan keselamatan haiwan.',
  },
  {
    id: 'q3',
    label: 'Soalan 3',
    title: 'Tindakan Ejen Penyelamat',
    question:
      'Jika kamu melihat seseorang melakukan pembakaran terbuka, apakah tindakan yang akan kamu cadangkan untuk mengatasi masalah tersebut? Berikan alasan kamu.',
    hint: 'Cadangkan satu tindakan bijak berserta sebab mengapa ia membantu.',
  },
] as const;

/* ============================================================================
   CUSTOM HOLOGRAPHIC SCENE ILLUSTRATIONS FOR THE 4 AUDIO CLUES
   ============================================================================ */
function ClueSceneGraphic({ id }: { id: AudioClueItem['id'] }) {
  if (id === 'fire') {
    return (
      <svg viewBox="0 0 180 105" className="w-full h-24 rounded-xl" aria-hidden="true">
        <defs>
          <linearGradient id="m2FireSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
        </defs>
        <rect width="180" height="105" fill="url(#m2FireSky)" />
        <path d="M25 85 C35 55, 65 40, 82 22 C75 48, 108 42, 118 16 C128 48, 148 56, 156 85 Z" fill="#64748b" opacity="0.55" />
        <ellipse cx="90" cy="88" rx="60" ry="12" fill="#451a03" />
        <path d="M56 86 Q68 48 80 86 Q90 36 102 86 Q112 52 124 86 Z" fill="#f97316" />
        <path d="M68 86 Q78 58 88 86 Q96 52 108 86 Z" fill="#fde047" />
        <rect x="64" y="84" width="52" height="7" rx="3" fill="#78350f" />
      </svg>
    );
  }
  if (id === 'river') {
    return (
      <svg viewBox="0 0 180 105" className="w-full h-24 rounded-xl" aria-hidden="true">
        <defs>
          <linearGradient id="m2RivSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#082f49" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <rect width="180" height="105" fill="url(#m2RivSky)" />
        <path d="M0 56 Q45 48 90 56 T180 56 L180 105 L0 105 Z" fill="#0e7490" />
        <path d="M0 70 Q50 62 95 72 T180 68 L180 105 L0 105 Z" fill="#155e75" />
        <ellipse cx="48" cy="78" rx="14" ry="8" fill="#94a3b8" />
        <rect x="74" y="68" width="18" height="11" rx="3" fill="#fbbf24" transform="rotate(-12 83 73)" />
        <circle cx="115" cy="80" r="8" fill="#cbd5e1" />
        <path d="M136 86 Q146 78 156 86 Q146 94 136 86 Z" fill="#fb7185" />
        <path d="M156 86 L163 81 L163 91 Z" fill="#fb7185" />
      </svg>
    );
  }
  if (id === 'forest') {
    return (
      <svg viewBox="0 0 180 105" className="w-full h-24 rounded-xl" aria-hidden="true">
        <defs>
          <linearGradient id="m2ForSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect width="180" height="105" fill="url(#m2ForSky)" />
        <rect x="0" y="76" width="180" height="29" fill="#365314" />
        {/* Remaining single tree */}
        <rect x="84" y="42" width="10" height="38" fill="#78350f" />
        <circle cx="89" cy="34" r="20" fill="#22c55e" />
        {/* Cut tree stumps */}
        <path d="M30 84 L34 66 L50 66 L54 84 Z" fill="#92400e" />
        <ellipse cx="42" cy="66" rx="8" ry="3" fill="#fde68a" />
        <path d="M126 85 L130 68 L148 68 L152 85 Z" fill="#92400e" />
        <ellipse cx="139" cy="68" rx="9" ry="3" fill="#fde68a" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 180 105" className="w-full h-24 rounded-xl" aria-hidden="true">
      <defs>
        <linearGradient id="m2VehSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect width="180" height="105" fill="url(#m2VehSky)" />
      <rect x="0" y="76" width="180" height="29" fill="#1e293b" />
      {/* Smoke puffs */}
      <circle cx="38" cy="48" r="14" fill="#94a3b8" opacity="0.65" />
      <circle cx="52" cy="34" r="17" fill="#64748b" opacity="0.55" />
      <circle cx="118" cy="42" r="13" fill="#94a3b8" opacity="0.55" />
      {/* Car 1 */}
      <rect x="44" y="64" width="46" height="16" rx="5" fill="#ef4444" />
      <rect x="52" y="55" width="26" height="11" rx="3" fill="#fca5a5" />
      <circle cx="54" cy="81" r="5" fill="#0f172a" />
      <circle cx="80" cy="81" r="5" fill="#0f172a" />
      {/* Car 2 */}
      <rect x="104" y="66" width="44" height="14" rx="5" fill="#38bdf8" />
      <rect x="112" y="57" width="24" height="10" rx="3" fill="#bae6fd" />
      <circle cx="114" cy="81" r="5" fill="#0f172a" />
      <circle cx="138" cy="81" r="5" fill="#0f172a" />
    </svg>
  );
}

/* ============================================================================
   MALAY VOICE PICKER (STRICTLY BAHASA MELAYU MALAYSIA ms-MY, NEVER INDONESIAN)
   ============================================================================ */

// Pre-allocated Three.js sky/fog transition colors (zero allocations inside renderLoop)
const _targetRiverBg = new THREE.Color();
const _targetRiverFog = new THREE.Color();

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Mission2OperationAdventure({
  mission,
  user,
  musicOn,
  musicVolume,
  justTeleported = false,
  onToggleMusic,
  onChangeMusicVolume,
  onClose,
  onCompleteMission2,
}: Mission2OperationAdventureProps) {
  const [stage, setStage] = useState<Mission2Stage>('portal');
  const [portalJumping, setPortalJumping] = useState(false);
  const [introPhase, setIntroPhase] = useState<'walking' | 'observing' | 'done'>('walking');
  const [inspecting3D, setInspecting3D] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'cinematic' | 'river_wide' | 'agent_close'>('cinematic');

  // Stage 2: Audio Clues state
  const [heardIds, setHeardIds] = useState<string[]>([]);
  const [playingClueId, setPlayingClueId] = useState<string | null>(null);
  const [loadingClueId, setLoadingClueId] = useState<string | null>(null);
  const [audioFallbackNotice, setAudioFallbackNotice] = useState<string | null>(null);
  const ttsBlobCacheRef = useRef<Record<string, string>>({});
  const clueAudioElRef = useRef<HTMLAudioElement | null>(null);
  const captionTimerRef = useRef<number | null>(null);

  // Stage 3: Hologram Puzzle Lab (Drag & Drop + Click Support)
  const shuffledInitial = useMemo(
    () => [
      INITIAL_PUZZLE_CARDS[0],
      INITIAL_PUZZLE_CARDS[3],
      INITIAL_PUZZLE_CARDS[4],
      INITIAL_PUZZLE_CARDS[7],
      INITIAL_PUZZLE_CARDS[2],
      INITIAL_PUZZLE_CARDS[1],
      INITIAL_PUZZLE_CARDS[6],
      INITIAL_PUZZLE_CARDS[5],
    ],
    []
  );
  const [placements, setPlacements] = useState<Record<string, 'tray' | 'punca' | 'kesan'>>(() => {
    const init: Record<string, 'tray' | 'punca' | 'kesan'> = {};
    INITIAL_PUZZLE_CARDS.forEach((c) => {
      init[c.id] = 'tray';
    });
    return init;
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'punca' | 'kesan' | 'tray' | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [wrongCardIds, setWrongCardIds] = useState<string[]>([]);
  const [puzzleFeedback, setPuzzleFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleAttempts, setPuzzleAttempts] = useState(0);

  // Stage 4: Voice Challenge ("Suara Ejen") state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(VOICE_QUESTIONS[0].id);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voiceMeter, setVoiceMeter] = useState<number[]>([0.2, 0.3, 0.25, 0.35, 0.22, 0.3, 0.2]);
  const [recordedAudios, setRecordedAudios] = useState<
    Record<string, { url: string; duration: number; size: number }>
  >({});
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isPlayingBackVoice, setIsPlayingBackVoice] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const voiceAudioElRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudiosRef = useRef(recordedAudios);
  recordedAudiosRef.current = recordedAudios;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number>(0);

  // Three.js live 3D Polluted-to-Restored River World refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<SungaiTercemarWorldHandle | null>(null);
  const stageRef = useRef<Mission2Stage>(stage);
  stageRef.current = stage;
  const justTeleportedRef = useRef<boolean>(justTeleported);
  justTeleportedRef.current = justTeleported;
  const lastIntroPhaseRef = useRef<'walking' | 'observing' | 'done'>('walking');

  const avatarDef = AVATARS.find((a) => a.id === user.avatar) || AVATARS[2];

  // =========================================================================
  // LIVE 3D SUNGAI TERCEMAR -> SUNGAI DIPULIHKAN ADVENTURE ENVIRONMENT
  // =========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      const probeDbg = probeGl?.getExtension('WEBGL_debug_renderer_info');
      const probeName = probeDbg
        ? String(probeGl?.getParameter(probeDbg.UNMASKED_RENDERER_WEBGL) || '')
        : '';
      const probeSoft = /swiftshader|llvmpipe|softpipe/i.test(probeName);

      renderer = new THREE.WebGLRenderer({
        antialias: !probeSoft,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const gl = renderer.getContext();
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    const glName = dbg ? String(gl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /swiftshader|llvmpipe|softpipe/i.test(glName);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#72878d');
    scene.fog = new THREE.FogExp2('#8ea39d', 0.0145);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.65;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.15,
      190
    );
    camera.position.set(-11, 4.5, 16);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const world = buildSungaiTercemarWorld(avatarDef.id, maxAnisotropy, justTeleportedRef.current);
    worldRef.current = world;
    scene.add(world.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Smooth camera orbit & zoom directly on the 3D river canvas
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      world.orbitCameraBy(-dx * 0.006, dy * 0.0048);
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      world.zoomCameraBy(e.deltaY * 0.008);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

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
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const gl2 = gl as WebGL2RenderingContext;
    const canFenceSync = isSoftwareGl && typeof gl2?.fenceSync === 'function';

    function afterDraw(cb: () => void) {
      if (!canFenceSync) {
        frameId = requestAnimationFrame(cb);
        return;
      }
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = requestAnimationFrame(cb);
        return;
      }
      gl2.flush();
      const pollFence = () => {
        if (disposed) {
          gl2.deleteSync(sync);
          return;
        }
        const status = gl2.clientWaitSync(sync, 0, 0);
        if (
          status === gl2.ALREADY_SIGNALED ||
          status === gl2.CONDITION_SATISFIED ||
          status === gl2.WAIT_FAILED
        ) {
          gl2.deleteSync(sync);
          frameId = requestAnimationFrame(cb);
        } else {
          frameId = requestAnimationFrame(pollFence);
        }
      };
      frameId = requestAnimationFrame(pollFence);
    }

    function renderLoop() {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const st = stageRef.current as RiverStageMode;

      const sim = world.update(dt, elapsed, camera, st, justTeleportedRef.current);

      // Smoothly brighten sky & horizon haze as river transitions from polluted -> restored
      const rec = sim.recoveryProgress;
      _targetRiverBg.setHex(0x72878d).lerp(_targetRiverFog.setHex(0x60a5fa), rec);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_targetRiverBg, dt * 3.0);
      }
      _targetRiverFog.setHex(0x8ea39d).lerp(_targetRiverBg.setHex(0xbae6fd), rec);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(_targetRiverFog, dt * 3.0);
        scene.fog.density = THREE.MathUtils.lerp(0.0155, 0.0085, rec);
      }

      if (st === 'travel_intro') {
        if (sim.introPhase !== lastIntroPhaseRef.current) {
          lastIntroPhaseRef.current = sim.introPhase;
          setIntroPhase(sim.introPhase);
          if (sim.introPhase === 'done') {
            setStage('audio_clues');
          }
        }
      }

      renderer.render(scene, camera);
      afterDraw(renderLoop);
    }

    renderLoop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      world.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      worldRef.current = null;
    };
  }, [avatarDef.id]);

  // Cleanup all audio/mic resources on unmount
  useEffect(() => {
    const blobMap = ttsBlobCacheRef.current;
    return () => {
      setMusicState({ suppressedForAudio: false, ducked: false });
      if (clueAudioElRef.current) {
        clueAudioElRef.current.pause();
        clueAudioElRef.current = null;
      }
      if (voiceAudioElRef.current) {
        voiceAudioElRef.current.pause();
        voiceAudioElRef.current = null;
      }
      if (captionTimerRef.current) {
        clearTimeout(captionTimerRef.current);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      Object.values(blobMap).forEach((u) => URL.revokeObjectURL(u));
      Object.values(recordedAudiosRef.current).forEach((rec) => URL.revokeObjectURL(rec.url));
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(meterRafRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // =========================================================================
  // STAGE 2 AUDIO CLUE PLAYBACK (STRICTLY BAHASA MELAYU HUMAN VOICE)
  // =========================================================================
  const stopClueAudio = useCallback(() => {
    if (clueAudioElRef.current) {
      clueAudioElRef.current.pause();
      clueAudioElRef.current.currentTime = 0;
      clueAudioElRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (captionTimerRef.current) {
      clearTimeout(captionTimerRef.current);
      captionTimerRef.current = null;
    }
    setPlayingClueId(null);
    setLoadingClueId(null);
    setMusicState({ suppressedForAudio: false });
  }, []);

  const markClueHeard = useCallback((id: string) => {
    setHeardIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const playClueAudio = async (clue: AudioClueItem) => {
    if (playingClueId === clue.id) {
      stopClueAudio();
      return;
    }
    stopClueAudio();
    setAudioFallbackNotice(null);
    setLoadingClueId(clue.id);

    try {
      let url = ttsBlobCacheRef.current[clue.id];
      if (!url) {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clue.script,
            style: buildMalaysianTtsStyle(
              'Clear, natural Malaysian presenter reporting environmental evidence to primary school pupils.'
            ),
          }),
        });
        if (!resp.ok) throw new Error('TTS server unavailable');
        const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
        if (!data.audioBase64) throw new Error('Empty audio payload');

        const bin = atob(data.audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
        ttsBlobCacheRef.current[clue.id] = url;
      }

      const audio = new Audio(url);
      clueAudioElRef.current = audio;
      audio.onplay = () => {
        setLoadingClueId(null);
        setPlayingClueId(clue.id);
        setMusicState({ suppressedForAudio: true });
      };
      audio.onended = () => {
        setPlayingClueId(null);
        setMusicState({ suppressedForAudio: false });
        markClueHeard(clue.id);
      };
      audio.onerror = () => {
        setLoadingClueId(null);
        tryBrowserMalayVoice(clue);
      };
      await audio.play();
    } catch {
      setLoadingClueId(null);
      tryBrowserMalayVoice(clue);
    }
  };

  const tryBrowserMalayVoice = (clue: AudioClueItem) => {
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      const { voice: malayVoice } = pickMalaysianSpeechVoice(voices);
      if (malayVoice) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clue.script);
        utter.voice = malayVoice;
        utter.lang = malayVoice.lang;
        utter.rate = 0.94;
        utter.onstart = () => {
          setPlayingClueId(clue.id);
          setMusicState({ suppressedForAudio: true });
        };
        utter.onend = () => {
          setPlayingClueId(null);
          setMusicState({ suppressedForAudio: false });
          markClueHeard(clue.id);
        };
        utter.onerror = () => {
          setPlayingClueId(null);
          setMusicState({ suppressedForAudio: false });
          markClueHeard(clue.id);
        };
        setPlayingClueId(clue.id);
        setMusicState({ suppressedForAudio: true });
        window.speechSynthesis.speak(utter);
        return;
      }
    }

    // Strict Bahasa Melayu Malaysia (ms-MY) guard: Never use Indonesian or English voice!
    setPlayingClueId(clue.id);
    setMusicState({ suppressedForAudio: false });
    setAudioFallbackNotice(
      'Suara pembaca Bahasa Melayu Malaysia (ms-MY) sedang dipaparkan melalui skrin sari kata langsung (tiada suara Bahasa Indonesia atau Inggeris digunakan).'
    );
    captionTimerRef.current = window.setTimeout(() => {
      setPlayingClueId(null);
      setMusicState({ suppressedForAudio: false });
      markClueHeard(clue.id);
    }, 6500);
  };

  // =========================================================================
  // STAGE 3 HOLOGRAM PUZZLE LAB (DRAG-AND-DROP + TAP PLACEMENT)
  // =========================================================================
  const moveCardToZone = (cardId: string, zone: 'tray' | 'punca' | 'kesan') => {
    playSFX('click');
    setPlacements((prev) => ({ ...prev, [cardId]: zone }));
    setSelectedCardId(null);
    setDragOverZone(null);
    setDraggedCardId(null);
    setJustDroppedId(cardId);
    setWrongCardIds((prev) => prev.filter((id) => id !== cardId));
    setPuzzleFeedback(null);
    window.setTimeout(() => setJustDroppedId(null), 420);
  };

  const allPlaced = Object.values(placements).every((z) => z !== 'tray');

  const handleCheckPuzzle = () => {
    if (!allPlaced) {
      playSFX('error');
      setPuzzleFeedback({
        ok: false,
        text: 'Sila seret atau masukkan semua 8 kad puzzle ke dalam Dashboard PUNCA atau KESAN dahulu!',
      });
      return;
    }

    const wrongIds = INITIAL_PUZZLE_CARDS.filter((c) => placements[c.id] !== c.category).map(
      (c) => c.id
    );

    if (wrongIds.length > 0) {
      setPuzzleAttempts((a) => a + 1);
      setWrongCardIds(wrongIds);
      playSFX('error');
      setPuzzleFeedback({
        ok: false,
        text: `Ada ${wrongIds.length} kad bertanda kuning masih belum tepat! Ingat: PUNCA ialah sebab pencemaran berlaku, manakala KESAN ialah akibatnya. Cuba tukar kad tersebut dan tekan SEMAK PETUNJUK semula!`,
      });
      return;
    }

    setWrongCardIds([]);
    setPuzzleSolved(true);
    playSFX('win');
    setPuzzleFeedback({
      ok: true,
      text: 'Tahniah, Ejen! Semua 8 kad punca dan kesan pencemaran berjaya dikelaskan dengan tepat!',
    });
  };

  // =========================================================================
  // STAGE 4 VOICE CHALLENGE (REAL BROWSER MICROPHONE RECORDING)
  // =========================================================================
  useEffect(() => {
    if (!isRecording) return;
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isRecording]);

  const stopMicRecording = useCallback(() => {
    cancelAnimationFrame(meterRafRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
    setMusicState({ suppressedForAudio: false });
  }, []);

  const startMicRecording = async () => {
    setVoiceError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      playSFX('error');
      setVoiceError(
        'Rakaman suara tidak disokong pada pelayar ini. Sila gunakan pelayar moden yang menyokong mikrofon.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live audio frequency visualizer using Web Audio API AnalyserNode
      try {
        const ACtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (ACtx) {
          const ctx = new ACtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          src.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const tickMeter = () => {
            analyser.getByteFrequencyData(dataArr);
            const bars = [1, 2, 3, 4, 5, 6, 7].map((i) =>
              Math.max(0.18, Math.min(1, (dataArr[i] || 30) / 180))
            );
            setVoiceMeter(bars);
            meterRafRef.current = requestAnimationFrame(tickMeter);
          };
          tickMeter();
        }
      } catch {
        // Fallback visual wave continues safely via CSS
      }

      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      const startedAt = Date.now();

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        cancelAnimationFrame(meterRafRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });

        if (durationSec < 2 || blob.size < 800) {
          playSFX('error');
          setVoiceError(
            'Rakaman terlalu pendek! Sila berikan pandangan berserta alasan yang jelas (sekurang-kurangnya 2–3 saat).'
          );
          return;
        }

        const url = URL.createObjectURL(blob);
        setRecordedAudios((prev) => {
          if (prev[selectedQuestionId]?.url) URL.revokeObjectURL(prev[selectedQuestionId].url);
          return {
            ...prev,
            [selectedQuestionId]: { url, duration: durationSec, size: blob.size },
          };
        });
        playSFX('xp');
      };

      setRecSeconds(0);
      rec.start();
      setIsRecording(true);
      setMusicState({ suppressedForAudio: true });
      playSFX('click');
    } catch {
      playSFX('error');
      setVoiceError(
        'Akses mikrofon disekat atau tiada mikrofon dikesan. Sila benarkan kebenaran mikrofon pada pelayar untuk merakam suara anda.'
      );
      setMusicState({ suppressedForAudio: false });
    }
  };

  const handlePlayRecordedVoice = (qId: string) => {
    const rec = recordedAudios[qId];
    if (!rec) return;
    if (voiceAudioElRef.current) {
      voiceAudioElRef.current.pause();
      voiceAudioElRef.current = null;
      setIsPlayingBackVoice(false);
      setMusicState({ suppressedForAudio: false });
      return;
    }
    const audio = new Audio(rec.url);
    voiceAudioElRef.current = audio;
    audio.onplay = () => {
      setIsPlayingBackVoice(true);
      setMusicState({ suppressedForAudio: true });
    };
    audio.onended = () => {
      setIsPlayingBackVoice(false);
      setMusicState({ suppressedForAudio: false });
      voiceAudioElRef.current = null;
    };
    audio.onerror = () => {
      setIsPlayingBackVoice(false);
      setMusicState({ suppressedForAudio: false });
      voiceAudioElRef.current = null;
    };
    audio.play().catch(() => {});
  };

  const handleReRecordQuestion = (qId: string) => {
    if (voiceAudioElRef.current) {
      voiceAudioElRef.current.pause();
      voiceAudioElRef.current = null;
      setIsPlayingBackVoice(false);
    }
    setRecordedAudios((prev) => {
      const next = { ...prev };
      if (next[qId]?.url) URL.revokeObjectURL(next[qId].url);
      delete next[qId];
      return next;
    });
    setVoiceError(null);
    playSFX('click');
  };

  const recordedCount = Object.keys(recordedAudios).length;

  const handleStartOperation = () => {
    playSFX('warp');
    setPortalJumping(true);
    window.setTimeout(() => {
      setPortalJumping(false);
      lastIntroPhaseRef.current = 'walking';
      setIntroPhase('walking');
      worldRef.current?.startTravelIntro();
      setStage('travel_intro');
    }, 550);
  };

  const handleFinishMission2 = (afterAction: 'map' | 'next_mission') => {
    stopClueAudio();
    stopMicRecording();
    if (voiceAudioElRef.current) {
      voiceAudioElRef.current.pause();
      voiceAudioElRef.current = null;
      setIsPlayingBackVoice(false);
    }
    const puzzleScore = Math.max(75, 100 - puzzleAttempts * 5);
    const kbatScore = Math.min(100, 80 + recordedCount * 7);
    const total = Math.round((puzzleScore + kbatScore) / 2);
    const answeredLabels = Object.keys(recordedAudios)
      .map((qid) => VOICE_QUESTIONS.find((q) => q.id === qid)?.label)
      .filter(Boolean)
      .join(', ');

    onCompleteMission2(
      total,
      kbatScore,
      'Pembakaran terbuka, pembuangan sampah ke sungai, penebangan pokok & asap kenderaan',
      'Udara tercemar, air sungai kotor, haiwan hilang habitat & kesihatan manusia terjejas',
      `Rakaman suara spontan dijawab (${answeredLabels || 'Soalan 1'}) melalui Operasi Jejak Punca dan Kesan`,
      afterAction
    );
  };

  const activeClueObj = AUDIO_CLUES.find((c) => c.id === playingClueId) || null;
  const activeVoiceQuestion =
    VOICE_QUESTIONS.find((q) => q.id === selectedQuestionId) || VOICE_QUESTIONS[0];
  const currentRecorded = recordedAudios[activeVoiceQuestion.id];

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-950 select-none">
      {/* Live 3D Holographic EcoWorld Backdrop */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />

      {/* Top HUD Bar */}
      <header className="relative z-20 px-3 sm:px-6 pt-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl portal-glass-card">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-500 text-slate-950 flex items-center justify-center font-game font-black shadow-lg shrink-0">
            M2
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs font-game font-bold text-amber-300 tracking-wider truncate">
              {avatarDef.name.toUpperCase()} · +{mission.maxXp} XP
            </div>
            <h1 className="font-game text-xs sm:text-base font-black text-white truncate">
              MISI 2: OPERASI JEJAK PUNCA DAN KESAN
            </h1>
          </div>
        </div>

        {/* Stage Stepper */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl portal-glass-card text-[11px] font-game font-bold">
          {(
            [
              ['portal', '1. Portal'],
              ['audio_clues', '2. Dengar Petunjuk'],
              ['puzzle_lab', '3. Makmal Puzzle'],
              ['voice_challenge', '4. Suara Ejen'],
              ['victory', '5. Kejayaan'],
            ] as [Mission2Stage, string][]
          ).map(([stKey, label]) => (
            <span
              key={stKey}
              className={`px-2.5 py-1 rounded-xl transition-colors ${
                stage === stKey || (stage === 'travel_intro' && stKey === 'portal')
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-black'
                  : 'text-cyan-200/70'
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {stage !== 'portal' && stage !== 'travel_intro' && (
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setInspecting3D((v) => !v);
              }}
              className="btn-game-teal btn-game-sm px-3 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{inspecting3D ? 'Kembali ke Tugasan' : stage === 'victory' ? 'Lihat Sungai Pulih 3D' : 'Tinjau Sungai 3D'}</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 rounded-2xl portal-glass-sub px-2.5 py-1.5">
            <button
              type="button"
              onClick={onToggleMusic}
              className="text-xs font-bold text-cyan-200 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {musicOn ? (
                <Music className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{musicOn ? 'Muzik' : 'Senyap'}</span>
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={musicOn ? Math.round(musicVolume * 100) : 0}
              onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
              aria-label="Laraskan kelantangan muzik"
              className="w-14 accent-cyan-400 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              stopClueAudio();
              stopMicRecording();
              playSFX('click');
              onClose();
            }}
            className="btn-game-gold btn-game-sm px-3.5 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>PETA MISI</span>
          </button>
        </div>
      </header>

      {/* Travel & River Observation Cinematic HUD Overlay */}
      {stage === 'travel_intro' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1.5rem)] max-w-2xl pointer-events-auto modal-pop-in">
          <div className="portal-glass-card rounded-3xl p-4 sm:p-5 border-2 border-cyan-300/80 text-white flex flex-wrap items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 to-cyan-400 text-slate-950 flex items-center justify-center shrink-0">
                <Compass className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-game font-bold text-amber-300 tracking-wider">
                  {introPhase === 'walking'
                    ? 'PERJALANAN EJEN ECOWORLD KE SUNGAI'
                    : 'PEMERHATIAN KEADAAN SUNGAI TERCEMAR'}
                </div>
                <p className="text-xs sm:text-sm text-cyan-50 font-semibold leading-snug">
                  {introPhase === 'walking'
                    ? 'Ejen EcoWorld sedang menuju ke tebing sungai untuk membuat pemeriksaan awal...'
                    : 'Perhatikan air sungai yang keruh dan sampah di tebing. Selesaikan aktiviti misi untuk memulihkannya!'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSFX('portal');
                setStage('audio_clues');
              }}
              className="btn-game-emerald btn-game-sm px-4 py-2.5 text-slate-950 font-game text-xs font-black shrink-0 cursor-pointer"
            >
              TERUSKAN KE PETUNJUK →
            </button>
          </div>
        </div>
      )}

      {/* Optional 3D River Free-Orbit Inspection Dock (when user toggles "Tinjau Sungai 3D") */}
      {inspecting3D && stage !== 'portal' && stage !== 'travel_intro' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto modal-pop-in">
          <div className="portal-glass-card rounded-2xl px-4 py-2.5 border border-cyan-300/75 text-white flex flex-wrap items-center gap-2.5 shadow-2xl">
            <span className="text-xs font-semibold text-cyan-100">
              Seret skrin untuk pusing sudut kamera · Skrol untuk zum
            </span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  ['cinematic', 'Sudut Ejen'],
                  ['river_wide', 'Pemandangan Luas'],
                  ['agent_close', 'Dekat Ejen'],
                ] as ['cinematic' | 'river_wide' | 'agent_close', string][]
              ).map(([preset, lbl]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    setCameraPreset(preset);
                    worldRef.current?.setCameraPreset(preset);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-game text-[11px] font-bold border cursor-pointer flex items-center gap-1 ${
                    cameraPreset === preset
                      ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                      : 'bg-slate-900/90 text-cyan-100 border-cyan-400/45'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Responsive Stage Container (passes pointer clicks through to 3D river when inspecting) */}
      <main
        className={`relative z-20 h-[calc(100vh-76px)] overflow-y-auto eco-scroll p-3 sm:p-5 pb-24 flex items-center justify-center pointer-events-none ${
          stage === 'travel_intro' || inspecting3D ? 'opacity-0' : ''
        }`}
      >
        {/* =================================================================
            STAGE 1: TELEPORTASI KE ECOWORLD (PORTAL ENTRY)
           ================================================================= */}
        {stage === 'portal' && (
          <div
            className={`portal-glass-card modal-pop-in w-full max-w-3xl rounded-3xl p-6 sm:p-8 text-center text-white space-y-6 border-2 border-cyan-300/75 transition-all duration-500 ${
              inspecting3D ? 'pointer-events-none' : 'pointer-events-auto'
            } ${
              portalJumping ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-400/75 text-cyan-200 font-game text-xs font-bold tracking-wider shadow-[0_0_18px_rgba(34,211,238,0.35)]">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>PORTAL TELEPORTASI ECOWORLD 3D</span>
            </div>

            <div className="space-y-2">
              <div className="font-game text-lg sm:text-2xl font-black tracking-[0.14em] text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.65)]">
                SELAMAT DATANG KE MISI 2
              </div>
              <h2 className="font-game text-2xl sm:text-4xl font-black game-title-emerald">
                MISI 2: OPERASI JEJAK PUNCA DAN KESAN
              </h2>
              <p className="text-xs sm:text-sm text-cyan-200 font-semibold">
                Pusat Kawalan Penyelamat Alam Sekitar EcoWorld
              </p>
            </div>

            <div className="portal-glass-sub rounded-2xl p-5 sm:p-6 max-w-2xl mx-auto border border-cyan-400/45">
              <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                &ldquo;Selamat datang, Ejen EcoWorld! Alam sekitar sedang menghadapi ancaman. Kamu perlu mengesan punca pencemaran dan memahami kesannya. Bersedia untuk menjalankan operasi?&rdquo;
              </p>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleStartOperation}
                className="btn-game-gold px-9 py-4 text-slate-950 font-game text-base sm:text-lg font-black tracking-wider flex items-center gap-3 cursor-pointer hover:scale-[1.03] transition-transform"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>MULAKAN OPERASI</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            STAGE 2: CABARAN PERTAMA – DENGAR DAN JEJAK PETUNJUK
           ================================================================= */}
        {stage === 'audio_clues' && (
          <div className={`portal-glass-card modal-pop-in w-full max-w-5xl rounded-3xl p-5 sm:p-7 text-white space-y-5 border-2 border-cyan-400/70 my-auto ${inspecting3D ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-400/25">
              <div>
                <div className="text-xs font-game font-bold text-cyan-300 tracking-wider">
                  CABARAN 1 · PENDAFTARAN BUNYI HOLOGRAM
                </div>
                <h2 className="font-game text-xl sm:text-2xl font-black text-white">
                  Dengar dan Jejak Petunjuk
                </h2>
                <p className="text-xs sm:text-sm text-cyan-100/90 mt-0.5">
                  Tekan setiap kad hologram untuk mendengar laporan pencemaran dengan teliti.
                </p>
              </div>

              <div className="px-4 py-2 rounded-2xl portal-glass-sub border border-amber-400/60 flex items-center gap-2 text-xs font-game font-black text-amber-300">
                <Star className="w-4 h-4 fill-amber-300" />
                <span>PETUNJUK DIDENGAR: {heardIds.length} / 4</span>
              </div>
            </div>

            {/* 4 Interactive Hologram Audio Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {AUDIO_CLUES.map((clue) => {
                const isPlaying = playingClueId === clue.id;
                const isLoading = loadingClueId === clue.id;
                const isHeard = heardIds.includes(clue.id);

                return (
                  <button
                    key={clue.id}
                    type="button"
                    onClick={() => playClueAudio(clue)}
                    className={`portal-glass-sub rounded-2xl p-3.5 text-left flex flex-col justify-between gap-3 border-2 transition-all duration-200 hover:-translate-y-1 cursor-pointer ${
                      isPlaying
                        ? 'border-amber-300 ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.55)]'
                        : isHeard
                        ? 'border-emerald-400/80'
                        : `${clue.borderColor} hover:border-cyan-300`
                    }`}
                  >
                    <div className="space-y-2.5 w-full">
                      <ClueSceneGraphic id={clue.id} />

                      <div>
                        <div className="text-[10px] font-bold text-cyan-300 tracking-wide">
                          {clue.subtitle}
                        </div>
                        <div className="font-game text-xs sm:text-sm font-black text-white mt-0.5 leading-snug">
                          {clue.title}
                        </div>
                      </div>
                    </div>

                    <div className="w-full pt-2 border-t border-cyan-400/20 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r ${clue.badgeColor} text-slate-950 font-game text-[11px] font-black shadow`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>
                          {isLoading ? 'MEMUAT...' : isPlaying ? 'SEDANG MAIN' : 'DENGAR'}
                        </span>
                      </span>

                      {/* Animated Sound Wave Visualizer */}
                      <div className="flex items-end gap-0.5 h-5">
                        {[0, 1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            style={{ animationDelay: `${bar * 0.1}s` }}
                            className={`w-1 rounded-full transition-all ${
                              isPlaying
                                ? 'h-5 bg-amber-300 wave-bar-active'
                                : isHeard
                                ? 'h-2.5 bg-emerald-400'
                                : 'h-2 bg-cyan-400/40'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {isHeard && (
                      <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sudah didengar</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Playing Hologram Transcript Support */}
            {activeClueObj && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border-2 border-cyan-300/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-game text-xs font-black text-amber-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    <span>SEDANG MEMAINKAN: {activeClueObj.title.toUpperCase()}</span>
                  </span>
                  <button
                    type="button"
                    onClick={stopClueAudio}
                    className="btn-game-rose btn-game-sm px-3 py-1 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Henti Audio
                  </button>
                </div>
                <p className="text-sm text-cyan-50 leading-relaxed font-medium">
                  &ldquo;{activeClueObj.script}&rdquo;
                </p>
                {audioFallbackNotice && (
                  <p className="text-[11px] text-amber-200">{audioFallbackNotice}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-cyan-200">
                {heardIds.length < 4
                  ? `Sila dengar kesemua 4 petunjuk audio dahulu (${4 - heardIds.length} lagi belum didengar).`
                  : 'Semua petunjuk telah didengar! Kamu sedia untuk ke Makmal Puzzle.'}
              </p>

              <button
                type="button"
                disabled={heardIds.length < 4}
                onClick={() => {
                  stopClueAudio();
                  playSFX('portal');
                  setStage('puzzle_lab');
                }}
                className="btn-game-emerald disabled:opacity-45 px-6 py-3 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 cursor-pointer"
              >
                <Puzzle className="w-4 h-4" />
                <span>TERUSKAN KE MAKMAL PUZZLE →</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            STAGE 3: CABARAN KEDUA – MAKMAL PUZZLE ECOWORLD (DRAG & DROP)
           ================================================================= */}
        {stage === 'puzzle_lab' && (
          <div className={`portal-glass-card modal-pop-in w-full max-w-6xl rounded-3xl p-5 sm:p-6 text-white space-y-4 border-2 border-purple-400/70 my-auto ${inspecting3D ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-400/25">
              <div>
                <div className="text-xs font-game font-bold text-purple-300 tracking-wider">
                  CABARAN 2 · MEJA HOLOGRAM DIGITAL
                </div>
                <h2 className="font-game text-xl sm:text-2xl font-black text-white">
                  Makmal Puzzle EcoWorld
                </h2>
                <p className="text-xs sm:text-sm text-cyan-100/90 mt-0.5">
                  Seret dan lepas (atau klik kad kemudian klik ruang) kad hologram ke Dashboard PUNCA atau KESAN yang betul.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setStage('audio_clues');
                }}
                className="btn-game-slate btn-game-sm px-3.5 py-2 text-cyan-200 font-game text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Dengar Semula Audio</span>
              </button>
            </div>

            {/* Two Main Drop Dashboards: PUNCA & KESAN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* DASHBOARD 1: PUNCA */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverZone('punca');
                }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const cid = e.dataTransfer.getData('text/plain') || draggedCardId;
                  if (cid) moveCardToZone(cid, 'punca');
                }}
                onClick={() => {
                  if (selectedCardId) moveCardToZone(selectedCardId, 'punca');
                }}
                className={`rounded-3xl p-4 sm:p-5 border-2 min-h-[210px] transition-all duration-200 space-y-3 ${
                  dragOverZone === 'punca' || selectedCardId
                    ? 'border-emerald-300 bg-emerald-950/75 shadow-[0_0_28px_rgba(16,185,129,0.5)] cursor-pointer'
                    : 'border-emerald-400/65 bg-emerald-950/45'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-400/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 text-slate-950 flex items-center justify-center shadow-lg">
                      <Leaf className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="font-game text-base sm:text-lg font-black text-emerald-300">
                        DASHBOARD 1: PUNCA
                      </h3>
                      <p className="text-[11px] text-emerald-100/85">
                        Sebab sesuatu pencemaran berlaku
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-black text-emerald-200">
                    {shuffledInitial.filter((c) => placements[c.id] === 'punca').length} kad
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {shuffledInitial
                    .filter((c) => placements[c.id] === 'punca')
                    .map((card) => {
                      const isWrong = wrongCardIds.includes(card.id);
                      const isJust = justDroppedId === card.id;
                      return (
                        <div
                          key={card.id}
                          draggable={!puzzleSolved}
                          onDragStart={(e) => {
                            setDraggedCardId(card.id);
                            e.dataTransfer.setData('text/plain', card.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!puzzleSolved) moveCardToZone(card.id, 'tray');
                          }}
                          title="Seret ke ruang lain atau klik untuk kembalikan ke meja"
                          className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing ${
                            isWrong
                              ? 'border-amber-300 bg-rose-950/90 text-amber-100 ring-2 ring-amber-400'
                              : puzzleSolved
                              ? 'border-emerald-300 bg-emerald-900/75 text-white'
                              : 'border-emerald-300/70 bg-slate-950/85 text-emerald-100 hover:border-white'
                          } ${isJust ? 'confirm-green-pulse scale-[1.03]' : ''}`}
                        >
                          <span>{card.text}</span>
                          {!puzzleSolved && (
                            <span className="text-[10px] text-emerald-300/80 shrink-0">↩</span>
                          )}
                        </div>
                      );
                    })}
                </div>

                {shuffledInitial.filter((c) => placements[c.id] === 'punca').length === 0 && (
                  <div className="h-24 rounded-2xl border-2 border-dashed border-emerald-400/40 flex items-center justify-center text-xs text-emerald-200/75 font-semibold text-center px-3">
                    Seret kad PUNCA pencemaran ke sini
                  </div>
                )}
              </div>

              {/* DASHBOARD 2: KESAN */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverZone('kesan');
                }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const cid = e.dataTransfer.getData('text/plain') || draggedCardId;
                  if (cid) moveCardToZone(cid, 'kesan');
                }}
                onClick={() => {
                  if (selectedCardId) moveCardToZone(selectedCardId, 'kesan');
                }}
                className={`rounded-3xl p-4 sm:p-5 border-2 min-h-[210px] transition-all duration-200 space-y-3 ${
                  dragOverZone === 'kesan' || selectedCardId
                    ? 'border-cyan-300 bg-sky-950/75 shadow-[0_0_28px_rgba(56,189,248,0.5)] cursor-pointer'
                    : 'border-cyan-400/65 bg-sky-950/45'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-400/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 text-slate-950 flex items-center justify-center shadow-lg">
                      <Droplets className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="font-game text-base sm:text-lg font-black text-cyan-300">
                        DASHBOARD 2: KESAN
                      </h3>
                      <p className="text-[11px] text-cyan-100/85">
                        Akibat daripada sesuatu pencemaran
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-black text-cyan-200">
                    {shuffledInitial.filter((c) => placements[c.id] === 'kesan').length} kad
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {shuffledInitial
                    .filter((c) => placements[c.id] === 'kesan')
                    .map((card) => {
                      const isWrong = wrongCardIds.includes(card.id);
                      const isJust = justDroppedId === card.id;
                      return (
                        <div
                          key={card.id}
                          draggable={!puzzleSolved}
                          onDragStart={(e) => {
                            setDraggedCardId(card.id);
                            e.dataTransfer.setData('text/plain', card.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!puzzleSolved) moveCardToZone(card.id, 'tray');
                          }}
                          title="Seret ke ruang lain atau klik untuk kembalikan ke meja"
                          className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing ${
                            isWrong
                              ? 'border-amber-300 bg-rose-950/90 text-amber-100 ring-2 ring-amber-400'
                              : puzzleSolved
                              ? 'border-cyan-300 bg-sky-900/75 text-white'
                              : 'border-cyan-300/70 bg-slate-950/85 text-cyan-100 hover:border-white'
                          } ${isJust ? 'confirm-green-pulse scale-[1.03]' : ''}`}
                        >
                          <span>{card.text}</span>
                          {!puzzleSolved && (
                            <span className="text-[10px] text-cyan-300/80 shrink-0">↩</span>
                          )}
                        </div>
                      );
                    })}
                </div>

                {shuffledInitial.filter((c) => placements[c.id] === 'kesan').length === 0 && (
                  <div className="h-24 rounded-2xl border-2 border-dashed border-cyan-400/40 flex items-center justify-center text-xs text-cyan-200/75 font-semibold text-center px-3">
                    Seret kad KESAN pencemaran ke sini
                  </div>
                )}
              </div>
            </div>

            {/* Hologram Cards Tray */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone('tray');
              }}
              onDrop={(e) => {
                e.preventDefault();
                const cid = e.dataTransfer.getData('text/plain') || draggedCardId;
                if (cid) moveCardToZone(cid, 'tray');
              }}
              className="portal-glass-sub rounded-2xl p-4 space-y-2.5 border border-purple-400/45"
            >
              <div className="flex items-center justify-between text-xs font-game font-bold text-purple-200">
                <span>MEJA KAD HOLOGRAM ({shuffledInitial.filter((c) => placements[c.id] === 'tray').length} kad berbaki)</span>
                {selectedCardId && (
                  <span className="text-amber-300">
                    Kad dipilih — sekarang klik Dashboard PUNCA atau KESAN di atas!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {shuffledInitial
                  .filter((c) => placements[c.id] === 'tray')
                  .map((card) => {
                    const isPicked = selectedCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedCardId(card.id);
                          e.dataTransfer.setData('text/plain', card.id);
                        }}
                        onClick={() => {
                          playSFX('click');
                          setSelectedCardId((prev) => (prev === card.id ? null : card.id));
                        }}
                        className={`p-3 rounded-2xl border-2 text-xs font-bold flex items-center gap-2.5 cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 ${
                          isPicked
                            ? 'border-amber-300 bg-purple-900/90 text-white shadow-[0_0_16px_rgba(250,204,21,0.55)] scale-[1.02]'
                            : 'border-purple-400/60 bg-slate-950/90 text-slate-100 hover:border-cyan-300'
                        }`}
                      >
                        <Wind className="w-4 h-4 text-cyan-300 shrink-0" />
                        <span>{card.text}</span>
                      </div>
                    );
                  })}
              </div>

              {shuffledInitial.every((c) => placements[c.id] !== 'tray') && (
                <p className="text-xs text-emerald-300 font-semibold text-center py-1">
                  Semua kad telah dimasukkan ke dalam dashboard! Tekan butang SEMAK PETUNJUK di bawah.
                </p>
              )}
            </div>

            {/* Friendly Feedback Banner */}
            {puzzleFeedback && (
              <div
                className={`p-3.5 rounded-2xl border-2 text-xs sm:text-sm font-bold flex items-center gap-2.5 ${
                  puzzleFeedback.ok
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
                    : 'bg-rose-950/90 border-amber-400 text-amber-100'
                }`}
              >
                {puzzleFeedback.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
                )}
                <span>{puzzleFeedback.text}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              {!puzzleSolved ? (
                <button
                  type="button"
                  onClick={handleCheckPuzzle}
                  className="btn-game-emerald px-7 py-3 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.8]" />
                  <span>SEMAK PETUNJUK</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playSFX('portal');
                    setStage('voice_challenge');
                  }}
                  className="btn-game-gold px-7 py-3 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>TERUSKAN KE SUARA EJEN →</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* =================================================================
            STAGE 4: CABARAN KETIGA – SUARA EJEN: FIKIR DAN HUJAHKAN!
           ================================================================= */}
        {stage === 'voice_challenge' && (
          <div className={`portal-glass-card modal-pop-in w-full max-w-5xl rounded-3xl p-5 sm:p-7 text-white space-y-5 border-2 border-purple-400/75 my-auto ${inspecting3D ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <div className="space-y-1 pb-3 border-b border-cyan-400/25">
              <div className="text-xs font-game font-bold text-purple-300 tracking-wider">
                CABARAN 3 · SUARA EJEN: FIKIR DAN HUJAHKAN!
              </div>
              <h2 className="font-game text-lg sm:text-2xl font-black text-emerald-300">
                Suara Ejen — Jawab Secara Spontan
              </h2>
              <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed">
                &ldquo;Tahniah, Ejen! Kamu berjaya mengesan punca dan kesan pencemaran. Sekarang, buktikan bahawa kamu mampu berfikir seperti seorang penyelamat alam sekitar!&rdquo;
              </p>
            </div>

            {/* 3 Critical-Thinking Digital Challenge Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {VOICE_QUESTIONS.map((q) => {
                const isActive = selectedQuestionId === q.id;
                const hasRec = Boolean(recordedAudios[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={isRecording}
                    onClick={() => {
                      playSFX('click');
                      if (voiceAudioElRef.current) {
                        voiceAudioElRef.current.pause();
                        voiceAudioElRef.current = null;
                        setIsPlayingBackVoice(false);
                        setMusicState({ suppressedForAudio: false });
                      }
                      setSelectedQuestionId(q.id);
                      setVoiceError(null);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer disabled:opacity-70 ${
                      isActive
                        ? 'border-cyan-300 bg-gradient-to-br from-purple-950/90 to-sky-950/90 shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                        : hasRec
                        ? 'border-emerald-400/75 bg-emerald-950/45'
                        : 'border-slate-700 bg-slate-950/75 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-game text-xs font-black text-amber-300">{q.label}</span>
                      {hasRec && (
                        <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Dirakam
                        </span>
                      )}
                    </div>
                    <div className="font-display text-sm font-bold text-white">{q.title}</div>
                  </button>
                );
              })}
            </div>

            {/* Active Question Challenge Card + Big Microphone Studio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center portal-glass-sub rounded-3xl p-5 border border-cyan-400/45">
              <div className="lg:col-span-7 space-y-3">
                <span className="text-xs font-game font-bold text-cyan-300">
                  {activeVoiceQuestion.label.toUpperCase()} · {activeVoiceQuestion.title}
                </span>
                <p className="text-base sm:text-xl font-bold text-white leading-relaxed">
                  &ldquo;{activeVoiceQuestion.question}&rdquo;
                </p>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-400/35 text-xs text-purple-200">
                  <strong>Panduan Ejen:</strong> {activeVoiceQuestion.hint}
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col items-center justify-center gap-3.5 text-center">
                {!currentRecorded ? (
                  <>
                    <button
                      type="button"
                      onClick={isRecording ? stopMicRecording : startMicRecording}
                      className={`relative w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center gap-1 font-game text-xs font-black shadow-2xl cursor-pointer transition-transform duration-200 ${
                        isRecording
                          ? 'bg-gradient-to-br from-rose-500 to-rose-700 border-rose-200 text-white scale-105'
                          : 'bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-600 border-cyan-200 text-slate-950 hover:scale-105'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-8 h-8 fill-current" />
                          <span>HENTI</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-9 h-9 stroke-[2.4]" />
                          <span>RAKAM</span>
                        </>
                      )}
                    </button>

                    {/* Live Animated Voice Wave Bars */}
                    <div className="flex items-end gap-1.5 h-8">
                      {voiceMeter.map((v, i) => (
                        <span
                          key={i}
                          style={{ height: isRecording ? `${Math.round(v * 32)}px` : '6px' }}
                          className={`w-2 rounded-full transition-all duration-100 ${
                            isRecording
                              ? 'bg-gradient-to-t from-emerald-400 to-cyan-300'
                              : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs font-semibold text-cyan-100">
                      {isRecording
                        ? `Sedang merakam suara anda (${formatSec(recSeconds)})... Tekan HENTI apabila selesai.`
                        : 'Tekan mikrofon dan sampaikan pendapat kamu.'}
                    </p>
                  </>
                ) : (
                  <div className="w-full space-y-3 p-4 rounded-2xl bg-slate-950/90 border border-emerald-400/60">
                    <div className="text-xs font-game font-black text-emerald-300 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>RAKAMAN SEDIA ({formatSec(currentRecorded.duration)})</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePlayRecordedVoice(activeVoiceQuestion.id)}
                        className="btn-game-cyan btn-game-sm py-2.5 px-3 text-slate-950 font-game text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isPlayingBackVoice ? 'Henti Main' : 'Dengar Semula'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReRecordQuestion(activeVoiceQuestion.id)}
                        className="btn-game-rose btn-game-sm py-2.5 px-3 text-white font-game text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rakam Semula</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {voiceError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-400 text-rose-100 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <span>{voiceError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-cyan-200">
                Soalan dirakam: <strong className="text-amber-300">{recordedCount} / 3</strong> (Minimum 1 soalan dirakam untuk menyelamatkan EcoWorld)
              </div>

              <button
                type="button"
                disabled={recordedCount < 1 || isRecording}
                onClick={() => {
                  playSFX('win');
                  setStage('victory');
                }}
                className="btn-game-emerald disabled:opacity-45 px-7 py-3 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>SELESAIKAN OPERASI MISI 2 →</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================================
            STAGE 5: PAPARAN KEJAYAAN – ECOWORLD BERJAYA DISELAMATKAN!
           ================================================================= */}
        {stage === 'victory' && (
          <div className={`portal-glass-card modal-pop-in w-full max-w-3xl rounded-3xl p-6 sm:p-8 text-center text-white space-y-5 border-2 border-amber-300 my-auto ${inspecting3D ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <div className="flex items-center justify-center gap-3">
              <Star className="w-9 h-9 text-amber-300 fill-amber-300 animate-bounce" />
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 text-slate-950 flex items-center justify-center shadow-[0_0_30px_rgba(52,211,153,0.75)]">
                <Award className="w-9 h-9 stroke-[2.3]" />
              </div>
              <Star className="w-9 h-9 text-amber-300 fill-amber-300 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h2 className="font-game text-3xl sm:text-5xl font-black game-title-gold">
                TAHNIAH!
              </h2>
              <p className="text-base sm:text-xl font-bold text-emerald-200">
                &ldquo;Anda telah berjaya menyelesaikan Misi 2 untuk menyelamatkan EcoWorld!&rdquo;
              </p>
              <p className="text-xs sm:text-sm text-cyan-100 max-w-xl mx-auto leading-relaxed">
                &ldquo;Anda kini lebih bijak mengenal pasti punca dan kesan pencemaran alam sekitar. Teruskan usaha anda!&rdquo;
              </p>
            </div>

            {/* Restored EcoWorld Visual Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
              <div className="portal-glass-sub rounded-2xl p-3 border border-emerald-400/50">
                <div className="text-[10px] font-bold text-emerald-300">HUTAN HIJAU</div>
                <div className="text-xs font-bold text-white mt-0.5">Pokok Kembali Subur</div>
              </div>
              <div className="portal-glass-sub rounded-2xl p-3 border border-cyan-400/50">
                <div className="text-[10px] font-bold text-cyan-300">SUNGAI BERSIH</div>
                <div className="text-xs font-bold text-white mt-0.5">Hidupan Air Selamat</div>
              </div>
              <div className="portal-glass-sub rounded-2xl p-3 border border-amber-400/50">
                <div className="text-[10px] font-bold text-amber-300">GANJARAN XP</div>
                <div className="font-mono-num text-base font-black text-amber-300">
                  +{mission.maxXp} XP
                </div>
              </div>
              <div className="portal-glass-sub rounded-2xl p-3 border border-purple-400/50">
                <div className="text-[10px] font-bold text-purple-300">LENCANA</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  Ejen Penyelamat EcoWorld
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  handleFinishMission2('map');
                }}
                className="btn-game-slate py-3.5 px-5 text-cyan-100 font-game text-xs sm:text-sm font-black tracking-wide flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>KEMBALI KE PETA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSFX('warp');
                  handleFinishMission2('next_mission');
                }}
                className="btn-game-emerald py-3.5 px-5 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wide flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.03] transition-transform"
              >
                <Sparkles className="w-4 h-4" />
                <span>TERUSKAN KE MISI 3</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
