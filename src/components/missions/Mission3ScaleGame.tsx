import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic, Scale, Sparkles, Square, XCircle } from 'lucide-react';
import { M3_OPTS } from '../../data/gameData';
import { UserAccount } from '../../types/game';
import { playSFX, setMusicState } from '../../utils/sound';

const POLICY_METRICS: Record<
  string,
  {
    nature: number;
    people: number;
    tiltDeg: number;
    verdictTitle: string;
    verdictText: string;
    isBalanced: boolean;
  }
> = {
  o1: {
    nature: 90,
    people: 25,
    tiltDeg: -12,
    verdictTitle: '⚠️ TIDAK SEIMBANG (EKONOMI TERJEJAS)',
    verdictText:
      'Menutup semua kilang memang membersihkan udara dengan cepat, tetapi ramai ibu bapa kehilangan pekerjaan dan pendapatan keluarga terjejas.',
    isBalanced: false,
  },
  o2: {
    nature: 92,
    people: 90,
    tiltDeg: 0,
    verdictTitle: '✅ SEIMBANG & MAMPAN (PILIHAN TERBAIK!)',
    verdictText:
      'Tahniah! Mewajibkan penapis asap, menanam semula hutan dan menggalakkan pengangkutan hijau memulihkan alam sambil mengekalkan pekerjaan penduduk.',
    isBalanced: true,
  },
  o3: {
    nature: 20,
    people: 55,
    tiltDeg: 11,
    verdictTitle: '⚠️ KURANG BERKESAN (PUNCA MASIH KEKAL)',
    verdictText:
      'Mengedar topeng muka hanya melindungi buat sementara waktu, tetapi asap beracun dan hujan asid masih merosakkan pokok.',
    isBalanced: false,
  },
};

const STARTER_CHIPS = [
  'Pada pendapat saya, Pilihan B paling seimbang kerana',
  'Selain membersihkan udara, cadangan ini juga',
  'Berbanding Pilihan A dan C, langkah ini',
];

interface Mission3ScaleGameProps {
  user: UserAccount;
  onCompleteMission3: (score: number, chosenOption: string, justification: string) => void;
}

export function Mission3ScaleGame({ user, onCompleteMission3 }: Mission3ScaleGameProps) {
  const prevM3 = user.progress?.m3;
  const [testedIds, setTestedIds] = useState<string[]>([]);
  const [inspectId, setInspectId] = useState<string>(prevM3?.completed ? 'o2' : '');
  const [lockedId, setLockedId] = useState<string>(prevM3?.completed ? 'o2' : '');
  const [justification, setJustification] = useState(prevM3?.justification || '');
  const [oralPracticed, setOralPracticed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recStatus, setRecStatus] = useState('Sedia merakam alasan penilaian anda');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setMusicState({ ducked: false });
    };
  }, []);

  const currentMetric = inspectId
    ? POLICY_METRICS[inspectId]
    : {
        nature: 50,
        people: 50,
        tiltDeg: 0,
        verdictTitle: 'UJI KAD CADANGAN DI BAWAH',
        verdictText: 'Klik mana-mana kad polisi untuk melihat kesannya pada Timbangan Keadilan Eco!',
        isBalanced: false,
      };

  const handleTestPolicy = (id: string) => {
    playSFX(id === 'o2' ? 'xp' : 'click');
    setInspectId(id);
    setErrorMsg(null);
    if (!testedIds.includes(id)) {
      setTestedIds((prev) => [...prev, id]);
    }
  };

  const handleLockChoice = () => {
    if (!inspectId) {
      playSFX('error');
      setErrorMsg('Sila klik dan uji sekurang-kurangnya satu kad cadangan dahulu.');
      return;
    }
    if (inspectId !== 'o2') {
      playSFX('error');
      setErrorMsg(
        `${POLICY_METRICS[inspectId].verdictTitle}: Cuba bandingkan dengan pilihan lain untuk mencari penyelesaian yang menjaga alam sekitar DAN kesejahteraan penduduk!`
      );
      return;
    }
    playSFX('win');
    setLockedId('o2');
    setErrorMsg(null);
  };

  const handleStartRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setMusicState({ ducked: false });
      };
      rec.start();
      setRecording(true);
      setMusicState({ ducked: true });
      setRecStatus('Sedang merakam alasan lisan anda...');
    } catch {
      setRecStatus('Mikrofon disekat/tiada. Anda masih boleh menandai latihan lisan!');
      setMusicState({ ducked: false });
      playSFX('click');
    }
  };

  const handleStopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
      setMusicState({ ducked: false });
      setRecStatus('Rakaman penilaian lisan berjaya disimpan!');
      setOralPracticed(true);
      playSFX('xp');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedId !== 'o2') {
      playSFX('error');
      setErrorMsg('Uji kad polisi di atas Timbangan Eco dan kunci Pilihan B sebagai penyelesaian paling seimbang!');
      return;
    }
    if (justification.trim().length < 15) {
      playSFX('error');
      setErrorMsg('Tuliskan alasan kritis anda sekurang-kurangnya 1 ayat lengkap sebelum menghantar.');
      return;
    }
    setErrorMsg(null);
    const chosen = M3_OPTS.find((o) => o.id === 'o2')!;
    const score = Math.min(
      100,
      85 + (justification.trim().length >= 30 ? 10 : 5) + (testedIds.length >= 2 ? 5 : 0)
    );
    onCompleteMission3(score, chosen.t, justification.trim());
  };

  return (
    <div className="space-y-4">
      {/* 1. Interactive Eco Balance Scale */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-400/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-game text-xs font-black text-emerald-300 flex items-center gap-1.5 uppercase">
            <Scale className="w-4 h-4 text-amber-300" />
            <span>Pusingan 1: Timbangan Keadilan Eco (Uji &amp; Nilai Cadangan)</span>
          </div>
          <span className="text-[11px] font-bold text-amber-300">
            Diuji: {testedIds.length}/3 Polisi
          </span>
        </div>

        {/* Visual Animated Scale Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-center py-1">
            <div className="relative w-56 h-12 flex items-center justify-center">
              <div className="w-2 h-8 bg-slate-600 rounded-full translate-y-2" />
              <div
                className="absolute top-2 w-52 h-2.5 rounded-full transition-transform duration-500 flex items-center justify-between px-1"
                style={{
                  transform: `rotate(${currentMetric.tiltDeg}deg)`,
                  background: currentMetric.isBalanced
                    ? 'linear-gradient(90deg, #34d399, #facc15, #34d399)'
                    : 'linear-gradient(90deg, #38bdf8, #94a3b8, #f97316)',
                }}
              >
                <span className="w-6 h-6 -mt-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-xs shadow">
                  🌿
                </span>
                <span className="w-6 h-6 -mt-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-xs shadow">
                  🏘️
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-emerald-300">
                <span>🌿 Kelestarian Alam</span>
                <span className="font-mono-num">{currentMetric.nature}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${currentMetric.nature}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-amber-300">
                <span>🏘️ Kesejahteraan Masyarakat</span>
                <span className="font-mono-num">{currentMetric.people}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${currentMetric.people}%` }}
                />
              </div>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs ${
              currentMetric.isBalanced
                ? 'bg-emerald-950/60 border-emerald-400/70 text-emerald-100'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <div className="font-game font-black text-amber-300 mb-0.5">{currentMetric.verdictTitle}</div>
            <p>{currentMetric.verdictText}</p>
          </div>
        </div>

        {/* 3 Clickable Policy Cards to Test */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {M3_OPTS.map((opt) => {
            const active = inspectId === opt.id;
            const tested = testedIds.includes(opt.id);
            const locked = lockedId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTestPolicy(opt.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  locked
                    ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400/50'
                    : active
                    ? 'bg-slate-800 border-amber-400 shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-game font-bold text-xs text-white">{opt.t}</span>
                    {locked && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-emerald-300 mb-1">+ {opt.p}</div>
                  <div className="text-[11px] text-rose-300">− {opt.c}</div>
                </div>
                <div className="text-[10px] font-game font-bold text-cyan-300 uppercase">
                  {locked ? '✓ DIKUNCI SEBAGAI TERBAIK' : tested ? 'Sudah Diuji · Klik Uji Lagi' : 'Klik Untuk Uji →'}
                </div>
              </button>
            );
          })}
        </div>

        {lockedId !== 'o2' && (
          <button
            type="button"
            onClick={handleLockChoice}
            className="btn-game-gold w-full py-2.5 rounded-xl text-slate-950 font-game text-xs font-black uppercase cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Kunci Cadangan Yang Sedang Diuji Sebagai Penyelesaian Terbaik</span>
          </button>
        )}
      </div>

      {/* 2. Critical Justification & Oral Defense */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-300">
              Pusingan 2: Bina Justifikasi Kritis Anda (Mengapa Pilihan B paling seimbang?)
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  playSFX('click');
                  if (!justification.includes(chip)) {
                    setJustification((prev) => `${chip} ${prev}`.trim());
                    setErrorMsg(null);
                  }
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-900 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>
          <textarea
            required
            rows={3}
            value={justification}
            onChange={(e) => {
              setJustification(e.target.value);
              setErrorMsg(null);
            }}
            placeholder="Pada pendapat saya, Pilihan B paling seimbang kerana menjaga alam sekitar tanpa menjejaskan pekerjaan penduduk..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm"
          />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-game text-xs font-bold text-emerald-300">
              🎙️ Latihan Lisan SP 1.2.2: Pertahankan Penilaian Anda
            </span>
            <button
              type="button"
              onClick={() => {
                playSFX('xp');
                setOralPracticed(true);
              }}
              className={`btn-game-sm px-3 py-1 text-[11px] font-bold cursor-pointer ${
                oralPracticed ? 'btn-game-emerald text-slate-950' : 'btn-game-slate text-emerald-200'
              }`}
            >
              {oralPracticed ? '✅ Sudah Berhujah Lisan' : 'Tandai Sudah Sebut Lantang'}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={recording}
              onClick={handleStartRec}
              className="btn-game-emerald btn-game-sm px-3 py-1.5 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Mic className="w-3.5 h-3.5" /> Rakam Penilaian
            </button>
            <button
              type="button"
              disabled={!recording}
              onClick={handleStopRec}
              className="btn-game-rose btn-game-sm px-3 py-1.5 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Square className="w-3.5 h-3.5" /> Henti
            </button>
            <span className="text-[11px] text-amber-300">{recStatus}</span>
          </div>
          {audioUrl && (
            <audio
              controls
              src={audioUrl}
              onPlay={() => setMusicState({ ducked: true })}
              onPause={() => setMusicState({ ducked: false })}
              onEnded={() => setMusicState({ ducked: false })}
              className="w-full h-8"
            />
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 text-xs font-semibold flex items-start gap-2">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-game-emerald w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
        >
          Sahkan Penilaian &amp; Pulihkan Hutan →
        </button>
      </form>
    </div>
  );
}
