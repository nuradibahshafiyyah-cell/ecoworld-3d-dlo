import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Link2,
  Mic,
  Play,
  Sparkles,
  Square,
  Video,
  XCircle,
} from 'lucide-react';
import { DSKP_CURRICULUM, PBL_STEPS } from '../../data/gameData';
import { UserAccount } from '../../types/game';
import { playSFX, setMusicState } from '../../utils/sound';

const CAMPAIGN_THEMES = [
  {
    id: 'sungai',
    icon: '🌊',
    name: 'Sungai Jernih Nadi Kita',
    gradient: 'linear-gradient(135deg, rgba(8,51,68,0.95), rgba(6,78,59,0.95))',
    border: 'border-cyan-400',
  },
  {
    id: 'udara',
    icon: '🌤️',
    name: 'Langit Biru Udara Segar',
    gradient: 'linear-gradient(135deg, rgba(12,74,110,0.95), rgba(15,118,110,0.95))',
    border: 'border-sky-400',
  },
  {
    id: 'hutan',
    icon: '🌿',
    name: 'Bumi Hijau Masa Depan',
    gradient: 'linear-gradient(135deg, rgba(6,78,59,0.95), rgba(63,98,18,0.95))',
    border: 'border-emerald-400',
  },
];

interface Mission5CampaignStudioProps {
  user: UserAccount;
  onCompleteMission5: (
    title: string,
    link: string,
    stepsDone: number[],
    rubricScore: number,
    reflection: string
  ) => void;
}

export function Mission5CampaignStudio({ user, onCompleteMission5 }: Mission5CampaignStudioProps) {
  const p = user.progress!;
  const [station, setStation] = useState<1 | 2 | 3 | 4>(1);
  const [stepsDone, setStepsDone] = useState<number[]>(
    p.m5.stepsDone?.length ? p.m5.stepsDone : [0, 1, 2, 3]
  );

  // Campaign Metadata & Grounded Script
  const [themeId, setThemeId] = useState(CAMPAIGN_THEMES[0].id);
  const [title, setTitle] = useState(p.m5.title || 'Kempen Selamatkan EcoWorld 3D');
  const compiledArg = [
    p.m4.argument?.pendirian,
    p.m4.argument?.bukti,
    p.m4.argument?.huraian,
    p.m4.argument?.kesimpulan,
  ]
    .filter(Boolean)
    .join(' ');
  const [campaignScript, setCampaignScript] = useState(
    compiledArg ||
      `Salam sejahtera semua! Berdasarkan penyiasatan EcoWorld, pencemaran sungai dan udara berlaku akibat pembuangan sisa kilang dan asap tanpa penapis. ${
        p.m3.justification || 'Oleh itu, kita perlu mewajibkan penapis asap dan menanam semula pokok.'
      } Marilah kita bersatu menjaga alam sekitar!`
  );

  // Real Audio / Video Studio Recorder
  const [mediaMode, setMediaMode] = useState<'video' | 'audio' | 'link'>('video');
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedType, setRecordedType] = useState<'video' | 'audio' | null>(null);
  const [mediaStatus, setMediaStatus] = useState(
    'Pilih rakaman Video (Kamera + Suara) atau Audio untuk menghasilkan kempen anda!'
  );
  const [linkValue, setLinkValue] = useState(p.m5.link || '');

  // Final Self-Rubric & Reflection
  const [rubricChecks, setRubricChecks] = useState({
    bukti: true,
    cadangan: true,
    penyampaian: false,
  });
  const [rubricScore, setRubricScore] = useState<number>(p.m5.rubricScore || 90);
  const [reflection, setReflection] = useState(p.m5.reflection || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopMediaStream = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setRecording(false);
    setMusicState({ suppressedForAudio: false, ducked: false });
  };

  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, []);

  const handleStartMediaRec = async (mode: 'video' | 'audio') => {
    setErrorMsg(null);
    stopMediaStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === 'video' ? { video: true, audio: true } : { audio: true }
      );
      streamRef.current = stream;
      if (mode === 'video' && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }

      const mimeType =
        mode === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm'
          : 'audio/webm';

      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setRecordedType(mode);
        setLinkValue(
          mode === 'video'
            ? `Video Kempen EcoWorld (${title.trim() || 'Kempen'})`
            : `Audio Kempen EcoWorld (${title.trim() || 'Kempen'})`
        );
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
        setMusicState({ suppressedForAudio: false, ducked: false });
      };

      rec.start();
      setRecording(true);
      setRecSeconds(0);
      setMusicState({ suppressedForAudio: true, ducked: false });
      setMediaStatus(
        mode === 'video'
          ? 'Sedang merakam VIDEO kempen anda... Baca skrip di atas dengan yakin!'
          : 'Sedang merakam AUDIO kempen anda... Gunakan intonasi bersemangat!'
      );
      timerRef.current = window.setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setRecording(false);
      setMusicState({ suppressedForAudio: false, ducked: false });
      setMediaStatus(
        mode === 'video'
          ? 'Kamera/mikrofon tidak dikesan atau disekat. Anda boleh cuba mod Rakam Audio atau masukkan Pautan Fail.'
          : 'Mikrofon tidak dikesan atau disekat. Gunakan tab Pautan / Pembentangan Kelas.'
      );
      playSFX('error');
    }
  };

  const handleStopMediaRec = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
      setMediaStatus('Rakaman kempen berjaya disimpan! Pratonton dan muat turun di bawah.');
      setRubricChecks((prev) => ({ ...prev, penyampaian: true }));
      if (!stepsDone.includes(5)) setStepsDone((prev) => [...prev, 5]);
      playSFX('win');
    }
  };

  const currentTheme = CAMPAIGN_THEMES.find((t) => t.id === themeId) || CAMPAIGN_THEMES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStation(2);
      playSFX('error');
      setErrorMsg('Sila masukkan Tajuk Kempen Kesedaran anda di Stesen 2.');
      return;
    }
    if (!linkValue.trim() && !recordedUrl) {
      setStation(3);
      playSFX('error');
      setErrorMsg(
        'Sila rakam Audio/Video kempen anda di Studio Stesen 3 ATAU masukkan pautan pembentangan kempen.'
      );
      return;
    }
    if (reflection.trim().length < 12) {
      setStation(4);
      playSFX('error');
      setErrorMsg('Sila tulis refleksi pembelajaran dan kesimpulan kempen di Stesen 4.');
      return;
    }

    setErrorMsg(null);
    stopMediaStream();
    const finalLink =
      linkValue.trim() ||
      (recordedType === 'video'
        ? `Video Kempen EcoWorld (${title.trim()})`
        : `Audio Kempen EcoWorld (${title.trim()})`);
    const finalSteps = Array.from(new Set([...stepsDone, 6, 7])).sort((a, b) => a - b);
    onCompleteMission5(title.trim(), finalLink, finalSteps, rubricScore, reflection.trim());
  };

  return (
    <div className="space-y-4">
      {/* Driving Question Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-400/50 text-xs text-amber-100">
        <strong className="text-amber-300 font-game">MISI KEMUNCAK — KEMPEN AUDIO / VIDEO BERASAS:</strong>{' '}
        <em>
          &ldquo;Hasilkan kempen kesedaran alam sekitar dalam bentuk audio atau video dengan pandangan kritis dan cadangan yang berasas!&rdquo;
        </em>
      </div>

      {/* 4 Production Stations Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {[
          [1, '1. Bukti & Rancang'],
          [2, '2. Tema & Skrip'],
          [3, '3. Studio Audio/Video'],
          [4, '4. Tayang & Hantar'],
        ].map(([num, label]) => (
          <button
            key={num}
            type="button"
            onClick={() => {
              playSFX('click');
              setStation(num as 1 | 2 | 3 | 4);
            }}
            className={`btn-game-sm py-2 px-2 font-game text-[11px] font-bold text-center cursor-pointer ${
              station === num ? 'btn-game-gold text-slate-950' : 'btn-game-slate text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 text-xs font-semibold flex items-start gap-2">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* STESEN 1: Himpunan Bukti Misi 1-4 & Perancangan */}
        {station === 1 && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="font-game text-xs font-black text-emerald-300 uppercase">
              Stesen 1: Himpunan Bukti Berasas (Dari Misi 1 – Misi 4)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/35">
                <span className="font-bold text-cyan-300 block mb-0.5">Misi 1 (Fakta Didengar):</span>
                <span className="text-slate-300">
                  {p.m1.evidence[0] || 'Air sungai hitam berbau kimia & sisa dibuang tengah malam.'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-orange-500/35">
                <span className="font-bold text-orange-300 block mb-0.5">Misi 2 (Punca &amp; Kesan):</span>
                <span className="text-slate-300">
                  {p.m2.thinkingMap
                    ? `${p.m2.thinkingMap.punca} → ${p.m2.thinkingMap.kesan}`
                    : 'Asap kilang tanpa penapis mencetuskan asma & hujan asid.'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/35">
                <span className="font-bold text-emerald-300 block mb-0.5">Misi 3 (Cadangan Terbaik):</span>
                <span className="text-slate-300">
                  {p.m3.chosenOption || 'Wajibkan Penapis Asap + Tanam Semula Hutan & Pengangkutan Hijau'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/35">
                <span className="font-bold text-purple-300 block mb-0.5">Misi 4 (Hujah Kritis):</span>
                <span className="text-slate-300">
                  {p.m4.argument?.pendirian || 'Pencemaran mesti dihentikan dengan penyelesaian bersepadu.'}
                </span>
              </div>
            </div>

            <div className="font-game text-[11px] font-bold text-amber-300 pt-1">
              Senarai Semak Perancangan Kempen:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PBL_STEPS.map((st, idx) => {
                const checked = stepsDone.includes(idx);
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
                        if (e.target.checked) setStepsDone([...stepsDone, idx]);
                        else setStepsDone(stepsDone.filter((x) => x !== idx));
                      }}
                      className="accent-emerald-500"
                    />
                    <span>{st}</span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setStation(2)}
              className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
            >
              Seterusnya: Pilih Tema &amp; Skrip →
            </button>
          </div>
        )}

        {/* STESEN 2: Tema Visual Poster & Skrip Kempen Berasas */}
        {station === 2 && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="font-game text-xs font-black text-sky-300 uppercase">
              Stesen 2: Tema Latar &amp; Skrip Kempen Berasas
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CAMPAIGN_THEMES.map((th) => {
                const selected = themeId === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      playSFX('click');
                      setThemeId(th.id);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                      selected ? `${th.border} scale-[1.01] shadow-lg` : 'border-slate-800 opacity-75'
                    }`}
                    style={{ background: th.gradient }}
                  >
                    <div className="text-2xl mb-1">{th.icon}</div>
                    <div className="font-game text-xs font-black text-white">{th.name}</div>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tajuk Kempen Audio / Video Anda
              </label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Contoh: Selamatkan Sungai & Langit EcoWorld"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Skrip Kempen Berasas (Untuk Dibaca Semasa Rakaman Audio/Video):
              </label>
              <textarea
                rows={4}
                value={campaignScript}
                onChange={(e) => setCampaignScript(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-white text-xs sm:text-sm leading-relaxed"
              />
            </div>

            <button
              type="button"
              onClick={() => setStation(3)}
              className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
            >
              Seterusnya: Studio Rakaman Audio / Video →
            </button>
          </div>
        )}

        {/* STESEN 3: STUDIO RAKAMAN AUDIO & VIDEO SEBENAR */}
        {station === 3 && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-teal-400/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-game text-xs font-black text-teal-300 uppercase">
                Stesen 3: Studio Produksi Kempen Audio / Video
              </div>
              {recording && (
                <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-mono-num text-[11px] font-black animate-pulse">
                  ● MERAKAM {recSeconds}s
                </span>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'video' as const, label: 'Rakam Video Kamera', icon: <Video className="w-3.5 h-3.5" /> },
                { id: 'audio' as const, label: 'Rakam Audio Suara', icon: <Mic className="w-3.5 h-3.5" /> },
                { id: 'link' as const, label: 'Pautan / Pembentangan', icon: <Link2 className="w-3.5 h-3.5" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    stopMediaStream();
                    setMediaMode(m.id);
                  }}
                  className={`btn-game-sm px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    mediaMode === m.id ? 'btn-game-cyan text-slate-950' : 'btn-game-slate text-slate-200'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Teleprompter Cue Strip */}
            <div
              className={`p-3 rounded-xl border ${currentTheme.border} text-xs text-white space-y-1`}
              style={{ background: currentTheme.gradient }}
            >
              <div className="font-game text-[10px] font-black text-amber-300 uppercase">
                {currentTheme.icon} SKRIP PENYAMPAIAN ({title || 'KEMPEN ECOWORLD'}):
              </div>
              <p className="leading-relaxed">{campaignScript}</p>
            </div>

            {mediaMode === 'video' && (
              <div className="space-y-2.5">
                <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-400/50 bg-slate-950 h-44 flex items-center justify-center">
                  <video
                    ref={liveVideoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${recording ? 'block' : 'hidden'}`}
                  />
                  {!recording && (
                    <div className="text-center p-4 space-y-1">
                      <Film className="w-8 h-8 text-cyan-300 mx-auto" />
                      <div className="text-xs text-slate-300 font-semibold">{mediaStatus}</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={recording}
                    onClick={() => handleStartMediaRec('video')}
                    className="btn-game-emerald px-4 py-2 rounded-xl disabled:opacity-40 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Video className="w-4 h-4" /> Mula Rakam Video
                  </button>
                  <button
                    type="button"
                    disabled={!recording}
                    onClick={handleStopMediaRec}
                    className="btn-game-rose btn-game-sm px-4 py-2 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Henti Rakaman
                  </button>
                </div>
              </div>
            )}

            {mediaMode === 'audio' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-amber-200 font-semibold">{mediaStatus}</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={recording}
                    onClick={() => handleStartMediaRec('audio')}
                    className="btn-game-emerald px-4 py-2 rounded-xl disabled:opacity-40 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" /> Mula Rakam Audio
                  </button>
                  <button
                    type="button"
                    disabled={!recording}
                    onClick={handleStopMediaRec}
                    className="btn-game-rose btn-game-sm px-4 py-2 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Henti Rakaman
                  </button>
                </div>
              </div>
            )}

            {/* Playback + Download for Recorded Video/Audio */}
            {recordedUrl && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-400/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-game font-bold text-emerald-300">
                    ✅ Hasil Rakaman Kempen Anda Sedia!
                  </span>
                  <a
                    href={recordedUrl}
                    download={`kempen-ecoworld-${recordedType || 'media'}.webm`}
                    className="btn-game-gold btn-game-sm px-3 py-1 text-slate-950 font-game text-[11px] font-black flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Muat Turun Fail
                  </a>
                </div>
                {recordedType === 'video' ? (
                  <video
                    controls
                    src={recordedUrl}
                    onPlay={() => setMusicState({ suppressedForAudio: true })}
                    onPause={() => setMusicState({ suppressedForAudio: false })}
                    onEnded={() => setMusicState({ suppressedForAudio: false })}
                    className="w-full max-h-48 rounded-xl bg-black"
                  />
                ) : (
                  <audio
                    controls
                    src={recordedUrl}
                    onPlay={() => setMusicState({ suppressedForAudio: true })}
                    onPause={() => setMusicState({ suppressedForAudio: false })}
                    onEnded={() => setMusicState({ suppressedForAudio: false })}
                    className="w-full h-9"
                  />
                )}
              </div>
            )}

            {/* Link / Classroom Presentation Fallback */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rekod / Pautan Fail Kempen (Diisi automatik selepas rakam, atau masukkan pautan luar):
              </label>
              <input
                value={linkValue}
                onChange={(e) => {
                  setLinkValue(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="https://drive.google.com/... atau 'Pembentangan Lisan Di Kelas'"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => setStation(4)}
              className="btn-game-emerald px-5 py-2 rounded-xl text-slate-950 font-game text-xs font-black cursor-pointer"
            >
              Seterusnya: Tayangan Perdana &amp; Hantar →
            </button>
          </div>
        )}

        {/* STESEN 4: TAYANGAN PERDANA, RUBRIK KENDIRI & REFLEKSI */}
        {station === 4 && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-amber-400/50 space-y-3">
            <div className="font-game text-xs font-black text-amber-300 uppercase">
              Stesen 4: Tayangan Perdana, Rubrik &amp; Refleksi Akhir
            </div>

            <div
              className={`p-3.5 rounded-2xl border ${currentTheme.border} text-xs text-white space-y-1.5`}
              style={{ background: currentTheme.gradient }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-game font-black text-amber-300">
                  {currentTheme.icon} {title || 'Kempen Kesedaran EcoWorld 3D'}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950/70 text-[10px] font-bold text-emerald-300">
                  {recordedUrl ? `Rakaman ${recordedType?.toUpperCase()} ✓` : linkValue ? 'Pautan ✓' : 'Belum Rekod'}
                </span>
              </div>
              <p className="text-[11px] text-slate-100/90 italic">&ldquo;{campaignScript}&rdquo;</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs space-y-1.5">
              <div className="font-game text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>PENCAPAIAN OBJEKTIF DSKP (SK {DSKP_CURRICULUM.skCode} · SP {DSKP_CURRICULUM.spCode}):</span>
              </div>
              <ul className="space-y-0.5 text-[11px] text-slate-300">
                {DSKP_CURRICULUM.objectives.map((obj) => (
                  <li key={obj.id} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Objektif {obj.id}: {obj.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {[
                ['bukti', 'Pandangan berasas bukti'],
                ['cadangan', 'Cadangan penyelesaian jelas'],
                ['penyampaian', 'Sebutan, intonasi & gaya sesuai'],
              ].map(([k, lbl]) => {
                const key = k as keyof typeof rubricChecks;
                return (
                  <label
                    key={k}
                    className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer ${
                      rubricChecks[key]
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-100'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rubricChecks[key]}
                      onChange={(e) => setRubricChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="accent-emerald-400"
                    />
                    <span>{lbl}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Skor Rubrik Kendiri (60–100):{' '}
                <span className="font-mono-num text-amber-300">{rubricScore}%</span>
              </label>
              <input
                type="range"
                min={60}
                max={100}
                value={rubricScore}
                onChange={(e) => setRubricScore(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            {user.teacherFeedback && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-sky-200">
                <strong>Maklum Balas Guru:</strong> {user.teacherFeedback}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Refleksi Pembelajaran &amp; Kesimpulan Kempen
              </label>
              <textarea
                required
                rows={3}
                value={reflection}
                onChange={(e) => {
                  setReflection(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Apakah nilai dan kemahiran bertutur yang anda kuasai daripada penghasilan kempen audio/video ini?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>

            <button
              type="submit"
              className="btn-game-gold w-full py-3.5 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Lancarkan &amp; Hantar Kempen Kesedaran
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
