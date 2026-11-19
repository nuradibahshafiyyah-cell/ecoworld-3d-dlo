import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Eye,
  Gauge,
  Music,
  Navigation,
  Pause,
  Play,
  Radar,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { AVATARS, M1_CLUES_3D, M1_SCRIPT } from '../data/gameData';
import {
  AircraftHandle,
  buildCockpitInterior,
  buildEcoAircraft,
  buildFlightWorld,
  buildHangarScene,
  CockpitRigHandle,
  FlightWorldHandle,
  HangarSceneHandle,
} from '../three/flightModels';
import { animateHumanAgent } from '../three/humanAgents';
import { AvatarId, Clue3D, MissionDef, UserAccount } from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from '../utils/malayVoice';

export interface Mission1FlightAdventureProps {
  mission: MissionDef;
  user: UserAccount;
  m1CluesFound: string[];
  musicOn: boolean;
  musicVolume: number;
  onToggleMusic: () => void;
  onChangeMusicVolume: (vol: number) => void;
  onChangeAvatar: (avatarId: AvatarId) => void;
  onCollectClue: (clue: Clue3D) => void;
  onClose: () => void;
  onCompleteMission1: (
    score: number,
    tersuratScore: number,
    tersiratScore: number,
    evidence: string,
    afterAction?: 'map' | 'next_mission' | 'record_only'
  ) => void;
}

type MissionPhase = 'hangar' | 'flight' | 'completed';
type FlightStage =
  | 'fly_to_audio'
  | 'audio_challenge'
  | 'fly_to_q1'
  | 'q1_modal'
  | 'fly_to_q2'
  | 'q2_modal'
  | 'fly_to_q3'
  | 'q3_modal'
  | 'fly_to_runway'
  | 'landing_anim';

const CHECKPOINT_TARGETS: Record<FlightStage, { id: string | null; x: number; y: number; z: number; label: string }> = {
  fly_to_audio: {
    id: 'audio',
    x: 0,
    y: 14,
    z: 34,
    label: 'Terbang ke Kampung Sungai Jernih (Zon Audio)',
  },
  audio_challenge: {
    id: 'audio',
    x: 0,
    y: 14,
    z: 34,
    label: 'Dengar Laporan Audio Puan Aminah',
  },
  fly_to_q1: {
    id: 'q1',
    x: 0,
    y: 14,
    z: -24,
    label: 'Terbang ke Zon Soalan 1 (Pemerhatian Sungai)',
  },
  q1_modal: {
    id: 'q1',
    x: 0,
    y: 14,
    z: -24,
    label: 'Jawab Soalan 1 (Maklumat Tersurat)',
  },
  fly_to_q2: {
    id: 'q2',
    x: 0,
    y: 15,
    z: -82,
    label: 'Terbang ke Zon Sungai Tercemar & Kilang',
  },
  q2_modal: {
    id: 'q2',
    x: 0,
    y: 15,
    z: -82,
    label: 'Jawab Soalan 2 & Kumpul Bukti Sungai',
  },
  fly_to_q3: {
    id: 'q3',
    x: 0,
    y: 16,
    z: -138,
    label: 'Terbang ke Zon Cabaran Inferens (Soalan 3)',
  },
  q3_modal: {
    id: 'q3',
    x: 0,
    y: 16,
    z: -138,
    label: 'Tulis Inferens Anda (Maklumat Tersirat)',
  },
  fly_to_runway: {
    id: 'runway',
    x: 0,
    y: 10,
    z: 62,
    label: 'Kembali & Halakan Pesawat ke Landasan Eco World',
  },
  landing_anim: {
    id: null,
    x: 0,
    y: 1.8,
    z: 118,
    label: 'Mendarat di Pangkalan Eco World...',
  },
};

const Q1_OPTIONS = [
  'Kehitaman dan berbau busuk seperti bahan kimia.',
  'Jernih dan berbau harum.',
  'Kebiruan dan tidak berbau.',
  'Kehijauan dan berbau bunga.',
];

const Q2_OPTIONS = [
  'Pada waktu pagi.',
  'Pada waktu tengah hari.',
  'Pada waktu petang.',
  'Pada waktu tengah malam.',
];

// Strict Malaysian Bahasa Melayu (ms-MY) voice selector via shared malayVoice utility

// Pre-allocated math helpers (zero GC inside animation loop)
const _camTarget = new THREE.Vector3();
const _camPosDesired = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();

export function Mission1FlightAdventure({
  mission,
  user,
  m1CluesFound,
  musicOn,
  musicVolume,
  onToggleMusic,
  onChangeMusicVolume,
  onChangeAvatar,
  onCollectClue,
  onClose,
  onCompleteMission1,
}: Mission1FlightAdventureProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>(user.avatar || 'rimba');
  const [phase, setPhase] = useState<MissionPhase>('hangar');
  const [flightStage, setFlightStage] = useState<FlightStage>('fly_to_audio');
  const [cameraView, setCameraView] = useState<'cockpit' | 'chase'>('cockpit');
  const [manualStabilize, setManualStabilize] = useState(false);
  const [autopilot, setAutopilot] = useState(false);

  // Telemetry state throttled for crisp DOM HUD & Minimap
  const [telemetry, setTelemetry] = useState({
    x: 0,
    y: 14,
    z: 96,
    yaw: 0,
    speed: 36,
    distToTarget: 62,
  });
  const [inspectedClueToast, setInspectedClueToast] = useState<Clue3D | null>(null);

  // Audio playback state (Automatic 2x Play -> Choice: Dengar Sekali Lagi / Teruskan Misi)
  const [audioPlayPass, setAudioPlayPass] = useState<'1' | '2' | 'replay'>('1');
  const [audioStatus, setAudioStatus] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'transition' | 'done'
  >('idle');
  const [audioSourceType, setAudioSourceType] = useState<'ai' | 'browser' | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const cachedTtsUrlRef = useRef<string | null>(null);
  const audioTransitionTimerRef = useRef<number | null>(null);
  const playSessionIdRef = useRef(0);
  const audioStatusRef = useRef(audioStatus);
  audioStatusRef.current = audioStatus;

  // Comprehension Questions State (Exact Question Texts Preserved!)
  const [q1Choice, setQ1Choice] = useState('');
  const [q1Error, setQ1Error] = useState<string | null>(null);
  const [q1Success, setQ1Success] = useState(false);

  const [q2Choice, setQ2Choice] = useState('');
  const [q2Error, setQ2Error] = useState<string | null>(null);
  const [q2Success, setQ2Success] = useState(false);

  const [q3Text, setQ3Text] = useState('');
  const [q3Error, setQ3Error] = useState<string | null>(null);
  const [q3Success, setQ3Success] = useState(false);

  const [correctCount, setCorrectCount] = useState(0);
  const [showVictoryPopup, setShowVictoryPopup] = useState(false);
  const [autoTeleportSeconds, setAutoTeleportSeconds] = useState(5);
  const hasAutoRecordedRef = useRef(false);
  const hasAutoTeleportedRef = useRef(false);
  const q3ReturnTimerRef = useRef<number | null>(null);

  // Flight physics mutable state ref
  const flightPhysRef = useRef({
    x: 0,
    y: 14,
    z: 96,
    yaw: 0, // 0 faces North (-Z)
    speed: 22,
    roll: 0,
    pitch: 0,
    landingT: 0,
    landingStartZ: 62,
    landingStartY: 10,
    propSpeed: 22,
    stopElapsed: 0,
    touchdownTriggered: false,
  });

  // Touch / Mouse control inputs ref
  const touchInputRef = useRef({ forward: false, back: false, left: false, right: false });

  // Live props/state refs for WebGL loop
  const liveRef = useRef({
    phase,
    flightStage,
    cameraView,
    manualStabilize,
    autopilot,
    selectedAvatar,
    m1CluesFound,
    correctCount,
    onCollectClue,
  });
  liveRef.current = {
    phase,
    flightStage,
    cameraView,
    manualStabilize,
    autopilot,
    selectedAvatar,
    m1CluesFound,
    correctCount,
    onCollectClue,
  };

  const hangarRef = useRef<HangarSceneHandle | null>(null);
  const worldRef = useRef<FlightWorldHandle | null>(null);
  const aircraftRef = useRef<AircraftHandle | null>(null);
  const cockpitRef = useRef<CockpitRigHandle | null>(null);

  const isModalActive =
    phase === 'flight' &&
    (flightStage === 'audio_challenge' ||
      flightStage === 'q1_modal' ||
      flightStage === 'q2_modal' ||
      flightStage === 'q3_modal');
  const isStabilized = isModalActive || manualStabilize;

  const stopAllAudio = useCallback(() => {
    playSessionIdRef.current += 1;
    if (audioTransitionTimerRef.current) {
      window.clearTimeout(audioTransitionTimerRef.current);
      audioTransitionTimerRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.onplay = null;
      ttsAudioRef.current.onended = null;
      ttsAudioRef.current.onerror = null;
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setMusicState({ suppressedForAudio: false, ducked: false });
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const syncVoices = () => setVoicesList(window.speechSynthesis.getVoices());
    syncVoices();
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
  }, []);

  useEffect(() => {
    return () => {
      stopAllAudio();
      if (cachedTtsUrlRef.current) {
        URL.revokeObjectURL(cachedTtsUrlRef.current);
        cachedTtsUrlRef.current = null;
      }
    };
  }, [stopAllAudio]);

  useEffect(() => {
    if (!inspectedClueToast) return;
    const t = window.setTimeout(() => setInspectedClueToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [inspectedClueToast]);

  // AI Bahasa Melayu Voice Runner:
  // - Initial automatic run: '1' (Dengaran 1/2) -> brief gap -> '2' (Dengaran 2/2) -> 'done'
  // - Extra listen choice: 'replay' (1 full pass) -> 'done'
  // - Closes background music completely while audio plays & auto-reopens when finished!
  const playReportPass = useCallback(
    async (passMode: '1' | '2' | 'replay') => {
      stopAllAudio();
      const sessionId = playSessionIdRef.current;
      setAudioPlayPass(passMode);
      setAudioStatus('loading');
      setAudioNotice(null);
      setMusicState({ suppressedForAudio: true, ducked: false });

      const handlePassFinished = () => {
        if (sessionId !== playSessionIdRef.current) return;
        if (passMode === '1') {
          setAudioStatus('transition');
          // Keep background music closed smoothly during the 1.8s pause before Dengaran 2/2
          setMusicState({ suppressedForAudio: true, ducked: false });
          audioTransitionTimerRef.current = window.setTimeout(() => {
            if (sessionId !== playSessionIdRef.current) return;
            playReportPass('2');
          }, 1800);
        } else {
          setMusicState({ suppressedForAudio: false, ducked: false });
          setAudioStatus('done');
          playSFX('xp');
        }
      };

      const startSpeechFallback = (reason?: string) => {
        if (sessionId !== playSessionIdRef.current) return;
        setAudioSourceType('browser');
        if ('speechSynthesis' in window) {
          const pool = window.speechSynthesis.getVoices().length
            ? window.speechSynthesis.getVoices()
            : voicesList;
          const { voice, isConfirmedFemale } = pickMalaysianSpeechVoice(pool, { preferFemale: true });
          if (voice) {
            if (reason) setAudioNotice(reason);
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(M1_SCRIPT);
            utter.voice = voice;
            utter.lang = voice.lang || 'ms-MY';
            utter.pitch = isConfirmedFemale ? 1.12 : 1.38;
            utter.rate = 0.94;
            utter.onstart = () => {
              if (sessionId !== playSessionIdRef.current) return;
              setAudioStatus('playing');
              setMusicState({ suppressedForAudio: true, ducked: false });
            };
            utter.onend = () => {
              handlePassFinished();
            };
            utter.onerror = () => {
              handlePassFinished();
            };
            window.speechSynthesis.speak(utter);
            setAudioStatus('playing');
            setMusicState({ suppressedForAudio: true, ducked: false });
            return;
          }
        }

        // Strict ms-MY guard: never play Indonesian (id-ID) or English fallback voice
        setAudioNotice(
          'Pelayar ini tidak mempunyai enjin suara Bahasa Melayu Malaysia (ms-MY) tempatan. Sila baca transkrip laporan di skrin (tiada suara Bahasa Indonesia digunakan).'
        );
        setAudioStatus('playing');
        setMusicState({ suppressedForAudio: false, ducked: false });
        audioTransitionTimerRef.current = window.setTimeout(() => {
          handlePassFinished();
        }, 6500);
      };

      try {
        let url = cachedTtsUrlRef.current;
        if (!url) {
          const resp = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: M1_SCRIPT,
              style: buildMalaysianTtsStyle(
                'Puan Aminah, a warm, gentle, clear adult Malaysian woman reporting river pollution to Year 6 primary school pupils.'
              ),
            }),
          });
          if (sessionId !== playSessionIdRef.current) return;
          if (!resp.ok) {
            let errInfo: { code?: string; error?: string } = {};
            try {
              errInfo = (await resp.json()) as { code?: string; error?: string };
            } catch {
              // ignore
            }
            const msg =
              errInfo.code === 'NO_API_KEY'
                ? 'Suara AI Bahasa Melayu Malaysia memerlukan GEMINI_API_KEY aktif dalam Settings > Secrets. Buat sementara waktu, suara pelayar Bahasa Melayu Malaysia (ms-MY) dimainkan.'
                : 'Suara AI sedang sibuk; suara pelayar Bahasa Melayu Malaysia (ms-MY) dimainkan buat sementara.';
            startSpeechFallback(msg);
            return;
          }
          const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
          if (sessionId !== playSessionIdRef.current) return;
          if (!data.audioBase64) throw new Error('Empty audio');
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
          cachedTtsUrlRef.current = url;
        }

        if (sessionId !== playSessionIdRef.current) return;
        setAudioSourceType('ai');
        const audio = new Audio(url);
        ttsAudioRef.current = audio;
        audio.onplay = () => {
          if (sessionId !== playSessionIdRef.current) return;
          setAudioStatus('playing');
          setMusicState({ suppressedForAudio: true, ducked: false });
        };
        audio.onended = () => {
          handlePassFinished();
        };
        audio.onerror = () => {
          startSpeechFallback();
        };
        await audio.play();
      } catch {
        startSpeechFallback();
      }
    },
    [stopAllAudio, voicesList]
  );

  const handleToggleAudioPause = () => {
    if (audioStatus === 'playing') {
      if (ttsAudioRef.current && !ttsAudioRef.current.paused) {
        ttsAudioRef.current.pause();
      } else if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
      setAudioStatus('paused');
      setMusicState({ suppressedForAudio: false, ducked: false });
    } else if (audioStatus === 'paused') {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.play().catch(() => {});
      }
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      setAudioStatus('playing');
      setMusicState({ suppressedForAudio: true, ducked: false });
    }
  };

  // Trigger AI Bahasa Melayu audio challenge automatically (2x) upon arriving at audio checkpoint
  useEffect(() => {
    if (phase === 'flight' && flightStage === 'audio_challenge' && audioStatusRef.current === 'idle') {
      playReportPass('1');
    }
  }, [phase, flightStage, playReportPass]);

  // Update 3D agent whenever user switches agent in Hangar
  useEffect(() => {
    hangarRef.current?.setAgent(selectedAvatar);
    aircraftRef.current?.setAgent(selectedAvatar);
  }, [selectedAvatar]);

  // ============================================================================
  // THREE.JS WEBGL DEDICATED FLIGHT & HANGAR ENGINE
  // ============================================================================
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
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.25, 420);
    scene.add(camera);

    // Bright Sunlight & Hemisphere Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x22c55e, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.position.set(55, 90, 45);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 260;
    const d = 80;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Build Hangar Scene
    const hangar = buildHangarScene(liveRef.current.selectedAvatar, maxAnisotropy);
    hangarRef.current = hangar;
    scene.add(hangar.group);

    // Build Flight World + Player Aircraft + Cockpit Interior Rig
    const world = buildFlightWorld(maxAnisotropy);
    world.group.visible = false;
    worldRef.current = world;
    scene.add(world.group);

    const aircraft = buildEcoAircraft(liveRef.current.selectedAvatar, maxAnisotropy);
    aircraft.group.visible = false;
    aircraftRef.current = aircraft;
    scene.add(aircraft.group);

    const cockpit = buildCockpitInterior(maxAnisotropy);
    cockpit.group.visible = false;
    cockpitRef.current = cockpit;
    camera.add(cockpit.group);

    // Keyboard input tracking
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.code === 'Space' && liveRef.current.phase === 'flight') {
        e.preventDefault();
        setManualStabilize((prev) => {
          playSFX('click');
          return !prev;
        });
        return;
      }
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Raycasting for clickable 3D Evidence Objects during flight
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const onPointerUp = (e: PointerEvent) => {
      if (liveRef.current.phase !== 'flight') return;
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayMouse, camera);
      const targets = world.evidenceMarkers.map((em) => em.hitProxy);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const clueId = hits[0].object.userData.clueId as string;
        const clue = M1_CLUES_3D.find((c) => c.id === clueId);
        if (clue) {
          liveRef.current.onCollectClue(clue);
          setInspectedClueToast(clue);
        }
      }
    };
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let hudTick = 0;

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
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      const st = liveRef.current;

      if (st.phase === 'hangar') {
        hangar.group.visible = true;
        world.group.visible = false;
        aircraft.group.visible = false;
        cockpit.group.visible = false;
        (scene.fog as THREE.FogExp2).density = 0.004;

        hangar.animate(elapsed, dt);
        animateHumanAgent(hangar.guideAgentRig, elapsed, dt, {
          isMoving: false,
          hovered: false,
          selected: true,
        });
        animateHumanAgent(hangar.aircraft.companionRig, elapsed, dt, {
          isMoving: false,
          hovered: false,
          selected: true,
        });

        // Cinematic gentle orbit inside bright hangar
        const camSwirl = Math.sin(elapsed * 0.35) * 1.4;
        _camPosDesired.set(3.2 + camSwirl, 3.6, 11.2);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPosDesired.x, 4, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPosDesired.y, 4, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPosDesired.z, 4, dt);
        _camTarget.set(0.6, 1.85, -0.8);
        camera.lookAt(_camTarget);
      } else {
        // FLIGHT OR COMPLETED LANDING VIEW
        hangar.group.visible = false;
        world.group.visible = true;
        (scene.fog as THREE.FogExp2).density = 0.0018;

        const targetInfo = CHECKPOINT_TARGETS[st.flightStage];
        world.animate(elapsed, dt, st.m1CluesFound, targetInfo.id);

        const phys = flightPhysRef.current;
        const modalLocked =
          st.phase === 'completed' ||
          st.flightStage === 'audio_challenge' ||
          st.flightStage === 'q1_modal' ||
          st.flightStage === 'q2_modal' ||
          st.flightStage === 'q3_modal';

        if (st.flightStage === 'landing_anim') {
          // Automated smooth 3D touchdown and complete full stop on Eco World runway!
          cockpit.group.visible = false;
          aircraft.group.visible = true;
          phys.landingT = Math.min(1, phys.landingT + dt * 0.28);
          phys.x = THREE.MathUtils.damp(phys.x, 0, 3.5, dt);
          phys.z = THREE.MathUtils.lerp(phys.landingStartZ, 120, phys.landingT);
          phys.y = THREE.MathUtils.lerp(
            phys.landingStartY,
            1.05,
            Math.min(1, phys.landingT * 1.12)
          );
          phys.yaw = THREE.MathUtils.damp(phys.yaw, Math.PI, 4, dt); // facing +Z runway

          if (phys.landingT >= 0.99) {
            phys.speed = THREE.MathUtils.damp(phys.speed, 0, 6, dt);
            phys.propSpeed = THREE.MathUtils.damp(phys.propSpeed, 0, 4.5, dt);
            phys.roll = THREE.MathUtils.damp(phys.roll, 0, 8, dt);
            phys.pitch = THREE.MathUtils.damp(phys.pitch, 0, 6, dt);

            if (!phys.touchdownTriggered) {
              phys.touchdownTriggered = true;
              world.triggerCelebration();
              playSFX('win');
            }

            phys.stopElapsed += dt;
            if (phys.stopElapsed >= 0.85 && st.phase === 'flight' && st.correctCount >= 3) {
              phys.speed = 0;
              phys.propSpeed = 0;
              playSFX('achievement');
              setAutoTeleportSeconds(5);
              setPhase('completed');
              setShowVictoryPopup(true);
            }
          } else {
            phys.propSpeed = THREE.MathUtils.damp(phys.propSpeed, 14, 3, dt);
            phys.roll = THREE.MathUtils.damp(phys.roll, 0, 5, dt);
            phys.pitch = THREE.MathUtils.damp(phys.pitch, phys.landingT < 0.7 ? -0.08 : 0.04, 4, dt);
          }
        } else if (st.phase === 'completed') {
          cockpit.group.visible = false;
          aircraft.group.visible = true;
          phys.speed = 0;
          phys.propSpeed = 0;
          phys.roll = 0;
          phys.pitch = 0;
        } else {
          // Active Flight Mode (Player WASD / Touch / Autopilot + Stabilize)
          const isAutoReturning = st.flightStage === 'fly_to_runway';
          const stabilizedNow = isAutoReturning ? false : modalLocked || st.manualStabilize;
          let turnInput = 0;
          let thrustInput = 0;

          if (!stabilizedNow) {
            if (!isAutoReturning) {
              if (keys['KeyA'] || keys['ArrowLeft'] || touchInputRef.current.left) turnInput += 1;
              if (keys['KeyD'] || keys['ArrowRight'] || touchInputRef.current.right) turnInput -= 1;
              if (keys['KeyW'] || keys['ArrowUp'] || touchInputRef.current.forward) thrustInput += 1;
              if (keys['KeyS'] || keys['ArrowDown'] || touchInputRef.current.back) thrustInput -= 1;
            }

            if ((isAutoReturning || st.autopilot) && targetInfo) {
              // Steer smoothly toward active checkpoint / Main Zone Runway
              const dx = targetInfo.x - phys.x;
              const dz = targetInfo.z - phys.z;
              const desiredYaw = Math.atan2(-dx, -dz);
              let diff = desiredYaw - phys.yaw;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (isAutoReturning && Math.abs(Math.abs(diff) - Math.PI) < 0.08) {
                diff = Math.PI - 0.08;
              }
              turnInput = THREE.MathUtils.clamp(diff * (isAutoReturning ? 2.0 : 2.2), -1, 1);
              thrustInput = 1;
            }

            phys.yaw += turnInput * (isAutoReturning ? 1.75 : 1.45) * dt;
            const targetSpeed = isAutoReturning
              ? 48
              : thrustInput > 0
              ? 44
              : thrustInput < 0
              ? 12
              : 24;
            phys.speed = THREE.MathUtils.damp(phys.speed, targetSpeed, 3.2, dt);

            const fwdX = -Math.sin(phys.yaw);
            const fwdZ = -Math.cos(phys.yaw);
            phys.x += fwdX * phys.speed * dt;
            phys.z += fwdZ * phys.speed * dt;

            // Keep comfortably inside scenic valley bounds
            phys.x = THREE.MathUtils.clamp(phys.x, -165, 165);
            phys.z = THREE.MathUtils.clamp(phys.z, -175, 155);

            // Gentle altitude glide matching current checkpoint altitude (scenic cruise on auto-return)
            const targetAlt = isAutoReturning
              ? phys.z < -20
                ? 21
                : THREE.MathUtils.lerp(21, 10, THREE.MathUtils.clamp((phys.z + 20) / 82, 0, 1))
              : targetInfo
              ? targetInfo.y
              : 14;
            phys.y = THREE.MathUtils.damp(phys.y, targetAlt, 1.8, dt);
            phys.roll = THREE.MathUtils.damp(phys.roll, turnInput * 0.45, 6, dt);
            phys.pitch = THREE.MathUtils.damp(phys.pitch, thrustInput * 0.07, 5, dt);

            // Check arrival at active flight checkpoint!
            if (targetInfo && targetInfo.id) {
              const dist = Math.hypot(targetInfo.x - phys.x, targetInfo.z - phys.z);
              if (dist < 14) {
                setAutopilot(false);
                playSFX('portal');
                if (st.flightStage === 'fly_to_audio') {
                  setFlightStage('audio_challenge');
                } else if (st.flightStage === 'fly_to_q1') {
                  setFlightStage('q1_modal');
                } else if (st.flightStage === 'fly_to_q2') {
                  setFlightStage('q2_modal');
                } else if (st.flightStage === 'fly_to_q3') {
                  setFlightStage('q3_modal');
                } else if (st.flightStage === 'fly_to_runway') {
                  phys.landingT = 0;
                  phys.landingStartZ = phys.z;
                  phys.landingStartY = phys.y;
                  setFlightStage('landing_anim');
                }
              }
            }
          } else {
            // Stabilized hover mode (gentle float)
            phys.speed = THREE.MathUtils.damp(phys.speed, 0, 5, dt);
            phys.roll = THREE.MathUtils.damp(phys.roll, 0, 5, dt);
            phys.pitch = THREE.MathUtils.damp(phys.pitch, Math.sin(elapsed * 2) * 0.02, 4, dt);
          }

          const showCockpit = st.cameraView === 'cockpit' && !isAutoReturning;
          cockpit.group.visible = showCockpit;
          aircraft.group.visible = !showCockpit;

          if (showCockpit) {
            // Cockpit yoke & throttle animation
            cockpit.yoke.rotation.z = THREE.MathUtils.damp(cockpit.yoke.rotation.z, phys.roll * 1.15, 8, dt);
            cockpit.throttle.position.z = THREE.MathUtils.damp(
              cockpit.throttle.position.z,
              -0.82 - (phys.speed / 45) * 0.09,
              6,
              dt
            );
          }
        }

        // Update 3D aircraft transform & spinning propeller
        aircraft.group.position.set(
          phys.x,
          phys.y + (st.flightStage === 'landing_anim' || st.phase === 'completed' ? 0 : Math.sin(elapsed * 2.6) * 0.18),
          phys.z
        );
        aircraft.group.rotation.set(phys.pitch, phys.yaw, phys.roll, 'YXZ');
        aircraft.propeller.rotation.z += dt * phys.propSpeed;
        aircraft.leftFlap.rotation.x = phys.roll * 0.6;
        aircraft.rightFlap.rotation.x = -phys.roll * 0.6;
        animateHumanAgent(aircraft.companionRig, elapsed, dt, {
          isMoving: false,
          hovered: false,
          selected: true,
        });

        // Camera placement: Cockpit 1st-person OR Chase 3rd-person OR Cinematic Return OR Landing
        const fwdX = -Math.sin(phys.yaw);
        const fwdZ = -Math.cos(phys.yaw);
        if (st.phase === 'completed' || st.flightStage === 'landing_anim') {
          _camPosDesired.set(
            phys.x + 11 * Math.cos(elapsed * 0.35),
            phys.y + 6.2,
            phys.z + 15 * Math.sin(elapsed * 0.35)
          );
          camera.position.lerp(_camPosDesired, Math.min(1, dt * 4));
          _camTarget.set(phys.x, phys.y + 1.2, phys.z);
          camera.lookAt(_camTarget);
        } else if (st.flightStage === 'fly_to_runway') {
          const rightX = Math.cos(phys.yaw);
          const rightZ = -Math.sin(phys.yaw);
          const sweepOffset = Math.sin(elapsed * 0.85) * 3.4 - phys.roll * 6.5;
          _camPosDesired.set(
            phys.x - fwdX * 15.8 + rightX * sweepOffset,
            phys.y + 5.5,
            phys.z - fwdZ * 15.8 + rightZ * sweepOffset
          );
          camera.position.lerp(_camPosDesired, Math.min(1, dt * 4.5));
          _camTarget.set(phys.x + fwdX * 11, phys.y + 0.9, phys.z + fwdZ * 11);
          camera.lookAt(_camTarget);
        } else if (st.cameraView === 'cockpit') {
          camera.position.set(phys.x, phys.y + 0.9, phys.z);
          _camTarget.set(phys.x + fwdX * 30, phys.y + 0.15 + phys.pitch * 8, phys.z + fwdZ * 30);
          camera.lookAt(_camTarget);
          camera.rotation.z += phys.roll * 0.32;
        } else {
          _camPosDesired.set(phys.x - fwdX * 14.5, phys.y + 4.8, phys.z - fwdZ * 14.5);
          camera.position.lerp(_camPosDesired, Math.min(1, dt * 6));
          _camTarget.set(phys.x + fwdX * 12, phys.y + 0.8, phys.z + fwdZ * 12);
          camera.lookAt(_camTarget);
        }

        // Update cockpit holographic displays & throttled React minimap telemetry (~10 Hz)
        hudTick += dt;
        if (hudTick >= 0.1) {
          hudTick = 0;
          const distNow = targetInfo ? Math.hypot(targetInfo.x - phys.x, targetInfo.z - phys.z) : 0;
          const deg = ((Math.round((-phys.yaw * 180) / Math.PI) % 360) + 360) % 360;
          if (cockpit.group.visible) {
            cockpit.updateHudCanvas({
              speed: phys.speed * 4.5,
              altitude: phys.y * 12,
              headingDeg: deg,
              distToTarget: distNow * 10,
              stabilized: modalLocked || st.manualStabilize,
              stageLabel: targetInfo?.label || 'Misi Selesai',
              evidenceCount: st.m1CluesFound.length,
            });
          }
          setTelemetry({
            x: phys.x,
            y: phys.y,
            z: phys.z,
            yaw: phys.yaw,
            speed: Math.round(phys.speed * 4.5),
            distToTarget: Math.round(distNow * 10),
          });
        }
      }

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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      hangar.dispose();
      world.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Handlers for Starting Flight & Answering Questions
  const handleStartFlight = () => {
    playSFX('portal');
    if (q3ReturnTimerRef.current) {
      window.clearTimeout(q3ReturnTimerRef.current);
      q3ReturnTimerRef.current = null;
    }
    hasAutoRecordedRef.current = false;
    hasAutoTeleportedRef.current = false;
    setAutoTeleportSeconds(5);
    setShowVictoryPopup(false);
    flightPhysRef.current = {
      x: 0,
      y: 14,
      z: 96,
      yaw: 0,
      speed: 24,
      roll: 0,
      pitch: 0,
      landingT: 0,
      landingStartZ: 62,
      landingStartY: 10,
      propSpeed: 22,
      stopElapsed: 0,
      touchdownTriggered: false,
    };
    setFlightStage('fly_to_audio');
    setPhase('flight');
  };

  const handleSubmitQ1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q1Choice) {
      playSFX('error');
      setQ1Error('Sila pilih satu jawapan terlebih dahulu.');
      return;
    }
    if (q1Choice !== Q1_OPTIONS[0]) {
      playSFX('error');
      setQ1Error(
        'Jawapan kurang tepat! Dengar semula laporan Puan Aminah: air sungai kelihatan kehitaman dan mengeluarkan bau yang sangat busuk seperti bahan kimia.'
      );
      return;
    }
    setQ1Error(null);
    setQ1Success(true);
    setCorrectCount((c) => Math.max(c, 1));
    playSFX('win');
    window.setTimeout(() => {
      setQ1Success(false);
      setFlightStage('fly_to_q2');
    }, 1150);
  };

  const handleSubmitQ2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q2Choice) {
      playSFX('error');
      setQ2Error('Sila pilih satu jawapan terlebih dahulu.');
      return;
    }
    if (q2Choice !== Q2_OPTIONS[3]) {
      playSFX('error');
      setQ2Error(
        'Jawapan kurang tepat! Penduduk ternampak lori kilang membuang sisa buangan ke dalam sungai pada waktu tengah malam.'
      );
      return;
    }
    setQ2Error(null);
    setQ2Success(true);
    setCorrectCount((c) => Math.max(c, 2));
    playSFX('win');
    window.setTimeout(() => {
      setQ2Success(false);
      setFlightStage('fly_to_q3');
    }, 1150);
  };

  const handleSubmitQ3 = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = q3Text.trim();
    const low = cleaned.toLowerCase();
    const kw = [
      'elak',
      'kesan',
      'sedar',
      'disedari',
      'penduduk',
      'tidur',
      'rahsia',
      'sembunyi',
      'tangkap',
      'nampak',
      'gelap',
      'senyap',
      'tahu',
      'malam',
    ];
    if (cleaned.length < 12 || !kw.some((k) => low.includes(k))) {
      playSFX('error');
      setQ3Error(
        'Inferens anda masih terlalu ringkas atau kurang tepat. Fikirkan mengapa kilang memilih waktu kebanyakan penduduk sedang tidur.'
      );
      return;
    }
    setQ3Error(null);
    setQ3Success(true);
    setCorrectCount(3);
    playSFX('win');
    if (q3ReturnTimerRef.current) {
      window.clearTimeout(q3ReturnTimerRef.current);
    }
    q3ReturnTimerRef.current = window.setTimeout(() => {
      q3ReturnTimerRef.current = null;
      setQ3Success(false);
      setManualStabilize(false);
      setAutopilot(true);
      setCameraView('chase');
      setFlightStage('fly_to_runway');
      playSFX('portal');
    }, 2400);
  };

  useEffect(() => {
    return () => {
      if (q3ReturnTimerRef.current) {
        window.clearTimeout(q3ReturnTimerRef.current);
      }
    };
  }, []);

  const finishAndSaveMission = useCallback(
    (afterAction: 'map' | 'next_mission' | 'record_only') => {
      if (afterAction !== 'record_only') {
        stopAllAudio();
      }
      const evidenceSummary =
        m1CluesFound.length > 0
          ? `Bukti Udara 3D (${m1CluesFound.length}/3): ${m1CluesFound
              .map((id) => M1_CLUES_3D.find((c) => c.id === id)?.title)
              .filter(Boolean)
              .join(', ')} | Inferens: ${q3Text.trim()}`
          : `Siasatan Udara Selesai | Inferens: ${q3Text.trim()}`;
      const bonus = m1CluesFound.length >= 3 ? 10 : m1CluesFound.length * 3;
      const totalScore = Math.min(100, 90 + bonus);
      onCompleteMission1(totalScore, 100, 90, evidenceSummary, afterAction);
    },
    [m1CluesFound, onCompleteMission1, q3Text, stopAllAudio]
  );

  const finishAndSaveRef = useRef(finishAndSaveMission);
  finishAndSaveRef.current = finishAndSaveMission;

  // Automatically mark Misi 1 COMPLETED & UNLOCK Misi 2, display congratulatory popup for 5s, then auto-teleport
  useEffect(() => {
    if (phase !== 'completed' || !showVictoryPopup) return;

    if (!hasAutoRecordedRef.current) {
      hasAutoRecordedRef.current = true;
      finishAndSaveRef.current('record_only');
    }

    setAutoTeleportSeconds(5);
    const countdownId = window.setInterval(() => {
      setAutoTeleportSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    const teleportTimerId = window.setTimeout(() => {
      if (!hasAutoTeleportedRef.current) {
        hasAutoTeleportedRef.current = true;
        playSFX('portal');
        finishAndSaveRef.current('next_mission');
      }
    }, 5000);

    return () => {
      window.clearInterval(countdownId);
      window.clearTimeout(teleportTimerId);
    };
  }, [phase, showVictoryPopup]);

  // Compute progress percentage across the 5 mission milestones
  const progressMap: Record<FlightStage, number> = {
    fly_to_audio: 15,
    audio_challenge: 30,
    fly_to_q1: 42,
    q1_modal: 52,
    fly_to_q2: 64,
    q2_modal: 74,
    fly_to_q3: 84,
    q3_modal: 90,
    fly_to_runway: 96,
    landing_anim: 100,
  };
  const progressPct = phase === 'completed' ? 100 : progressMap[flightStage];
  const currentAv = AVATARS.find((a) => a.id === selectedAvatar) || AVATARS[1];
  const activeTarget = CHECKPOINT_TARGETS[flightStage];

  // Minimap coordinate converter (-175..175 -> 0..108px)
  const toMini = (wx: number, wz: number) => ({
    mx: ((wx + 175) / 350) * 108,
    mz: ((wz + 175) / 350) * 108,
  });
  const planeMini = toMini(telemetry.x, telemetry.z);
  const targetMini = toMini(activeTarget.x, activeTarget.z);

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none bg-sky-500">
      {/* Dedicated Isolated 3D WebGL Flight & Hangar Canvas */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Dunia Penerbangan 3D Misi 01"
      />

      {/* =====================================================================
          TOP HEADER BAR (Clean Sky-Turquoise-Emerald Game HUD)
         ===================================================================== */}
      <div className="relative z-20 px-3 sm:px-5 pt-3 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border-2 border-cyan-300/75 shadow-xl"
          style={{ background: 'linear-gradient(135deg, rgba(6,78,59,0.92), rgba(12,74,110,0.92))' }}
        >
          <span className="btn-icon-3d w-9 h-9 text-xl shrink-0">✈️</span>
          <div className="min-w-0">
            <div className="font-game text-[10px] sm:text-xs font-bold text-amber-300 tracking-wider uppercase truncate">
              MISI 01 · {currentAv.name}
            </div>
            <h1 className="font-game text-xs sm:text-base font-black text-white truncate">
              OPERASI UDARA: RAHSIA SUNGAI TERCEMAR
            </h1>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Quick Music Toggle (mirrors global music controls) */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-2xl border border-teal-300/50 px-2.5 py-1.5"
            style={{ background: 'rgba(8, 47, 73, 0.9)' }}
          >
            <button
              type="button"
              onClick={onToggleMusic}
              className="text-xs font-bold text-teal-200 hover:text-white flex items-center gap-1 cursor-pointer"
              title="Muzik Latar Buka/Tutup"
            >
              {musicOn ? <Music className="w-3.5 h-3.5 text-emerald-300" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span>{musicOn ? 'Muzik' : 'Senyap'}</span>
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={musicOn ? Math.round(musicVolume * 100) : 0}
              onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
              aria-label="Kelantangan muzik"
              className="w-14 accent-teal-400 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              playSFX('click');
              onClose();
            }}
            className="btn-game-gold btn-game-sm px-3.5 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> PETA MISI
          </button>
        </div>
      </div>

      {/* =====================================================================
          PHASE 1: BRIGHT 3D AIRCRAFT HANGAR & MISSION BRIEFING HOLOGRAM
         ===================================================================== */}
      {phase === 'hangar' && (
        <div className="relative z-20 h-[calc(100vh-70px)] flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
          {/* Top-right floating 4-Agent Companion Selector */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-3 mt-1">
            {/* Holographic Mission Briefing Panel (Left) */}
            <div
              className="pointer-events-auto max-w-lg rounded-3xl border-2 border-cyan-300/80 p-4 sm:p-5 text-slate-100 shadow-2xl space-y-3"
              style={{
                background: 'linear-gradient(150deg, rgba(8,51,68,0.92), rgba(6,78,59,0.92))',
              }}
            >
              <div className="flex items-center gap-2 text-amber-300 font-game text-xs sm:text-sm font-black">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>SELAMAT DATANG, JURUTERBANG ECO WORLD!</span>
              </div>
              <p className="text-xs text-cyan-100 font-medium">
                Arahan misi penerbangan anda di Hangar Eco World:
              </p>
              <ol className="space-y-1.5 text-xs sm:text-sm font-medium text-white">
                <li>1. Terbang ke kawasan sungai tercemar.</li>
                <li>2. Dengar laporan daripada penduduk kampung.</li>
                <li>3. Jawab tiga soalan berdasarkan maklumat yang didengar.</li>
                <li>4. Kenal pasti bukti pencemaran.</li>
                <li>5. Kembali dan mendarat di pangkalan Eco World.</li>
              </ol>
            </div>

            {/* 4 Selectable Agent Companions (Right) */}
            <div
              className="pointer-events-auto w-full lg:w-[360px] rounded-3xl border-2 border-teal-300/75 p-4 text-slate-100 shadow-2xl space-y-2.5"
              style={{ background: 'rgba(8, 47, 73, 0.92)' }}
            >
              <div className="font-game text-xs font-black text-teal-200 uppercase tracking-wide">
                Pilih Ejen Rakan Penerbangan Anda:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVATARS.map((av) => {
                  const active = selectedAvatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setSelectedAvatar(av.id);
                        onChangeAvatar(av.id);
                      }}
                      className={`btn-game-sm p-2.5 text-left cursor-pointer flex items-center gap-2 ${
                        active
                          ? 'btn-game-emerald text-slate-950'
                          : 'btn-game-slate text-slate-100'
                      }`}
                    >
                      <span className="btn-icon-3d w-8 h-8 text-lg shrink-0">{av.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-game text-[11px] font-black truncate">{av.name}</div>
                        <div className="text-[10px] opacity-85 truncate">{av.roleTitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-cyan-200 font-medium pt-0.5">
                Ejen dipilih akan menemani anda di dalam kokpit pesawat 3D!
              </div>
            </div>
          </div>

          {/* Bottom-center Large 3D START MISSION Button */}
          <div className="pointer-events-auto flex flex-col items-center gap-2 pb-24 sm:pb-6">
            <button
              type="button"
              onClick={handleStartFlight}
              className="btn-game-emerald px-10 py-4 rounded-2xl text-slate-950 font-game text-base sm:text-xl font-black tracking-wider uppercase flex items-center gap-3 cursor-pointer shadow-2xl"
            >
              <span className="btn-icon-3d w-9 h-9">
                <Rocket className="w-5 h-5" />
              </span>
              <span>MULA MISI</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          PHASE 2: ACTIVE 3D FLIGHT HUD (Objective Tracker, Minimap, Gauges,
          Evidence Scanner, Flight Controls & Floating Holographic Challenges)
         ===================================================================== */}
      {phase === 'flight' && (
        <>
          {/* Top-left & Top-right Flight HUD Row */}
          <div className="relative z-20 px-3 sm:px-5 pt-2 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
            {/* Objective Tracker + Flight Progress + Evidence Counter */}
            <div
              className="pointer-events-auto max-w-md w-full sm:w-auto rounded-2xl border-2 border-teal-300/70 px-3.5 py-2.5 text-white shadow-xl space-y-2"
              style={{ background: 'rgba(8, 47, 73, 0.88)' }}
            >
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="font-game font-black text-amber-300 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-300" />
                  <span>OBJEKTIF SEMASA</span>
                </span>
                <span className="font-mono-num font-bold text-emerald-300">
                  {progressPct}% Selesai
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-cyan-50">{activeTarget.label}</div>
              <div className="w-full h-2 rounded-full bg-slate-900/90 overflow-hidden border border-cyan-400/40">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-semibold text-cyan-100">
                <span className="font-mono-num">
                  Altitud: <strong className="text-emerald-300">{Math.round(telemetry.y * 12)} m</strong>
                </span>
                <span>·</span>
                <span className="font-mono-num">
                  Kelajuan: <strong className="text-amber-300">{telemetry.speed} km/j</strong>
                </span>
                <span>·</span>
                <span className="font-mono-num">
                  Bukti: <strong className="text-lime-300">{m1CluesFound.length}/3</strong>
                </span>
              </div>
            </div>

            {/* Right: Minimap Radar + Camera Switch + Auto-Steer Helper */}
            <div className="pointer-events-auto flex items-start gap-2.5">
              <div className="flex flex-col gap-1.5">
                {flightStage !== 'landing_anim' && flightStage !== 'fly_to_runway' && (
                  <button
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      setCameraView((v) => (v === 'cockpit' ? 'chase' : 'cockpit'));
                    }}
                    className="btn-game-cyan btn-game-sm px-3 py-1.5 text-slate-950 font-game text-[11px] font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{cameraView === 'cockpit' ? 'Lihat Pesawat' : 'Kamera Kokpit'}</span>
                  </button>
                )}

                {!isModalActive &&
                  flightStage !== 'landing_anim' &&
                  flightStage !== 'fly_to_runway' && (
                  <button
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      setManualStabilize(false);
                      setAutopilot((a) => !a);
                    }}
                    className={`btn-game-sm px-3 py-1.5 font-game text-[11px] font-black flex items-center gap-1.5 cursor-pointer ${
                      autopilot ? 'btn-game-gold text-slate-950' : 'btn-game-teal text-slate-950'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{autopilot ? 'Auto-Pandu: ON' : 'Auto-Pandu ke Zon'}</span>
                  </button>
                )}
              </div>

              {/* Live SVG Minimap */}
              <div
                className="rounded-2xl border-2 border-cyan-300/75 p-1.5 shadow-xl"
                style={{ background: 'rgba(4, 31, 58, 0.9)' }}
              >
                <svg width="108" height="108" viewBox="0 0 108 108" className="rounded-xl bg-emerald-950/90">
                  {/* River ribbon on minimap */}
                  <path
                    d="M 48 105 Q 52 60 54 15"
                    stroke="#0ea5e9"
                    strokeWidth="6"
                    fill="none"
                    opacity="0.7"
                  />
                  {/* Polluted Factory Zone */}
                  <rect x="64" y="18" width="12" height="10" rx="2" fill="#f97316" />
                  {/* Runway Base */}
                  <rect x="50" y="84" width="8" height="16" rx="1" fill="#facc15" />
                  {/* 3 Evidence dots */}
                  {M1_CLUES_3D.map((c, idx) => {
                    const found = m1CluesFound.includes(c.id);
                    return (
                      <circle
                        key={c.id}
                        cx={52 + (idx - 1) * 7}
                        cy={26 + idx * 4}
                        r="3"
                        fill={found ? '#4ade80' : '#f97316'}
                      />
                    );
                  })}
                  {/* Target Checkpoint */}
                  <circle
                    cx={targetMini.mx}
                    cy={targetMini.mz}
                    r="6"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    fill="rgba(34,211,238,0.22)"
                  />
                  {/* Aircraft Blip */}
                  <g
                    transform={`translate(${planeMini.mx}, ${planeMini.mz}) rotate(${
                      (-telemetry.yaw * 180) / Math.PI
                    })`}
                  >
                    <polygon points="0,-6 4.5,5 -4.5,5" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
                  </g>
                </svg>
                <div className="text-[9px] font-game font-bold text-center text-cyan-200 mt-0.5 flex items-center justify-center gap-1">
                  <Radar className="w-2.5 h-2.5" /> PETA RADAR
                </div>
              </div>
            </div>
          </div>

          {/* Evidence Scanner Strip (Quick 3D Evidence Inspection Bar in Polluted Zone or Anytime in Flight) */}
          {(flightStage === 'fly_to_q2' ||
            flightStage === 'q2_modal' ||
            flightStage === 'fly_to_q3' ||
            flightStage === 'q3_modal' ||
            flightStage === 'fly_to_runway') && (
            <div className="relative z-20 px-3 sm:px-5 mt-2 flex justify-start pointer-events-none">
              <div
                className="pointer-events-auto rounded-2xl border-2 border-amber-300/75 px-3 py-2 shadow-xl space-y-1.5 max-w-xl"
                style={{ background: 'rgba(8, 47, 73, 0.9)' }}
              >
                <div className="text-[11px] font-game font-black text-amber-300 flex items-center gap-1.5">
                  <span>🔍 PENGIMBAS BUKTI PENCEMARAN ({m1CluesFound.length}/3):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {M1_CLUES_3D.map((clue) => {
                    const found = m1CluesFound.includes(clue.id);
                    return (
                      <button
                        key={clue.id}
                        type="button"
                        onClick={() => {
                          onCollectClue(clue);
                          setInspectedClueToast(clue);
                        }}
                        className={`btn-game-sm px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          found
                            ? 'btn-game-emerald text-slate-950'
                            : 'btn-game-slate text-cyan-100'
                        }`}
                      >
                        <span>{found ? '✅' : '🧪'}</span>
                        <span>{clue.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Inspected Evidence Callout Banner */}
          {inspectedClueToast && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div
                className="px-4 py-2.5 rounded-2xl border-2 border-emerald-300 text-white shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2"
                style={{ background: 'rgba(6, 78, 59, 0.95)' }}
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  Bukti Dikesan: <strong>{inspectedClueToast.title}</strong> — {inspectedClueToast.description}
                </span>
              </div>
            </div>
          )}

          {/* =================================================================
              FLOATING HOLOGRAPHIC CHALLENGE PANELS (AUTO-STABILIZED AIRCRAFT)
             ================================================================= */}

          {/* 1. AUDIO LISTENING CHALLENGE MODAL */}
          {flightStage === 'audio_challenge' && (
            <div className="fixed inset-0 top-16 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-xl max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-3xl border-2 border-cyan-300 p-5 sm:p-6 text-white shadow-2xl space-y-4"
                style={{
                  background: 'linear-gradient(155deg, rgba(8,51,68,0.95), rgba(6,78,59,0.94))',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-game text-[11px] font-bold text-amber-300 uppercase">
                      ✈️ PESAWAT STABIL (MOD APUNG) · KOMUNIKASI RADIO
                    </div>
                    <h2 className="font-game text-lg sm:text-xl font-black text-cyan-200 mt-0.5">
                      LAPORAN AUDIO PUAN AMINAH
                    </h2>
                    <p className="text-xs text-teal-200 font-semibold">
                      Wakil Penduduk Kampung Sungai Jernih
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-950/75 border border-cyan-400/60 font-game text-xs font-black text-amber-300">
                      {audioStatus === 'done'
                        ? 'SELESAI (2/2)'
                        : audioPlayPass === 'replay'
                        ? 'DENGARAN TAMBAHAN'
                        : `DENGARAN ${audioPlayPass}/2`}
                    </div>
                    {audioSourceType === 'ai' && (
                      <span className="text-[10px] font-bold text-emerald-300">
                        🤖 Suara AI Bahasa Melayu
                      </span>
                    )}
                  </div>
                </div>

                {/* Animated Sound Waves & Voice Indicator */}
                <div
                  className="p-4 rounded-2xl border border-cyan-400/45 flex flex-col sm:flex-row items-center justify-between gap-4"
                  style={{ background: 'rgba(4, 31, 58, 0.85)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-2xl shadow-lg shrink-0">
                      👩🏽
                    </div>
                    <div>
                      <div className="text-xs font-bold text-cyan-200">
                        {audioStatus === 'loading' && 'Menyediakan suara AI Bahasa Melayu Puan Aminah...'}
                        {audioStatus === 'playing' &&
                          (audioPlayPass === 'replay'
                            ? 'Sedang dimainkan (Dengaran Tambahan) · Muzik latar ditutup'
                            : `Sedang dimainkan (Dengaran ${audioPlayPass}/2) · Muzik latar ditutup`)}
                        {audioStatus === 'paused' &&
                          (audioPlayPass === 'replay'
                            ? 'Dijeda (Dengaran Tambahan)'
                            : `Dijeda (Dengaran ${audioPlayPass}/2)`)}
                        {audioStatus === 'transition' &&
                          'Dengaran 1/2 selesai! Memainkan Dengaran 2/2 secara automatik...'}
                        {audioStatus === 'done' &&
                          'Audio selesai! Muzik latar telah dibuka semula.'}
                        {audioStatus === 'idle' && 'Memulakan laporan audio...'}
                      </div>
                      <div className="text-[11px] text-teal-200 mt-0.5">
                        Dengar laporan dengan teliti sebanyak 2 kali sebelum menjawab soalan.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-1.5 h-9 shrink-0">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        style={{ animationDelay: `${i * 0.11}s` }}
                        className={`w-2 rounded-full transition-all ${
                          audioStatus === 'playing'
                            ? 'h-9 wave-bar-active bg-gradient-to-t from-emerald-400 to-cyan-300'
                            : 'h-3 bg-cyan-600/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {audioNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-950/75 border border-amber-400/50 text-[11px] text-amber-100">
                    {audioNotice}
                  </div>
                )}

                {/* Post-Playback Choice vs Active Playback Controls */}
                {audioStatus === 'done' ? (
                  <div
                    className="p-4 rounded-2xl border-2 border-emerald-400/75 space-y-3"
                    style={{ background: 'rgba(6, 78, 59, 0.65)' }}
                  >
                    <div className="text-xs sm:text-sm font-bold text-emerald-100 text-center">
                      {audioPlayPass === 'replay'
                        ? 'Dengaran tambahan selesai! Adakah anda mahu dengar sekali lagi atau teruskan misi?'
                        : 'Kedua-dua dengaran automatik (2/2) telah selesai! Pilih tindakan anda:'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          playSFX('click');
                          playReportPass('replay');
                        }}
                        className="btn-game-cyan py-3 px-4 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Dengar Sekali Lagi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          stopAllAudio();
                          playSFX('portal');
                          setFlightStage('fly_to_q1');
                        }}
                        className="btn-game-emerald py-3 px-4 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Rocket className="w-4 h-4" />
                        <span>Teruskan Misi →</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      {(audioStatus === 'playing' || audioStatus === 'paused') && (
                        <button
                          type="button"
                          onClick={handleToggleAudioPause}
                          className="btn-game-cyan btn-game-sm px-3.5 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          {audioStatus === 'playing' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" /> Jeda
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" /> Sambung
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="px-4 py-2 rounded-xl bg-slate-950/70 border border-cyan-400/40 text-xs font-bold text-cyan-200 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-amber-300" />
                      <span>
                        {audioPlayPass === 'replay'
                          ? 'Mendengar ulangan laporan...'
                          : 'Sedang memainkan 2x secara automatik...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. QUESTION 1 FLOATING HOLOGRAPHIC PANEL (EXPLICIT) */}
          {flightStage === 'q1_modal' && (
            <div className="fixed inset-0 top-16 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
              <form
                onSubmit={handleSubmitQ1}
                className="pointer-events-auto w-full max-w-xl max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-3xl border-2 border-emerald-300 p-5 sm:p-6 text-white shadow-2xl space-y-4"
                style={{
                  background: 'linear-gradient(155deg, rgba(6,78,59,0.95), rgba(8,51,68,0.94))',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-game text-xs font-bold text-amber-300 uppercase">
                    ✈️ PESAWAT STABIL · SOALAN 1 (MAKLUMAT TERSURAT)
                  </span>
                  <span className="font-game text-xs font-black text-cyan-200">1 / 3</span>
                </div>

                <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                  Apakah warna &amp; bau air sungai?
                </h2>

                <div className="space-y-2">
                  {Q1_OPTIONS.map((opt) => {
                    const selected = q1Choice === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          playSFX('click');
                          setQ1Choice(opt);
                          setQ1Error(null);
                        }}
                        className={`btn-game-sm w-full p-3 text-left text-xs sm:text-sm font-bold flex items-center gap-2.5 cursor-pointer ${
                          selected
                            ? 'btn-game-cyan text-slate-950'
                            : 'btn-game-slate text-slate-100'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] shrink-0">
                          {selected ? '✓' : ''}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {q1Error && (
                  <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-400 text-rose-100 text-xs font-semibold flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{q1Error}</span>
                  </div>
                )}

                {q1Success && (
                  <div className="p-3 rounded-2xl bg-emerald-950/90 border-2 border-amber-300 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-300 shrink-0" />
                    <span>Syabas! Jawapan tepat! Terbang ke Zon Sungai Tercemar...</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={q1Success}
                    className="btn-game-emerald px-6 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black cursor-pointer"
                  >
                    HANTAR JAWAPAN →
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. QUESTION 2 FLOATING HOLOGRAPHIC PANEL (EXPLICIT + EVIDENCE CHECK) */}
          {flightStage === 'q2_modal' && (
            <div className="fixed inset-0 top-16 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
              <form
                onSubmit={handleSubmitQ2}
                className="pointer-events-auto w-full max-w-xl max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-3xl border-2 border-amber-300 p-5 sm:p-6 text-white shadow-2xl space-y-4"
                style={{
                  background: 'linear-gradient(155deg, rgba(12,74,110,0.95), rgba(6,78,59,0.94))',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-game text-xs font-bold text-amber-300 uppercase">
                    ✈️ PESAWAT STABIL · SOALAN 2 (MAKLUMAT TERSURAT)
                  </span>
                  <span className="font-game text-xs font-black text-cyan-200">2 / 3</span>
                </div>

                <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                  Bilakah sisa dibuang ke sungai?
                </h2>

                <div className="space-y-2">
                  {Q2_OPTIONS.map((opt) => {
                    const selected = q2Choice === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          playSFX('click');
                          setQ2Choice(opt);
                          setQ2Error(null);
                        }}
                        className={`btn-game-sm w-full p-3 text-left text-xs sm:text-sm font-bold flex items-center gap-2.5 cursor-pointer ${
                          selected
                            ? 'btn-game-cyan text-slate-950'
                            : 'btn-game-slate text-slate-100'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] shrink-0">
                          {selected ? '✓' : ''}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {q2Error && (
                  <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-400 text-rose-100 text-xs font-semibold flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{q2Error}</span>
                  </div>
                )}

                {q2Success && (
                  <div className="p-3 rounded-2xl bg-emerald-950/90 border-2 border-amber-300 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-300 shrink-0" />
                    <span>Tepat sekali! Terbang ke Zon Cabaran Inferens...</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={q2Success}
                    className="btn-game-emerald px-6 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black cursor-pointer"
                  >
                    HANTAR JAWAPAN →
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. QUESTION 3 INFERENCE CHALLENGE ZONE (IMPLICIT - TYPED INPUT) */}
          {flightStage === 'q3_modal' && (
            <div className="fixed inset-0 top-16 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
              <form
                onSubmit={handleSubmitQ3}
                className="pointer-events-auto w-full max-w-xl max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-3xl border-2 border-purple-300 p-5 sm:p-6 text-white shadow-2xl space-y-4"
                style={{
                  background: 'linear-gradient(155deg, rgba(15,23,42,0.95), rgba(8,51,68,0.95))',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-game text-xs font-bold text-amber-300 uppercase">
                    ✈️ PESAWAT STABIL · SOALAN 3 (MAKLUMAT TERSIRAT)
                  </span>
                  <span className="font-game text-xs font-black text-purple-200">3 / 3</span>
                </div>

                <h2 className="font-display text-lg sm:text-2xl font-bold text-white">
                  Mengapakah kilang memilih waktu tengah malam untuk membuang sisa?
                </h2>

                <div>
                  <textarea
                    required
                    rows={4}
                    value={q3Text}
                    onChange={(e) => {
                      setQ3Text(e.target.value);
                      setQ3Error(null);
                    }}
                    placeholder="Tulis inferens anda berdasarkan laporan yang didengar..."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900/95 border-2 border-cyan-400/70 text-white text-sm focus:outline-none focus:border-amber-300"
                  />
                  <div className="text-[11px] text-cyan-200 mt-1">
                    Pesawat sedang dalam mod apung stabil supaya anda boleh menaip dengan tenang.
                  </div>
                </div>

                {q3Error && (
                  <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-400 text-rose-100 text-xs font-semibold flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{q3Error}</span>
                  </div>
                )}

                {q3Success && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/95 border-2 border-amber-300 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                    <Star className="w-5 h-5 text-amber-300 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-game text-amber-300">
                        TAHNIAH! TUGASAN BERJAYA DISELESAIKAN!
                      </div>
                      <div className="text-[11px] text-emerald-100 font-medium mt-0.5">
                        Ejen akan terbang secara automatik kembali ke Zon Utama Misi 1 dalam beberapa saat...
                      </div>
                    </div>
                  </div>
                )}

                {!q3Success && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-game-gold px-6 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black cursor-pointer"
                    >
                      HANTAR JAWAPAN →
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Automated 3D Return Flight Banner */}
          {flightStage === 'fly_to_runway' && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div
                className="px-5 py-2.5 rounded-2xl border-2 border-cyan-300 text-center text-white shadow-2xl"
                style={{ background: 'rgba(6, 78, 59, 0.92)' }}
              >
                <div className="font-game text-xs sm:text-sm font-black text-amber-300 flex items-center justify-center gap-2">
                  <span className="animate-pulse">✈️</span>
                  <span>PENERBANGAN PULANG AUTOMATIK KE ZON UTAMA MISI 1</span>
                </div>
                <div className="text-xs text-emerald-100 mt-0.5">
                  Ejen sedang menerbangkan pesawat kembali ke Pangkalan Eco World untuk mendarat...
                </div>
              </div>
            </div>
          )}

          {/* Bottom-Left Flight Controls Guide + Touch Controls (Leaves bottom-right clear for MusicControlPanel) */}
          {flightStage !== 'landing_anim' && flightStage !== 'fly_to_runway' && (
            <div className="fixed bottom-24 sm:bottom-3 left-3 right-3 sm:right-auto z-20 flex flex-col gap-2 pointer-events-none sm:max-w-[calc(100vw-355px)] lg:max-w-lg">
              <div
                className="pointer-events-auto rounded-2xl border-2 border-cyan-300/65 px-3 py-2.5 text-white shadow-xl flex flex-wrap items-center gap-3"
                style={{ background: 'rgba(8, 47, 73, 0.9)' }}
              >
                {/* Interactive Touch / Click Flight Pad */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={() => (touchInputRef.current.left = true)}
                    onPointerUp={() => (touchInputRef.current.left = false)}
                    onPointerLeave={() => (touchInputRef.current.left = false)}
                    className="btn-game-slate btn-game-sm w-9 h-9 font-black text-white flex items-center justify-center cursor-pointer"
                    aria-label="Belok kiri"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => (touchInputRef.current.forward = true)}
                    onPointerUp={() => (touchInputRef.current.forward = false)}
                    onPointerLeave={() => (touchInputRef.current.forward = false)}
                    className="btn-game-emerald btn-game-sm w-9 h-9 font-black text-slate-950 flex items-center justify-center cursor-pointer"
                    aria-label="Terbang maju"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => (touchInputRef.current.back = true)}
                    onPointerUp={() => (touchInputRef.current.back = false)}
                    onPointerLeave={() => (touchInputRef.current.back = false)}
                    className="btn-game-slate btn-game-sm w-9 h-9 font-black text-white flex items-center justify-center cursor-pointer"
                    aria-label="Perlahan"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => (touchInputRef.current.right = true)}
                    onPointerUp={() => (touchInputRef.current.right = false)}
                    onPointerLeave={() => (touchInputRef.current.right = false)}
                    className="btn-game-slate btn-game-sm w-9 h-9 font-black text-white flex items-center justify-center cursor-pointer"
                    aria-label="Belok kanan"
                  >
                    ▶
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    setManualStabilize((s) => !s);
                  }}
                  className={`btn-game-sm px-3 py-1.5 font-game text-[11px] font-black flex items-center gap-1.5 cursor-pointer ${
                    isStabilized ? 'btn-game-gold text-slate-950' : 'btn-game-cyan text-slate-950'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>{isStabilized ? 'MOD STABIL: AKTIF' : 'STABIL (Space)'}</span>
                </button>

                <div className="hidden md:block text-[11px] text-cyan-100 font-medium leading-tight">
                  <strong>W</strong> Maju · <strong>A/D</strong> Belok · <strong>S</strong> Perlahan ·{' '}
                  <strong>Space</strong> Stabil
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          PHASE 3: SAFE LANDING CELEBRATION & 5-SECOND AUTO-TELEPORT VICTORY POP-UP
         ===================================================================== */}
      {phase === 'completed' && showVictoryPopup && (
        <div className="fixed inset-0 top-14 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/35 pointer-events-auto">
          <div className="holo-victory-panel w-full max-w-2xl max-h-[calc(100vh-5.5rem)] overflow-y-auto eco-scroll rounded-3xl p-6 sm:p-8 text-center text-white space-y-5">
            <div className="holo-scanline" />
            <div className="holo-sweep-beam" />

            {/* Hologram HUD Top Tag */}
            <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-cyan-950/85 border border-cyan-300/75 text-cyan-200 font-game text-[11px] font-black tracking-[0.22em] uppercase shadow-[0_0_16px_rgba(34,211,238,0.45)]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>HOLOGRAM KEJAYAAN · MISI 1 SELESAI</span>
            </div>

            {/* Exact Required Congratulatory Copy */}
            <div className="relative z-10 space-y-3">
              <h2
                className="game-title-gold text-2xl sm:text-4xl font-black tracking-wide holo-text-reveal"
                style={{ animationDelay: '0.05s' }}
              >
                🎉 TAHNIAH, EJEN!
              </h2>

              <div
                className="p-4 sm:p-5 rounded-2xl bg-slate-950/75 border border-cyan-400/50 space-y-3 text-sm sm:text-base leading-relaxed shadow-inner holo-text-reveal"
                style={{ animationDelay: '0.16s' }}
              >
                <p className="text-emerald-100 font-medium">
                  Anda telah berjaya menyelesaikan Misi Sungai Tercemar! Hasil usaha dan tindakan bijak anda, ekosistem sungai kini berjaya diselamatkan daripada ancaman pencemaran.
                </p>
                <p className="text-cyan-100 font-medium">
                  Namun, perjuangan belum berakhir! Bersedia untuk cabaran seterusnya. Misi baharu sedang menanti anda!
                </p>
              </div>
            </div>

            {/* Compact Mission Stats & Unlock Confirmation */}
            <div
              className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left holo-text-reveal"
              style={{ animationDelay: '0.26s' }}
            >
              <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-400/50">
                <div className="text-[10px] text-cyan-200 font-bold">SOALAN BETUL</div>
                <div className="font-mono-num text-lg font-black text-emerald-300">
                  {correctCount} / 3
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-400/50">
                <div className="text-[10px] text-cyan-200 font-bold">STATUS MISI 1</div>
                <div className="text-xs font-game font-black text-emerald-300 pt-1">
                  ✅ COMPLETED
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-400/50">
                <div className="text-[10px] text-cyan-200 font-bold">STATUS MISI 2</div>
                <div className="text-xs font-game font-black text-cyan-300 pt-1">
                  🔓 UNLOCKED
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-400/50">
                <div className="text-[10px] text-cyan-200 font-bold">GANJARAN XP</div>
                <div className="font-mono-num text-lg font-black text-lime-300">
                  +{mission.maxXp} XP
                </div>
              </div>
            </div>

            {/* Automatic 5-Second Holographic Teleport Countdown (No Buttons Needed) */}
            <div
              className="relative z-10 p-4 rounded-2xl bg-cyan-950/80 border-2 border-cyan-300/75 space-y-2.5 shadow-[0_0_24px_rgba(34,211,238,0.35)] holo-text-reveal"
              style={{ animationDelay: '0.32s' }}
            >
              <div className="flex items-center justify-center gap-2.5 text-xs sm:text-sm font-game font-black tracking-wider text-cyan-200">
                <span className="animate-spin text-base">💠</span>
                <span>
                  {autoTeleportSeconds > 0
                    ? `TELEPORTASI AUTOMATIK KE MISI 2 DALAM ${autoTeleportSeconds} SAAT...`
                    : 'MEMULAKAN TELEPORTASI KE MISI 2...'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-900/90 overflow-hidden border border-cyan-400/40">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, Math.max(8, ((5 - autoTeleportSeconds) / 5) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
