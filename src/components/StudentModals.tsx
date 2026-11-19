import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  MessageCircle,
  Printer,
  Shield,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { AVATARS, BADGES_DEF } from '../data/gameData';
import { AvatarId, MissionDef, UserAccount } from '../types/game';
import { downloadCertificatePdf } from '../utils/certificatePdf';
import { playSFX, setMusicState } from '../utils/sound';
import { calcLevel, calcOverallScore, computeAIGuide } from '../utils/storage';
import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from '../utils/malayVoice';
import { Agent3DStage } from './Agent3DStage';

let greetingSessionSeq = 0;
let activeGreetingAudio: HTMLAudioElement | null = null;
const greetingTtsCache = new Map<string, string>();

async function speakAgentGreeting(avatarId: AvatarId, text: string): Promise<void> {
  if (typeof window === 'undefined' || !text) return;
  stopAgentGreeting();
  const sessionId = ++greetingSessionSeq;
  const isFemale = avatarId === 'tirta' || avatarId === 'suara';

  const runBrowserMalayVoiceOnly = () => {
    if (sessionId !== greetingSessionSeq || !('speechSynthesis' in window)) {
      setMusicState({ ducked: false });
      return;
    }
    try {
      const voices = window.speechSynthesis.getVoices();
      const { voice, isConfirmedFemale } = pickMalaysianSpeechVoice(voices, { preferFemale: isFemale });
      if (!voice) {
        // Strict ms-MY guard: never fall back to Indonesian (id-ID) or English voices
        setMusicState({ ducked: false });
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = voice;
      utter.lang = voice.lang || 'ms-MY';
      utter.pitch = isFemale ? (isConfirmedFemale ? 1.15 : 1.24) : 0.94;
      utter.rate = 0.98;
      utter.onstart = () => setMusicState({ ducked: true });
      utter.onend = () => setMusicState({ ducked: false });
      utter.onerror = () => setMusicState({ ducked: false });
      setMusicState({ ducked: true });
      window.speechSynthesis.speak(utter);
    } catch {
      setMusicState({ ducked: false });
    }
  };

  try {
    const cacheKey = `${avatarId}::${text}`;
    let url = greetingTtsCache.get(cacheKey);
    if (!url) {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          style: buildMalaysianTtsStyle(
            `Cheerful, confident, friendly Malaysian youth hero agent (${avatarId}) greeting a Year 6 pupil.`
          ),
        }),
      });
      if (sessionId !== greetingSessionSeq) return;
      if (!resp.ok) {
        runBrowserMalayVoiceOnly();
        return;
      }
      const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
      if (sessionId !== greetingSessionSeq) return;
      if (!data.audioBase64) {
        runBrowserMalayVoiceOnly();
        return;
      }
      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
      greetingTtsCache.set(cacheKey, url);
    }

    if (sessionId !== greetingSessionSeq) return;
    const audio = new Audio(url);
    activeGreetingAudio = audio;
    audio.onplay = () => setMusicState({ ducked: true });
    audio.onended = () => {
      if (activeGreetingAudio === audio) activeGreetingAudio = null;
      setMusicState({ ducked: false });
    };
    audio.onerror = () => {
      if (activeGreetingAudio === audio) activeGreetingAudio = null;
      runBrowserMalayVoiceOnly();
    };
    await audio.play();
  } catch {
    runBrowserMalayVoiceOnly();
  }
}

function stopAgentGreeting(): void {
  greetingSessionSeq += 1;
  if (activeGreetingAudio) {
    try {
      activeGreetingAudio.pause();
      activeGreetingAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeGreetingAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  setMusicState({ ducked: false });
}

export function EvidenceBookModal({
  user,
  onClose,
}: {
  user: UserAccount;
  onClose: () => void;
}) {
  const p = user.progress!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-xl bg-slate-950 border border-sky-500/50 rounded-3xl p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold text-sky-300">
            📖 Buku Bukti · {user.fullName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-game-slate btn-game-sm p-2 rounded-xl text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4 text-sm">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="font-display font-bold text-emerald-400 mb-2">
              Bukti Sungai Tercemar (Misi 1)
            </div>
            {p.m1.evidence.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                {p.m1.evidence.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">Belum ada bukti terkumpul.</p>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="font-display font-bold text-amber-300 mb-2">
              Peta Pemikiran Udara Beracun (Misi 2)
            </div>
            {p.m2.thinkingMap ? (
              <div className="text-slate-300 space-y-1">
                <div>
                  <strong className="text-white">Punca:</strong> {p.m2.thinkingMap.punca}
                </div>
                <div>
                  <strong className="text-white">Kesan:</strong> {p.m2.thinkingMap.kesan}
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Belum dilengkapkan.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileBadgesModal({
  user,
  missions,
  onChangeAvatar,
  onOpenMission,
  onClose,
}: {
  user: UserAccount;
  missions: MissionDef[];
  onChangeAvatar: (id: AvatarId) => void;
  onOpenMission: (id: number) => void;
  onClose: () => void;
}) {
  const xp = user.xp || 0;
  const lvl = calcLevel(xp);
  const xpIn = xp % 200;
  const pct = Math.round(xpIn / 2);
  const ai = computeAIGuide(user);
  const p = user.progress!;
  const currentAv = AVATARS.find((a) => a.id === user.avatar) || AVATARS[0];
  const [hoveredAv, setHoveredAv] = useState<AvatarId | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [showBubble, setShowBubble] = useState(true);

  useEffect(() => {
    return () => {
      stopAgentGreeting();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto eco-scroll bg-slate-950 border border-emerald-500/50 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl">
              {currentAv.emoji}
            </div>
            <div>
              <div className="text-xs text-amber-300 font-semibold">
                Tahap {lvl} · {user.className} · {user.studentId}
              </div>
              <h2 className="font-display text-2xl font-bold text-white">{user.fullName}</h2>
              <div className="text-xs text-slate-400 mt-1 font-mono-num">
                XP: <span className="text-amber-300 font-bold">{xp}</span> ({xpIn}/200 ke Tahap{' '}
                {lvl + 1})
              </div>
              <div className="w-56 h-2.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-game-slate btn-game-sm p-2 rounded-xl text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3D Avatar Selector with Live Interactive 3D Human Preview */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-300">
            Pilih Karakter Ejen 3D Anda (Berubah terus di Pulau 3D)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
            <div className="md:col-span-5 relative h-52 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
              <Agent3DStage
                mode="single"
                selectedId={currentAv.id}
                hoveredId={hoveredAv}
                welcomeBurstKey={burstKey}
                onHoverAgent={setHoveredAv}
                onSelectAgent={() => {
                  playSFX('click');
                  setBurstKey((k) => k + 1);
                  setShowBubble(true);
                  speakAgentGreeting(currentAv.id, currentAv.greeting || '');
                }}
              />
              {showBubble && currentAv.greeting && (
                <div className="pointer-events-none absolute bottom-2 inset-x-2 rounded-xl bg-slate-950/90 border border-emerald-400/60 px-2.5 py-1.5 text-[11px] text-slate-100 shadow-lg">
                  <span className="font-bold text-amber-300">{currentAv.name}:</span>{' '}
                  {currentAv.greeting}
                </div>
              )}
            </div>
            <div className="md:col-span-7 grid grid-cols-2 gap-2.5">
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onMouseEnter={() => setHoveredAv(av.id)}
                  onMouseLeave={() => setHoveredAv(null)}
                  onClick={() => {
                    onChangeAvatar(av.id);
                    setBurstKey((k) => k + 1);
                    setShowBubble(true);
                    speakAgentGreeting(av.id, av.greeting || '');
                  }}
                  className={`btn-game-sm p-3 rounded-2xl text-left cursor-pointer ${
                    user.avatar === av.id
                      ? 'btn-game-emerald text-slate-950'
                      : 'btn-game-slate text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="btn-icon-3d w-9 h-9 text-xl">{av.emoji}</span>
                    {user.avatar === av.id && <span className="text-xs font-black">⭐</span>}
                  </div>
                  <div className="font-display font-bold text-xs">{av.name}</div>
                  <div className="text-[11px] opacity-85">{av.tagline}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3 Columns: Badges, Progress, AI Mission Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <h3 className="font-display font-bold text-amber-300 text-base">
              🏅 Lencana ({(user.badges || []).length}/5)
            </h3>
            {BADGES_DEF.map((b) => {
              const earned = (user.badges || []).includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    earned
                      ? 'bg-amber-950/40 border-amber-400/60 text-amber-100'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-lg">{b.icon}</span>
                  <div>
                    <div className="font-bold">
                      {b.name} {earned ? '✅' : '🔒'}
                    </div>
                    <div className="text-[11px] opacity-80">{b.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <h3 className="font-display font-bold text-sky-300 text-base">📊 Kemajuan Misi</h3>
            {missions.map((m) => {
              const mp = p[`m${m.id}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5'];
              const done = 'submitted' in mp ? mp.submitted : mp.completed;
              const scoreVal = 'rubricScore' in mp ? mp.rubricScore : mp.score;
              const unlocked = m.id <= (user.unlockedMission || 1);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    onClose();
                    onOpenMission(m.id);
                  }}
                  className={`btn-game-sm w-full p-2.5 rounded-xl disabled:opacity-50 flex items-center justify-between text-xs text-left cursor-pointer ${
                    unlocked ? 'btn-game-cyan text-slate-950' : 'btn-game-slate text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span className="btn-icon-3d w-6 h-6 text-xs">{m.icon}</span>
                    <span>
                      Misi {m.id}: {m.shortTitle}
                    </span>
                  </span>
                  <span className="font-mono-num font-black">
                    {done ? `⭐ ${scoreVal}%` : unlocked ? 'Sedia' : '🔒'}
                  </span>
                </button>
              );
            })}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-100 mt-2">
              <strong className="text-amber-300">Maklum Balas Guru:</strong>
              <p className="mt-1">{user.teacherFeedback}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/40 space-y-2.5">
            <h3 className="font-display font-bold text-purple-300 text-base">
              🤖 Panduan Pintar Misi
            </h3>
            <div className="text-xs font-semibold text-sky-300">Tahap: {ai.levelMode}</div>
            <div className="text-xs text-slate-200">
              <strong>Langkah Seterusnya:</strong>
              <p className="mt-1 text-slate-300">{ai.nextStep}</p>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-400">
              {ai.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div className="text-xs font-semibold pt-2 text-emerald-400">
              {user.aiApprovedByTeacher ? '✅ Disahkan Guru' : '⏳ Menunggu semakan guru'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HallOfHeroesModal({
  user,
  onClose,
}: {
  user: UserAccount;
  onClose: () => void;
}) {
  const ov = calcOverallScore(user);
  const xp = user.xp || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-amber-50 text-slate-900 rounded-3xl p-8 border-4 border-amber-400 shadow-2xl cert-printable text-center">
        <div className="text-5xl mb-2">🏆🌍</div>
        <h1 className="font-display text-3xl font-bold text-emerald-900">
          TAHNIAH, EJEN PRIHATIN!
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Sijil Pengiktirafan Penyelamat Dunia EcoWorld · Bahasa Melayu Tahun 6
        </p>

        <div className="my-6 py-4 border-y border-dashed border-slate-300">
          <div className="font-display text-2xl font-bold text-sky-800">{user.fullName}</div>
          <div className="text-sm text-slate-600 mt-1">
            Kelas: <strong>{user.className}</strong> · ID: <strong>{user.studentId}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-slate-900 text-white">
            <div className="text-xs text-slate-400">Jumlah XP</div>
            <div className="font-mono-num text-xl font-bold text-amber-300">{xp}</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900 text-white">
            <div className="text-xs text-slate-400">Tahap</div>
            <div className="font-mono-num text-xl font-bold text-emerald-400">
              Tahap {calcLevel(xp)}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900 text-white">
            <div className="text-xs text-slate-400">Purata Markah</div>
            <div className="font-mono-num text-xl font-bold text-sky-400">{ov}%</div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900 text-white">
            <div className="text-xs text-slate-400">Projek Kempen</div>
            <div className="text-sm font-bold pt-1 text-emerald-300">
              {user.progress?.m5.submitted ? 'Selesai' : 'Dalam Proses'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {(user.badges || []).map((bId) => {
            const b = BADGES_DEF.find((x) => x.id === bId);
            if (!b) return null;
            return (
              <span
                key={b.id}
                className="px-3 py-1.5 rounded-xl bg-amber-200 border border-amber-500 text-xs font-bold text-amber-950"
              >
                {b.icon} {b.name}
              </span>
            );
          })}
        </div>

        <div className="no-print flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              playSFX('xp');
              downloadCertificatePdf(user);
            }}
            className="btn-game-emerald px-5 py-2.5 rounded-2xl text-slate-950 font-game font-black text-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="btn-icon-3d w-6 h-6">
              <Download className="w-3.5 h-3.5" />
            </span>
            <span>Muat Turun Sijil PDF Sebenar</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-game-gold px-5 py-2.5 rounded-2xl text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="btn-icon-3d w-6 h-6">
              <Printer className="w-3.5 h-3.5" />
            </span>
            <span>Cetak Sijil</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-game-slate px-5 py-2.5 rounded-2xl text-white font-display font-bold text-sm cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function WheretoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-xl bg-slate-950 border border-emerald-500/40 rounded-3xl p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold text-emerald-400">
            📘 Panduan Pembelajaran Misi
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-game-slate btn-game-sm p-2 rounded-xl text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          <strong>Bahasa Melayu Tahun 6 · SK 1.2 / SP 1.2.2:</strong> Bertutur untuk menghujahkan
          sesuatu perkara menggunakan idea kritis & kreatif berdasarkan maklumat tersurat dan tersirat.
        </p>
        <div className="space-y-2 text-xs bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-300">
          <div><strong className="text-amber-300">1. Hala Tuju (W):</strong> Matlamat Kempen Digital Selamatkan EcoWorld.</div>
          <div><strong className="text-amber-300">2. Tarikan (H):</strong> Penerokaan Pulau 3D, bukti sungai & audio Puan Aminah.</div>
          <div><strong className="text-amber-300">3. Lengkapkan (E):</strong> 5 misi berperingkat, bina hujah & rakaman suara.</div>
          <div><strong className="text-amber-300">4. Fikir Semula (R):</strong> Semakan kendiri, rakan sebaya & maklum balas guru.</div>
          <div><strong className="text-amber-300">5. Penilaian (E):</strong> Markah automatik, lencana pencapaian & projek kempen.</div>
          <div><strong className="text-amber-300">6. Bimbingan (T):</strong> Panduan Pintar mencadangkan latihan pengukuhan atau pengayaan.</div>
          <div><strong className="text-amber-300">7. Susunan (O):</strong> Kembara pulau 3D berperingkat hingga Dewan Wira.</div>
        </div>
      </div>
    </div>
  );
}

export function AgentSelectModal({
  user,
  onSelectAgent,
}: {
  user: UserAccount;
  onSelectAgent: (avatarId: AvatarId) => void;
}) {
  const [selected, setSelected] = useState<AvatarId>(user.avatar || 'tirta');
  const [hovered, setHovered] = useState<AvatarId | null>(null);
  const [burstKey, setBurstKey] = useState(1);
  const [introSpeaker, setIntroSpeaker] = useState<AvatarId>(user.avatar || 'tirta');

  const speakerAv = AVATARS.find((a) => a.id === introSpeaker) || AVATARS[0];

  useEffect(() => {
    return () => {
      stopAgentGreeting();
    };
  }, []);

  const handleTriggerAgent = (id: AvatarId) => {
    playSFX('click');
    setSelected(id);
    setIntroSpeaker(id);
    setBurstKey((k) => k + 1);
    const av = AVATARS.find((a) => a.id === id);
    if (av?.greeting) {
      speakAgentGreeting(id, av.greeting);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto eco-scroll bg-slate-950 border-2 border-emerald-400/75 rounded-3xl p-4 sm:p-6 text-slate-100 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-400/50 text-emerald-300 font-game text-xs font-bold">
            <Shield className="w-3.5 h-3.5" /> PENDAFTARAN WATAK EJEN 3D
          </div>
          <h2 className="game-title-emerald text-2xl sm:text-3xl font-black uppercase">
            PILIH EJEN ECOWORLD ANDA
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto">
            Selamat datang <strong className="text-amber-300">{user.fullName}</strong>! Klik atau gerakkan kursor pada mana-mana Ejen 3D di pentas untuk berkenalan sebelum memulakan misi.
          </p>
        </div>

        {/* Live 3D Guardians Stage showing all 4 separate animated 3D human characters */}
        <div className="relative rounded-2xl border-2 border-sky-400/50 bg-slate-900 overflow-hidden shadow-2xl">
          <div className="h-[220px] sm:h-[270px] md:h-[300px] w-full">
            <Agent3DStage
              mode="lineup"
              selectedId={selected}
              hoveredId={hovered}
              welcomeBurstKey={burstKey}
              onHoverAgent={setHovered}
              onSelectAgent={handleTriggerAgent}
            />
          </div>

          {/* Interactive Speech Bubble Introduction */}
          <div className="px-3 sm:px-5 py-2.5 bg-slate-950/95 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0 border"
                style={{
                  backgroundColor: `${speakerAv.primaryColor}30`,
                  borderColor: speakerAv.accentColor,
                }}
              >
                {speakerAv.emoji}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-game font-black text-amber-300 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                    {speakerAv.name}
                  </span>
                  {speakerAv.roleTitle && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-sky-300">
                      {speakerAv.roleTitle}
                    </span>
                  )}
                  {speakerAv.personality && (
                    <span className="text-[11px] text-emerald-300 font-semibold">
                      · {speakerAv.personality}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-100 font-medium mt-0.5">
                  &ldquo;{speakerAv.greeting}&rdquo;
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => speakAgentGreeting(speakerAv.id, speakerAv.greeting || '')}
              className="btn-game-teal btn-game-sm px-2.5 py-1 text-[11px] font-game font-black text-slate-950 flex items-center gap-1 cursor-pointer shrink-0"
              title="Dengar ucapan ejen"
            >
              <Volume2 className="w-3.5 h-3.5" /> Dengar Suara
            </button>
          </div>
        </div>

        {/* 4 Separate Individual Guardian Cards (Desktop 4-col, Tablet 2-col, Mobile 1-col) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AVATARS.map((av) => {
            const active = selected === av.id;
            return (
              <button
                key={av.id}
                type="button"
                onMouseEnter={() => setHovered(av.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleTriggerAgent(av.id)}
                className={`p-3.5 rounded-2xl text-left cursor-pointer flex flex-col gap-2 ${
                  active
                    ? 'btn-game-emerald text-slate-950 scale-[1.01]'
                    : 'btn-game-slate text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="btn-icon-3d w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.28)' : `${av.primaryColor}35`,
                      border: active ? '2px solid #facc15' : `2px solid ${av.primaryColor}`,
                    }}
                  >
                    {av.emoji}
                  </div>
                  {active ? (
                    <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {av.roleTitle}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-game text-sm font-black">{av.name}</div>
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      active ? 'text-emerald-950' : 'text-emerald-300'
                    }`}
                  >
                    {av.tagline}
                  </div>
                  <div
                    className={`text-[11px] mt-1 font-medium leading-snug ${
                      active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {av.suitLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => {
              stopAgentGreeting();
              onSelectAgent(selected);
            }}
            className="btn-game-emerald px-8 py-3.5 rounded-2xl text-slate-950 font-game font-black text-sm sm:text-base tracking-wider uppercase flex items-center gap-2.5 cursor-pointer"
          >
            <span className="btn-icon-3d w-7 h-7">
              <Sparkles className="w-4 h-4" />
            </span>
            <span>SAHKAN EJEN & MULA MISI →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionSuccessModal({
  user,
  info,
  nextMission,
  onTeleportNext,
  onClose,
  onOpenHeroes,
}: {
  user: UserAccount;
  info: { missionId: number; score: number; xpEarned: number; message: string };
  nextMission?: MissionDef | null;
  onTeleportNext?: () => void;
  onClose: () => void;
  onOpenHeroes: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg bg-slate-950 border-2 border-amber-400 rounded-3xl p-7 text-center text-slate-100 shadow-2xl space-y-4">
        <div className="text-5xl">🎉🏆</div>
        <div>
          <div className="font-game text-xs font-bold tracking-widest text-amber-300 uppercase">
            TAHNIAH, {user.fullName}!
          </div>
          <h2 className="game-title-emerald text-2xl sm:text-3xl font-black mt-1">
            MISI 0{info.missionId} SELESAI!
          </h2>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-1">
          <div className="font-mono-num text-base font-bold text-amber-300">
            Markah: {info.score}% · Ganjaran: +{info.xpEarned} XP
          </div>
          <div className="text-xs text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Rekod anda telah disimpan ke Papan Guru!
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{info.message}</p>

        <div className="flex flex-wrap justify-center gap-2.5 pt-2">
          {nextMission && onTeleportNext && (
            <button
              type="button"
              onClick={onTeleportNext}
              className="btn-game-emerald w-full sm:w-auto px-5 py-2.5 rounded-2xl text-slate-950 font-game font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="btn-icon-3d w-6 h-6">
                <Zap className="w-3.5 h-3.5" />
              </span>
              <span>
                {info.missionId === 1
                  ? 'TERUSKAN KE MISI 2'
                  : `TELEPORTASI KE MISI 0${nextMission.id}`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playSFX('xp');
              downloadCertificatePdf(user);
            }}
            className="btn-game-gold px-5 py-2.5 rounded-2xl text-slate-950 font-game font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
          >
            <span className="btn-icon-3d w-6 h-6">
              <Download className="w-3.5 h-3.5" />
            </span>
            <span>Muat Turun Sijil PDF</span>
          </button>
          <button
            type="button"
            onClick={onOpenHeroes}
            className="btn-game-cyan btn-game-sm px-4 py-2.5 rounded-2xl text-slate-950 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>🏆</span>
            <span>Lihat Sijil Penuh</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-game-slate btn-game-sm px-4 py-2.5 rounded-2xl text-slate-100 font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>🗺️</span>
            <span>Kembali ke Peta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
