import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Link2, Mic, Sparkles, Square, Volume2, XCircle } from 'lucide-react';
import { M2_AUDIO_SCRIPT, M2_SCENES } from '../../data/gameData';
import { UserAccount } from '../../types/game';
import { playSFX, setMusicState } from '../../utils/sound';

interface PairItem {
  id: string;
  punca: string;
  kesan: string;
  explanation: string;
  hint: string;
}

const PUZZLE_PAIRS: PairItem[] = [
  {
    id: 'p1',
    punca: 'Cerobong kilang melepaskan asap tanpa penapis',
    kesan: 'Zarah karbon hitam mengotorkan udara bandar',
    explanation: 'Tepat! Cerobong tanpa penapis melepaskan asap hitam dan jelaga terus ke udara.',
    hint: 'Petunjuk: Fikirkan apa yang keluar dari cerobong asap hitam di Babak 1.',
  },
  {
    id: 'p2',
    punca: 'Asap kenderaan sesak dan jerebu harian',
    kesan: 'Masalah pernafasan dan serangan asma penduduk',
    explanation: 'Betul! Zarah halus asap kenderaan mudah memasuki paru-paru dan mencetuskan asma.',
    hint: 'Petunjuk: Asap kenderaan yang disedut manusia memberi kesan kepada kesihatan pernafasan.',
  },
  {
    id: 'p3',
    punca: 'Gas sulfur dioksida daripada aktiviti perindustrian',
    kesan: 'Hujan asid yang melayukan daun dan pokok',
    explanation: 'Cemerlang! Gas sulfur dioksida bertindak balas dengan wap air membentuk hujan asid.',
    hint: 'Petunjuk: Lihat Babak 3 — gas kilang menghasilkan hujan yang merosakkan tumbuhan.',
  },
  {
    id: 'p4',
    punca: 'Pembakaran sampah secara terbuka setiap petang',
    kesan: 'Lapisan jerebu tebal mengurangkan jarak penglihatan',
    explanation: 'Tepat sekali! Asap pembakaran terbuka berkumpul menjadi jerebu tebal di ruang udara.',
    hint: 'Petunjuk: Asap yang banyak di ruang udara menjejaskan jarak penglihatan.',
  },
];

// Deterministic shuffled order so pupils actively think instead of matching straight across
const SHUFFLED_KESAN_IDS = ['p3', 'p1', 'p4', 'p2'];

interface Mission2PuzzleGameProps {
  user: UserAccount;
  playMalayAudio: (key: 'm1' | 'm2' | 'm4', scriptText: string, style: string) => Promise<void>;
  stopReportAudio: () => void;
  isPlayingAudio: boolean;
  isLoadingAudio: boolean;
  activeAudioKey: 'm1' | 'm2' | 'm4' | null;
  onCompleteMission2: (score: number, kbatScore: number, punca: string, kesan: string, kbat: string) => void;
}

export function Mission2PuzzleGame({
  user,
  playMalayAudio,
  stopReportAudio,
  isPlayingAudio,
  isLoadingAudio,
  activeAudioKey,
  onCompleteMission2,
}: Mission2PuzzleGameProps) {
  const prevM2 = user.progress?.m2;
  const [sceneIdx, setSceneIdx] = useState(0);
  const [selectedPuncaId, setSelectedPuncaId] = useState<string | null>(null);
  const [solvedIds, setSolvedIds] = useState<string[]>(prevM2?.completed ? PUZZLE_PAIRS.map((p) => p.id) : []);
  const [matchFeedback, setMatchFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const [m2Punca, setM2Punca] = useState(prevM2?.thinkingMap?.punca || '');
  const [m2Kesan, setM2Kesan] = useState(prevM2?.thinkingMap?.kesan || '');
  const [m2Kbat, setM2Kbat] = useState(prevM2?.kbatAnswer || '');
  const [oralPracticed, setOralPracticed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recStatus, setRecStatus] = useState('Sedia merakam analisis lisan');
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

  const kesanCards = useMemo(
    () => SHUFFLED_KESAN_IDS.map((id) => PUZZLE_PAIRS.find((p) => p.id === id)!),
    []
  );

  const hazePct = Math.max(0, 100 - solvedIds.length * 25);
  const allPairsSolved = solvedIds.length === PUZZLE_PAIRS.length;

  const handleClickKesan = (kesanId: string) => {
    if (solvedIds.includes(kesanId)) return;
    if (!selectedPuncaId) {
      playSFX('click');
      setMatchFeedback({
        ok: false,
        text: 'Klik satu kad PUNCA di sebelah kiri terlebih dahulu, kemudian padankan dengan kad KESAN di sebelah kanan!',
      });
      return;
    }

    if (selectedPuncaId === kesanId) {
      const pair = PUZZLE_PAIRS.find((p) => p.id === kesanId)!;
      playSFX(solvedIds.length + 1 === PUZZLE_PAIRS.length ? 'win' : 'xp');
      setSolvedIds((prev) => [...prev, kesanId]);
      setSelectedPuncaId(null);
      setMatchFeedback({ ok: true, text: pair.explanation });

      // Helpful auto-assist for thinking map when puzzle completes
      if (!m2Punca.trim()) {
        setM2Punca('Asap kilang tanpa penapis, kenderaan & pembakaran terbuka');
      }
      if (!m2Kesan.trim()) {
        setM2Kesan('Jerebu tebal, masalah asma & hujan asid merosakkan pokok');
      }
    } else {
      const target = PUZZLE_PAIRS.find((p) => p.id === selectedPuncaId)!;
      playSFX('error');
      setMistakes((m) => m + 1);
      setMatchFeedback({ ok: false, text: `Kurang tepat! ${target.hint}` });
    }
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
      setRecStatus('Sedang merakam suara analisis anda...');
    } catch {
      setRecStatus('Mikrofon disekat/tiada. Tandai butang latihan lantang di sebelah!');
      setMusicState({ ducked: false });
      playSFX('click');
    }
  };

  const handleStopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
      setMusicState({ ducked: false });
      setRecStatus('Rakaman analisis lisan berjaya disimpan!');
      setOralPracticed(true);
      playSFX('xp');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPairsSolved) {
      playSFX('error');
      setFormError('Selesaikan kesemua 4 pasangan Puzzle Punca ⇄ Kesan di atas untuk membersihkan jerebu kepada 0%!');
      return;
    }
    if (m2Punca.trim().length < 8 || m2Kesan.trim().length < 8) {
      playSFX('error');
      setFormError('Lengkapkan Peta Pemikiran (Punca Utama & Kesan Jangka Panjang).');
      return;
    }
    if (m2Kbat.trim().length < 15) {
      playSFX('error');
      setFormError('Jawapan KBAT masih terlalu ringkas. Terangkan kesan kepada kesihatan murid atau sesi persekolahan!');
      return;
    }

    setFormError(null);
    stopReportAudio();
    const puzzleScore = Math.max(80, 100 - mistakes * 5);
    const kbatScore = m2Kbat.trim().length >= 30 ? 95 : 85;
    const bonus = oralPracticed || audioUrl ? 5 : 0;
    const total = Math.min(100, Math.round((puzzleScore + kbatScore) / 2) + bonus);
    onCompleteMission2(total, kbatScore, m2Punca.trim(), m2Kesan.trim(), m2Kbat.trim());
  };

  return (
    <div className="space-y-4">
      {/* 1. Interactive Sky Haze Meter & Audio Briefing */}
      <div
        className="p-4 rounded-2xl border transition-colors space-y-3"
        style={{
          background:
            hazePct === 0
              ? 'linear-gradient(135deg, rgba(6,78,59,0.75), rgba(14,116,144,0.75))'
              : 'linear-gradient(135deg, rgba(67,20,7,0.72), rgba(30,41,59,0.92))',
          borderColor: hazePct === 0 ? 'rgba(52,211,153,0.7)' : 'rgba(251,146,60,0.6)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-game text-xs font-black text-amber-300 uppercase">
              🌫️ TAHAP JEREBU BANDAR BERACUN: {hazePct}%
            </div>
            <div className="text-[11px] text-slate-200">
              {hazePct === 0
                ? 'Syabas! Langit Bandar Beracun kembali biru dan bersih!'
                : 'Sambungkan kesemua 4 kad puzzle Punca ⇄ Kesan untuk menyedut jerebu!'}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 border border-cyan-400/50 font-mono-num text-xs font-black text-cyan-300">
            {solvedIds.length}/4 Pasangan
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-950/90 overflow-hidden border border-slate-700">
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{
              width: `${100 - hazePct}%`,
              background: 'linear-gradient(90deg, #f97316, #facc15, #34d399)',
            }}
          />
        </div>

        {/* Audio Briefing + Visual Babak */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-game text-xs font-bold text-cyan-300">
              🔊 Laporan Audio Ejen Bayu · {M2_SCENES[sceneIdx].icon} {M2_SCENES[sceneIdx].title}
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">{M2_SCENES[sceneIdx].text}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {M2_SCENES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  playSFX('click');
                  setSceneIdx(idx);
                }}
                className={`btn-game-sm px-2 py-1 text-[10px] font-bold cursor-pointer ${
                  sceneIdx === idx ? 'btn-game-gold text-slate-950' : 'btn-game-slate text-slate-200'
                }`}
              >
                B{idx + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={isLoadingAudio && activeAudioKey === 'm2'}
              onClick={() =>
                playMalayAudio(
                  'm2',
                  M2_AUDIO_SCRIPT,
                  'Clear, energetic standard Malaysian Bahasa Melayu speaker reporting urban air pollution causes and effects to primary school pupils.'
                )
              }
              className="btn-game-cyan btn-game-sm px-2.5 py-1 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-60"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>
                {isLoadingAudio && activeAudioKey === 'm2'
                  ? 'Menjana...'
                  : isPlayingAudio && activeAudioKey === 'm2'
                  ? 'Dimainkan'
                  : 'Dengar'}
              </span>
            </button>
            {isPlayingAudio && activeAudioKey === 'm2' && (
              <button
                type="button"
                onClick={stopReportAudio}
                className="btn-game-rose btn-game-sm px-2 py-1 text-white text-[11px] font-bold cursor-pointer"
              >
                Henti
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. PUZZLE GAME: Connect Punca (Left) <-> Kesan (Right) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-teal-400/50 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-game text-xs font-black text-teal-300 flex items-center gap-1.5 uppercase">
            <Link2 className="w-4 h-4 text-amber-300" />
            <span>Pusingan 1: Puzzle Sambung Punca ⇄ Kesan</span>
          </div>
          <span className="text-[11px] text-amber-200">
            1. Klik Kad Punca → 2. Klik Kad Kesan yang sepadan
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Punca Column */}
          <div className="space-y-2">
            <div className="text-[11px] font-game font-bold text-orange-300 uppercase">
              ⚡ Kad Punca Pencemaran
            </div>
            {PUZZLE_PAIRS.map((pair, idx) => {
              const solved = solvedIds.includes(pair.id);
              const selected = selectedPuncaId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={solved}
                  onClick={() => {
                    playSFX('click');
                    setSelectedPuncaId(pair.id);
                    setMatchFeedback(null);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    solved
                      ? 'bg-emerald-950/60 border-emerald-400/70 text-emerald-200 opacity-90'
                      : selected
                      ? 'bg-amber-400 text-slate-950 border-white font-black scale-[1.01] shadow-lg'
                      : 'bg-slate-950 border-slate-700 text-slate-100 hover:border-amber-400/60'
                  }`}
                >
                  <span>
                    <strong className="mr-1.5">{idx + 1}.</strong>
                    {pair.punca}
                  </span>
                  {solved && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Kesan Column */}
          <div className="space-y-2">
            <div className="text-[11px] font-game font-bold text-cyan-300 uppercase">
              🎯 Kad Kesan Alam &amp; Manusia
            </div>
            {kesanCards.map((pair) => {
              const solved = solvedIds.includes(pair.id);
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={solved}
                  onClick={() => handleClickKesan(pair.id)}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    solved
                      ? 'bg-emerald-950/60 border-emerald-400/70 text-emerald-200'
                      : selectedPuncaId
                      ? 'bg-slate-950 border-cyan-400/60 text-cyan-100 hover:bg-cyan-950/60'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>{pair.kesan}</span>
                  {solved ? (
                    <span className="text-[10px] font-game font-black px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 shrink-0">
                      SEPADAN ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-cyan-300 shrink-0">Padan →</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {matchFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
              matchFeedback.ok
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                : 'bg-amber-950/80 border-amber-400 text-amber-100'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span>{matchFeedback.text}</span>
          </div>
        )}
      </div>

      {/* 3. Thinking Map + KBAT + Oral Practice */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Peta Pemikiran: Rumusan Punca Utama
            </label>
            <input
              required
              value={m2Punca}
              onChange={(e) => {
                setM2Punca(e.target.value);
                setFormError(null);
              }}
              placeholder="Contoh: Asap kilang tanpa penapis & pembakaran terbuka"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Peta Pemikiran: Rumusan Kesan Jangka Panjang
            </label>
            <input
              required
              value={m2Kesan}
              onChange={(e) => {
                setM2Kesan(e.target.value);
                setFormError(null);
              }}
              placeholder="Contoh: Jerebu tebal, penyakit asma & hujan asid"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Cabaran KBAT: Apakah kesan terhadap murid sekolah jika udara kekal beracun selama 6 bulan?
          </label>
          <textarea
            required
            rows={2}
            value={m2Kbat}
            onChange={(e) => {
              setM2Kbat(e.target.value);
              setFormError(null);
            }}
            placeholder="Huraikan ramalan kritis anda (contoh: kesihatan paru-paru murid terjejas, sekolah terpaksa ditutup)..."
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm"
          />
        </div>

        {/* Oral Speaking Practice (SP 1.2.2) */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-teal-500/40 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-game text-xs font-bold text-teal-300">
              🎙️ Latihan Bertutur SP 1.2.2: Suarakan 1 Punca &amp; 1 Kesan
            </span>
            <button
              type="button"
              onClick={() => {
                playSFX('xp');
                setOralPracticed(true);
              }}
              className={`btn-game-sm px-3 py-1 text-[11px] font-bold cursor-pointer ${
                oralPracticed ? 'btn-game-emerald text-slate-950' : 'btn-game-slate text-cyan-200'
              }`}
            >
              {oralPracticed ? '✅ Sudah Berlatih Lisan' : 'Tandai Sebut Lantang'}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={recording}
              onClick={handleStartRec}
              className="btn-game-emerald btn-game-sm px-3 py-1.5 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Mic className="w-3.5 h-3.5" /> Rakam Suara
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

        {formError && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 text-xs font-semibold flex items-start gap-2">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-game-cyan w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
        >
          {allPairsSolved
            ? 'Sahkan Analisis & Bersihkan Jerebu →'
            : `Selesaikan Puzzle (${solvedIds.length}/4) Untuk Teruskan`}
        </button>
      </form>
    </div>
  );
}
