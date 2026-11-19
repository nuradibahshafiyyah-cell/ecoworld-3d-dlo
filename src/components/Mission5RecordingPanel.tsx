import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mic,
  Play,
  RotateCcw,
  Send,
  Square,
  Video,
  Volume2,
} from 'lucide-react';
import { StudentRecordingSubmission, SubmissionMediaType, UserAccount } from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { fetchSubmissions, uploadMission5Recording } from '../utils/submissionsApi';

interface Mission5RecordingPanelProps {
  user: UserAccount;
  campaignTitle: string;
  onSubmissionSuccess: (submission: StudentRecordingSubmission) => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Mission5RecordingPanel({
  user,
  campaignTitle,
  onSubmissionSuccess,
}: Mission5RecordingPanelProps) {
  const [mediaType, setMediaType] = useState<SubmissionMediaType>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Draft recording held in memory ONLY after stopping so pupil can preview before deciding
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [draftMediaType, setDraftMediaType] = useState<SubmissionMediaType>('audio');

  // Re-record confirmation state (warns before replacing previous draft/recording)
  const [confirmReRecordOpen, setConfirmReRecordOpen] = useState(false);

  // Submission status & server-persisted records
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedSubmission, setSavedSubmission] = useState<StudentRecordingSubmission | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Load any previously submitted recording for this student on mount (survives page reload)
  useEffect(() => {
    let cancelled = false;
    fetchSubmissions(user)
      .then((list) => {
        if (!cancelled && list.length > 0) {
          setSavedSubmission(list[0]);
        }
      })
      .catch(() => {
        // Silent fallback if no records yet
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Recording elapsed timer
  useEffect(() => {
    if (!isRecording) return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isRecording]);

  // Clean up object URLs & active streams on unmount
  useEffect(() => {
    return () => {
      setMusicState({ ducked: false });
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (draftUrl) URL.revokeObjectURL(draftUrl);
    };
  }, [draftUrl]);

  const stopStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  const handleStartRecording = async () => {
    setDeviceError(null);
    setSubmitNotice(null);
    setConfirmReRecordOpen(false);

    try {
      const constraints: MediaStreamConstraints =
        mediaType === 'video' ? { audio: true, video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mediaType === 'video' && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }

      const preferredMime =
        mediaType === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const rec = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        const mime = rec.mimeType || (mediaType === 'video' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        setDraftBlob(blob);
        setDraftUrl(url);
        setDraftMediaType(mediaType);
        stopStreams();
        setMusicState({ ducked: false });
      };

      setElapsedSec(0);
      rec.start();
      setIsRecording(true);
      setMusicState({ ducked: true });
      playSFX('click');
    } catch {
      stopStreams();
      setMusicState({ ducked: false });
      playSFX('error');
      setDeviceError(
        mediaType === 'video'
          ? 'Kamera atau mikrofon tidak dapat diakses. Sila benarkan kebenaran kamera & mikrofon pada pelayar anda atau tukar ke mod Audio.'
          : 'Mikrofon tidak dapat diakses. Sila benarkan kebenaran mikrofon pada pelayar anda.'
      );
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setIsRecording(false);
      playSFX('xp');
    }
  };

  const handleReplayPreview = () => {
    setMusicState({ ducked: true });
    if (draftMediaType === 'video' && previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
      previewVideoRef.current.play().catch(() => {});
    } else if (draftMediaType === 'audio' && previewAudioRef.current) {
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current.play().catch(() => {});
    }
  };

  const handleConfirmReRecord = () => {
    playSFX('click');
    setConfirmReRecordOpen(false);
    setDraftBlob(null);
    setDraftUrl(null);
    setSubmitNotice(null);
  };

  const handleSubmitRecording = async () => {
    if (!draftBlob) return;
    setIsSubmitting(true);
    setSubmitNotice(null);

    try {
      const saved = await uploadMission5Recording({
        user,
        blob: draftBlob,
        mediaType: draftMediaType,
        campaignTitle,
      });
      setSavedSubmission(saved);
      setDraftBlob(null);
      setDraftUrl(null);
      playSFX('win');
      setSubmitNotice({
        ok: true,
        text: 'Rakaman anda berjaya dihantar! Guru kini boleh memainkan dan menilai hasil kerja anda.',
      });
      onSubmissionSuccess(saved);
    } catch (err) {
      playSFX('error');
      setSubmitNotice({
        ok: false,
        text:
          err instanceof Error
            ? err.message
            : 'Penghantaran rakaman gagal. Sila semak sambungan dan cuba lagi.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border-2 border-teal-400/55 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-game text-xs sm:text-sm font-black text-teal-300 uppercase">
            Studio Rakaman Kempen Misi 5 (Audio / Video)
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Pilih jenis tugasan, rakam penyampaian anda, semak semula sebelum menekan Selesai &amp; Hantar.
          </p>
        </div>

        {/* Submission status badge if already sent */}
        {savedSubmission && (
          <div className="px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-game font-black flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>STATUS: {savedSubmission.status}</span>
          </div>
        )}
      </div>

      {/* Mode Switch: Audio (Mic) or Video (Camera) */}
      {!isRecording && !draftUrl && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              playSFX('click');
              setMediaType('audio');
              setDeviceError(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-game text-xs font-black flex items-center justify-center gap-2 cursor-pointer ${
              mediaType === 'audio'
                ? 'btn-game-cyan text-slate-950'
                : 'btn-game-slate text-slate-200'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Tugasan Audio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playSFX('click');
              setMediaType('video');
              setDeviceError(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-game text-xs font-black flex items-center justify-center gap-2 cursor-pointer ${
              mediaType === 'video'
                ? 'btn-game-cyan text-slate-950'
                : 'btn-game-slate text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Tugasan Video</span>
          </button>
        </div>
      )}

      {/* Live Video Preview while recording video */}
      {mediaType === 'video' && isRecording && (
        <div className="relative rounded-2xl overflow-hidden border-2 border-rose-400 bg-black aspect-video">
          <video
            ref={liveVideoRef}
            muted
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-rose-600/95 text-white font-game text-xs font-black flex items-center gap-2 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>MERAKAM VIDEO · {formatDuration(elapsedSec)}</span>
          </div>
        </div>
      )}

      {/* Live Audio Wave Animation while recording audio */}
      {mediaType === 'audio' && isRecording && (
        <div className="p-4 rounded-2xl bg-slate-950 border-2 border-rose-500/80 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-rose-300 font-game text-xs font-black">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <span>SEDANG MERAKAM SUARA · {formatDuration(elapsedSec)}</span>
          </div>
          <div className="flex items-end gap-1.5 h-10">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 0.08}s` }}
                className="w-2 h-9 rounded-full bg-gradient-to-t from-emerald-400 to-cyan-300 wave-bar-active"
              />
            ))}
          </div>
        </div>
      )}

      {/* Primary Large Start / Stop Recording Controls (shown when not holding an unreviewed draft) */}
      {!draftUrl && (
        <div className="flex flex-wrap items-center gap-3">
          {!isRecording ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="btn-game-emerald w-full sm:w-auto flex-1 py-3.5 px-6 text-slate-950 font-game text-sm font-black tracking-wide flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {mediaType === 'video' ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span>MULA RAKAMAN ({mediaType === 'video' ? 'VIDEO' : 'AUDIO'})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              className="btn-game-rose w-full py-3.5 px-6 text-white font-game text-sm font-black tracking-wide flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>HENTIKAN RAKAMAN</span>
            </button>
          )}
        </div>
      )}

      {deviceError && (
        <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-400 text-rose-100 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <span>{deviceError}</span>
        </div>
      )}

      {/* ===================================================================
          PREVIEW & DECISION STAGE (After Stop: Replay, Rakam Semula, Hantar)
         =================================================================== */}
      {draftUrl && (
        <div className="p-4 rounded-2xl bg-slate-950 border-2 border-cyan-400/70 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-game text-xs font-black text-cyan-300 uppercase flex items-center gap-2">
              {draftMediaType === 'video' ? <Video className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>Pratonton Rakaman ({draftMediaType === 'video' ? 'Video' : 'Audio'})</span>
            </div>
            <span className="text-[11px] font-semibold text-amber-300">
              Semak sebelum menghantar ({formatDuration(elapsedSec)})
            </span>
          </div>

          {draftMediaType === 'video' ? (
            <video
              ref={previewVideoRef}
              controls
              src={draftUrl}
              onPlay={() => setMusicState({ ducked: true })}
              onPause={() => setMusicState({ ducked: false })}
              onEnded={() => setMusicState({ ducked: false })}
              className="w-full rounded-xl bg-black aspect-video border border-slate-700"
            />
          ) : (
            <audio
              ref={previewAudioRef}
              controls
              src={draftUrl}
              onPlay={() => setMusicState({ ducked: true })}
              onPause={() => setMusicState({ ducked: false })}
              onEnded={() => setMusicState({ ducked: false })}
              className="w-full h-10"
            />
          )}

          {/* Dedicated Replay Button */}
          <button
            type="button"
            onClick={handleReplayPreview}
            className="btn-game-cyan btn-game-sm w-full py-2.5 px-4 text-slate-950 font-game text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{draftMediaType === 'video' ? 'TONTON SEMULA' : 'DENGAR SEMULA'}</span>
          </button>

          {/* Re-record Confirmation Warning Dialog */}
          {confirmReRecordOpen ? (
            <div className="p-3.5 rounded-xl bg-amber-950/90 border-2 border-amber-400 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-amber-100 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  Amaran Pengesahan: Rakaman terdahulu ini akan digantikan dengan rakaman baharu. Adakah anda pasti mahu merakam semula?
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReRecordOpen(false)}
                  className="btn-game-slate btn-game-sm py-2 px-3 text-slate-100 font-game text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReRecord}
                  className="btn-game-gold btn-game-sm py-2 px-3 text-slate-950 font-game text-xs font-black cursor-pointer"
                >
                  Ya, Rakam Semula
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  playSFX('click');
                  setConfirmReRecordOpen(true);
                }}
                className="btn-game-gold py-3 px-4 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RAKAM SEMULA</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitRecording}
                className="btn-game-emerald py-3 px-4 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'MENGHANTAR...' : 'SELESAI & HANTAR'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submission Notification */}
      {submitNotice && (
        <div
          className={`p-3.5 rounded-xl border-2 text-xs font-bold flex items-center gap-2.5 ${
            submitNotice.ok
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
              : 'bg-rose-950/90 border-rose-400 text-rose-100'
          }`}
        >
          {submitNotice.ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{submitNotice.text}</span>
        </div>
      )}

      {/* Persisted Latest Submission Preview (visible after sending or reloading) */}
      {savedSubmission && !draftUrl && (
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/45 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-game font-bold text-emerald-300">
              Rekod Terakhir Disimpan ({savedSubmission.mediaType === 'video' ? 'Video' : 'Audio'})
            </span>
            <span className="text-slate-400">
              {new Date(savedSubmission.submittedAt).toLocaleString('ms-MY')}
            </span>
          </div>

          {savedSubmission.mediaUrl && savedSubmission.mediaType === 'video' && (
            <video
              controls
              src={savedSubmission.mediaUrl}
              onPlay={() => setMusicState({ ducked: true })}
              onPause={() => setMusicState({ ducked: false })}
              onEnded={() => setMusicState({ ducked: false })}
              className="w-full rounded-xl bg-black aspect-video border border-slate-800"
            />
          )}

          {savedSubmission.mediaUrl && savedSubmission.mediaType === 'audio' && (
            <audio
              controls
              src={savedSubmission.mediaUrl}
              onPlay={() => setMusicState({ ducked: true })}
              onPause={() => setMusicState({ ducked: false })}
              onEnded={() => setMusicState({ ducked: false })}
              className="w-full h-9"
            />
          )}

          {savedSubmission.teacherComment && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-sky-500/35 text-xs text-sky-100">
              <strong className="text-sky-300">Penilaian Guru:</strong>{' '}
              {savedSubmission.teacherScore !== null ? `${savedSubmission.teacherScore}% · ` : ''}
              {savedSubmission.teacherGrade ? `${savedSubmission.teacherGrade} · ` : ''}
              {savedSubmission.teacherComment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
