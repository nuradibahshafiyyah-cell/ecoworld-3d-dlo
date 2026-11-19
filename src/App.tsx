import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  Compass,
  LogOut,
  Trophy,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { DskpObjectivesView } from './components/DskpObjectivesView';
import { LoginPortal } from './components/LoginPortal';
import { Mission1FlightAdventure } from './components/Mission1FlightAdventure';
import { Mission2OperationAdventure } from './components/Mission2OperationAdventure';
import { Mission3OperationAdventure } from './components/Mission3OperationAdventure';
import { Mission4VoiceLabAdventure } from './components/Mission4VoiceLabAdventure';
import { MissionDrawer } from './components/MissionDrawer';
import { MusicControlPanel, MusicPlayerHandle } from './components/MusicControlPanel';
import {
  AgentSelectModal,
  EvidenceBookModal,
  HallOfHeroesModal,
  MissionSuccessModal,
  ProfileBadgesModal,
  WheretoModal,
} from './components/StudentModals';
import { TeacherDashboard } from './components/TeacherDashboard';
import { WarpTransition } from './components/WarpTransition';
import { WelcomeSplash } from './components/WelcomeSplash';
import { AVATARS } from './data/gameData';
import { EcoWorldCanvas } from './three/EcoWorldCanvas';
import {
  AvatarId,
  CameraMode,
  Clue3D,
  DatabaseState,
  UserAccount,
} from './types/game';
import {
  getMusicVolume,
  installGlobalAudioInterruptHooks,
  isMusicEnabled,
  isSoundEnabled,
  playSFX,
  setMasterMuted,
  setMusicEnabled,
  setMusicState,
  setMusicVolume,
  setSoundEnabled,
  subscribeAudioSettings,
  unlockAudioOnUserGesture,
} from './utils/sound';
import {
  addLog,
  calcLevel,
  evaluateBadges,
  getDB,
  resetDemoDB,
  saveDB,
} from './utils/storage';

function getSequentialUnlockedLimit(user: UserAccount | null): number {
  if (!user || !user.progress) return 1;
  const p = user.progress;
  let seq = 1;
  if (p.m1.completed) seq = 2;
  if (p.m1.completed && p.m2.completed) seq = 3;
  if (p.m1.completed && p.m2.completed && p.m3.completed) seq = 4;
  if (p.m1.completed && p.m2.completed && p.m3.completed && p.m4.completed) seq = 5;
  return seq;
}

export default function App() {
  const [db, setDb] = useState<DatabaseState>(() => getDB());
  const [showSplash, setShowSplash] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 3D Viewport Navigation & Camera State
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [focusedMissionId, setFocusedMissionId] = useState<number>(1);
  const [activeMissionId, setActiveMissionId] = useState<number | null>(null);
  const [travelMissionId, setTravelMissionId] = useState<number | null>(null);
  const [travelPhase, setTravelPhase] = useState<'walking' | 'activating' | null>(null);
  const [teleportOutMissionId, setTeleportOutMissionId] = useState<number | null>(null);
  const [m2TeleportEntry, setM2TeleportEntry] = useState(false);
  const [m5IntroState, setM5IntroState] = useState<{
    phase: 1 | 2 | 3 | 4 | 5;
    done: boolean;
  }>({ phase: 1, done: false });
  const [m5SkipTrigger, setM5SkipTrigger] = useState(0);
  const m1RecordedThisRunRef = useRef(false);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [m1CluesFound, setM1CluesFound] = useState<string[]>([]);
  const [dpadVector, setDpadVector] = useState<{ x: number; z: number }>({ x: 0, z: 0 });

  // Collapsible Bottom Dock (Cinema / Zen Mode)
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Modals & Audio
  const musicPanelRef = useRef<MusicPlayerHandle>(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [musicVolume, setMusicVolumeState] = useState(getMusicVolume());
  const [proximityZoneId, setProximityZoneId] = useState<number>(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHeroes, setShowHeroes] = useState(false);
  const [showWhereto, setShowWhereto] = useState(false);
  const [showDskp, setShowDskp] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    missionId: number;
    score: number;
    xpEarned: number;
    message: string;
  } | null>(null);
  const [warpState, setWarpState] = useState<{
    title: string;
    subtitle: string;
    accentColor: string;
    onMidpoint?: () => void;
    onComplete?: () => void;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (activeMissionId === 5) {
      setM5IntroState({ phase: 1, done: false });
    }
  }, [activeMissionId]);

  const currentUser: UserAccount | null =
    db.users.find((u) => u.id === currentUserId) || null;
  const sequentialUnlockedLimit = getSequentialUnlockedLimit(currentUser);

  const showToast = useCallback((text: string, isError = false) => {
    setToastMsg({ text, isError });
    if (isError) playSFX('error');
  }, []);

  useEffect(() => {
    installGlobalAudioInterruptHooks();
    return subscribeAudioSettings((snap) => {
      setSoundOn(snap.soundEnabled && !snap.masterMuted);
      setMusicOn(snap.musicEnabled && !snap.masterMuted);
      setMusicVolumeState(snap.musicVolume);
    });
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Keyboard shortcut 'H' to toggle Collapsible Bottom Dock (Cinema/Zen Mode)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h' && currentUser?.role === 'murid') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentUser]);

  // Derive active music zone & restoration state
  const activeMusicZone =
    activeMissionId ??
    (cameraMode === 'zone' ? focusedMissionId : proximityZoneId || 0);
  const activeZoneKey =
    activeMusicZone >= 1 && activeMusicZone <= 5
      ? (`m${activeMusicZone}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5')
      : null;
  const activeZoneProgress = activeZoneKey ? currentUser?.progress?.[activeZoneKey] : null;
  const isZoneRestored = Boolean(
    activeZoneProgress &&
      ('submitted' in activeZoneProgress
        ? activeZoneProgress.submitted
        : activeZoneProgress.completed)
  );

  // Sync adaptive ambient music track & intensity with active zone / proximity / mission state
  useEffect(() => {
    setMusicState({
      zoneId: currentUser ? activeMusicZone : 0,
      inMission: Boolean(activeMissionId),
      zoneRestored: isZoneRestored,
    });
  }, [currentUser, activeMusicZone, activeMissionId, isZoneRestored]);

  const updateDB = useCallback((mutator: (draft: DatabaseState) => void) => {
    setDb((prev) => {
      const next: DatabaseState = JSON.parse(JSON.stringify(prev));
      mutator(next);
      saveDB(next);
      return next;
    });
  }, []);

  const handleStartFromSplash = () => {
    unlockAudioOnUserGesture();
    setShowSplash(false);
    musicPanelRef.current?.startFromUserAction();
  };

  // Staff Login (Guru by Nama Guru or Username + Password; Admin by Username + Password)
  const handleLoginStaff = (identifier: string, password: string, role: 'guru' | 'admin') => {
    const idLower = identifier.toLowerCase();
    const found = db.users.find(
      (u) =>
        u.role === role &&
        u.password === password &&
        (u.username.toLowerCase() === idLower || u.fullName.toLowerCase() === idLower)
    );
    if (!found) {
      showToast(
        role === 'guru'
          ? 'Nama Guru / Nama Pengguna atau Kata Laluan tidak sah!'
          : 'Nama Pengguna atau Kata Laluan Pentadbir tidak sah!',
        true
      );
      return;
    }
    playSFX('xp');
    setCurrentUserId(found.id);
    setActiveMissionId(null);
    setCameraMode('overview');
    showToast(`Selamat datang, ${found.fullName}!`);
  };

  // Student Access directly via Nama + ID Murid + Kelas (auto-resumes or auto-creates record)
  const handleEnterStudent = (fullName: string, studentId: string, className: string) => {
    const cleanId = studentId.trim().toUpperCase();
    const existing = db.users.find(
      (u) =>
        u.role === 'murid' &&
        ((u.studentId || '').toUpperCase() === cleanId ||
          (u.fullName.toLowerCase() === fullName.toLowerCase() && u.className === className))
    );

    if (existing) {
      unlockAudioOnUserGesture();
      const seqLimit = getSequentialUnlockedLimit(existing);
      updateDB((draft) => {
        const target = draft.users.find((u) => u.id === existing.id);
        if (target) {
          target.fullName = fullName;
          target.className = className;
          target.unlockedMission = seqLimit;
        }
        addLog(draft, fullName, `Log masuk ke EcoWorld 3D (${cleanId} · ${className})`);
      });
      playSFX('xp');
      setCurrentUserId(existing.id);
      setActiveMissionId(null);
      setTravelMissionId(null);
      setTravelPhase(null);
      setFocusedMissionId(seqLimit);
      setCameraMode('overview');
      setShowAgentSelect(true);
      showToast(`Selamat kembali, ${fullName}! Pilih ejen anda sebelum mula misi.`);
      return;
    }

    const newId = 'M' + Date.now();
    const newStudent: UserAccount = {
      id: newId,
      role: 'murid',
      username: cleanId.toLowerCase(),
      password: '',
      fullName,
      studentId: cleanId,
      className,
      classCode: className.replace(/\s+/g, '').toUpperCase(),
      avatar: 'rimba',
      xp: 0,
      unlockedMission: 1,
      progress: {
        m1: { completed: false, score: 0, tersuratScore: 0, tersiratScore: 0, evidence: [] },
        m2: { completed: false, score: 0, kbatScore: 0, thinkingMap: null, kbatAnswer: '' },
        m3: { completed: false, score: 0, chosenOption: '', justification: '' },
        m4: { completed: false, score: 0, argument: null, hasRecording: false },
        m5: {
          completed: false,
          submitted: false,
          link: '',
          title: '',
          stepsDone: [],
          rubricScore: 0,
          reflection: '',
        },
      },
      badges: [],
      teacherFeedback: 'Belum ada maklum balas guru.',
      aiApprovedByTeacher: false,
      peerFeedback: '',
    };

    updateDB((draft) => {
      draft.users.push(newStudent);
      addLog(draft, fullName, `Akses baharu (${cleanId} · ${className})`);
    });
    playSFX('win');
    setCurrentUserId(newId);
    setActiveMissionId(null);
    setFocusedMissionId(1);
    setCameraMode('overview');
    setShowAgentSelect(true);
    showToast(`Selamat datang Ejen ${fullName}! Pilih ejen pilihan anda.`);
  };

  // Register a new student directly from Access Portal (+ TAMBAH MURID) without logging in immediately
  const handleRegisterStudent = (
    fullName: string,
    studentId: string,
    className: string
  ): { ok: boolean; error?: string; student?: UserAccount } => {
    const cleanName = fullName.trim();
    const cleanId = studentId.trim().toUpperCase();
    const duplicate = db.users.some(
      (u) => u.role === 'murid' && (u.studentId || '').toUpperCase() === cleanId
    );
    if (duplicate) {
      playSFX('error');
      return {
        ok: false,
        error: `ID Murid ${cleanId} telah didaftarkan. Sila gunakan ID lain.`,
      };
    }

    const newRecord: UserAccount = {
      id: 'M' + Date.now(),
      role: 'murid',
      username: cleanId.toLowerCase(),
      password: '',
      fullName: cleanName,
      studentId: cleanId,
      className,
      classCode: className.replace(/\s+/g, '').toUpperCase(),
      avatar: 'rimba',
      xp: 0,
      unlockedMission: 1,
      progress: {
        m1: { completed: false, score: 0, tersuratScore: 0, tersiratScore: 0, evidence: [] },
        m2: { completed: false, score: 0, kbatScore: 0, thinkingMap: null, kbatAnswer: '' },
        m3: { completed: false, score: 0, chosenOption: '', justification: '' },
        m4: { completed: false, score: 0, argument: null, hasRecording: false },
        m5: {
          completed: false,
          submitted: false,
          link: '',
          title: '',
          stepsDone: [],
          rubricScore: 0,
          reflection: '',
        },
      },
      badges: [],
      teacherFeedback: 'Belum ada maklum balas guru.',
      aiApprovedByTeacher: false,
      peerFeedback: '',
    };

    updateDB((draft) => {
      draft.users.push(newRecord);
      if (!draft.classes.some((c) => c.name === className)) {
        draft.classes.push({
          id: 'c' + Date.now(),
          name: className,
          code: className.replace(/\s+/g, '').toUpperCase(),
          teacherUsername: 'cikgu_amina',
        });
      }
      addLog(draft, cleanName, `Pendaftaran murid baharu (${cleanId} · ${className})`);
    });
    playSFX('win');
    showToast(`Murid baharu didaftarkan: ${cleanName} (${cleanId})`);
    return { ok: true, student: newRecord };
  };

  const triggerEnterRoomWarp = useCallback(
    (missionId: number) => {
      const mission = db.missions.find((m) => m.id === missionId);
      if (!mission) return;
      setTravelMissionId(null);
      setTravelPhase(null);
      playSFX('warp');
      setWarpState({
        title: `TELEPORTASI KE MISI 0${mission.id}`,
        subtitle: `MEMASUKI BILIK MAYA 3D: ${mission.title.toUpperCase()}`,
        accentColor: mission.color,
        onMidpoint: () => {
          setFocusedMissionId(mission.id);
          setCameraMode('zone');
          setActiveMissionId(mission.id);
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('arrival');
        },
      });
    },
    [db.missions]
  );

  const startAutoWalkToMission = useCallback((missionId: number) => {
    unlockAudioOnUserGesture();
    playSFX('zone');
    setSuccessInfo(null);
    setActiveMissionId(null);
    setFocusedMissionId(missionId);
    setCameraMode('follow');
    setTravelPhase('walking');
    setTravelMissionId(missionId);
  }, []);

  const handleTravelFailed = useCallback(
    (missionId: number) => {
      setTravelMissionId(null);
      setTravelPhase(null);
      showToast(
        `Laluan ke Misi 0${missionId} terhalang. Gerakkan ejen ke ruang lapang dan cuba lagi.`,
        true
      );
    },
    [showToast]
  );

  const handleSelectMissionFromWorld = useCallback(
    (missionId: number) => {
      unlockAudioOnUserGesture();
      if (!currentUser || currentUser.role !== 'murid') return;
      if (warpState || travelPhase === 'activating' || travelMissionId === missionId) {
        return;
      }
      const mission = db.missions.find((m) => m.id === missionId);
      if (!mission) return;
      if (!mission.active) {
        showToast('Misi ini ditutup sementara oleh Pentadbir.', true);
        return;
      }
      if (missionId > sequentialUnlockedLimit) {
        showToast(
          `Misi 0${missionId} masih terkunci! Selesaikan Misi 0${missionId - 1} dahulu.`,
          true
        );
        return;
      }
      startAutoWalkToMission(missionId);
    },
    [
      currentUser,
      db.missions,
      sequentialUnlockedLimit,
      showToast,
      startAutoWalkToMission,
      travelMissionId,
      travelPhase,
      warpState,
    ]
  );

  const handleSetMusicOn = useCallback((enabled: boolean) => {
    setMusicOn(enabled);
    setMusicEnabled(enabled);
    if (!enabled) {
      musicPanelRef.current?.stopImmediately();
    }
  }, []);

  const handleToggleMusic = useCallback(() => {
    unlockAudioOnUserGesture();
    if (musicOn) {
      setMusicOn(false);
      setMusicEnabled(false);
      musicPanelRef.current?.stopImmediately();
    } else {
      musicPanelRef.current?.startFromUserAction();
    }
  }, [musicOn]);

  const handleChangeMusicVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setMusicVolumeState(clamped);
    setMusicVolume(clamped);
    if (clamped <= 0.01) {
      setMusicOn(false);
      setMusicEnabled(false);
      musicPanelRef.current?.stopImmediately();
    }
  }, []);

  const handleCollectClue = useCallback(
    (clue: Clue3D) => {
      if (!currentUser || currentUser.role !== 'murid') return;
      playSFX('clue');
      setM1CluesFound((prev) => (prev.includes(clue.id) ? prev : [...prev, clue.id]));
      updateDB((draft) => {
        const u = draft.users.find((x) => x.id === currentUser.id);
        if (u?.progress) {
          u.progress.m1.evidence = Array.from(
            new Set([...u.progress.m1.evidence, `${clue.title}: ${clue.description}`])
          );
        }
      });
      showToast(`Bukti ditemui: ${clue.title}! Disimpan dalam Buku Bukti.`);
    },
    [currentUser, updateDB, showToast]
  );

  const triggerMissionWarp = useCallback(
    (
      completedId: number,
      score: number,
      xpEarned: number,
      message: string
    ) => {
      const nextId = completedId < 5 ? completedId + 1 : 5;
      const nextMission = db.missions.find((m) => m.id === nextId);
      playSFX('warp');
      setWarpState({
        title:
          completedId < 5
            ? `MISI 0${completedId} BERJAYA!`
            : 'ECOWORLD DISELAMATKAN!',
        subtitle:
          completedId < 5
            ? `BERPINDAH KE ZON MISI 0${nextId}: ${(nextMission?.title || '').toUpperCase()}`
            : 'MEMBUKA SIJIL KEJAYAAN DEWAN WIRA',
        accentColor: nextMission?.color || '#34d399',
        onMidpoint: () => {
          setActiveMissionId(null);
          setFocusedMissionId(nextId);
          setCameraMode('zone');
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('win');
          setSuccessInfo({
            missionId: completedId,
            score,
            xpEarned,
            message,
          });
        },
      });
    },
    [db.missions]
  );

  const handleTeleportDeparted = useCallback((targetId: number) => {
    setTeleportOutMissionId(null);
    playSFX('warp');
    setWarpState({
      title: `TELEPORTASI KE MISI 0${targetId}`,
      subtitle: 'MEMINDAHKAN EJEN KE LOKASI KHAS MISI 2',
      accentColor: '#38bdf8',
      onMidpoint: () => {
        setM2TeleportEntry(targetId === 2);
        setActiveMissionId(targetId);
      },
      onComplete: () => {
        setWarpState(null);
        playSFX('arrival');
      },
    });
  }, []);

  const handleCompleteM1 = (
    score: number,
    tersuratScore: number,
    tersiratScore: number,
    evidence: string,
    afterAction?: 'map' | 'next_mission' | 'record_only'
  ) => {
    if (!currentUser) return;
    let xpEarned = 0;

    if (afterAction === 'record_only' || !m1RecordedThisRunRef.current) {
      const isFirst = !currentUser.progress?.m1.completed;
      xpEarned = isFirst ? 150 : 0;
      updateDB((draft) => {
        const u = draft.users.find((x) => x.id === currentUser.id)!;
        u.progress!.m1 = {
          completed: true,
          score,
          tersuratScore,
          tersiratScore,
          evidence: Array.from(new Set([...u.progress!.m1.evidence, evidence].filter(Boolean))),
        };
        u.xp = (u.xp || 0) + xpEarned;
        u.unlockedMission = Math.max(u.unlockedMission || 1, 2);
        evaluateBadges(u);
        addLog(draft, u.fullName, `Menyelesaikan Misi 1 (${score}%)`);
      });
      if (afterAction === 'record_only') {
        m1RecordedThisRunRef.current = true;
        showToast('TAHNIAH! MISI 2 BERJAYA DIBUKA!');
        return;
      }
    }

    m1RecordedThisRunRef.current = false;

    if (afterAction === 'map') {
      playSFX('warp');
      setWarpState({
        title: 'MISI 01 SELESAI!',
        subtitle: 'KEMBALI KE PETA PULAU ECOWORLD 3D',
        accentColor: '#34d399',
        onMidpoint: () => {
          setActiveMissionId(null);
          setFocusedMissionId(2);
          setCameraMode('overview');
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('win');
          showToast(
            `TAHNIAH! MISI 2 BERJAYA DIBUKA! Rekod Misi 01 disimpan (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''}).`
          );
        },
      });
      return;
    }

    if (afterAction === 'next_mission') {
      const m2 = db.missions.find((m) => m.id === 2);
      if (m2 && m2.active) {
        playSFX('achievement');
        setActiveMissionId(null);
        setTravelMissionId(null);
        setTravelPhase(null);
        setFocusedMissionId(2);
        setCameraMode('follow');
        setTeleportOutMissionId(2);
        return;
      }
      setActiveMissionId(null);
      setCameraMode('overview');
      showToast('Rekod Misi 01 disimpan, tetapi Misi 02 ditutup sementara oleh Pentadbir.', true);
      return;
    }

    triggerMissionWarp(
      1,
      score,
      xpEarned,
      `Tersurat: ${tersuratScore}% · Tersirat: ${tersiratScore}%. Rekod telah dihantar ke Papan Guru & Zon 2 kini dibuka!`
    );
  };

  const handleCompleteM2 = (
    score: number,
    kbatScore: number,
    punca: string,
    kesan: string,
    kbatAnswer: string,
    afterAction?: 'map' | 'next_mission'
  ) => {
    if (!currentUser) return;
    const isFirst = !currentUser.progress?.m2.completed;
    const xpEarned = isFirst ? 180 : 0;
    updateDB((draft) => {
      const u = draft.users.find((x) => x.id === currentUser.id)!;
      u.progress!.m2 = {
        completed: true,
        score,
        kbatScore,
        thinkingMap: { punca, kesan },
        kbatAnswer,
      };
      u.xp = (u.xp || 0) + xpEarned;
      if ((u.unlockedMission || 1) < 3) u.unlockedMission = 3;
      evaluateBadges(u);
      addLog(draft, u.fullName, `Menyelesaikan Misi 2 (${score}%)`);
    });

    if (afterAction === 'map') {
      playSFX('warp');
      setWarpState({
        title: 'MISI 02 SELESAI!',
        subtitle: 'KEMBALI KE PETA PULAU ECOWORLD 3D',
        accentColor: '#34d399',
        onMidpoint: () => {
          setActiveMissionId(null);
          setFocusedMissionId(3);
          setCameraMode('overview');
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('win');
          showToast(
            `Tahniah! Rekod Misi 02 disimpan (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''}). Zon Misi 03 kini dibuka!`
          );
        },
      });
      return;
    }

    if (afterAction === 'next_mission') {
      const m3 = db.missions.find((m) => m.id === 3);
      if (m3 && m3.active) {
        playSFX('achievement');
        startAutoWalkToMission(3);
        showToast(
          `Misi 02 selesai (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''})! Menuju ke Misi 03: Hutan Harapan.`
        );
        return;
      }
      setActiveMissionId(null);
      setCameraMode('overview');
      showToast('Rekod Misi 02 disimpan, tetapi Misi 03 ditutup sementara oleh Pentadbir.', true);
      return;
    }

    triggerMissionWarp(
      2,
      score,
      xpEarned,
      'Jerebu berjaya dibersihkan & rekod dihantar ke Papan Guru! Zon 3 kini dibuka.'
    );
  };

  const handleCompleteM3 = (
    score: number,
    chosenOption: string,
    justification: string,
    afterAction?: 'map' | 'next_mission'
  ) => {
    if (!currentUser) return;
    const isFirst = !currentUser.progress?.m3.completed;
    const xpEarned = isFirst ? 180 : 0;
    updateDB((draft) => {
      const u = draft.users.find((x) => x.id === currentUser.id)!;
      u.progress!.m3 = { completed: true, score, chosenOption, justification };
      u.xp = (u.xp || 0) + xpEarned;
      if ((u.unlockedMission || 1) < 4) u.unlockedMission = 4;
      evaluateBadges(u);
      addLog(draft, u.fullName, `Menyelesaikan Misi 3 (${score}%)`);
    });

    if (afterAction === 'map') {
      playSFX('warp');
      setWarpState({
        title: 'MISI 03 SELESAI!',
        subtitle: 'KEMBALI KE PETA PULAU ECOWORLD 3D',
        accentColor: '#34d399',
        onMidpoint: () => {
          setActiveMissionId(null);
          setFocusedMissionId(4);
          setCameraMode('overview');
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('win');
          showToast(
            `Tahniah, Ejen! Rekod Misi 03 disimpan (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''}). Zon Misi 04 kini dibuka!`
          );
        },
      });
      return;
    }

    if (afterAction === 'next_mission') {
      const m4 = db.missions.find((m) => m.id === 4);
      if (m4 && m4.active) {
        playSFX('achievement');
        startAutoWalkToMission(4);
        showToast(
          `Misi 03 selesai (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''})! Menuju ke Misi 04: Makmal Suara.`
        );
        return;
      }
      setActiveMissionId(null);
      setCameraMode('overview');
      showToast('Rekod Misi 03 disimpan, tetapi Misi 04 ditutup sementara oleh Pentadbir.', true);
      return;
    }

    triggerMissionWarp(
      3,
      score,
      xpEarned,
      'Turbin angin Hutan Harapan kini berputar! Makmal Suara (Misi 4) kini dibuka.'
    );
  };

  const handleUpdateM4Argument = (argument: {
    pendirian: string;
    bukti: string;
    huraian: string;
    kesimpulan: string;
  }) => {
    if (!currentUser) return;
    updateDB((draft) => {
      const u = draft.users.find((x) => x.id === currentUser.id);
      if (!u || !u.progress) return;
      u.progress.m4 = {
        ...u.progress.m4,
        argument,
      };
      addLog(draft, u.fullName, 'Mengemas kini hujah Misi 4 dalam Bahagian 2 Misi 5');
    });
    showToast('Hujah berjaya dikemas kini!');
  };

  const handleCompleteM4 = (
    score: number,
    argument: { pendirian: string; bukti: string; huraian: string; kesimpulan: string },
    hasRecording: boolean,
    peerFeedback: string,
    afterAction?: 'map' | 'next_mission'
  ) => {
    if (!currentUser) return;
    const isFirst = !currentUser.progress?.m4.completed;
    const xpEarned = isFirst ? 220 : 0;
    updateDB((draft) => {
      const u = draft.users.find((x) => x.id === currentUser.id)!;
      u.progress!.m4 = {
        completed: true,
        score,
        argument,
        hasRecording: hasRecording || u.progress!.m4.hasRecording,
      };
      u.peerFeedback = peerFeedback;
      u.xp = (u.xp || 0) + xpEarned;
      if ((u.unlockedMission || 1) < 5) u.unlockedMission = 5;
      evaluateBadges(u);
      addLog(draft, u.fullName, `Menyiapkan Makmal Suara (${score}%)`);
    });

    if (afterAction === 'map') {
      playSFX('warp');
      setWarpState({
        title: 'MISI 04 SELESAI!',
        subtitle: 'KEMBALI KE PETA PULAU ECOWORLD 3D',
        accentColor: '#34d399',
        onMidpoint: () => {
          setActiveMissionId(null);
          setFocusedMissionId(5);
          setCameraMode('overview');
        },
        onComplete: () => {
          setWarpState(null);
          playSFX('win');
          showToast(
            `Tahniah, Ejen! Hujah disimpan (${score}%${xpEarned ? ` · +${xpEarned} XP` : ''}). Misi 05 kini dibuka!`
          );
        },
      });
      return;
    }

    if (afterAction === 'next_mission') {
      const m5 = db.missions.find((m) => m.id === 5);
      if (m5 && m5.active) {
        playSFX('achievement');
        startAutoWalkToMission(5);
        showToast(
          `Hujah disimpan${xpEarned ? ` (+${xpEarned} XP)` : ''}! Ejen menuju ke Misi 05: Operasi EcoWorld.`
        );
        return;
      }
      setActiveMissionId(null);
      setCameraMode('overview');
      showToast('Rekod Misi 04 disimpan, tetapi Misi 05 ditutup sementara oleh Pentadbir.', true);
      return;
    }

    triggerMissionWarp(
      4,
      score,
      xpEarned,
      'Hujah kritis anda mantap! Monumen Operasi Selamatkan EcoWorld (Misi 5) kini dibuka.'
    );
  };

  const handleCompleteM5 = (
    title: string,
    link: string,
    stepsDone: number[],
    rubricScore: number,
    reflection: string
  ) => {
    if (!currentUser) return;
    const isFirst = !currentUser.progress?.m5.submitted;
    const xpEarned = isFirst ? 300 : 0;
    updateDB((draft) => {
      const u = draft.users.find((x) => x.id === currentUser.id)!;
      u.progress!.m5 = {
        completed: true,
        submitted: true,
        title,
        link,
        stepsDone,
        rubricScore,
        reflection,
      };
      u.xp = (u.xp || 0) + xpEarned;
      evaluateBadges(u);
      addLog(draft, u.fullName, `Menghantar Kempen Digital: ${title}`);
    });
    triggerMissionWarp(
      5,
      rubricScore,
      xpEarned,
      'TAHNIAH! EcoWorld berjaya diselamatkan. Cetak atau muat turun sijil PDF anda sekarang!'
    );
  };

  const activeMission = db.missions.find((m) => m.id === activeMissionId) || null;
  const currentAv = AVATARS.find((a) => a.id === currentUser?.avatar) || AVATARS[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Dedicated Isolated 3D WebGL Canvas */}
      <EcoWorldCanvas
        user={
          currentUser
            ? { ...currentUser, unlockedMission: sequentialUnlockedLimit }
            : null
        }
        missions={db.missions}
        cameraMode={cameraMode}
        focusedMissionId={focusedMissionId}
        activeRoomId={
          currentUser?.role === 'murid' &&
          activeMissionId !== 1 &&
          activeMissionId !== 2 &&
          activeMissionId !== 3 &&
          activeMissionId !== 4
            ? activeMissionId
            : null
        }
        paused={Boolean(
          currentUser?.role === 'murid' &&
            (activeMissionId === 1 ||
              activeMissionId === 2 ||
              activeMissionId === 3 ||
              activeMissionId === 4)
        )}
        m1CluesFound={m1CluesFound}
        dpadVector={dpadVector}
        travelTargetMissionId={currentUser?.role === 'murid' && !activeMissionId ? travelMissionId : null}
        teleportOutMissionId={
          currentUser?.role === 'murid' && !activeMissionId ? teleportOutMissionId : null
        }
        onSelectMission={handleSelectMissionFromWorld}
        onArriveAtMission={triggerEnterRoomWarp}
        onTeleportDeparted={handleTeleportDeparted}
        onTravelPhaseChange={setTravelPhase}
        onTravelFailed={handleTravelFailed}
        onCollectClue={handleCollectClue}
        onHoverInfo={setHoverInfo}
        onProximityZoneChange={setProximityZoneId}
        onMission5IntroChange={setM5IntroState}
        m5SkipTrigger={m5SkipTrigger}
      />

      {/* Top Navigation Bar */}
      {currentUser && (
        <header className="no-print fixed top-0 inset-x-0 z-30 px-4 md:px-6 py-2 bg-slate-950/92 border-b border-emerald-500/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="game-title-emerald text-lg md:text-xl font-black whitespace-nowrap shrink-0">
              ECOWORLD 3D
            </span>
            <span className="hidden sm:inline text-xs text-slate-300 font-medium whitespace-nowrap truncate">
              {currentUser.fullName} ·{' '}
              {currentUser.role === 'admin' ? 'PENTADBIR' : currentUser.role.toUpperCase()}
              {currentUser.role === 'murid' &&
                ` · ${currentUser.studentId} · ${currentUser.className} · Tahap ${calcLevel(
                  currentUser.xp || 0
                )} · ${currentUser.xp || 0} XP`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                unlockAudioOnUserGesture();
                const next = !soundOn;
                if (next) {
                  setMasterMuted(false);
                  setSoundEnabled(true);
                  playSFX('click');
                } else {
                  setSoundEnabled(false);
                }
              }}
              className={`btn-game-sm px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                soundOn ? 'btn-game-emerald text-slate-950' : 'btn-game-slate text-slate-300'
              }`}
            >
              <span className="btn-icon-3d w-5 h-5">
                {soundOn ? (
                  <Volume2 className="w-3 h-3" />
                ) : (
                  <VolumeX className="w-3 h-3" />
                )}
              </span>
              <span className="hidden md:inline">{soundOn ? 'Bunyi: Buka' : 'Bunyi: Tutup'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setShowDskp(true);
              }}
              className="btn-game-teal btn-game-sm px-3 py-1.5 text-xs font-bold text-slate-950 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span className="btn-icon-3d w-5 h-5">
                <BookOpenCheck className="w-3.5 h-3.5" />
              </span>
              <span>DSKP &amp; Objektif</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setShowWhereto(true);
              }}
              className="btn-game-cyan btn-game-sm px-3 py-1.5 text-xs font-bold text-slate-950 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span className="btn-icon-3d w-5 h-5 text-[11px]">📘</span>
              <span>Panduan Misi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setCurrentUserId(null);
                setActiveMissionId(null);
              }}
              className="btn-game-rose btn-game-sm px-3 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span className="btn-icon-3d w-5 h-5">
                <LogOut className="w-3 h-3" />
              </span>
              <span>Keluar</span>
            </button>
          </div>
        </header>
      )}

      {/* Agent Teleportation HUD Banner */}
      {currentUser?.role === 'murid' && !activeMission && teleportOutMissionId !== null && (
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl bg-slate-950/95 border-2 border-cyan-400 text-cyan-100 text-xs font-game font-black flex items-center gap-3 shadow-[0_0_28px_rgba(56,189,248,0.55)]">
          <span className="animate-spin text-sm">💠</span>
          <span>TELEPORTASI EJEN KE MISI {teleportOutMissionId} SEDANG BERLANGSUNG...</span>
        </div>
      )}

      {/* Agent Walking-to-Mission & Portal Activation HUD Banner */}
      {currentUser?.role === 'murid' && !activeMission && teleportOutMissionId === null && travelMissionId !== null && (() => {
        const tm = db.missions.find((m) => m.id === travelMissionId);
        const isActivatingPortal = travelPhase === 'activating';
        return (
          <div
            className={`no-print fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-slate-950/95 border-2 text-xs font-game font-bold flex items-center gap-3 shadow-2xl ${
              isActivatingPortal
                ? 'border-cyan-400 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.45)]'
                : 'border-emerald-400 text-emerald-100'
            }`}
          >
            <span className="animate-pulse text-sm">{isActivatingPortal ? '🌀' : '🧭'}</span>
            <span>
              {isActivatingPortal
                ? `Mengaktifkan Gerbang Teleportasi Misi 0${travelMissionId}${tm ? `: ${tm.title}` : ''}...`
                : `Menuju ke Misi 0${travelMissionId}${tm ? `: ${tm.title}` : ''}... (${currentAv.name})`}
            </span>
          </div>
        );
      })()}
      {currentUser?.role === 'murid' && !activeMission && travelMissionId === null && cameraMode === 'firstPerson' && !hoverInfo && (
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-xl bg-slate-950/95 border border-emerald-400/70 text-xs font-game font-bold text-emerald-200 pointer-events-none shadow-lg">
          👁️ PANDANGAN MATA EJEN ({currentAv.name}) · W/S Jalan · A/D Pusing
        </div>
      )}
      {hoverInfo && currentUser?.role === 'murid' && !activeMission && travelMissionId === null && (
        <div className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-xl bg-slate-950/95 border border-amber-400/60 text-xs font-semibold text-amber-200 pointer-events-none shadow-lg">
          {hoverInfo}
        </div>
      )}

      {/* Step 1: Static 16:9 Welcome Splash Screen with Single MULA Button */}
      {!currentUser && showSplash && <WelcomeSplash onStart={handleStartFromSplash} />}

      {/* Step 2: Role Access Portal (Admin, Guru, Murid) directly after MULA */}
      {!currentUser && !showSplash && (
        <LoginPortal
          classes={db.classes}
          students={db.users.filter((u) => u.role === 'murid')}
          onBackToSplash={() => {
            setShowSplash(true);
          }}
          onOpenDskp={() => setShowDskp(true)}
          onLoginStaff={handleLoginStaff}
          onEnterStudent={handleEnterStudent}
          onRegisterStudent={handleRegisterStudent}
        />
      )}

      {/* Teacher Dashboard */}
      {currentUser?.role === 'guru' && (
        <TeacherDashboard
          db={db}
          teacher={currentUser}
          onSaveFeedback={(studentId, fb) => {
            updateDB((draft) => {
              const s = draft.users.find((u) => u.id === studentId);
              if (s) s.teacherFeedback = fb;
            });
            playSFX('xp');
            showToast('Maklum balas guru disimpan!');
          }}
          onApproveAI={(studentId, approved) => {
            updateDB((draft) => {
              const s = draft.users.find((u) => u.id === studentId);
              if (s) s.aiApprovedByTeacher = approved;
            });
            playSFX('click');
            showToast('Status pengesahan AI dikemas kini.');
          }}
        />
      )}

      {/* Admin Dashboard */}
      {currentUser?.role === 'admin' && (
        <AdminDashboard
          db={db}
          onAddTeacher={(fullName, username, password) => {
            updateDB((draft) => {
              draft.users.push({
                id: 't' + Date.now(),
                role: 'guru',
                fullName,
                username,
                password,
              });
              addLog(draft, currentUser.fullName, `Mendaftar guru baharu: ${fullName}`);
            });
            playSFX('xp');
            showToast('Guru baharu ditambah!');
          }}
          onUpdateTeacherPassword={(userId, newPassword) => {
            updateDB((draft) => {
              const t = draft.users.find((u) => u.id === userId);
              if (t) t.password = newPassword;
            });
            playSFX('xp');
            showToast('Kata laluan guru dikemas kini.');
          }}
          onAddClass={(name, code) => {
            updateDB((draft) => {
              draft.classes.push({ id: 'c' + Date.now(), name, code });
            });
            playSFX('xp');
            showToast('Kelas baharu ditambah!');
          }}
          onDeleteUser={(userId) => {
            updateDB((draft) => {
              draft.users = draft.users.filter((u) => u.id !== userId);
            });
            showToast('Pengguna dipadam.');
          }}
          onDeleteClass={(classId) => {
            updateDB((draft) => {
              draft.classes = draft.classes.filter((c) => c.id !== classId);
            });
            showToast('Kelas dipadam.');
          }}
          onToggleMission={(index, active) => {
            updateDB((draft) => {
              draft.missions[index].active = active;
            });
            showToast('Status misi dikemas kini.');
          }}
          onSaveApi={(url) => {
            updateDB((draft) => {
              draft.apiEndpoint = url;
            });
            showToast('Pautan Segerak disimpan.');
          }}
          onResetDemo={() => {
            setDb(resetDemoDB());
            showToast('Data contoh berjaya ditetapkan semula.');
          }}
        />
      )}

      {/* Student Collapsible Bottom Control Dock (Shown only on Main Mission Map) */}
      {currentUser?.role === 'murid' &&
        !activeMission &&
        travelMissionId === null &&
        teleportOutMissionId === null &&
        !warpState && (
          <div
            className={`no-print fixed bottom-3 left-3 md:left-6 xl:left-1/2 xl:-translate-x-[calc(50%+110px)] z-30 w-[min(710px,calc(100vw-24px))] md:w-[min(710px,calc(100vw-355px))] transition-transform duration-300 ${
              dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
            }`}
          >
            <div className="control-board-holo-in">
              <div className="flex justify-center mb-1">
                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    setDockCollapsed((p) => !p);
                  }}
                  className="btn-game-slate btn-game-sm px-3 py-0.5 text-[10.5px] font-game font-bold text-slate-100 flex items-center gap-1 cursor-pointer"
                >
                  {dockCollapsed ? (
                    <>
                      <ChevronUp className="w-3 h-3 text-emerald-400" /> Papar Kawalan (H)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 text-amber-300" /> Sembunyi Kawalan (H)
                    </>
                  )}
                </button>
              </div>

              <div className="mission-board-shell relative overflow-hidden rounded-2xl p-2 space-y-1.5">
                <div className="pointer-events-none absolute top-0 inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                <div className="holo-scanline opacity-35" />

                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {db.missions.map((m) => {
                    const mp = currentUser.progress![`m${m.id}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5'];
                    const done = 'submitted' in mp ? mp.submitted : mp.completed;
                    const unlocked = m.id <= sequentialUnlockedLimit && m.active;
                    const isFocused = focusedMissionId === m.id;
                    const statusBadge = done
                      ? '⭐ SELESAI'
                      : unlocked
                      ? isFocused
                        ? '⚡ AKTIF'
                        : '🔓 DIBUKA'
                      : '🔒 TERKUNCI';
                    const cardCls = done
                      ? 'btn-game-gold text-slate-950'
                      : unlocked
                      ? isFocused
                        ? 'btn-game-emerald text-slate-950'
                        : 'btn-game-teal text-slate-950'
                      : 'btn-game-slate text-slate-400 opacity-75';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-disabled={!unlocked}
                        title={`${m.shortTitle} (${statusBadge})`}
                        onClick={() => handleSelectMissionFromWorld(m.id)}
                        className={`btn-game-sm px-2 py-1.5 text-left cursor-pointer ${cardCls}`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[9.5px] font-game font-black">
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="btn-icon-3d w-4 h-4 text-[10px] shrink-0">
                              {m.icon}
                            </span>
                            <span className="whitespace-nowrap">MISI 0{m.id}</span>
                          </span>
                          <span className="text-[8px] tracking-tight whitespace-nowrap">
                            {statusBadge}
                          </span>
                        </div>
                        <div
                          className={`font-display font-bold mt-0.5 ${
                            m.id === 2
                              ? 'text-[9.5px] leading-tight whitespace-normal'
                              : 'text-[10.5px] leading-tight truncate'
                          }`}
                        >
                          {m.shortTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-cyan-500/20">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 rounded-xl border border-cyan-500/30">
                    <Compass className="w-3.5 h-3.5 text-sky-400 ml-1 mr-0.5 shrink-0" />
                    {(
                      [
                        ['overview', 'Pulau'],
                        ['follow', 'Ikut Ejen'],
                        ['firstPerson', 'Mata Ejen'],
                        ['zone', 'Zon'],
                      ] as [CameraMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          playSFX('click');
                          setCameraMode(mode);
                        }}
                        className={`btn-game-sm px-2 py-0.5 text-[10.5px] font-bold cursor-pointer whitespace-nowrap ${
                          cameraMode === mode
                            ? 'btn-game-cyan text-slate-950'
                            : 'btn-game-slate text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="hidden xl:inline">WASD ·</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onPointerDown={() => setDpadVector({ x: -1, z: 0 })}
                        onPointerUp={() => setDpadVector({ x: 0, z: 0 })}
                        onPointerLeave={() => setDpadVector({ x: 0, z: 0 })}
                        className="btn-game-slate btn-game-sm w-7 h-7 text-[11px] text-white font-black flex items-center justify-center cursor-pointer"
                        aria-label="Gerak kiri"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => setDpadVector({ x: 0, z: -1 })}
                        onPointerUp={() => setDpadVector({ x: 0, z: 0 })}
                        onPointerLeave={() => setDpadVector({ x: 0, z: 0 })}
                        className="btn-game-slate btn-game-sm w-7 h-7 text-[11px] text-white font-black flex items-center justify-center cursor-pointer"
                        aria-label="Gerak depan"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => setDpadVector({ x: 0, z: 1 })}
                        onPointerUp={() => setDpadVector({ x: 0, z: 0 })}
                        onPointerLeave={() => setDpadVector({ x: 0, z: 0 })}
                        className="btn-game-slate btn-game-sm w-7 h-7 text-[11px] text-white font-black flex items-center justify-center cursor-pointer"
                        aria-label="Gerak belakang"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => setDpadVector({ x: 1, z: 0 })}
                        onPointerUp={() => setDpadVector({ x: 0, z: 0 })}
                        onPointerLeave={() => setDpadVector({ x: 0, z: 0 })}
                        className="btn-game-slate btn-game-sm w-7 h-7 text-[11px] text-white font-black flex items-center justify-center cursor-pointer"
                        aria-label="Gerak kanan"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setShowAgentSelect(true);
                      }}
                      className="btn-game-teal btn-game-sm px-2 py-1 text-slate-950 font-game text-[10.5px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span className="btn-icon-3d w-5 h-5 text-xs">{currentAv.emoji}</span>
                      <span>Pilih Ejen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setShowEvidence(true);
                      }}
                      className="btn-game-cyan btn-game-sm px-2 py-1 text-slate-950 font-game text-[10.5px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span className="btn-icon-3d w-5 h-5">
                        <BookOpen className="w-3 h-3" />
                      </span>
                      <span>
                        Buku Bukti ({currentUser.progress?.m1.evidence.length || 0})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setShowProfile(true);
                      }}
                      className="btn-game-emerald btn-game-sm px-2 py-1 text-slate-950 font-game text-[10.5px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span className="btn-icon-3d w-5 h-5">
                        <User className="w-3 h-3" />
                      </span>
                      <span>
                        Profil ({(currentUser.badges || []).length}/5)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setShowHeroes(true);
                      }}
                      className="btn-game-gold btn-game-sm px-2.5 py-1 text-slate-950 font-game text-[10.5px] font-black flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span className="btn-icon-3d w-5 h-5">
                        <Trophy className="w-3 h-3" />
                      </span>
                      <span>Dewan Wira ★</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Mission 01: Fullscreen 3D Flight Adventure */}
      {activeMission && activeMission.id === 1 && currentUser?.role === 'murid' && (
        <Mission1FlightAdventure
          mission={activeMission}
          user={currentUser}
          m1CluesFound={m1CluesFound}
          musicOn={musicOn}
          musicVolume={musicVolume}
          onToggleMusic={handleToggleMusic}
          onChangeMusicVolume={handleChangeMusicVolume}
          onChangeAvatar={(avatarId: AvatarId) => {
            updateDB((draft) => {
              const u = draft.users.find((x) => x.id === currentUser.id);
              if (u) u.avatar = avatarId;
            });
          }}
          onCollectClue={handleCollectClue}
          onClose={() => {
            m1RecordedThisRunRef.current = false;
            setActiveMissionId(null);
          }}
          onCompleteMission1={handleCompleteM1}
        />
      )}

      {/* Mission 02: Fullscreen Interactive 3D Operation Adventure */}
      {activeMission && activeMission.id === 2 && currentUser?.role === 'murid' && (
        <Mission2OperationAdventure
          mission={activeMission}
          user={currentUser}
          musicOn={musicOn}
          musicVolume={musicVolume}
          justTeleported={m2TeleportEntry}
          onToggleMusic={handleToggleMusic}
          onChangeMusicVolume={handleChangeMusicVolume}
          onClose={() => {
            setM2TeleportEntry(false);
            setActiveMissionId(null);
          }}
          onCompleteMission2={(score, kbatScore, punca, kesan, kbatAnswer, afterAction) => {
            setM2TeleportEntry(false);
            handleCompleteM2(score, kbatScore, punca, kesan, kbatAnswer, afterAction);
          }}
        />
      )}

      {/* Mission 03: ECO RESCUE: MISI 3 – OPERASI PILIHAN TERBAIK! */}
      {activeMission && activeMission.id === 3 && currentUser?.role === 'murid' && (
        <Mission3OperationAdventure
          mission={activeMission}
          user={currentUser}
          musicOn={musicOn}
          musicVolume={musicVolume}
          onToggleMusic={handleToggleMusic}
          onChangeMusicVolume={handleChangeMusicVolume}
          onClose={() => setActiveMissionId(null)}
          onCompleteMission3={handleCompleteM3}
        />
      )}

      {/* Mission 04: Makmal Suara (Dengar Laporan -> Bina Hujah -> Simpan Hujah) */}
      {activeMission && activeMission.id === 4 && currentUser?.role === 'murid' && (
        <Mission4VoiceLabAdventure
          mission={activeMission}
          user={currentUser}
          musicOn={musicOn}
          musicVolume={musicVolume}
          onToggleMusic={handleToggleMusic}
          onChangeMusicVolume={handleChangeMusicVolume}
          onClose={() => setActiveMissionId(null)}
          onCompleteMission4={handleCompleteM4}
        />
      )}

      {/* 3D Virtual Mission Room HUD & Activity Panel (Mission 05) */}
      {activeMission &&
        activeMission.id !== 1 &&
        activeMission.id !== 2 &&
        activeMission.id !== 3 &&
        activeMission.id !== 4 &&
        currentUser?.role === 'murid' && (
        <MissionDrawer
          mission={activeMission}
          user={currentUser}
          m1CluesFound={m1CluesFound}
          musicOn={musicOn}
          musicVolume={musicVolume}
          onToggleMusic={handleToggleMusic}
          onChangeMusicVolume={handleChangeMusicVolume}
          onCollectClue={handleCollectClue}
          onClose={() => setActiveMissionId(null)}
          onCompleteMission1={handleCompleteM1}
          onCompleteMission2={handleCompleteM2}
          onCompleteMission3={handleCompleteM3}
          onCompleteMission4={handleCompleteM4}
          onUpdateMission4Argument={handleUpdateM4Argument}
          onCompleteMission5={handleCompleteM5}
          m5IntroState={m5IntroState}
          onSkipM5Intro={() => setM5SkipTrigger((n) => n + 1)}
        />
      )}

      {/* Student & Shared Modals */}
      {showAgentSelect && currentUser?.role === 'murid' && (
        <AgentSelectModal
          user={currentUser}
          onSelectAgent={(avatarId: AvatarId) => {
            updateDB((draft) => {
              const u = draft.users.find((x) => x.id === currentUser.id);
              if (u) u.avatar = avatarId;
            });
            setShowAgentSelect(false);
            musicPanelRef.current?.startFromUserAction();
            const av = AVATARS.find((a) => a.id === avatarId);
            showToast(`Anda kini bertugas sebagai ${av?.name || 'Ejen EcoWorld'}! Klik Misi 1 untuk bermula.`);
          }}
        />
      )}
      {showEvidence && currentUser && (
        <EvidenceBookModal user={currentUser} onClose={() => setShowEvidence(false)} />
      )}
      {showProfile && currentUser && (
        <ProfileBadgesModal
          user={currentUser}
          missions={db.missions}
          onChangeAvatar={(avatarId: AvatarId) => {
            updateDB((draft) => {
              const u = draft.users.find((x) => x.id === currentUser.id);
              if (u) u.avatar = avatarId;
            });
            playSFX('click');
            showToast('Karakter Ejen 3D bertukar!');
          }}
          onOpenMission={(id) => handleSelectMissionFromWorld(id)}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showHeroes && currentUser && (
        <HallOfHeroesModal user={currentUser} onClose={() => setShowHeroes(false)} />
      )}
      {showWhereto && <WheretoModal onClose={() => setShowWhereto(false)} />}
      {showDskp && <DskpObjectivesView onBack={() => setShowDskp(false)} />}
      {successInfo && currentUser && (() => {
        const nextM =
          successInfo.missionId < 5
            ? db.missions.find((m) => m.id === successInfo.missionId + 1 && m.active) || null
            : null;
        return (
          <MissionSuccessModal
            user={currentUser}
            info={successInfo}
            nextMission={nextM}
            onTeleportNext={
              nextM
                ? () => {
                    handleSelectMissionFromWorld(nextM.id);
                  }
                : undefined
            }
            onClose={() => setSuccessInfo(null)}
            onOpenHeroes={() => {
              setSuccessInfo(null);
              setShowHeroes(true);
            }}
          />
        );
      })()}

      {/* Cinematic Teleportation / Warp Speed Overlay */}
      {warpState && (
        <WarpTransition
          title={warpState.title}
          subtitle={warpState.subtitle}
          accentColor={warpState.accentColor}
          onMidpoint={warpState.onMidpoint}
          onComplete={() => warpState.onComplete?.()}
        />
      )}

      {/* Persistent Floating 3D YouTube Background Music Control Panel (Bottom-Right Corner) */}
      <MusicControlPanel
        ref={musicPanelRef}
        visible={!showSplash}
        musicOn={musicOn}
        musicVolume={musicVolume}
        onSetMusicOn={handleSetMusicOn}
        onChangeVolume={handleChangeMusicVolume}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`no-print fixed top-16 right-4 z-50 px-4 py-3 rounded-2xl border shadow-2xl text-xs md:text-sm font-semibold flex items-center gap-2 ${
            toastMsg.isError
              ? 'bg-rose-950/95 border-rose-500 text-rose-100'
              : 'bg-slate-950/95 border-emerald-400 text-emerald-100'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>{toastMsg.text}</span>
        </div>
      )}
    </div>
  );
}
