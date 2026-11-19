import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Mic,
  Music,
  Play,
  Rocket,
  Square,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { M1_CLUES_3D, M1_SCRIPT, M2_SCENES, M3_OPTS, PBL_STEPS } from '../data/gameData';
import { Clue3D, MissionDef, UserAccount } from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from '../utils/malayVoice';
import { Mission5RecordingPanel } from './Mission5RecordingPanel';

interface MissionDrawerProps {
  mission: MissionDef;
  user: UserAccount;
  m1CluesFound: string[];
  musicOn: boolean;
  musicVolume: number;
  onToggleMusic: () => void;
  onChangeMusicVolume: (vol: number) => void;
  onCollectClue: (clue: Clue3D) => void;
  onClose: () => void;
  onCompleteMission1: (score: number, tersurat: number, tersirat: number, evidence: string) => void;
  onCompleteMission2: (score: number, kbatScore: number, punca: string, kesan: string, kbat: string) => void;
  onCompleteMission3: (score: number, chosenOption: string, justification: string) => void;
  onCompleteMission4: (
    score: number,
    argument: { pendirian: string; bukti: string; huraian: string; kesimpulan: string },
    hasRecording: boolean,
    peerFeedback: string
  ) => void;
  onUpdateMission4Argument?: (argument: {
    pendirian: string;
    bukti: string;
    huraian: string;
    kesimpulan: string;
  }) => void;
  onCompleteMission5: (
    title: string,
    link: string,
    stepsDone: number[],
    rubricScore: number,
    reflection: string
  ) => void;
  m5IntroState?: { phase: 1 | 2 | 3 | 4 | 5; done: boolean };
  onSkipM5Intro?: () => void;
}

interface RoomMeta {
  gameTitle: string;
  subtitle: string;
  objective: string;
  startLabel: string;
  accentBorder: string;
  titleClass: string;
  btnClass: string;
}

const ROOM_META: Record<number, RoomMeta> = {
  1: {
    gameTitle: 'MISI 01: ZON SUNGAI TERCEMAR',
    subtitle: 'OPERASI MENCARI BUKTI',
    objective:
      'Dengar laporan penduduk dengan teliti dan kenal pasti maklumat penting termasuk maklumat tersurat dan tersirat.',
    startLabel: 'MULA MENYIASAT',
    accentBorder: 'border-emerald-400/70',
    titleClass: 'game-title-emerald',
    btnClass: 'btn-game-emerald text-slate-950',
  },
  2: {
    gameTitle: 'MISI 02: BANDAR UDARA BERACUN',
    subtitle: 'OPERASI ANALISIS PENCEMARAN',
    objective:
      'Analisis punca dan kesan pencemaran udara berdasarkan bahan audio dan visual serta jawab soalan pemikiran kritis.',
    startLabel: 'MULA MENGANALISIS',
    accentBorder: 'border-teal-400/70',
    titleClass: 'game-title-gold',
    btnClass: 'btn-game-cyan text-slate-950',
  },
  3: {
    gameTitle: 'MISI 03: HUTAN HARAPAN',
    subtitle: 'OPERASI PENYELAMATAN ALAM',
    objective:
      'Nilaikan cadangan penyelesaian masalah pencemaran dengan mengambil kira kelebihan dan cabarannya secara kritis.',
    startLabel: 'MULA CABARAN',
    accentBorder: 'border-emerald-400/75',
    titleClass: 'game-title-emerald',
    btnClass: 'btn-game-emerald text-slate-950',
  },
  4: {
    gameTitle: 'MISI 04: MAKMAL SUARA',
    subtitle: 'OPERASI BINA HUJAH',
    objective:
      'Bina hujah yang jelas dan berkeyakinan berdasarkan bukti serta latih penyampaian lisan dengan intonasi yang tepat.',
    startLabel: 'MULA BERTUTUR',
    accentBorder: 'border-sky-400/75',
    titleClass: 'game-title-gold',
    btnClass: 'btn-game-gold text-slate-950',
  },
  5: {
    gameTitle: 'MISI 05: OPERASI SELAMATKAN ECOWORLD',
    subtitle: 'MISI AKHIR – SUARAKAN PERUBAHAN!',
    objective:
      'KEMPEN DIGITAL: SELAMATKAN ECOWORLD! — "Bagaimanakah kita boleh meyakinkan masyarakat untuk mengambil tindakan terhadap masalah alam sekitar?"',
    startLabel: 'MULA MISI AKHIR',
    accentBorder: 'border-amber-400/80',
    titleClass: 'game-title-gold',
    btnClass: 'btn-game-gold text-slate-950',
  },
};

// Strict Malaysian Bahasa Melayu (ms-MY) voice selection via shared malayVoice utility

export function MissionDrawer({
  mission,
  user,
  m1CluesFound,
  musicOn,
  musicVolume,
  onToggleMusic,
  onChangeMusicVolume,
  onCollectClue,
  onClose,
  onCompleteMission1,
  onCompleteMission2,
  onCompleteMission3,
  onCompleteMission4,
  onUpdateMission4Argument,
  onCompleteMission5,
  m5IntroState,
  onSkipM5Intro,
}: MissionDrawerProps) {
  const p = user.progress!;
  const meta = ROOM_META[mission.id] || ROOM_META[1];
  const isM5 = mission.id === 5;
  const isM5IntroPending = isM5 && Boolean(m5IntroState && !m5IntroState.done);

  // Room Phase: 'briefing' (showcases 3D room entrance + title) -> 'activity' -> optional 'inspect3d'
  const [phase, setPhase] = useState<'briefing' | 'activity' | 'inspect3d'>('briefing');

  // Misi 1 state (unselected defaults so students must actively pick)
  const [m1Q1, setM1Q1] = useState('');
  const [m1Q2, setM1Q2] = useState('');
  const [m1Q3, setM1Q3] = useState('');
  const [m1Ev, setM1Ev] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const cachedTtsUrlRef = useRef<string | null>(null);

  // Misi 2 state (unselected defaults with wrong distractors)
  const [m2Scene, setM2Scene] = useState(0);
  const [m2A, setM2A] = useState('');
  const [m2B, setM2B] = useState('');
  const [m2Punca, setM2Punca] = useState(p.m2.thinkingMap?.punca || '');
  const [m2Kesan, setM2Kesan] = useState(p.m2.thinkingMap?.kesan || '');
  const [m2Kbat, setM2Kbat] = useState(p.m2.kbatAnswer || '');

  // Misi 3 state (must choose option deliberately)
  const [m3Choice, setM3Choice] = useState('');
  const [m3Just, setM3Just] = useState(p.m3.justification || '');

  // Misi 4 state
  const [m4P, setM4P] = useState(p.m4.argument?.pendirian || '');
  const [m4B, setM4B] = useState(p.m4.argument?.bukti || '');
  const [m4H, setM4H] = useState(p.m4.argument?.huraian || '');
  const [m4K, setM4K] = useState(p.m4.argument?.kesimpulan || '');
  const [m4Peer, setM4Peer] = useState(user.peerFeedback || '');
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recStatus, setRecStatus] = useState('Sedia merakam');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Misi 5 state (5 Dedicated Areas)
  const [m5Area, setM5Area] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [m5Steps, setM5Steps] = useState<number[]>(p.m5.stepsDone || []);
  const [m5Title, setM5Title] = useState(p.m5.title || '');
  const [m5Link, setM5Link] = useState(p.m5.link || '');
  const [m5Score, setM5Score] = useState<number>(p.m5.rubricScore || 85);
  const [m5Refl, setM5Refl] = useState(p.m5.reflection || '');

  // Misi 5 Area 2 (Hujah dari Makmal Suara) inline edit state
  const [m5EditingArg, setM5EditingArg] = useState(false);
  const [m5ArgDraft, setM5ArgDraft] = useState({
    pendirian: p.m4.argument?.pendirian || '',
    bukti: p.m4.argument?.bukti || '',
    huraian: p.m4.argument?.huraian || '',
    kesimpulan: p.m4.argument?.kesimpulan || '',
  });
  const [m5ArgError, setM5ArgError] = useState<string | null>(null);
  const [m5ArgSavedBanner, setM5ArgSavedBanner] = useState(false);

  // Wrong answer feedback with red X cross icon and retry explanation
  const [wrongFeedback, setWrongFeedback] = useState<{
    summary: string;
    fields: Record<string, string>;
  } | null>(null);

  const clearFieldError = (key: string) => {
    setWrongFeedback((prev) => {
      if (!prev || !prev.fields[key]) return prev;
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      if (Object.keys(nextFields).length === 0) return null;
      return { ...prev, fields: nextFields };
    });
  };

  useEffect(() => {
    setPhase('briefing');
    setM5Area(1);
    setWrongFeedback(null);
    setM5EditingArg(false);
    setM5ArgError(null);
    setM5ArgSavedBanner(false);
  }, [mission.id, user.id]);

  useEffect(() => {
    setM5ArgDraft({
      pendirian: p.m4.argument?.pendirian || '',
      bukti: p.m4.argument?.bukti || '',
      huraian: p.m4.argument?.huraian || '',
      kesimpulan: p.m4.argument?.kesimpulan || '',
    });
  }, [
    user.id,
    p.m4.argument?.pendirian,
    p.m4.argument?.bukti,
    p.m4.argument?.huraian,
    p.m4.argument?.kesimpulan,
  ]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const syncVoices = () => setVoicesList(window.speechSynthesis.getVoices());
    syncVoices();
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
    };
  }, []);

  useEffect(() => {
    if (m1CluesFound.length > 0) {
      const titles = m1CluesFound
        .map((id) => M1_CLUES_3D.find((c) => c.id === id)?.title)
        .filter(Boolean)
        .join(', ');
      setM1Ev(`Bukti 3D ditemui (${m1CluesFound.length}/3): ${titles}`);
    }
  }, [m1CluesFound]);

  useEffect(() => {
    return () => {
      setMusicState({ ducked: false });
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (cachedTtsUrlRef.current) {
        URL.revokeObjectURL(cachedTtsUrlRef.current);
        cachedTtsUrlRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const stopReportAudio = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsLoadingAudio(false);
    setIsPlayingAudio(false);
    setMusicState({ ducked: false });
  };

  const playSpeechFallbackFemale = () => {
    if (!('speechSynthesis' in window)) {
      setIsPlayingAudio(false);
      setMusicState({ ducked: false });
      return;
    }
    window.speechSynthesis.cancel();
    const liveVoices = window.speechSynthesis.getVoices();
    const pool = liveVoices.length > 0 ? liveVoices : voicesList;
    const { voice, isConfirmedFemale } = pickMalaysianSpeechVoice(pool, { preferFemale: true });
    if (!voice) {
      // Strict ms-MY guard: never fall back to Indonesian (id-ID) or English voices
      setIsPlayingAudio(false);
      setMusicState({ ducked: false });
      return;
    }
    const utter = new SpeechSynthesisUtterance(M1_SCRIPT);
    utter.voice = voice;
    utter.lang = voice.lang || 'ms-MY';
    utter.pitch = isConfirmedFemale ? 1.14 : 1.38;
    utter.rate = 0.94;
    utter.onstart = () => {
      setIsPlayingAudio(true);
      setMusicState({ ducked: true });
    };
    utter.onend = () => {
      setIsPlayingAudio(false);
      setMusicState({ ducked: false });
    };
    utter.onerror = () => {
      setIsPlayingAudio(false);
      setMusicState({ ducked: false });
    };
    window.speechSynthesis.speak(utter);
    setIsPlayingAudio(true);
    setMusicState({ ducked: true });
  };

  const playFemaleReportAudio = async () => {
    stopReportAudio();
    setIsLoadingAudio(true);

    try {
      let audioUrlToPlay = cachedTtsUrlRef.current;

      if (!audioUrlToPlay) {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: M1_SCRIPT,
            style: buildMalaysianTtsStyle(
              'Warm, clear, expressive Malaysian Malay woman speaking naturally as Puan Aminah, a village resident reporting river pollution to Year 6 pupils.'
            ),
          }),
        });
        if (!resp.ok) throw new Error('Server TTS unavailable');
        const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
        if (!data.audioBase64) throw new Error('Empty audio payload');

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrlToPlay = URL.createObjectURL(blob);
        cachedTtsUrlRef.current = audioUrlToPlay;
      }

      const audio = new Audio(audioUrlToPlay);
      ttsAudioRef.current = audio;
      audio.onplay = () => {
        setIsLoadingAudio(false);
        setIsPlayingAudio(true);
        setMusicState({ ducked: true });
      };
      audio.onended = () => {
        setIsPlayingAudio(false);
        setMusicState({ ducked: false });
      };
      audio.onerror = () => {
        setIsLoadingAudio(false);
        playSpeechFallbackFemale();
      };
      await audio.play();
    } catch {
      setIsLoadingAudio(false);
      playSpeechFallbackFemale();
    }
  };

  const handleStartRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        setMusicState({ ducked: false });
      };
      rec.start();
      setRecording(true);
      setMusicState({ ducked: true });
      setRecStatus('Sedang merakam hujah anda...');
    } catch {
      setRecStatus('Mikrofon disekat/tiada. Anda masih boleh berlatih secara lisan.');
      setMusicState({ ducked: false });
      playSFX('error');
    }
  };

  const handleStopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
      setMusicState({ ducked: false });
      setRecStatus('Rakaman suara berjaya disimpan!');
      playSFX('xp');
    }
  };

  const submitM1 = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (m1Q1 !== 'b') {
      fields.m1Q1 =
        'Salah! Dengar semula laporan Puan Aminah: air sungai bertukar hitam pekat dan berbau busuk.';
    }
    if (m1Q2 !== 'a') {
      fields.m1Q2 =
        'Salah! Dalam laporan audio, sisa kimia dibuang selepas waktu tengah malam ketika penduduk tidur.';
    }
    const kw = ['sembunyi', 'tidur', 'kesan', 'tangkap', 'rahsia', 'elak', 'penguat', 'nampak', 'senyap', 'malam'];
    const low = m1Q3.toLowerCase();
    if (m1Q3.trim().length < 15 || !kw.some((k) => low.includes(k))) {
      fields.m1Q3 =
        'Jawapan tersirat kurang tepat: Nyatakan sebab tersembunyi (contoh: mengelak daripada dikesan atau ketika penduduk tidur).';
    }
    if (Object.keys(fields).length > 0) {
      playSFX('error');
      setWrongFeedback({
        summary: 'Jawapan anda masih belum tepat. Sila semak sebab kesalahan bertanda ❌ dan jawab semula!',
        fields,
      });
      return;
    }

    setWrongFeedback(null);
    stopReportAudio();
    const tersurat = 100;
    const tersirat = 90;
    const bonus = m1CluesFound.length >= 3 ? 10 : 0;
    const total = Math.min(100, Math.round((tersurat + tersirat) / 2) + bonus);
    onCompleteMission1(total, tersurat, tersirat, m1Ev.trim());
  };

  const submitM2 = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (m2A !== 'ok') {
      fields.m2A =
        'Salah! Asap kenderaan dan jerebu mencemarkan udara lalu menjejaskan sistem pernafasan dan menyebabkan asma.';
    }
    if (m2B !== 'ok') {
      fields.m2B =
        'Salah! Gas sulfur dioksida daripada kilang membentuk hujan asid yang merosakkan tumbuhan dan pokok.';
    }
    if (m2Kbat.trim().length < 15) {
      fields.m2Kbat =
        'Jawapan KBAT terlalu ringkas! Huraikan kesan jangka panjang kepada kesihatan murid atau sesi persekolahan.';
    }
    if (Object.keys(fields).length > 0) {
      playSFX('error');
      setWrongFeedback({
        summary: 'Analisis pencemaran mengandungi kesilapan. Sila betulkan bahagian bertanda ❌ dan hantar semula!',
        fields,
      });
      return;
    }

    setWrongFeedback(null);
    const match = 100;
    const kbatScore = m2Kbat.trim().length >= 30 ? 90 : 75;
    const total = Math.round((match + kbatScore) / 2);
    onCompleteMission2(total, kbatScore, m2Punca.trim(), m2Kesan.trim(), m2Kbat.trim());
  };

  const submitM3 = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Record<string, string> = {};
    const chosen = M3_OPTS.find((o) => o.id === m3Choice);
    if (!chosen || m3Choice !== 'o2') {
      fields.m3Choice =
        m3Choice === 'o1'
          ? 'Pilihan A kurang seimbang kerana menutup semua kilang akan menyebabkan ramai pekerja hilang punca pendapatan.'
          : m3Choice === 'o3'
          ? 'Pilihan C tidak berkesan kerana mengedar topeng muka sahaja tidak menghapuskan punca pencemaran udara.'
          : 'Sila pilih penyelesaian paling seimbang untuk alam sekitar dan masyarakat.';
    }
    if (m3Just.trim().length < 15) {
      fields.m3Just =
        'Justifikasi terlalu ringkas! Terangkan alasan kritis anda sekurang-kurangnya 1 ayat lengkap.';
    }
    if (Object.keys(fields).length > 0) {
      playSFX('error');
      setWrongFeedback({
        summary: 'Pilihan penyelesaian belum paling seimbang. Baca sebab bertanda ❌ dan jawab semula!',
        fields,
      });
      return;
    }

    setWrongFeedback(null);
    const total = m3Just.trim().length >= 25 ? 100 : 85;
    onCompleteMission3(total, chosen!.t, m3Just.trim());
  };

  const submitM4 = (e: React.FormEvent) => {
    e.preventDefault();
    const hasRec = Boolean(audioUrl) || p.m4.hasRecording;
    const score = Math.min(100, 75 + (hasRec ? 15 : 5) + (m4Peer.trim().length > 5 ? 10 : 0));
    onCompleteMission4(
      score,
      {
        pendirian: m4P.trim(),
        bukti: m4B.trim(),
        huraian: m4H.trim(),
        kesimpulan: m4K.trim(),
      },
      hasRec,
      m4Peer.trim()
    );
  };

  const submitM5 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!m5Title.trim() || !m5Link.trim() || !m5Refl.trim()) {
      setM5Area(!m5Title.trim() || !m5Link.trim() ? 4 : 5);
      playSFX('error');
      return;
    }
    onCompleteMission5(m5Title.trim(), m5Link.trim(), m5Steps, m5Score, m5Refl.trim());
  };

  // Shared Audio Bar inside Mission Room HUD
  const audioControlBar = (
    <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700 rounded-xl px-2.5 py-1.5">
      <button
        type="button"
        onClick={onToggleMusic}
        className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1 cursor-pointer"
        title="Muzik Latar Buka/Tutup"
      >
        {musicOn ? <Music className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
        <span className="hidden sm:inline">{musicOn ? 'Muzik' : 'Senyap'}</span>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={musicOn ? Math.round(musicVolume * 100) : 0}
        onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
        aria-label="Laras kelantangan muzik"
        className="w-16 sm:w-20 accent-emerald-400 cursor-pointer"
      />
    </div>
  );

  // ===========================================================================
  // INSPECT 3D ROOM MODE (Full unobstructed view of the 3D Virtual Mission Room)
  // ===========================================================================
  if (phase === 'inspect3d') {
    return (
      <div className="fixed top-14 inset-x-0 z-40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto px-4 py-2 rounded-2xl bg-slate-950/90 border border-emerald-400/60 shadow-xl">
          <div className={`text-sm sm:text-base font-black ${meta.titleClass}`}>{meta.gameTitle}</div>
          <div className="text-[11px] text-teal-300 font-semibold">
            Seret tetikus untuk tinjau bilik 3D · Klik panel aktiviti apabila sedia
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {audioControlBar}
          <button
            type="button"
            onClick={() => {
              playSFX('click');
              setPhase('activity');
            }}
            className={`px-4 py-2 font-game text-xs font-black cursor-pointer ${meta.btnClass}`}
          >
            BUKA PANEL MISI
          </button>
          <button
            type="button"
            onClick={() => {
              stopReportAudio();
              playSFX('click');
              onClose();
            }}
            className="btn-game-gold btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> KEMBALI KE PETA MISI
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // BRIEFING / ROOM ENTRANCE MODE (Showcases 3D Virtual Room behind clean HUD)
  // ===========================================================================
  if (phase === 'briefing') {
    const phaseLabels: Record<1 | 2 | 3 | 4 | 5, string> = {
      1: 'FASA 1/5 · PENGENALAN STUDIO PODCAST',
      2: 'FASA 2/5 · EJEN MEMASUKI STUDIO',
      3: 'FASA 3/5 · EJEN MENUJU KE PENTAS',
      4: 'FASA 4/5 · EJEN DUDUK DI KERUSI HOS',
      5: 'FASA 5/5 · SIARAN LANGSUNG ON AIR!',
    };
    const activePhaseNum = m5IntroState?.phase ?? 1;

    return (
      <div className="fixed inset-0 top-12 z-40 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
        {/* Top Room Entrance HUD */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 max-w-6xl w-full mx-auto">
          <button
            type="button"
            onClick={() => {
              stopReportAudio();
              playSFX('click');
              onClose();
            }}
            className="btn-game-gold btn-game-sm px-4 py-2 text-slate-950 font-game text-xs font-black flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> KEMBALI KE PETA MISI
          </button>

          <div className="flex items-center gap-2">
            {audioControlBar}
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-game text-amber-300 ${
                isM5
                  ? 'bg-slate-950/75 backdrop-blur-xl border border-cyan-400/70 shadow-[0_0_20px_rgba(34,211,238,0.28)]'
                  : 'bg-slate-950/90 border border-emerald-400/60'
              }`}
            >
              ⭐ +{mission.maxXp} XP · BILIK 3D AKTIF
            </div>
          </div>
        </div>

        {/* During Misi 05 5-Phase Broadcast Intro: keep studio center completely clear */}
        {isM5IntroPending ? (
          <div className="pointer-events-auto max-w-xl w-full mx-auto rounded-2xl bg-slate-950/75 backdrop-blur-xl border border-cyan-400/70 shadow-[0_0_32px_rgba(168,85,247,0.35)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    activePhaseNum === 5
                      ? 'bg-pink-500 animate-ping'
                      : 'bg-cyan-400 animate-pulse'
                  }`}
                />
                <span className="font-game text-xs sm:text-sm font-black tracking-wider text-cyan-200 truncate">
                  {phaseLabels[activePhaseNum]}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 transition-all duration-300"
                  style={{ width: `${(activePhaseNum / 5) * 100}%` }}
                />
              </div>
            </div>
            {onSkipM5Intro && (
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  onSkipM5Intro();
                }}
                className="btn-game-slate btn-game-sm px-3 py-1.5 text-[11px] font-game font-bold text-cyan-200 hover:text-white cursor-pointer shrink-0"
              >
                Langkau Intro →
              </button>
            )}
          </div>
        ) : (
          /* Bottom-Center Entrance Card leaving upper/center 3D Room clearly visible */
          <div
            className={`pointer-events-auto max-w-3xl w-full mx-auto rounded-3xl p-5 sm:p-7 shadow-2xl text-center space-y-4 ${
              isM5
                ? 'bg-slate-950/74 backdrop-blur-xl border-2 border-cyan-400/75 shadow-[0_0_40px_rgba(168,85,247,0.35)]'
                : `bg-slate-950/90 border-2 ${meta.accentBorder}`
            }`}
          >
            <div className="space-y-1.5">
              <div className="game-subtitle-neon text-xs sm:text-sm font-bold tracking-[0.22em] text-teal-300 uppercase">
                {meta.subtitle}
              </div>
              <h2 className={`text-2xl sm:text-4xl font-black tracking-wide leading-tight ${meta.titleClass}`}>
                {meta.gameTitle}
              </h2>
            </div>

            <div
              className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl mx-auto ${
                isM5
                  ? 'bg-slate-900/75 backdrop-blur-md border border-purple-400/45'
                  : 'bg-slate-900/95 border border-slate-700'
              }`}
            >
              <span className="font-game text-[11px] text-amber-300 block mb-1 uppercase tracking-wider">
                OBJEKTIF MISI ({mission.focus})
              </span>
              {meta.objective}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  playSFX('portal');
                  setPhase('activity');
                }}
                className={`px-7 py-3.5 font-game text-sm sm:text-base font-black tracking-wider uppercase flex items-center gap-2 cursor-pointer ${meta.btnClass}`}
              >
                <Rocket className="w-4 h-4" /> {meta.startLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setPhase('inspect3d');
                }}
                className="btn-game-slate px-5 py-3.5 text-sky-200 font-game text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" /> TINJAU BILIK 3D
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // ACTIVE HOLOGRAPHIC ACTIVITY PANEL (Side panel keeping 3D Room visible on left)
  // ===========================================================================
  return (
    <div className="fixed inset-0 top-12 z-40 flex items-center justify-end p-3 md:p-5 pb-24 sm:pb-24 pointer-events-none">
      <div
        className={`pointer-events-auto w-full max-w-2xl max-h-[calc(100vh-148px)] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ${
          isM5
            ? 'bg-slate-950/78 backdrop-blur-xl border-2 border-cyan-400/70 shadow-[0_0_40px_rgba(34,211,238,0.28)]'
            : `bg-slate-950/95 border-2 ${meta.accentBorder}`
        }`}
      >
        {/* Holographic Header */}
        <div
          className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
            isM5
              ? 'bg-slate-900/75 border-cyan-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="min-w-0">
            <div className="game-subtitle-neon text-[11px] font-bold tracking-widest text-teal-300 uppercase">
              {meta.subtitle} · ⭐ +{mission.maxXp} XP
            </div>
            <h2 className={`text-lg sm:text-xl font-black truncate ${meta.titleClass}`}>
              {meta.gameTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {audioControlBar}
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setPhase('inspect3d');
              }}
              title="Tinjau Bilik 3D"
              className="btn-game-slate btn-game-sm p-2 text-sky-300 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopReportAudio();
                playSFX('click');
                onClose();
              }}
              className="btn-game-gold btn-game-sm px-3 py-2 text-slate-950 font-game text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> KEMBALI KE PETA MISI
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto eco-scroll space-y-5">
          {mission.id === 1 && (
            <>
              {/* 3D Sample / Evidence Checklist */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-game text-xs font-bold text-emerald-300 uppercase">
                    Sampel & Bukti Makmal Sungai ({m1CluesFound.length}/3 ditemui)
                  </span>
                  <span className="text-[11px] text-slate-400">Tandai bukti siasatan anda</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {M1_CLUES_3D.map((clue) => {
                    const found = m1CluesFound.includes(clue.id);
                    return (
                      <button
                        key={clue.id}
                        type="button"
                        onClick={() => onCollectClue(clue)}
                        className={`btn-game-sm p-2.5 text-left text-xs cursor-pointer ${
                          found
                            ? 'btn-game-emerald text-slate-950 font-black'
                            : 'btn-game-slate text-slate-200'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          {found ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : '🧪'}{' '}
                          {clue.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Female Resident Audio Report (Puan Aminah) */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-sky-500/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-game font-bold text-sky-300 text-sm">
                      👩🏽 Laporan Audio Puan Aminah (Suara Wanita)
                    </div>
                    <div className="text-xs text-slate-400">Wakil Penduduk Kampung Sungai Jernih</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-end gap-1 h-7">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          style={{ animationDelay: `${i * 0.1}s` }}
                          className={`w-1.5 rounded-full bg-sky-400 transition-all ${
                            isPlayingAudio ? 'h-7 wave-bar-active bg-emerald-400' : 'h-2.5'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isLoadingAudio}
                      onClick={playFemaleReportAudio}
                      className="btn-game-emerald btn-game-sm px-3.5 py-1.5 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> {isLoadingAudio ? 'Menjana...' : 'Dengar'}
                    </button>
                    <button
                      type="button"
                      onClick={stopReportAudio}
                      className="btn-game-rose btn-game-sm px-3 py-1.5 text-white text-xs font-bold cursor-pointer"
                    >
                      Henti
                    </button>
                  </div>
                </div>
                <details className="mt-3 text-xs text-slate-300">
                  <summary className="cursor-pointer text-amber-300 font-semibold">
                    Baca transkrip laporan (sokongan bacaan)
                  </summary>
                  <p className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 leading-relaxed">
                    "{M1_SCRIPT}"
                  </p>
                </details>
              </div>

              <form onSubmit={submitM1} className="space-y-4">
                {wrongFeedback && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-game font-black text-rose-300 uppercase">
                        ❌ JAWAPAN KURANG TEPAT — JAWAB SEMULA
                      </div>
                      <p>{wrongFeedback.summary}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      1. (Tersurat) Apakah warna & bau air sungai?
                    </label>
                    <select
                      required
                      value={m1Q1}
                      onChange={(e) => {
                        setM1Q1(e.target.value);
                        clearFieldError('m1Q1');
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-sm ${
                        wrongFeedback?.fields.m1Q1 ? 'border-rose-500' : 'border-slate-700'
                      }`}
                    >
                      <option value="">-- Pilih Jawapan --</option>
                      <option value="a">Jernih dan berbau wangi bunga</option>
                      <option value="c">Kehijauan dan berbau lumpur biasa</option>
                      <option value="b">Hitam pekat dan berbau busuk</option>
                      <option value="d">Kekuningan dan berbau klorin</option>
                    </select>
                    {wrongFeedback?.fields.m1Q1 && (
                      <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                        <span>❌</span>
                        <span>{wrongFeedback.fields.m1Q1}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      2. (Tersurat) Bilakah sisa dibuang ke sungai?
                    </label>
                    <select
                      required
                      value={m1Q2}
                      onChange={(e) => {
                        setM1Q2(e.target.value);
                        clearFieldError('m1Q2');
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-sm ${
                        wrongFeedback?.fields.m1Q2 ? 'border-rose-500' : 'border-slate-700'
                      }`}
                    >
                      <option value="">-- Pilih Jawapan --</option>
                      <option value="b">Waktu pagi sebelum subuh</option>
                      <option value="c">Tengah hari ketika cuaca panas</option>
                      <option value="d">Petang selepas waktu persekolahan</option>
                      <option value="a">Selepas waktu tengah malam</option>
                    </select>
                    {wrongFeedback?.fields.m1Q2 && (
                      <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                        <span>❌</span>
                        <span>{wrongFeedback.fields.m1Q2}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    3. (Tersirat) Mengapakah kilang memilih waktu tengah malam untuk membuang sisa?
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={m1Q3}
                    onChange={(e) => {
                      setM1Q3(e.target.value);
                      clearFieldError('m1Q3');
                    }}
                    placeholder="Tulis inferens / maksud tersirat anda..."
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-white text-sm ${
                      wrongFeedback?.fields.m1Q3 ? 'border-rose-500' : 'border-slate-700'
                    }`}
                  />
                  {wrongFeedback?.fields.m1Q3 && (
                    <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                      <span>❌</span>
                      <span>{wrongFeedback.fields.m1Q3}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    4. Catatan Bukti untuk Buku Bukti:
                  </label>
                  <input
                    required
                    value={m1Ev}
                    onChange={(e) => setM1Ev(e.target.value)}
                    placeholder="Klik sampel bukti di atas atau tulis pemerhatian anda..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-game-emerald w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
                >
                  Hantar Laporan & Pulihkan Sungai
                </button>
              </form>
            </>
          )}

          {mission.id === 2 && (
            <>
              <div className="p-5 rounded-2xl bg-slate-900 border border-teal-400/50 text-center">
                <div className="font-game text-[11px] font-bold text-amber-300 mb-2 uppercase">
                  Taklimat Visual & Analisis Pencemaran Udara
                </div>
                <div className="text-5xl mb-2">{M2_SCENES[m2Scene].icon}</div>
                <h3 className="font-game text-base sm:text-lg font-bold text-teal-300">
                  {M2_SCENES[m2Scene].title}
                </h3>
                <p className="text-sm text-slate-300 mt-1 mb-4 max-w-md mx-auto">
                  {M2_SCENES[m2Scene].text}
                </p>
                <div className="flex justify-center gap-2">
                  {M2_SCENES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playSFX('click');
                        setM2Scene(idx);
                      }}
                      className={`btn-game-sm px-3 py-1.5 font-game text-xs font-bold cursor-pointer ${
                        m2Scene === idx
                          ? 'btn-game-gold text-slate-950'
                          : 'btn-game-slate text-slate-200'
                      }`}
                    >
                      Babak {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={submitM2} className="space-y-4">
                {wrongFeedback && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-game font-black text-rose-300 uppercase">
                        ❌ JAWAPAN KURANG TEPAT — JAWAB SEMULA
                      </div>
                      <p>{wrongFeedback.summary}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Padanan A: Asap kenderaan bermotor & jerebu
                    </label>
                    <select
                      required
                      value={m2A}
                      onChange={(e) => {
                        setM2A(e.target.value);
                        clearFieldError('m2A');
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-sm ${
                        wrongFeedback?.fields.m2A ? 'border-rose-500' : 'border-slate-700'
                      }`}
                    >
                      <option value="">-- Pilih Padanan --</option>
                      <option value="no1">Menyebabkan air laut menjadi masin</option>
                      <option value="ok">Menyebabkan masalah pernafasan & asma</option>
                      <option value="no2">Menambah kesuburan tanah pertanian</option>
                    </select>
                    {wrongFeedback?.fields.m2A && (
                      <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                        <span>❌</span>
                        <span>{wrongFeedback.fields.m2A}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Padanan B: Gas sulfur dioksida kilang
                    </label>
                    <select
                      required
                      value={m2B}
                      onChange={(e) => {
                        setM2B(e.target.value);
                        clearFieldError('m2B');
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-sm ${
                        wrongFeedback?.fields.m2B ? 'border-rose-500' : 'border-slate-700'
                      }`}
                    >
                      <option value="">-- Pilih Padanan --</option>
                      <option value="no1">Menyuburkan tanaman sayuran hijau</option>
                      <option value="no2">Menyejukkan suhu persekitaran bandar</option>
                      <option value="ok">Membentuk hujan asid merosakkan tumbuhan</option>
                    </select>
                    {wrongFeedback?.fields.m2B && (
                      <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                        <span>❌</span>
                        <span>{wrongFeedback.fields.m2B}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Peta Pemikiran: Punca Utama
                    </label>
                    <input
                      required
                      value={m2Punca}
                      onChange={(e) => setM2Punca(e.target.value)}
                      placeholder="Contoh: Asap kilang & pembakaran terbuka"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Peta Pemikiran: Kesan Jangka Panjang
                    </label>
                    <input
                      required
                      value={m2Kesan}
                      onChange={(e) => setM2Kesan(e.target.value)}
                      placeholder="Contoh: Jerebu, asma & hujan asid"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Soalan KBAT: Apakah kesan terhadap murid sekolah jika udara kekal beracun selama 6 bulan?
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={m2Kbat}
                    onChange={(e) => {
                      setM2Kbat(e.target.value);
                      clearFieldError('m2Kbat');
                    }}
                    placeholder="Huraikan ramalan kritis anda..."
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-white text-sm ${
                      wrongFeedback?.fields.m2Kbat ? 'border-rose-500' : 'border-slate-700'
                    }`}
                  />
                  {wrongFeedback?.fields.m2Kbat && (
                    <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                      <span>❌</span>
                      <span>{wrongFeedback.fields.m2Kbat}</span>
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn-game-cyan w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
                >
                  Lengkapkan Analisis & Bersihkan Jerebu
                </button>
              </form>
            </>
          )}

          {mission.id === 3 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {M3_OPTS.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      playSFX('click');
                      setM3Choice(opt.id);
                      clearFieldError('m3Choice');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                      m3Choice === opt.id
                        ? 'bg-emerald-950/70 border-amber-400 shadow-lg'
                        : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="font-game font-bold text-xs text-white mb-2">{opt.t}</div>
                    <div className="text-xs text-emerald-300 mb-1">Kelebihan: {opt.p}</div>
                    <div className="text-xs text-rose-300">Cabaran: {opt.c}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={submitM3} className="space-y-4">
                {wrongFeedback && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-game font-black text-rose-300 uppercase">
                        ❌ JAWAPAN KURANG TEPAT — JAWAB SEMULA
                      </div>
                      <p>{wrongFeedback.summary}</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Pilihan Penyelesaian Paling Seimbang
                  </label>
                  <select
                    required
                    value={m3Choice}
                    onChange={(e) => {
                      setM3Choice(e.target.value);
                      clearFieldError('m3Choice');
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl bg-slate-900 border text-white text-sm ${
                      wrongFeedback?.fields.m3Choice ? 'border-rose-500' : 'border-slate-700'
                    }`}
                  >
                    <option value="">-- Pilih Cadangan Penyelesaian --</option>
                    {M3_OPTS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.t}
                      </option>
                    ))}
                  </select>
                  {wrongFeedback?.fields.m3Choice && (
                    <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                      <span>❌</span>
                      <span>{wrongFeedback.fields.m3Choice}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Justifikasi & Alasan Kritis Anda
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={m3Just}
                    onChange={(e) => {
                      setM3Just(e.target.value);
                      clearFieldError('m3Just');
                    }}
                    placeholder="Pada pendapat saya, cadangan ini paling berkesan kerana..."
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-white text-sm ${
                      wrongFeedback?.fields.m3Just ? 'border-rose-500' : 'border-slate-700'
                    }`}
                  />
                  {wrongFeedback?.fields.m3Just && (
                    <p className="mt-1.5 text-xs text-rose-300 font-semibold flex items-start gap-1">
                      <span>❌</span>
                      <span>{wrongFeedback.fields.m3Just}</span>
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn-game-emerald w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
                >
                  Sahkan Justifikasi & Pulihkan Hutan
                </button>
              </form>
            </>
          )}

          {mission.id === 4 && (
            <>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-sky-500/50 text-xs text-slate-300">
                <strong className="text-amber-300 font-game">PANDUAN BERTUTUR (SP 1.2.2):</strong> Sebutan baku jelas · Intonasi bersemangat pada isi penting · Gunakan penanda wacana (<em>Buktinya, Oleh itu, Tegasnya</em>).
              </div>
              <form onSubmit={submitM4} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      1. Pendirian
                    </label>
                    <input
                      required
                      value={m4P}
                      onChange={(e) => setM4P(e.target.value)}
                      placeholder="Saya berpendapat pencemaran mesti dihentikan..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      2. Bukti Tersurat & Tersirat
                    </label>
                    <input
                      required
                      value={m4B}
                      onChange={(e) => setM4B(e.target.value)}
                      placeholder="Buktinya, laporan Puan Aminah mendedahkan..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      3. Huraian Kritis & Cadangan
                    </label>
                    <input
                      required
                      value={m4H}
                      onChange={(e) => setM4H(e.target.value)}
                      placeholder="Oleh itu, penapis asap wajib dipasang..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      4. Kesimpulan / Seruan
                    </label>
                    <input
                      required
                      value={m4K}
                      onChange={(e) => setM4K(e.target.value)}
                      placeholder="Tegasnya, marilah kita selamatkan bumi!"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                  </div>
                </div>

                {/* Microphone Recorder */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-game font-bold text-emerald-400 text-xs uppercase">
                      Studio Rakaman Suara Hujah
                    </div>
                    <span className="text-xs text-amber-300">{recStatus}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={recording}
                      onClick={handleStartRec}
                      className="btn-game-emerald px-4 py-2 rounded-xl disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" /> Mula Rakam
                    </button>
                    <button
                      type="button"
                      disabled={!recording}
                      onClick={handleStopRec}
                      className="btn-game-rose btn-game-sm px-3.5 py-2 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" /> Henti
                    </button>
                  </div>
                  {audioUrl && (
                    <audio
                      controls
                      src={audioUrl}
                      onPlay={() => setMusicState({ ducked: true })}
                      onPause={() => setMusicState({ ducked: false })}
                      onEnded={() => setMusicState({ ducked: false })}
                      className="w-full h-9"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Semakan Kendiri / Rakan Sebaya
                  </label>
                  <input
                    value={m4Peer}
                    onChange={(e) => setM4Peer(e.target.value)}
                    placeholder="Sebutan baku jelas dan intonasi saya semakin yakin..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-game-gold w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
                >
                  Simpan Hujah & Buka Misi Akhir
                </button>
              </form>
            </>
          )}

          {mission.id === 5 && (
            <>
              <div className="p-3.5 rounded-2xl bg-amber-950/35 border border-amber-400/50 text-xs text-amber-100">
                <strong className="text-amber-300 font-game">SOALAN PEMACU:</strong>{' '}
                <em>
                  "Bagaimanakah kita boleh meyakinkan masyarakat untuk mengambil tindakan terhadap masalah alam sekitar?"
                </em>
              </div>

              {/* 5 Dedicated Areas Navigation */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  [1, '1. Rancang'],
                  [2, '2. Hujah'],
                  [3, '3. Produksi'],
                  [4, '4. Hantar'],
                  [5, '5. Bentang'],
                ].map(([num, label]) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      setM5Area(num as 1 | 2 | 3 | 4 | 5);
                    }}
                    className={`btn-game-sm py-2 px-1 font-game text-[10px] sm:text-[11px] font-bold text-center cursor-pointer ${
                      m5Area === num
                        ? 'btn-game-gold text-slate-950'
                        : 'btn-game-slate text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitM5} className="space-y-4">
                {m5Area === 1 && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="font-game text-xs font-bold text-emerald-300 uppercase">
                      Kawasan 1: Perancangan Kempen Digital (9 Langkah Projek)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {PBL_STEPS.map((st, idx) => {
                        const checked = m5Steps.includes(idx);
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer ${
                              checked
                                ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-100'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) setM5Steps([...m5Steps, idx]);
                                else setM5Steps(m5Steps.filter((x) => x !== idx));
                              }}
                              className="accent-emerald-500"
                            />
                            {st}
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setM5Area(2)}
                      className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
                    >
                      Seterusnya: Penyediaan Hujah →
                    </button>
                  </div>
                )}

                {m5Area === 2 && (() => {
                  const m4Items: {
                    key: 'pendirian' | 'bukti' | 'huraian' | 'kesimpulan';
                    num: string;
                    label: string;
                    val: string;
                    borderCls: string;
                    labelCls: string;
                  }[] = [
                    {
                      key: 'pendirian',
                      num: '1',
                      label: 'Pendirian',
                      val: p.m4.argument?.pendirian || '',
                      borderCls: 'border-emerald-500/40',
                      labelCls: 'text-emerald-300',
                    },
                    {
                      key: 'bukti',
                      num: '2',
                      label: 'Bukti Utama',
                      val: p.m4.argument?.bukti || '',
                      borderCls: 'border-cyan-500/40',
                      labelCls: 'text-cyan-300',
                    },
                    {
                      key: 'huraian',
                      num: '3',
                      label: 'Huraian & Cadangan',
                      val: p.m4.argument?.huraian || '',
                      borderCls: 'border-amber-500/40',
                      labelCls: 'text-amber-300',
                    },
                    {
                      key: 'kesimpulan',
                      num: '4',
                      label: 'Seruan / Kesimpulan',
                      val: p.m4.argument?.kesimpulan || '',
                      borderCls: 'border-violet-500/40',
                      labelCls: 'text-violet-300',
                    },
                  ];
                  const hasAnyM4 = m4Items.some((item) => item.val.trim().length > 0);

                  return (
                    <div className="p-4 rounded-2xl bg-slate-900 border border-cyan-500/40 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-game text-xs font-bold text-sky-300 uppercase">
                            Kawasan 2: Penyediaan Hujah Kritis (Dari Makmal Suara)
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Dipaparkan secara automatik daripada hasil hujah kamu dalam Misi 4.
                          </p>
                        </div>

                        {onUpdateMission4Argument && (
                          <button
                            type="button"
                            onClick={() => {
                              playSFX('click');
                              setM5ArgError(null);
                              setM5ArgSavedBanner(false);
                              if (!m5EditingArg) {
                                setM5ArgDraft({
                                  pendirian: p.m4.argument?.pendirian || '',
                                  bukti: p.m4.argument?.bukti || '',
                                  huraian: p.m4.argument?.huraian || '',
                                  kesimpulan: p.m4.argument?.kesimpulan || '',
                                });
                              }
                              setM5EditingArg((prev) => !prev);
                            }}
                            className="btn-game-cyan btn-game-sm px-3 py-1.5 rounded-xl text-slate-950 font-game text-[11px] font-black cursor-pointer"
                          >
                            {m5EditingArg ? 'Batal Edit' : 'Edit Hujah'}
                          </button>
                        )}
                      </div>

                      {!hasAnyM4 && !m5EditingArg && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-200">
                          Hujah kamu daripada Misi 4 belum diisi lagi. Sila lengkapkan Misi 4: Makmal Suara atau tekan <strong>Edit Hujah</strong> untuk mengisinya.
                        </div>
                      )}

                      {m5ArgSavedBanner && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                          <span>Kemas kini hujah berjaya disimpan untuk rekod Misi 4 &amp; Misi 5!</span>
                        </div>
                      )}

                      {m5ArgError && (
                        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/50 text-xs text-rose-200 font-semibold">
                          {m5ArgError}
                        </div>
                      )}

                      {m5EditingArg ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            {m4Items.map((item) => (
                              <div
                                key={item.key}
                                className={`p-3 rounded-xl bg-slate-950 border ${item.borderCls} space-y-1.5`}
                              >
                                <label className={`${item.labelCls} font-bold block`}>
                                  {item.num}. {item.label}:
                                </label>
                                <textarea
                                  rows={3}
                                  value={m5ArgDraft[item.key]}
                                  onChange={(e) => {
                                    setM5ArgDraft((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.value,
                                    }));
                                    if (m5ArgError) setM5ArgError(null);
                                  }}
                                  placeholder={`Tulis ${item.label.toLowerCase()} kamu di sini...`}
                                  className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 resize-none"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const cleaned = {
                                  pendirian: m5ArgDraft.pendirian.trim(),
                                  bukti: m5ArgDraft.bukti.trim(),
                                  huraian: m5ArgDraft.huraian.trim(),
                                  kesimpulan: m5ArgDraft.kesimpulan.trim(),
                                };
                                if (
                                  cleaned.pendirian.length < 5 ||
                                  cleaned.bukti.length < 5 ||
                                  cleaned.huraian.length < 5 ||
                                  cleaned.kesimpulan.length < 5
                                ) {
                                  playSFX('error');
                                  setM5ArgError(
                                    'Sila pastikan kesemua 4 komponen hujah diisi dengan lengkap sebelum menyimpan.'
                                  );
                                  return;
                                }
                                onUpdateMission4Argument?.(cleaned);
                                playSFX('xp');
                                setM5EditingArg(false);
                                setM5ArgSavedBanner(true);
                              }}
                              className="btn-game-gold btn-game-sm px-4 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
                            >
                              Simpan Kemas Kini Hujah
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          {m4Items.map((item) => {
                            const hasValue = item.val.trim().length > 0;
                            return (
                              <div
                                key={item.key}
                                className={`p-3 rounded-xl bg-slate-950 border ${item.borderCls}`}
                              >
                                <span className={`${item.labelCls} font-bold block mb-1`}>
                                  {item.num}. {item.label}:
                                </span>
                                <span className={hasValue ? 'text-slate-100 leading-relaxed' : 'text-slate-500 italic'}>
                                  {hasValue ? item.val : 'Belum diisi di Misi 4'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setM5Area(3)}
                        className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
                      >
                        Seterusnya: Produksi Audio / Video →
                      </button>
                    </div>
                  );
                })()}

                {m5Area === 3 && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5">
                    <div className="font-game text-xs font-bold text-teal-300 uppercase">
                      Kawasan 3: Studio Produksi Audio / Video Kempen
                    </div>
                    <Mission5RecordingPanel
                      user={user}
                      campaignTitle={m5Title}
                      onSubmissionSuccess={(saved) => {
                        if (!m5Title.trim()) {
                          setM5Title(saved.campaignTitle || 'Kempen Selamatkan EcoWorld');
                        }
                        if (!m5Link.trim() || m5Link.startsWith('/api/submissions/')) {
                          setM5Link(saved.mediaUrl || `/api/submissions/${saved.id}/media`);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setM5Area(4)}
                      className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
                    >
                      Seterusnya: Penghantaran Projek →
                    </button>
                  </div>
                )}

                {m5Area === 4 && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="font-game text-xs font-bold text-amber-300 uppercase">
                      Kawasan 4: Penghantaran Projek Kempen Digital
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Tajuk Kempen Audio / Video
                        </label>
                        <input
                          required
                          value={m5Title}
                          onChange={(e) => setM5Title(e.target.value)}
                          placeholder="Selamatkan Sungai Kita"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Pautan Fail / Video / Audio
                        </label>
                        <input
                          required
                          value={m5Link}
                          onChange={(e) => setM5Link(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Skor Rubrik Kendiri (50–100):{' '}
                        <span className="font-mono-num text-amber-300">{m5Score}%</span>
                      </label>
                      <input
                        type="range"
                        min={50}
                        max={100}
                        value={m5Score}
                        onChange={(e) => setM5Score(Number(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setM5Area(5)}
                      className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
                    >
                      Seterusnya: Pembentangan & Maklum Balas →
                    </button>
                  </div>
                )}

                {m5Area === 5 && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-amber-400/50 space-y-3">
                    <div className="font-game text-xs font-bold text-amber-300 uppercase">
                      Kawasan 5: Pembentangan, Refleksi & Maklum Balas
                    </div>
                    {user.teacherFeedback && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-sky-200">
                        <strong>Maklum Balas Guru:</strong> {user.teacherFeedback}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Refleksi Pembelajaran & Kesimpulan Kempen
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={m5Refl}
                        onChange={(e) => setM5Refl(e.target.value)}
                        placeholder="Apakah nilai dan kemahiran yang anda pelajari melalui misi EcoWorld 3D ini?"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-game-gold w-full py-3.5 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" /> Hantar Kempen Digital
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
