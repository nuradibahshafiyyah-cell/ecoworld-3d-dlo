import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  Youtube,
} from 'lucide-react';
import {
  AudioSettingsSnapshot,
  getAudioSettings,
  isVoiceAudioActive,
  setMasterMuted,
  setMasterVolume,
  setMusicEnabled,
  setSfxVolume,
  subscribeAudioSettings,
  subscribeVoiceActivity,
  unlockAudioOnUserGesture,
} from '../utils/sound';

const YOUTUBE_VIDEO_ID = 'YPcpT5qMKj4';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  destroy: () => void;
}

interface YTPlayerOptions {
  width?: number;
  height?: number;
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
    onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTGlobal {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface MusicPlayerHandle {
  startFromUserAction: () => void;
  stopImmediately: () => void;
}

interface MusicControlPanelProps {
  visible: boolean;
  musicOn: boolean;
  musicVolume: number; // 0..1
  onSetMusicOn: (enabled: boolean) => void;
  onChangeVolume: (vol: number) => void;
}

let ytApiPromise: Promise<YTGlobal> | null = null;

function loadYouTubeIframeAPI(): Promise<YTGlobal> {
  if (typeof window !== 'undefined' && window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTGlobal>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      ytApiPromise = null;
      reject(new Error('YouTube IFrame API load timeout'));
    }, 9500);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (prevReady) {
        try {
          prevReady();
        } catch {
          // ignore
        }
      }
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        ytApiPromise = null;
        reject(new Error('YT.Player unavailable'));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        ytApiPromise = null;
        reject(new Error('Failed to load YouTube script'));
      };
      document.head.appendChild(script);
    } else if (window.YT?.Player) {
      window.clearTimeout(timeout);
      resolve(window.YT);
    }
  });

  return ytApiPromise;
}

function MusicNote3DIcon({ playing }: { playing: boolean }) {
  return (
    <div
      className={`relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border-2 border-teal-200/80 ${
        playing ? 'music-note-playing' : ''
      }`}
      style={{
        background: 'linear-gradient(145deg, #2dd4bf 0%, #0ea5e9 52%, #059669 100%)',
        boxShadow:
          'inset 0 2.5px 0 rgba(255,255,255,0.68), 0 4px 0 #064e3b, 0 8px 18px rgba(14,165,233,0.55)',
      }}
    >
      <svg
        viewBox="0 0 48 48"
        className="w-7 h-7 drop-shadow-[0_2px_3px_rgba(2,6,23,0.65)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="noteGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="48%" stopColor="#cffafe" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <linearGradient id="noteEdge3D" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
        </defs>
        <path
          d="M19 10v20.2a5.5 5.5 0 1 1-3-4.9V13.8l21-4.3v18.7a5.5 5.5 0 1 1-3-4.9V15.4L19 18.5V10z"
          fill="url(#noteEdge3D)"
          transform="translate(1.8, 2.2)"
        />
        <path
          d="M19 9.5v20.2a5.5 5.5 0 1 1-3-4.9V13.3l21-4.3v18.7a5.5 5.5 0 1 1-3-4.9V14.9L19 18V9.5z"
          fill="url(#noteGrad3D)"
        />
        <circle cx="12.5" cy="29" r="1.4" fill="#ffffff" opacity="0.85" />
        <circle cx="30.5" cy="27" r="1.4" fill="#ffffff" opacity="0.85" />
      </svg>

      {playing && (
        <span
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_8px_#34d399] animate-ping"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export const MusicControlPanel = forwardRef<MusicPlayerHandle, MusicControlPanelProps>(
  function MusicControlPanel(
    { visible, musicOn, musicVolume, onSetMusicOn, onChangeVolume },
    ref
  ) {
    const playerHostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const playerReadyRef = useRef(false);
    const pendingPlayRef = useRef(false);
    const wasArmedBeforeVoiceRef = useRef(false);

    const [audioSnap, setAudioSnap] = useState<AudioSettingsSnapshot>(() => getAudioSettings());
    const [playerReady, setPlayerReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ytError, setYtError] = useState<string | null>(null);
    const [voicePaused, setVoicePaused] = useState(() => isVoiceAudioActive());
    const [collapsed, setCollapsed] = useState(true);
    const [showVideoPreview, setShowVideoPreview] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const latestPrefsRef = useRef({
      musicOn,
      musicVolume,
      masterVolume: audioSnap.masterVolume,
      masterMuted: audioSnap.masterMuted,
    });
    latestPrefsRef.current = {
      musicOn,
      musicVolume,
      masterVolume: audioSnap.masterVolume,
      masterMuted: audioSnap.masterMuted,
    };

    // User-triggered stop/mute: pauses player and clears auto-resume arming
    const stopPlayerImmediately = useCallback(() => {
      pendingPlayRef.current = false;
      wasArmedBeforeVoiceRef.current = false;
      const p = playerRef.current;
      if (p && playerReadyRef.current) {
        try {
          p.mute();
          p.pauseVideo();
        } catch {
          // ignore
        }
      }
      setIsPlaying(false);
    }, []);

    // Voice-triggered pause: immediately pauses at exact playback position WITHOUT clearing musicOn
    const pausePlayerForVoice = useCallback(() => {
      const prefs = latestPrefsRef.current;
      if (
        prefs.musicOn &&
        !prefs.masterMuted &&
        prefs.musicVolume > 0.01 &&
        prefs.masterVolume > 0.01
      ) {
        wasArmedBeforeVoiceRef.current = true;
      }
      const p = playerRef.current;
      if (p && playerReadyRef.current) {
        try {
          p.mute();
          p.pauseVideo();
        } catch {
          // ignore
        }
      }
      setIsPlaying(false);
    }, []);

    // Automatic resumption once ALL human voice audio has finished: resumes from exact paused timestamp
    const resumePlayerAfterVoice = useCallback(() => {
      const prefs = latestPrefsRef.current;
      const effectivePct = Math.round(prefs.masterVolume * prefs.musicVolume * 100);
      if (
        (wasArmedBeforeVoiceRef.current || pendingPlayRef.current) &&
        prefs.musicOn &&
        !prefs.masterMuted &&
        effectivePct > 0
      ) {
        wasArmedBeforeVoiceRef.current = false;
        const p = playerRef.current;
        if (p && playerReadyRef.current) {
          pendingPlayRef.current = false;
          try {
            p.unMute();
            p.setVolume(effectivePct);
            p.playVideo();
            setIsPlaying(true);
          } catch {
            pendingPlayRef.current = true;
          }
        } else {
          pendingPlayRef.current = true;
        }
      }
    }, []);

    // Keep AudioSettingsSnapshot synced
    useEffect(() => {
      return subscribeAudioSettings((snap) => {
        setAudioSnap(snap);
      });
    }, []);

    // Smart human-voice priority listener: pauses BGM immediately on voice start,
    // keeps paused while any voice is active, and auto-resumes from exact position when all finish.
    useEffect(() => {
      return subscribeVoiceActivity((voiceActive) => {
        setVoicePaused(voiceActive);
        if (voiceActive) {
          pausePlayerForVoice();
        } else {
          resumePlayerAfterVoice();
        }
      });
    }, [pausePlayerForVoice, resumePlayerAfterVoice]);

    // Initialize SINGLE persistent Official YouTube Embedded Player (never unmounts across missions/teleports)
    useEffect(() => {
      let cancelled = false;
      setYtError(null);
      setPlayerReady(false);
      playerReadyRef.current = false;

      loadYouTubeIframeAPI()
        .then((YT) => {
          if (cancelled || !playerHostRef.current) return;
          playerHostRef.current.innerHTML = '';
          const targetDiv = document.createElement('div');
          playerHostRef.current.appendChild(targetDiv);

          const instance = new YT.Player(targetDiv, {
            width: 200,
            height: 112,
            videoId: YOUTUBE_VIDEO_ID,
            playerVars: {
              autoplay: 0,
              controls: 1,
              loop: 1,
              playlist: YOUTUBE_VIDEO_ID,
              enablejsapi: 1,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (e) => {
                if (cancelled) return;
                playerRef.current = e.target;
                playerReadyRef.current = true;
                setPlayerReady(true);
                setYtError(null);

                const prefs = latestPrefsRef.current;
                const effectivePct = Math.round(prefs.masterVolume * prefs.musicVolume * 100);
                if (
                  (pendingPlayRef.current || wasArmedBeforeVoiceRef.current) &&
                  prefs.musicOn &&
                  !prefs.masterMuted &&
                  effectivePct > 0
                ) {
                  if (isVoiceAudioActive()) {
                    wasArmedBeforeVoiceRef.current = true;
                    pendingPlayRef.current = true;
                    try {
                      e.target.mute();
                      e.target.pauseVideo();
                    } catch {
                      // ignore
                    }
                  } else {
                    pendingPlayRef.current = false;
                    wasArmedBeforeVoiceRef.current = false;
                    try {
                      e.target.unMute();
                      e.target.setVolume(effectivePct);
                      e.target.playVideo();
                    } catch {
                      // Wait for explicit user click if browser blocks
                    }
                  }
                } else {
                  try {
                    e.target.mute();
                    e.target.pauseVideo();
                  } catch {
                    // ignore
                  }
                }
              },
              onStateChange: (e) => {
                if (cancelled) return;
                // YT.PlayerState: 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
                if (e.data === 1) {
                  const prefs = latestPrefsRef.current;
                  if (!prefs.musicOn || prefs.masterMuted || prefs.musicVolume <= 0.01) {
                    stopPlayerImmediately();
                    return;
                  }
                  if (isVoiceAudioActive()) {
                    pausePlayerForVoice();
                    return;
                  }
                  setIsPlaying(true);
                  setYtError(null);
                } else if (e.data === 2) {
                  setIsPlaying(false);
                } else if (e.data === 0) {
                  const prefs = latestPrefsRef.current;
                  if (
                    prefs.musicOn &&
                    !prefs.masterMuted &&
                    prefs.musicVolume > 0.01 &&
                    !isVoiceAudioActive()
                  ) {
                    try {
                      e.target.seekTo(0, true);
                      e.target.playVideo();
                    } catch {
                      setIsPlaying(false);
                    }
                  } else {
                    setIsPlaying(false);
                  }
                }
              },
              onError: (e) => {
                if (cancelled) return;
                setIsPlaying(false);
                if (e.data === 101 || e.data === 150 || e.data === 100) {
                  setYtError(
                    'Video YouTube ini disekat daripada dimainkan secara terbenam oleh pemilik atau tetapan pelayar.'
                  );
                } else {
                  setYtError(
                    'Muzik latar YouTube tidak dapat dimuatkan buat sementara. Permainan masih berjalan seperti biasa.'
                  );
                }
              },
            },
          });

          playerRef.current = instance;
        })
        .catch(() => {
          if (cancelled) return;
          setYtError(
            'Pemain YouTube disekat oleh rangkaian atau pelayar. Permainan tetap berjalan tanpa gangguan.'
          );
        });

      return () => {
        cancelled = true;
        playerReadyRef.current = false;
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }
      };
    }, [reloadKey, stopPlayerImmediately, pausePlayerForVoice]);

    // Apply exact instant volume or pause/stop without disrupting paused voice position
    useEffect(() => {
      const p = playerRef.current;
      if (!p || !playerReady) return;

      const effectivePct = Math.round(audioSnap.masterVolume * musicVolume * 100);
      if (!musicOn || audioSnap.masterMuted || effectivePct <= 0) {
        stopPlayerImmediately();
        return;
      }

      if (isVoiceAudioActive()) {
        wasArmedBeforeVoiceRef.current = true;
        return;
      }

      try {
        if (p.isMuted()) p.unMute();
        p.setVolume(effectivePct);
      } catch {
        // ignore
      }
    }, [musicOn, musicVolume, audioSnap.masterVolume, audioSnap.masterMuted, playerReady, stopPlayerImmediately]);

    const startFromUserAction = useCallback(() => {
      unlockAudioOnUserGesture();
      setMasterMuted(false);
      setMusicEnabled(true);
      onSetMusicOn(true);

      const effectivePct = Math.round(
        latestPrefsRef.current.masterVolume * Math.max(0.1, latestPrefsRef.current.musicVolume) * 100
      );

      // Human voice has highest priority: keep paused until all voices finish, then auto-resume
      if (isVoiceAudioActive()) {
        wasArmedBeforeVoiceRef.current = true;
        pendingPlayRef.current = true;
        setVoicePaused(true);
        return;
      }

      wasArmedBeforeVoiceRef.current = false;
      const p = playerRef.current;
      if (p && playerReadyRef.current) {
        pendingPlayRef.current = false;
        try {
          p.unMute();
          p.setVolume(effectivePct);
          p.playVideo();
          setIsPlaying(true);
        } catch {
          pendingPlayRef.current = true;
        }
      } else {
        pendingPlayRef.current = true;
      }
    }, [onSetMusicOn]);

    useImperativeHandle(
      ref,
      () => ({
        startFromUserAction,
        stopImmediately: stopPlayerImmediately,
      }),
      [startFromUserAction, stopPlayerImmediately]
    );

    const handlePlayPause = () => {
      unlockAudioOnUserGesture();
      if (isPlaying || (musicOn && !audioSnap.masterMuted)) {
        // Explicit user pause/stop
        setMusicEnabled(false);
        onSetMusicOn(false);
        stopPlayerImmediately();
      } else {
        // Explicit user start/resume of YouTube background music
        startFromUserAction();
      }
    };

    const handleToggleMasterMute = () => {
      unlockAudioOnUserGesture();
      const nextMuted = !audioSnap.masterMuted;
      setMasterMuted(nextMuted);
      if (nextMuted) {
        stopPlayerImmediately();
      } else if (latestPrefsRef.current.musicOn) {
        startFromUserAction();
      }
    };

    const masterPct = audioSnap.masterMuted ? 0 : Math.round(audioSnap.masterVolume * 100);
    const musicPct = musicOn && !audioSnap.masterMuted ? Math.round(musicVolume * 100) : 0;
    const sfxPct = audioSnap.masterMuted ? 0 : Math.round(audioSnap.sfxVolume * 100);
    const activeEffectivePlaying =
      isPlaying && musicOn && !audioSnap.masterMuted && audioSnap.masterVolume > 0.01 && musicVolume > 0.01 && !ytError;

    return (
      <div
        className={`no-print fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-[45] transition-all duration-300 ${
          visible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Panel Kawalan Muzik Latar YouTube & Audio 3D"
      >
        <div
          className={`rounded-3xl p-2.5 sm:p-3 text-slate-100 transition-all duration-300 ${
            activeEffectivePlaying ? 'music-panel-3d music-panel-3d-playing' : 'music-panel-3d'
          } ${collapsed ? 'w-auto' : 'w-[300px] sm:w-[328px]'}`}
        >
          {/* Single Persistent YouTube Embed Container (never unmounts across missions/teleports) */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              showVideoPreview && !collapsed && !ytError
                ? 'w-full h-[118px] mb-2.5 rounded-2xl border border-cyan-300/50 bg-slate-950 flex items-center justify-center shadow-inner'
                : 'w-[1px] h-[1px] opacity-[0.001] pointer-events-none absolute -z-10'
            }`}
          >
            <div ref={playerHostRef} className="rounded-xl overflow-hidden" />
          </div>

          {collapsed ? (
            /* Compact Floating 3D Orb Bar */
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlayPause}
                title={activeEffectivePlaying ? 'Henti Muzik Latar' : 'Main Muzik Latar'}
                className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
              >
                <MusicNote3DIcon playing={activeEffectivePlaying} />
              </button>

              <button
                type="button"
                onClick={handlePlayPause}
                title={activeEffectivePlaying ? 'Henti Muzik' : 'Main Muzik'}
                aria-label={activeEffectivePlaying ? 'Henti muzik latar' : 'Main muzik latar'}
                className={`btn-game-sm w-9 h-9 flex items-center justify-center cursor-pointer ${
                  activeEffectivePlaying
                    ? 'btn-game-cyan text-slate-950'
                    : 'btn-game-emerald text-slate-950'
                }`}
              >
                {activeEffectivePlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleMasterMute}
                title={audioSnap.masterMuted ? 'Buka Semua Audio' : 'Senyapkan Semua Audio'}
                aria-label={audioSnap.masterMuted ? 'Buka semua audio' : 'Senyapkan semua audio'}
                className={`btn-game-sm w-9 h-9 flex items-center justify-center cursor-pointer ${
                  !audioSnap.masterMuted
                    ? 'btn-game-teal text-slate-950'
                    : 'btn-game-slate text-slate-300'
                }`}
              >
                {!audioSnap.masterMuted ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  unlockAudioOnUserGesture();
                  setCollapsed(false);
                }}
                title="Buka Kawalan Audio & Muzik"
                aria-label="Kembangkan panel kawalan audio"
                className="btn-game-slate btn-game-sm w-8 h-9 flex items-center justify-center text-teal-200 cursor-pointer"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Full Floating 3D Audio & YouTube Control Panel */
            <div className="space-y-2.5">
              {/* Top Row: 3D Note Icon + Status + YT Toggle + Collapse */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MusicNote3DIcon playing={activeEffectivePlaying} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-game text-xs font-black text-teal-200 tracking-wide truncate">
                        MUZIK ECOWORLD
                      </span>
                      {activeEffectivePlaying && (
                        <span className="inline-flex items-end gap-0.5 h-3.5" aria-hidden="true">
                          <span
                            className="w-1 h-3 bg-emerald-300 rounded-full wave-bar-active"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="w-1 h-3.5 bg-cyan-300 rounded-full wave-bar-active"
                            style={{ animationDelay: '160ms' }}
                          />
                          <span
                            className="w-1 h-2.5 bg-teal-300 rounded-full wave-bar-active"
                            style={{ animationDelay: '320ms' }}
                          />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-cyan-200/90 truncate flex items-center gap-1">
                      <Youtube className="w-3 h-3 text-teal-300 shrink-0" />
                      <span>
                        {ytError
                          ? 'YouTube Disekat / Luar Talian'
                          : audioSnap.masterMuted
                          ? 'Semua Audio Disenyapkan'
                          : activeEffectivePlaying
                          ? 'YouTube Dimainkan · Gelung'
                          : voicePaused && musicOn
                          ? 'Dijeda · Suara Manusia Aktif'
                          : playerReady
                          ? 'Dihentikan · Tekan Main'
                          : 'Menyambung Pemain YouTube...'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!ytError && (
                    <button
                      type="button"
                      onClick={() => setShowVideoPreview((v) => !v)}
                      title={showVideoPreview ? 'Sembunyi Paparan YT' : 'Papar Pemain YouTube'}
                      className={`btn-game-sm px-2 py-1 text-[10px] font-game font-bold cursor-pointer ${
                        showVideoPreview
                          ? 'btn-game-cyan text-slate-950'
                          : 'btn-game-slate text-teal-200'
                      }`}
                    >
                      YT
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    title="Kecilkan Panel Audio"
                    aria-label="Kecilkan panel audio"
                    className="btn-game-slate btn-game-sm w-7 h-7 flex items-center justify-center text-teal-200 cursor-pointer shrink-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {ytError ? (
                <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-amber-400/50 text-[11px] text-amber-100 space-y-2">
                  <p className="leading-snug">{ytError}</p>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`https://youtu.be/${YOUTUBE_VIDEO_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 underline font-semibold text-[10px]"
                    >
                      Buka di YouTube ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className="btn-game-teal btn-game-sm px-2.5 py-1 text-[10px] font-game font-black text-slate-950 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Cuba Semula
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className={`btn-game-sm flex-1 px-2.5 py-1.5 text-[11px] font-game font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeEffectivePlaying
                        ? 'btn-game-cyan text-slate-950'
                        : 'btn-game-emerald text-slate-950'
                    }`}
                  >
                    {activeEffectivePlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Henti Muzik
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Main Muzik
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMasterMute}
                    className={`btn-game-sm flex-1 px-2.5 py-1.5 text-[11px] font-game font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                      !audioSnap.masterMuted
                        ? 'btn-game-teal text-slate-950'
                        : 'btn-game-rose text-white'
                    }`}
                  >
                    {!audioSnap.masterMuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" /> Bunyi Aktif
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" /> Nyahsenyap
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 3 Consistent Sliders: Master, Music Latar, SFX */}
              <div className="space-y-1.5 bg-slate-950/75 border border-teal-400/30 rounded-2xl p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-game font-bold text-slate-300 w-[76px] shrink-0 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-emerald-300 shrink-0" />
                    Utama
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masterPct}
                    onChange={(e) => {
                      unlockAudioOnUserGesture();
                      setMasterVolume(Number(e.target.value) / 100);
                    }}
                    aria-label="Kelantangan utama"
                    className="music-slider-3d flex-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, #34d399 0%, #2dd4bf ${masterPct}%, #0f172a ${masterPct}%, #0f172a 100%)`,
                    }}
                  />
                  <span className="font-mono-num text-[10px] font-bold text-emerald-200 w-8 text-right shrink-0">
                    {masterPct}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-game font-bold text-slate-300 w-[76px] shrink-0 flex items-center gap-1">
                    <Music2 className="w-3 h-3 text-cyan-300 shrink-0" />
                    Muzik Latar
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={musicPct}
                    onChange={(e) => {
                      unlockAudioOnUserGesture();
                      onChangeVolume(Number(e.target.value) / 100);
                    }}
                    aria-label="Kelantangan muzik latar YouTube"
                    className="music-slider-3d flex-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, #2dd4bf 0%, #38bdf8 ${musicPct}%, #0f172a ${musicPct}%, #0f172a 100%)`,
                    }}
                  />
                  <span className="font-mono-num text-[10px] font-bold text-cyan-200 w-8 text-right shrink-0">
                    {musicPct}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-game font-bold text-slate-300 w-[76px] shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                    Kesan SFX
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sfxPct}
                    onChange={(e) => {
                      unlockAudioOnUserGesture();
                      setSfxVolume(Number(e.target.value) / 100);
                    }}
                    aria-label="Kelantangan kesan bunyi SFX"
                    className="music-slider-3d flex-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, #facc15 0%, #fb923c ${sfxPct}%, #0f172a ${sfxPct}%, #0f172a 100%)`,
                    }}
                  />
                  <span className="font-mono-num text-[10px] font-bold text-amber-200 w-8 text-right shrink-0">
                    {sfxPct}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
