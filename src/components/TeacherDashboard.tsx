import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Video,
} from 'lucide-react';
import { BADGES_DEF } from '../data/gameData';
import { DatabaseState, StudentRecordingSubmission, UserAccount } from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { fetchSubmissions, saveSubmissionReview } from '../utils/submissionsApi';
import { calcOverallScore, computeAIGuide, getMasteryLevel } from '../utils/storage';

interface TeacherDashboardProps {
  db: DatabaseState;
  teacher: UserAccount;
  onSaveFeedback: (studentId: string, feedback: string) => void;
  onApproveAI: (studentId: string, approved: boolean) => void;
}

export function TeacherDashboard({
  db,
  teacher,
  onSaveFeedback,
  onApproveAI,
}: TeacherDashboardProps) {
  const [tab, setTab] = useState<'overview' | 'analytics' | 'submissions'>('overview');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fbDraft, setFbDraft] = useState('');
  const [minimized, setMinimized] = useState(false);

  // Mission 5 Student Recordings & Teacher Review state
  const [submissions, setSubmissions] = useState<StudentRecordingSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [playingSubId, setPlayingSubId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { comment: string; score: string; grade: string }>
  >({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [savedReviewNotice, setSavedReviewNotice] = useState<string | null>(null);
  const mediaRefs = useRef<Record<string, HTMLMediaElement | null>>({});

  const loadSubmissions = useCallback(async () => {
    setLoadingSubs(true);
    setSubsError(null);
    try {
      const list = await fetchSubmissions(teacher);
      setSubmissions(list);
      setReviewDrafts((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (!next[item.id]) {
            next[item.id] = {
              comment: item.teacherComment || '',
              score: item.teacherScore !== null ? String(item.teacherScore) : '',
              grade: item.teacherGrade || 'Cemerlang',
            };
          }
        }
        return next;
      });
    } catch (err) {
      setSubsError(err instanceof Error ? err.message : 'Gagal memuatkan rakaman murid.');
    } finally {
      setLoadingSubs(false);
    }
  }, [teacher]);

  useEffect(() => {
    loadSubmissions();
    return () => {
      setMusicState({ ducked: false });
    };
  }, [loadSubmissions]);

  const handleTogglePlaySubmission = (id: string) => {
    const targetEl = mediaRefs.current[id];
    if (!targetEl) return;

    Object.entries(mediaRefs.current).forEach(([otherId, el]) => {
      if (otherId !== id && el && !el.paused) {
        el.pause();
      }
    });

    if (targetEl.paused) {
      targetEl.play().catch(() => {});
      setPlayingSubId(id);
      setMusicState({ ducked: true });
    } else {
      targetEl.pause();
      setPlayingSubId(null);
      setMusicState({ ducked: false });
    }
  };

  const handleSaveSubmissionReview = async (subId: string) => {
    const draft = reviewDrafts[subId] || { comment: '', score: '', grade: 'Cemerlang' };
    setSavingReviewId(subId);
    setSavedReviewNotice(null);
    try {
      const updated = await saveSubmissionReview({
        teacher,
        submissionId: subId,
        teacherComment: draft.comment,
        teacherScore: draft.score === '' ? null : Number(draft.score),
        teacherGrade: draft.grade,
      });
      setSubmissions((prev) => prev.map((s) => (s.id === subId ? updated : s)));
      playSFX('xp');
      setSavedReviewNotice(`Penilaian untuk ${updated.studentName} telah disimpan.`);
    } catch (err) {
      playSFX('error');
      setSubsError(err instanceof Error ? err.message : 'Gagal menyimpan penilaian.');
    } finally {
      setSavingReviewId(null);
    }
  };

  const allStudents = db.users.filter((u) => u.role === 'murid');
  const students =
    selectedClass === 'ALL'
      ? allStudents
      : allStudents.filter((s) => s.className === selectedClass);

  const activeCount = students.filter((s) => (s.xp || 0) > 0).length;
  const avgScore = students.length
    ? Math.round(students.reduce((acc, s) => acc + calcOverallScore(s), 0) / students.length)
    : 0;
  const completedMissions = students.reduce((acc, s) => {
    const p = s.progress;
    if (!p) return acc;
    return (
      acc +
      (['m1', 'm2', 'm3', 'm4', 'm5'] as const).filter((k) => {
        const m = p[k];
        return 'submitted' in m ? m.submitted : m.completed;
      }).length
    );
  }, 0);
  const needGuidanceCount = students.filter((s) => computeAIGuide(s).needsIntervention).length;
  const selectedStudent = allStudents.find((s) => s.id === selectedId) || null;

  if (minimized) {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="btn-game-cyan px-5 py-2.5 rounded-2xl text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
        >
          <span className="btn-icon-3d w-6 h-6 text-xs">📊</span>
          <span>▴ Buka Papan Guru</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-4 z-30 flex items-start justify-center p-4 pointer-events-none">
      <div className="w-full max-w-6xl max-h-full overflow-y-auto eco-scroll bg-slate-950/95 border border-sky-500/40 rounded-3xl p-6 text-slate-100 shadow-2xl pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Papan Guru · {teacher.fullName}
            </h2>
            <p className="text-xs text-slate-400">
              Pilih kelas untuk memantau rekod jawapan murid dan status bimbingan secara masa nyata
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={`btn-game-sm px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'overview'
                  ? 'btn-game-emerald text-slate-950'
                  : 'btn-game-slate text-slate-200'
              }`}
            >
              <span className="btn-icon-3d w-5 h-5 text-[11px]">📋</span>
              <span>Rekod Murid</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`btn-game-sm px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'analytics'
                  ? 'btn-game-emerald text-slate-950'
                  : 'btn-game-slate text-slate-200'
              }`}
            >
              <span className="btn-icon-3d w-5 h-5 text-[11px]">📈</span>
              <span>Analitik & Intervensi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('submissions');
                loadSubmissions();
              }}
              className={`btn-game-sm px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'submissions'
                  ? 'btn-game-cyan text-slate-950'
                  : 'btn-game-slate text-slate-200'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Hasil Kerja Murid ({submissions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="btn-game-slate btn-game-sm px-3.5 py-2 text-xs font-bold text-sky-200 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="btn-icon-3d w-5 h-5 text-[11px]">🏝️</span>
              <span>▾ Tinjau Pulau 3D</span>
            </button>
          </div>
        </div>

        {/* Class Filter Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 mr-1">Pilih Kelas:</span>
            <button
              type="button"
              onClick={() => setSelectedClass('ALL')}
              className={`btn-game-sm px-3 py-1.5 text-xs font-bold cursor-pointer ${
                selectedClass === 'ALL'
                  ? 'btn-game-cyan text-slate-950'
                  : 'btn-game-slate text-slate-200'
              }`}
            >
              Semua Kelas ({allStudents.length})
            </button>
            {db.classes.map((cls) => {
              const count = allStudents.filter((s) => s.className === cls.name).length;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClass(cls.name)}
                  className={`btn-game-sm px-3 py-1.5 text-xs font-bold cursor-pointer ${
                    selectedClass === cls.name
                      ? 'btn-game-cyan text-slate-950'
                      : 'btn-game-slate text-slate-200'
                  }`}
                >
                  {cls.name} ({count})
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-400">
            Menunjukkan <strong className="text-white">{students.length}</strong> rekod murid
          </div>
        </div>

        {/* 5 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Jumlah Murid</div>
            <div className="font-mono-num text-2xl font-bold text-emerald-400">{students.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Aktif Bermain</div>
            <div className="font-mono-num text-2xl font-bold text-sky-400">{activeCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Purata Markah</div>
            <div className="font-mono-num text-2xl font-bold text-amber-300">{avgScore}%</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Misi Selesai</div>
            <div className="font-mono-num text-2xl font-bold text-emerald-400">{completedMissions}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Perlu Bimbingan</div>
            <div className="font-mono-num text-2xl font-bold text-rose-400">{needGuidanceCount}</div>
          </div>
        </div>

        {tab === 'submissions' ? (
          /* =================================================================
             DASHBOARD GURU – HASIL KERJA MURID (Professional Assessment View)
             ================================================================= */
          <section className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/95 border border-indigo-400/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white tracking-wide">
                  DASHBOARD GURU – HASIL KERJA MURID
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Mainkan rakaman audio/video Misi 5 murid, tulis maklum balas dan rekodkan markah penilaian.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSubmissions}
                disabled={loadingSubs}
                className="btn-game-slate btn-game-sm px-3.5 py-2 text-xs font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSubs ? 'animate-spin' : ''}`} />
                <span>Muat Semula</span>
              </button>
            </div>

            {savedReviewNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-100 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{savedReviewNotice}</span>
              </div>
            )}

            {subsError && (
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-400 text-rose-100 text-xs font-semibold">
                {subsError}
              </div>
            )}

            {(() => {
              const filteredSubs =
                selectedClass === 'ALL'
                  ? submissions
                  : submissions.filter((s) => s.className === selectedClass);

              if (loadingSubs && filteredSubs.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                    Memuatkan hasil rakaman murid...
                  </div>
                );
              }

              if (filteredSubs.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1.5">
                    <div className="font-display text-sm font-bold text-slate-200">
                      Belum ada rakaman dihantar
                    </div>
                    <p className="text-xs text-slate-400">
                      Rakaman audio atau video yang dihantar oleh murid dalam Misi 5 akan dipaparkan di sini secara automatik.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredSubs.map((sub) => {
                    const draft = reviewDrafts[sub.id] || {
                      comment: sub.teacherComment || '',
                      score: sub.teacherScore !== null ? String(sub.teacherScore) : '',
                      grade: sub.teacherGrade || 'Cemerlang',
                    };
                    const isPlaying = playingSubId === sub.id;

                    return (
                      <article
                        key={sub.id}
                        className="p-5 rounded-2xl bg-slate-900 border border-slate-700/80 space-y-4 shadow-lg"
                      >
                        {/* Student & Task Header */}
                        <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-800">
                          <div>
                            <h4 className="font-display text-base font-bold text-white">
                              {sub.studentName}
                            </h4>
                            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="font-mono-num text-cyan-300 font-semibold">
                                {sub.studentId || 'Tiada ID'}
                              </span>
                              <span>·</span>
                              <span>{sub.className}</span>
                              <span>·</span>
                              <span>{new Date(sub.submittedAt).toLocaleString('ms-MY')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-bold">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-400/50 text-indigo-200">
                              {sub.mediaType === 'video' ? (
                                <Video className="w-3.5 h-3.5" />
                              ) : (
                                <Mic className="w-3.5 h-3.5" />
                              )}
                              <span>{sub.mediaType === 'video' ? 'Video' : 'Audio'}</span>
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-400/60 text-emerald-300">
                              {sub.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-300">
                          <span className="text-slate-400">Tajuk Tugasan:</span>{' '}
                          <strong className="text-white">{sub.campaignTitle}</strong>
                        </div>

                        {/* Playable Submitted Recording */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                          {sub.mediaUrl && sub.mediaType === 'video' ? (
                            <video
                              ref={(el) => {
                                mediaRefs.current[sub.id] = el;
                              }}
                              controls
                              src={sub.mediaUrl}
                              onPlay={() => {
                                setPlayingSubId(sub.id);
                                setMusicState({ ducked: true });
                              }}
                              onPause={() => {
                                if (playingSubId === sub.id) setPlayingSubId(null);
                                setMusicState({ ducked: false });
                              }}
                              onEnded={() => {
                                setPlayingSubId(null);
                                setMusicState({ ducked: false });
                              }}
                              className="w-full rounded-lg bg-black aspect-video"
                            />
                          ) : (
                            <audio
                              ref={(el) => {
                                mediaRefs.current[sub.id] = el;
                              }}
                              controls
                              src={sub.mediaUrl}
                              onPlay={() => {
                                setPlayingSubId(sub.id);
                                setMusicState({ ducked: true });
                              }}
                              onPause={() => {
                                if (playingSubId === sub.id) setPlayingSubId(null);
                                setMusicState({ ducked: false });
                              }}
                              onEnded={() => {
                                setPlayingSubId(null);
                                setMusicState({ ducked: false });
                              }}
                              className="w-full h-9"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleTogglePlaySubmission(sub.id)}
                            className="btn-game-cyan btn-game-sm px-3.5 py-1.5 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Jeda {sub.mediaType === 'video' ? 'Video' : 'Audio'}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>
                                  Mainkan {sub.mediaType === 'video' ? 'Video' : 'Audio'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Teacher Feedback & Evaluation Form */}
                        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Markah Penilaian Guru (0–100)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draft.score}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...draft, score: e.target.value },
                                  }))
                                }
                                placeholder="Contoh: 90"
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono-num"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Tahap Pencapaian
                              </label>
                              <select
                                value={draft.grade}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...draft, grade: e.target.value },
                                  }))
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                              >
                                <option value="Cemerlang">Cemerlang</option>
                                <option value="Baik">Baik</option>
                                <option value="Memuaskan">Memuaskan</option>
                                <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Komen / Maklum Balas Guru
                            </label>
                            <textarea
                              rows={2}
                              value={draft.comment}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...draft, comment: e.target.value },
                                }))
                              }
                              placeholder="Tulis komen tentang kejelasan sebutan, intonasi dan kekuatan hujah murid..."
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">
                              {sub.reviewedAt
                                ? `Disemak oleh ${sub.reviewedBy || 'Guru'} · ${new Date(
                                    sub.reviewedAt
                                  ).toLocaleString('ms-MY')}`
                                : 'Menunggu semakan guru'}
                            </span>
                            <button
                              type="button"
                              disabled={savingReviewId === sub.id}
                              onClick={() => handleSaveSubmissionReview(sub.id)}
                              className="btn-game-emerald btn-game-sm px-4 py-1.5 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              {savingReviewId === sub.id
                                ? 'Menyimpan...'
                                : 'Simpan Penilaian'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        ) : tab === 'overview' ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Nama Murid</th>
                    <th className="p-3">ID Murid</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">XP</th>
                    <th className="p-3">Markah</th>
                    <th className="p-3">Status Murid</th>
                    <th className="p-3">Tahap Penguasaan</th>
                    <th className="p-3">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {students.length > 0 ? (
                    students.map((s) => {
                      const sc = calcOverallScore(s);
                      const m = getMasteryLevel(sc);
                      const ai = computeAIGuide(s);
                      const toneCls =
                        m.tone === 'emerald'
                          ? 'text-emerald-400'
                          : m.tone === 'sky'
                          ? 'text-sky-400'
                          : m.tone === 'rose'
                          ? 'text-rose-400'
                          : 'text-amber-300';
                      const statusLabel =
                        sc === 0
                          ? 'Belum Menjawab'
                          : ai.needsIntervention
                          ? 'Perlu Bimbingan'
                          : sc >= 80
                          ? 'Cemerlang'
                          : 'Memuaskan';
                      const statusCls =
                        sc === 0
                          ? 'text-amber-300'
                          : ai.needsIntervention
                          ? 'text-rose-400'
                          : 'text-emerald-400';

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-white">{s.fullName}</td>
                          <td className="p-3 font-mono-num text-slate-300">{s.studentId}</td>
                          <td className="p-3 text-slate-300">{s.className}</td>
                          <td className="p-3 font-mono-num font-bold text-amber-300">{s.xp || 0}</td>
                          <td className="p-3 font-mono-num font-bold text-white">{sc}%</td>
                          <td className={`p-3 text-xs font-bold ${statusCls}`}>{statusLabel}</td>
                          <td className={`p-3 text-xs font-semibold ${toneCls}`}>{m.label}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(s.id);
                                setFbDraft(s.teacherFeedback || '');
                              }}
                              className="btn-game-cyan btn-game-sm px-3 py-1.5 text-slate-950 text-xs font-bold cursor-pointer"
                            >
                              Semak Rekod
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                        Belum ada rekod murid untuk kelas {selectedClass}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedStudent && (
              <div className="mt-5 p-5 rounded-2xl bg-slate-900 border border-amber-400/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-amber-300">
                    Rekod Terperinci: {selectedStudent.fullName} ({selectedStudent.studentId} ·{' '}
                    {selectedStudent.className})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="btn-game-slate btn-game-sm px-3 py-1 text-xs text-slate-200 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs text-slate-400">Mendengar (Misi 1)</div>
                    <div className="font-mono-num text-xl font-bold text-sky-400">
                      {selectedStudent.progress?.m1.score || 0}%
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Tersurat {selectedStudent.progress?.m1.tersuratScore || 0}% · Tersirat{' '}
                      {selectedStudent.progress?.m1.tersiratScore || 0}%
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs text-slate-400">Analisis & Bertutur (M2–M5)</div>
                    <div className="font-mono-num text-xl font-bold text-emerald-400">
                      M2:{selectedStudent.progress?.m2.score || 0}% · M3:
                      {selectedStudent.progress?.m3.score || 0}% · M4:
                      {selectedStudent.progress?.m4.score || 0}%
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs text-slate-400">Lencana Pencapaian</div>
                    <div className="text-lg mt-1">
                      {(selectedStudent.badges || []).length > 0
                        ? selectedStudent.badges!
                            .map((bId) => BADGES_DEF.find((x) => x.id === bId)?.icon)
                            .join(' ')
                        : 'Tiada lagi'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-purple-300">
                      Cadangan Pintar ({computeAIGuide(selectedStudent).levelMode})
                    </div>
                    <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                      {computeAIGuide(selectedStudent).recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 text-xs text-emerald-400 pt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedStudent.aiApprovedByTeacher)}
                        onChange={(e) => onApproveAI(selectedStudent.id, e.target.checked)}
                        className="accent-emerald-500"
                      />
                      Guru sahkan cadangan pintar ini
                    </label>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-emerald-400">Maklum Balas Guru</div>
                    <textarea
                      rows={3}
                      value={fbDraft}
                      onChange={(e) => setFbDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => onSaveFeedback(selectedStudent.id, fbDraft)}
                      className="btn-game-emerald btn-game-sm px-4 py-2 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Simpan Maklum Balas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-display text-lg font-bold text-sky-300">
                Perbandingan Pencapaian (%)
              </h3>
              {students.map((s) => {
                const sc = calcOverallScore(s);
                return (
                  <div key={s.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>
                        {s.fullName} ({s.className})
                      </span>
                      <span className="font-mono-num font-bold">{sc}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sc >= 75 ? 'bg-emerald-500' : sc >= 60 ? 'bg-sky-400' : 'bg-rose-500'
                        }`}
                        style={{ width: `${sc}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-display text-lg font-bold text-rose-300">
                Senarai Murid Perlu Bimbingan
              </h3>
              {students.filter((s) => computeAIGuide(s).needsIntervention).length > 0 ? (
                students
                  .filter((s) => computeAIGuide(s).needsIntervention)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-2 border-b border-slate-800 text-xs"
                    >
                      <span>
                        <strong>{s.fullName}</strong> · {s.className} ({calcOverallScore(s)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTab('overview');
                          setSelectedId(s.id);
                          setFbDraft(s.teacherFeedback || '');
                        }}
                        className="btn-game-cyan btn-game-sm px-3 py-1 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Semak
                      </button>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-emerald-300">
                  Tiada murid memerlukan bimbingan khas dalam pilihan kelas ini.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
