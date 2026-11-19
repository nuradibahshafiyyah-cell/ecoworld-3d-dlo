import { unlockAmbientAudio, updateAmbientAudioPrefs } from './ambientAudio';

export type SfxType =
  | 'click'
  | 'xp'
  | 'achievement'
  | 'win'
  | 'error'
  | 'clue'
  | 'zone'
  | 'portal_charge'
  | 'portal'
  | 'warp'
  | 'arrival';

export type FootstepSurface = 'grass' | 'soil' | 'lab' | 'wood' | 'water';

export interface MusicTrackState {
  zoneId: number;
  inMission: boolean;
  zoneRestored: boolean;
  ducked: boolean;
  suppressedForAudio: boolean;
}

export interface AudioSettingsSnapshot {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  masterMuted: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let soundEnabled = true;
let musicEnabled = true;
let masterMuted = false;
let masterVolume = 0.9;
let musicVolume = 0.78;
let sfxVolume = 0.9;
let userInteracted = false;

const lastSfxAt: Record<string, number> = {};
const SFX_COOLDOWN_MS: Partial<Record<SfxType, number>> = {
  click: 55,
  zone: 120,
  clue: 140,
  xp: 180,
  achievement: 280,
  win: 380,
  portal_charge: 450,
  portal: 350,
  warp: 450,
  arrival: 380,
  error: 180,
};

let currentMusicState: MusicTrackState = {
  zoneId: 0,
  inMission: false,
  zoneRestored: false,
  ducked: false,
  suppressedForAudio: false,
};

type MusicStateListener = (state: MusicTrackState) => void;
const musicStateListeners = new Set<MusicStateListener>();

type AudioSettingsListener = (snap: AudioSettingsSnapshot) => void;
const settingsListeners = new Set<AudioSettingsListener>();

type VoiceActivityListener = (voiceActive: boolean) => void;
const voiceActivityListeners = new Set<VoiceActivityListener>();

let hooksInstalled = false;
const activeMediaElements = new Set<HTMLMediaElement>();
const hookedMediaElements = new WeakSet<HTMLMediaElement>();
let speechActive = false;
let speechTokenSeq = 0;
let speechStartedAtMs = 0;
let speechWatchdogId: number | null = null;
let voiceResumeTimerId: number | null = null;
let effectiveVoiceActive = false;

function computeRawVoiceActive(): boolean {
  // Prune any media element that is already paused/ended/muted
  activeMediaElements.forEach((el) => {
    if (el.paused || el.ended || el.muted) {
      activeMediaElements.delete(el);
    }
  });
  return Boolean(
    currentMusicState.ducked ||
      currentMusicState.suppressedForAudio ||
      activeMediaElements.size > 0 ||
      speechActive
  );
}

function emitVoiceActivity(nextActive: boolean): void {
  if (effectiveVoiceActive === nextActive) return;
  effectiveVoiceActive = nextActive;
  voiceActivityListeners.forEach((fn) => {
    try {
      fn(nextActive);
    } catch {
      // ignore
    }
  });
}

function stopSpeechWatchdog(): void {
  if (speechWatchdogId !== null && typeof window !== 'undefined') {
    window.clearInterval(speechWatchdogId);
    speechWatchdogId = null;
  }
}

function startSpeechWatchdog(): void {
  if (typeof window === 'undefined' || speechWatchdogId !== null) return;
  speechWatchdogId = window.setInterval(() => {
    if (!speechActive) {
      stopSpeechWatchdog();
      return;
    }
    // Give speechSynthesis a brief 400ms startup grace window before checking .speaking
    if (performance.now() - speechStartedAtMs < 400) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth || (!synth.speaking && !synth.pending)) {
        speechActive = false;
        stopSpeechWatchdog();
        syncVoiceActivity();
      }
    } catch {
      speechActive = false;
      stopSpeechWatchdog();
      syncVoiceActivity();
    }
  }, 220);
}

function syncVoiceActivity(): void {
  const rawActive = computeRawVoiceActive();
  if (rawActive) {
    // Immediate synchronous pause when any human voice starts
    if (voiceResumeTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(voiceResumeTimerId);
      voiceResumeTimerId = null;
    }
    emitVoiceActivity(true);
    return;
  }

  // Short 80ms settle window on completion so back-to-back voices never blip BGM
  if (!effectiveVoiceActive) return;
  if (voiceResumeTimerId !== null) return;

  if (typeof window === 'undefined') {
    emitVoiceActivity(false);
    return;
  }

  voiceResumeTimerId = window.setTimeout(() => {
    voiceResumeTimerId = null;
    if (!computeRawVoiceActive()) {
      emitVoiceActivity(false);
    }
  }, 80);
}

export function isVoiceAudioActive(): boolean {
  return computeRawVoiceActive();
}

export function subscribeVoiceActivity(listener: VoiceActivityListener): () => void {
  voiceActivityListeners.add(listener);
  listener(isVoiceAudioActive());
  return () => {
    voiceActivityListeners.delete(listener);
  };
}

function registerPlayingMediaElement(el: HTMLMediaElement): void {
  if (el.muted) return;
  activeMediaElements.add(el);

  if (!hookedMediaElements.has(el)) {
    hookedMediaElements.add(el);
    const handleStop = () => {
      activeMediaElements.delete(el);
      syncVoiceActivity();
    };
    const handlePlay = () => {
      if (!el.muted) {
        activeMediaElements.add(el);
        syncVoiceActivity();
      }
    };
    const handleVolumeChange = () => {
      if (el.muted) {
        activeMediaElements.delete(el);
      } else if (!el.paused && !el.ended) {
        activeMediaElements.add(el);
      }
      syncVoiceActivity();
    };
    el.addEventListener('play', handlePlay);
    el.addEventListener('playing', handlePlay);
    el.addEventListener('pause', handleStop);
    el.addEventListener('ended', handleStop);
    el.addEventListener('error', handleStop);
    el.addEventListener('emptied', handleStop);
    el.addEventListener('volumechange', handleVolumeChange);
  }

  syncVoiceActivity();
}

/**
 * Stops any ongoing voice/speech/media if explicitly requested.
 */
export function stopOtherAudioForMusic(): void {
  if (typeof window === 'undefined') return;
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore
  }
  try {
    document.querySelectorAll('audio').forEach((el) => {
      if (!el.paused) {
        el.pause();
      }
    });
  } catch {
    // ignore
  }
  activeMediaElements.clear();
  speechActive = false;
  stopSpeechWatchdog();
  syncVoiceActivity();
}

/**
 * Installs global capture hooks so human voice audio (<audio>, detached new Audio(),
 * unmuted <video> narration, and window.speechSynthesis) immediately pauses BGM
 * and automatically resumes BGM from its paused position once ALL voices finish.
 * Non-voice SFX, footsteps, and teleport sounds never trigger this interruption.
 */
export function installGlobalAudioInterruptHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;

  document.addEventListener(
    'play',
    (ev) => {
      const target = ev.target as HTMLMediaElement | null;
      if (target && !target.muted) {
        registerPlayingMediaElement(target);
      }
    },
    true
  );

  if (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.prototype?.play) {
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args) {
      if (!this.muted) {
        registerPlayingMediaElement(this);
      }
      const res = origPlay.apply(this, args);
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          activeMediaElements.delete(this);
          syncVoiceActivity();
        });
      }
      return res;
    };
  }

  if ('speechSynthesis' in window && typeof window.speechSynthesis?.speak === 'function') {
    const synth = window.speechSynthesis;
    const origSpeak = synth.speak.bind(synth);
    const origCancel = synth.cancel.bind(synth);
    const origPause = synth.pause?.bind(synth);
    const origResume = synth.resume?.bind(synth);

    synth.speak = (utterance: SpeechSynthesisUtterance) => {
      const myToken = ++speechTokenSeq;
      speechActive = true;
      speechStartedAtMs = performance.now();
      startSpeechWatchdog();

      const prevStart = utterance.onstart;
      const prevEnd = utterance.onend;
      const prevError = utterance.onerror;

      utterance.onstart = (ev) => {
        if (myToken === speechTokenSeq) {
          speechActive = true;
          speechStartedAtMs = performance.now();
          syncVoiceActivity();
        }
        prevStart?.call(utterance, ev);
      };

      utterance.onend = (ev) => {
        if (myToken === speechTokenSeq) {
          speechActive = false;
          stopSpeechWatchdog();
          syncVoiceActivity();
        }
        prevEnd?.call(utterance, ev);
      };

      utterance.onerror = (ev) => {
        if (myToken === speechTokenSeq) {
          speechActive = false;
          stopSpeechWatchdog();
          syncVoiceActivity();
        }
        prevError?.call(utterance, ev);
      };

      syncVoiceActivity();
      return origSpeak(utterance);
    };

    synth.cancel = () => {
      speechTokenSeq += 1;
      speechActive = false;
      stopSpeechWatchdog();
      origCancel();
      syncVoiceActivity();
    };

    if (origPause) {
      synth.pause = () => {
        speechTokenSeq += 1;
        speechActive = false;
        stopSpeechWatchdog();
        origPause();
        syncVoiceActivity();
      };
    }

    if (origResume) {
      synth.resume = () => {
        origResume();
        if (synth.speaking || synth.paused) {
          speechActive = true;
          speechStartedAtMs = performance.now();
          startSpeechWatchdog();
          syncVoiceActivity();
        }
      };
    }
  }
}

function emitAudioSettings(): void {
  const snap = getAudioSettings();
  updateAmbientAudioPrefs({
    enabled: musicEnabled,
    muted: masterMuted,
    masterVolume,
    musicVolume,
  });
  settingsListeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      // ignore
    }
  });
}

function ensureAudioContext(): AudioContext | null {
  if (!userInteracted) return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (!noiseBuffer) {
    const length = audioCtx.sampleRate * 0.15;
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return audioCtx;
}

export function unlockAudioOnUserGesture(): void {
  userInteracted = true;
  installGlobalAudioInterruptHooks();
  ensureAudioContext();
  unlockAmbientAudio();
}

export function getAudioSettings(): AudioSettingsSnapshot {
  return {
    masterVolume,
    musicVolume,
    sfxVolume,
    masterMuted,
    soundEnabled,
    musicEnabled,
  };
}

export function subscribeAudioSettings(listener: AudioSettingsListener): () => void {
  settingsListeners.add(listener);
  listener(getAudioSettings());
  return () => {
    settingsListeners.delete(listener);
  };
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function setMasterVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (masterVolume > 0 && masterMuted) {
    masterMuted = false;
  }
  emitAudioSettings();
}

export function isMasterMuted(): boolean {
  return masterMuted;
}

export function setMasterMuted(muted: boolean): void {
  masterMuted = muted;
  emitAudioSettings();
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function setSfxVolume(vol: number): void {
  sfxVolume = Math.max(0, Math.min(1, vol));
  if (sfxVolume > 0 && !soundEnabled) {
    soundEnabled = true;
  }
  emitAudioSettings();
}

export function isSoundEnabled(): boolean {
  return soundEnabled && !masterMuted;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  emitAudioSettings();
}

export function isMusicEnabled(): boolean {
  return musicEnabled && !masterMuted;
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  emitAudioSettings();
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled;
  emitAudioSettings();
}

export function getMusicState(): MusicTrackState {
  return currentMusicState;
}

export function subscribeMusicState(listener: MusicStateListener): () => void {
  musicStateListeners.add(listener);
  listener(currentMusicState);
  return () => {
    musicStateListeners.delete(listener);
  };
}

export function setMusicState(partial: Partial<MusicTrackState>): void {
  currentMusicState = { ...currentMusicState, ...partial };
  if ('ducked' in partial || 'suppressedForAudio' in partial) {
    syncVoiceActivity();
  }
  updateAmbientAudioPrefs({
    zoneId: currentMusicState.zoneId,
    inMission: currentMusicState.inMission,
    ducked: currentMusicState.ducked,
    suppressed: currentMusicState.suppressedForAudio,
  });
  musicStateListeners.forEach((fn) => {
    try {
      fn(currentMusicState);
    } catch {
      // Abaikan ralat pendengar
    }
  });
}

function getEffectiveSfxScale(): number {
  if (masterMuted || !soundEnabled) return 0;
  return Math.max(0, Math.min(1, masterVolume * sfxVolume));
}

export function playSFX(type: SfxType): void {
  // User calling playSFX from a UI click counts as user gesture
  if (!userInteracted) {
    unlockAudioOnUserGesture();
  }
  const scale = getEffectiveSfxScale();
  if (scale <= 0.005) return;

  const nowMs = performance.now();
  const cooldown = SFX_COOLDOWN_MS[type] ?? 80;
  if (lastSfxAt[type] && nowMs - lastSfxAt[type] < cooldown) {
    return;
  }
  lastSfxAt[type] = nowMs;

  const ctx = ensureAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'click') {
      // Soft futuristic UI tap
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(620, now);
      o.frequency.exponentialRampToValueAtTime(920, now + 0.05);
      g.gain.setValueAtTime(0.055 * scale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      o.start(now);
      o.stop(now + 0.07);
    } else if (type === 'zone') {
      // Mission selection & activation pulse
      [440, 659.25].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.065);
        o.frequency.exponentialRampToValueAtTime(freq * 1.06, now + i * 0.065 + 0.14);
        g.gain.setValueAtTime(0.07 * scale, now + i * 0.065);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.18);
        o.start(now + i * 0.065);
        o.stop(now + i * 0.065 + 0.19);
      });
    } else if (type === 'portal_charge') {
      // Magical energy charging swell at mission building entrance
      const baseOsc = ctx.createOscillator();
      const shimmerOsc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      baseOsc.type = 'triangle';
      shimmerOsc.type = 'sine';
      baseOsc.frequency.setValueAtTime(196, now);
      baseOsc.frequency.exponentialRampToValueAtTime(587.33, now + 0.85);
      shimmerOsc.frequency.setValueAtTime(392, now);
      shimmerOsc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.85);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, now);
      lp.frequency.exponentialRampToValueAtTime(3400, now + 0.85);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.095 * scale, now + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      baseOsc.connect(lp);
      shimmerOsc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      baseOsc.start(now);
      shimmerOsc.start(now);
      baseOsc.stop(now + 0.98);
      shimmerOsc.stop(now + 0.98);
    } else if (type === 'portal') {
      // Crystalline portal ignition chord
      [392, 587.33, 783.99, 1174.66].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.045);
        g.gain.setValueAtTime(0.08 * scale, now + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.28);
        o.start(now + i * 0.045);
        o.stop(now + i * 0.045 + 0.3);
      });
    } else if (type === 'clue') {
      [660, 880, 1175].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.06);
        g.gain.setValueAtTime(0.08 * scale, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
        o.start(now + i * 0.06);
        o.stop(now + i * 0.06 + 0.23);
      });
    } else if (type === 'xp') {
      // Reward notification crystal chord
      [587.33, 880, 1174.66].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + i * 0.055);
        g.gain.setValueAtTime(0.09 * scale, now + i * 0.055);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.24);
        o.start(now + i * 0.055);
        o.stop(now + i * 0.055 + 0.25);
      });
    } else if (type === 'achievement') {
      // Achievement unlock shimmering arpeggio
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = i % 2 === 0 ? 'sine' : 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.06);
        g.gain.setValueAtTime(0.085 * scale, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.34);
        o.start(now + i * 0.06);
        o.stop(now + i * 0.06 + 0.36);
      });
    } else if (type === 'win') {
      // Victory fanfare with warm root bass + rising triad
      const fanfare: [number, number, number][] = [
        [523.25, 0, 0.24],
        [659.25, 0.09, 0.24],
        [783.99, 0.18, 0.26],
        [1046.5, 0.28, 0.45],
      ];
      fanfare.forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gn = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gn);
        gn.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + delay);
        gn.gain.setValueAtTime(0.11 * scale, now + delay);
        gn.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      });
    } else if (type === 'arrival') {
      // Short cinematic arrival + new mission notification chime
      [392.0, 523.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.055);
        g.gain.setValueAtTime(0.085 * scale, now + i * 0.055);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.32);
        o.start(now + i * 0.055);
        o.stop(now + i * 0.055 + 0.34);
      });
    } else if (type === 'warp') {
      // Futuristic teleportation whoosh + shimmering harmonic burst
      const sweep = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweep.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, now);
      lp.frequency.exponentialRampToValueAtTime(3600, now + 0.72);
      sweep.frequency.setValueAtTime(95, now);
      sweep.frequency.exponentialRampToValueAtTime(680, now + 0.72);
      sweepGain.gain.setValueAtTime(0.001, now);
      sweepGain.gain.linearRampToValueAtTime(0.105 * scale, now + 0.16);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      sweep.connect(lp);
      lp.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      sweep.start(now);
      sweep.stop(now + 0.88);

      if (noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(2.5, now);
        bp.frequency.setValueAtTime(420, now);
        bp.frequency.exponentialRampToValueAtTime(2800, now + 0.68);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, now);
        ng.gain.linearRampToValueAtTime(0.08 * scale, now + 0.25);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.88);
      }

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + 0.45 + i * 0.05);
        g.gain.setValueAtTime(0.001, now + 0.45 + i * 0.05);
        g.gain.linearRampToValueAtTime(0.075 * scale, now + 0.49 + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.92 + i * 0.05);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + 0.45 + i * 0.05);
        o.stop(now + 0.95 + i * 0.05);
      });
    } else if (type === 'error') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, now);
      o.frequency.linearRampToValueAtTime(140, now + 0.16);
      g.gain.setValueAtTime(0.07 * scale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.start(now);
      o.stop(now + 0.19);
    }
  } catch {
    // Abaikan ralat autoplay WebAudio
  }
}

export function playFootstep(
  surface: FootstepSurface,
  foot: 'left' | 'right' = 'left'
): void {
  const scale = getEffectiveSfxScale();
  if (scale <= 0.005 || !userInteracted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const footBias = foot === 'left' ? 0.96 : 1.05;
    const jitter = 0.95 + Math.random() * 0.1;
    const pitchMul = footBias * jitter;

    if (surface === 'grass') {
      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1750 * pitchMul, now);
        bp.Q.setValueAtTime(1.3, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, now);
        ng.gain.linearRampToValueAtTime(0.055 * scale, now + 0.012);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.08);
      }

      const thud = ctx.createOscillator();
      const tg = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(112 * pitchMul, now);
      thud.frequency.exponentialRampToValueAtTime(58, now + 0.05);
      tg.gain.setValueAtTime(0.028 * scale, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      thud.connect(tg);
      tg.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.06);
    } else if (surface === 'soil') {
      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(760 * pitchMul, now);
        bp.Q.setValueAtTime(2.1, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, now);
        ng.gain.linearRampToValueAtTime(0.075 * scale, now + 0.008);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.068);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.075);
      }

      const thud = ctx.createOscillator();
      const tg = ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(148 * pitchMul, now);
      thud.frequency.exponentialRampToValueAtTime(56, now + 0.058);
      tg.gain.setValueAtTime(0.052 * scale, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      thud.connect(tg);
      tg.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.07);
    } else if (surface === 'lab') {
      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(2450 * pitchMul, now);
        hp.Q.setValueAtTime(3.2, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.065 * scale, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.026);
        src.connect(hp);
        hp.connect(ng);
        ng.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.03);
      }

      const heel = ctx.createOscillator();
      const hg = ctx.createGain();
      heel.type = 'triangle';
      heel.frequency.setValueAtTime(460 * pitchMul, now);
      heel.frequency.exponentialRampToValueAtTime(210 * pitchMul, now + 0.048);
      hg.gain.setValueAtTime(0.055 * scale, now);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      heel.connect(hg);
      hg.connect(ctx.destination);
      heel.start(now);
      heel.stop(now + 0.06);

      const ping = ctx.createOscillator();
      const pg = ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(920 * pitchMul, now);
      pg.gain.setValueAtTime(0.016 * scale, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      ping.connect(pg);
      pg.connect(ctx.destination);
      ping.start(now);
      ping.stop(now + 0.06);
    } else if (surface === 'wood') {
      const plank = ctx.createOscillator();
      const pg = ctx.createGain();
      plank.type = 'triangle';
      plank.frequency.setValueAtTime(230 * pitchMul, now);
      plank.frequency.exponentialRampToValueAtTime(118 * pitchMul, now + 0.062);
      pg.gain.setValueAtTime(0.068 * scale, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
      plank.connect(pg);
      pg.connect(ctx.destination);
      plank.start(now);
      plank.stop(now + 0.078);

      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(420 * pitchMul, now);
        bp.Q.setValueAtTime(3.0, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.04 * scale, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.04);
      }
    } else if (surface === 'water') {
      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1050 * pitchMul, now);
        bp.frequency.exponentialRampToValueAtTime(2600 * pitchMul, now + 0.085);
        bp.Q.setValueAtTime(1.5, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, now);
        ng.gain.linearRampToValueAtTime(0.065 * scale, now + 0.015);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.1);
      }

      const drop = ctx.createOscillator();
      const dg = ctx.createGain();
      drop.type = 'sine';
      drop.frequency.setValueAtTime(420 * pitchMul, now + 0.015);
      drop.frequency.exponentialRampToValueAtTime(760 * pitchMul, now + 0.065);
      dg.gain.setValueAtTime(0.02 * scale, now + 0.015);
      dg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      drop.connect(dg);
      dg.connect(ctx.destination);
      drop.start(now + 0.015);
      drop.stop(now + 0.075);
    }
  } catch {
    // Abaikan ralat WebAudio
  }
}
