import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Mic,
  Play,
  Puzzle,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import { M4_SAMPLE_SPEECH } from '../../data/gameData';
import { UserAccount } from '../../types/game';
import { playSFX, setMusicState } from '../../utils/sound';

interface PuzzleBlock {
  key: 'pendirian' | 'bukti' | 'huraian' | 'kesimpulan';
  order: number;
  label: string;
  desc: string;
}

const SCRAMBLED_BLOCKS: PuzzleBlock[] = [
  {
    key: 'kesimpulan',
    order: 4,
    label: 'Kesimpulan / Seruan',
    desc: 'Mengajak masyarakat bertindak bersama.',
  },
  {
    key: 'bukti',
    order: 2,
    label: 'Bukti Tersurat & Tersirat',
    desc: 'Fakta daripada laporan atau penyiasatan.',
  },
  {
    key: 'pendirian',
    order: 1,
    label: 'Pendirian Utama',
    desc: 'Menyatakan sikap jelas tentang isu.',
  },
  {
    key: 'huraian',
    order: 3,
    label: 'Huraian Kritis & Cadangan Kreatif',
    desc: 'Cadangan bernas dan kreatif untuk menyelesaikan masalah.',
  },
];

const CREATIVE_CHIPS = [
  'pasang penapis asap pintar dan bina taman mini sekolah',
  'adakan zon bebas kenderaan bermotor dan lorong basikal solar',
  'laksanakan sistem sensor pengesan sisa kimia di sungai',
  'wujudkan sudut kitar semula kreatif di setiap kelas',
];

interface Mission4SpeechStageProps {
  user: UserAccount;
  playMalayAudio: (key: 'm1' | 'm2' | 'm4', scriptText: string, style: string) => Promise<void>;
  stopReportAudio: () => void;
  isPlayingAudio: boolean;
  isLoadingAudio: boolean;
  activeAudioKey: 'm1' | 'm2' | 'm4' | null;
  onCompleteMission4: (
    score: number,
    argument: { pendirian: string; bukti: string; huraian: string; kesimpulan: string },
    hasRecording: boolean,
    peerFeedback: string
  ) => void;
}

export function Mission4SpeechStage({
  user,
  playMalayAudio,
  stopReportAudio,
  isPlayingAudio,
  isLoadingAudio,
  activeAudioKey,
  onCompleteMission4,
}: Mission4SpeechStageProps) {
  const prevM4 = user.progress?.m4;
  const alreadySolved = Boolean(prevM4?.completed);

  // Stage 1: Puzzle Order Builder
  const [arrangedKeys, setArrangedKeys] = useState<string[]>(
    alreadySolved ? ['pendirian', 'bukti', 'huraian', 'kesimpulan'] : []
  );
  const [puzzleFeedback, setPuzzleFeedback] = useState<string | null>(null);
  const puzzleUnlocked = arrangedKeys.length === 4;

  // Stage 2: Structured Creative Argument
  const [m4P, setM4P] = useState(prevM4?.argument?.pendirian || '');
  const [m4B, setM4B] = useState(prevM4?.argument?.bukti || '');
  const [m4H, setM4H] = useState(prevM4?.argument?.huraian || '');
  const [m4K, setM4K] = useState(prevM4?.argument?.kesimpulan || '');
  const [m4Peer, setM4Peer] = useState(user.peerFeedback || '');

  // Stage 3: Teleprompter Highlight + Oral Criteria + Recording
  const [teleprompterIdx, setTeleprompterIdx] = useState<number>(-1);
  const teleTimerRef = useRef<number | null>(null);
  const [criteria, setCriteria] = useState({ sebutan: false, intonasi: false, gaya: false });
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recStatus, setRecStatus] = useState('Sedia merakam ucapan anda');
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (teleTimerRef.current) window.clearInterval(teleTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setMusicState({ ducked: false });
    };
  }, []);

  const handlePickBlock = (block: PuzzleBlock) => {
    const nextExpectedOrder = arrangedKeys.length + 1;
    if (arrangedKeys.includes(block.key)) return;
    if (block.order === nextExpectedOrder) {
      playSFX(nextExpectedOrder === 4 ? 'win' : 'xp');
      setArrangedKeys((prev) => [...prev, block.key]);
      setPuzzleFeedback(
        nextExpectedOrder === 4
          ? '🎉 Susunan Blok Hujah Lengkap! Pentas Pembina Skrip & Teleprompter kini dibuka!'
          : `✅ Tepat! Langkah ${nextExpectedOrder} ialah ${block.label}.`
      );
    } else {
      playSFX('error');
      const expected = SCRAMBLED_BLOCKS.find((b) => b.order === nextExpectedOrder)!;
      setPuzzleFeedback(
        `💡 Belum tepat! Selepas langkah ${nextExpectedOrder - 1}, kita perlukan blok "${expected.label}" (${expected.desc}).`
      );
    }
  };

  const handleRunTeleprompter = () => {
    if (teleTimerRef.current) {
      window.clearInterval(teleTimerRef.current);
      teleTimerRef.current = null;
      setTeleprompterIdx(-1);
      return;
    }
    playSFX('click');
    setTeleprompterIdx(0);
    let idx = 0;
    teleTimerRef.current = window.setInterval(() => {
      idx += 1;
      if (idx > 3) {
        if (teleTimerRef.current) window.clearInterval(teleTimerRef.current);
        teleTimerRef.current = null;
        setTeleprompterIdx(-1);
      } else {
        setTeleprompterIdx(idx);
      }
    }, 3200);
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
      setRecStatus('Sedang merakam ucapan teleprompter anda...');
    } catch {
      setRecStatus('Mikrofon disekat/tiada. Anda masih boleh berlatih menggunakan Teleprompter!');
      setMusicState({ ducked: false });
      playSFX('click');
    }
  };

  const handleStopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
      setMusicState({ ducked: false });
      setRecStatus('Rakaman suara hujah berjaya disimpan!');
      playSFX('xp');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puzzleUnlocked) {
      playSFX('error');
      setErrorSummary('Susun kesemua 4 Blok Puzzle Hujah mengikut urutan yang betul terlebih dahulu!');
      return;
    }
    if (
      m4P.trim().length < 10 ||
      m4B.trim().length < 10 ||
      m4H.trim().length < 10 ||
      m4K.trim().length < 8
    ) {
      playSFX('error');
      setErrorSummary(
        'Setiap bahagian hujah (Pendirian, Bukti, Huraian Kreatif, dan Kesimpulan) perlu ditulis sekurang-kurangnya 1 ayat lengkap!'
      );
      return;
    }
    setErrorSummary(null);
    stopReportAudio();
    const hasRec = Boolean(audioUrl) || Boolean(prevM4?.hasRecording);
    const critBonus = (criteria.sebutan ? 3 : 0) + (criteria.intonasi ? 3 : 0) + (criteria.gaya ? 4 : 0);
    const score = Math.min(100, 75 + (hasRec ? 15 : 5) + (m4Peer.trim().length > 5 ? 5 : 0) + critBonus);
    onCompleteMission4(
      score,
      {
        pendirian: m4P.trim(),
        bukti: m4B.trim(),
        huraian: m4H.trim(),
        kesimpulan: m4K.trim(),
      },
      hasRec,
      m4Peer.trim() || 'Penyampaian lisan dilatih menggunakan teleprompter dengan sebutan dan intonasi yang sesuai.'
    );
  };

  const speechLines = [
    { title: '1. Pendirian', text: m4P.trim() || '(Isi pendirian anda di atas...)' },
    { title: '2. Bukti', text: m4B.trim() || '(Isi bukti tersurat & tersirat...)' },
    { title: '3. Huraian Kreatif', text: m4H.trim() || '(Isi cadangan kreatif anda...)' },
    { title: '4. Kesimpulan', text: m4K.trim() || '(Isi seruan penutup...)' },
  ];

  return (
    <div className="space-y-4">
      {/* Model Speech Header */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-purple-400/50 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-game text-xs font-bold text-purple-300">
            🎧 Contoh Penyampaian Ejen Suara (Model Sebutan &amp; Intonasi)
          </div>
          <div className="text-[11px] text-slate-400">
            Dengar cara menyusun hujah kritis dan bertutur dengan yakin.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoadingAudio && activeAudioKey === 'm4'}
            onClick={() =>
              playMalayAudio(
                'm4',
                M4_SAMPLE_SPEECH,
                'Confident, expressive, friendly Malaysian Bahasa Melayu girl speaker demonstrating clear pronunciation and persuasive intonation for primary school pupils.'
              )
            }
            className="btn-game-cyan btn-game-sm px-3 py-1.5 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-60"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>
              {isLoadingAudio && activeAudioKey === 'm4'
                ? 'Menjana...'
                : isPlayingAudio && activeAudioKey === 'm4'
                ? 'Dimainkan...'
                : 'Dengar Contoh'}
            </span>
          </button>
          {isPlayingAudio && activeAudioKey === 'm4' && (
            <button
              type="button"
              onClick={stopReportAudio}
              className="btn-game-rose btn-game-sm px-2.5 py-1.5 text-white text-xs font-bold cursor-pointer"
            >
              Henti
            </button>
          )}
        </div>
      </div>

      {/* STAGE 1: PUZZLE SUSUN TURUTAN BLOK HUJAH */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-sky-400/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-game text-xs font-black text-sky-300 flex items-center gap-1.5 uppercase">
            <Puzzle className="w-4 h-4 text-amber-300" />
            <span>Peringkat 1: Puzzle Susun Struktur Hujah ({arrangedKeys.length}/4)</span>
          </div>
          {arrangedKeys.length > 0 && !puzzleUnlocked && (
            <button
              type="button"
              onClick={() => {
                setArrangedKeys([]);
                setPuzzleFeedback(null);
              }}
              className="text-[11px] text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Susun Semula
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCRAMBLED_BLOCKS.map((blk) => {
            const pos = arrangedKeys.indexOf(blk.key);
            const placed = pos !== -1;
            return (
              <button
                key={blk.key}
                type="button"
                disabled={placed}
                onClick={() => handlePickBlock(blk)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  placed
                    ? 'bg-emerald-950/70 border-emerald-400 text-emerald-100'
                    : 'bg-slate-950 border-slate-700 hover:border-amber-400 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-game text-xs font-black">
                    {placed ? `#${pos + 1} · ` : '🧩 '}
                    {blk.label}
                  </span>
                  {placed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">{blk.desc}</div>
              </button>
            );
          })}
        </div>

        {puzzleFeedback && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-amber-200 font-semibold flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span>{puzzleFeedback}</span>
          </div>
        )}
      </div>

      {/* STAGE 2 & 3: SCRIPT BUILDER + TELEPROMPTER STAGE */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div
          className={`p-4 rounded-2xl border space-y-3 transition-opacity ${
            puzzleUnlocked
              ? 'bg-slate-900 border-amber-400/50 opacity-100'
              : 'bg-slate-900/60 border-slate-800 opacity-60 pointer-events-none'
          }`}
        >
          <div className="font-game text-xs font-black text-amber-300 uppercase">
            Peringkat 2: Bina Hujah Kritis &amp; Cadangan Kreatif Anda
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-sky-300">Idea Kreatif Pantas:</span>
            {CREATIVE_CHIPS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  playSFX('click');
                  setM4H(`Oleh itu, cadangan kreatif saya ialah kita perlu ${idea}.`);
                  setErrorSummary(null);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-sky-900 border border-sky-400/40 text-[10px] font-semibold text-sky-200 cursor-pointer"
              >
                + {idea}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">1. Pendirian</label>
              <input
                value={m4P}
                onChange={(e) => {
                  setM4P(e.target.value);
                  setErrorSummary(null);
                }}
                placeholder="Saya berpendapat pencemaran alam mesti dihentikan segera..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                2. Bukti Tersurat &amp; Tersirat
              </label>
              <input
                value={m4B}
                onChange={(e) => {
                  setM4B(e.target.value);
                  setErrorSummary(null);
                }}
                placeholder="Buktinya, laporan Puan Aminah dan data udara menunjukkan..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                3. Huraian Kritis &amp; Cadangan Kreatif
              </label>
              <input
                value={m4H}
                onChange={(e) => {
                  setM4H(e.target.value);
                  setErrorSummary(null);
                }}
                placeholder="Oleh itu, cadangan kreatif saya ialah..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">4. Kesimpulan / Seruan</label>
              <input
                value={m4K}
                onChange={(e) => {
                  setM4K(e.target.value);
                  setErrorSummary(null);
                }}
                placeholder="Tegasnya, marilah kita bersatu menyelamatkan bumi!"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* STAGE 3: INTERACTIVE TELEPROMPTER & RECORDING */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/45 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-game text-xs font-black text-emerald-300 flex items-center gap-1.5 uppercase">
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Peringkat 3: Pentas Teleprompter &amp; Rakaman Ucapan</span>
            </div>
            <button
              type="button"
              onClick={handleRunTeleprompter}
              className="btn-game-cyan btn-game-sm px-3 py-1 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{teleprompterIdx >= 0 ? 'Henti Sorotan' : 'Mainkan Sorotan Skrip'}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            {speechLines.map((line, i) => {
              const active = teleprompterIdx === i;
              return (
                <div
                  key={line.title}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    active
                      ? 'bg-amber-400 text-slate-950 font-black scale-[1.01]'
                      : 'text-slate-300'
                  }`}
                >
                  <strong className="mr-1.5">{line.title}:</strong>
                  <span>{line.text}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={recording}
              onClick={handleStartRec}
              className="btn-game-emerald btn-game-sm px-3.5 py-2 disabled:opacity-40 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" /> Mula Rakam Ucapan
            </button>
            <button
              type="button"
              disabled={!recording}
              onClick={handleStopRec}
              className="btn-game-rose btn-game-sm px-3.5 py-2 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" /> Henti
            </button>
            <span className="text-xs text-amber-300">{recStatus}</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
            {[
              ['sebutan', 'Sebutan baku jelas'],
              ['intonasi', 'Intonasi bersemangat'],
              ['gaya', 'Gaya yakin & sesuai'],
            ].map(([k, lbl]) => {
              const key = k as keyof typeof criteria;
              return (
                <label
                  key={k}
                  className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer ${
                    criteria[key]
                      ? 'bg-emerald-950/60 border-emerald-400 text-emerald-100'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={criteria[key]}
                    onChange={(e) => setCriteria((p) => ({ ...p, [key]: e.target.checked }))}
                    className="accent-emerald-400"
                  />
                  <span>{lbl}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Semakan Kendiri / Rakan Sebaya
          </label>
          <input
            value={m4Peer}
            onChange={(e) => setM4Peer(e.target.value)}
            placeholder="Sebutan baku jelas, intonasi bertenaga dan cadangan kreatif saya meyakinkan..."
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm"
          />
        </div>

        {errorSummary && (
          <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-100 text-xs font-semibold flex items-start gap-2">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorSummary}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-game-gold w-full py-3 rounded-xl text-slate-950 font-game font-black text-sm tracking-wider uppercase cursor-pointer"
        >
          Simpan Skrip &amp; Buka Studio Kempen Misi 5 →
        </button>
      </form>
    </div>
  );
}
