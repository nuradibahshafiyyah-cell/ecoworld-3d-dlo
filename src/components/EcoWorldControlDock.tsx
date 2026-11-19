import React from 'react';
import { AvatarDef, CameraMode, MissionDef, UserAccount } from '../types/game';

interface EcoWorldControlDockProps {
  dockCollapsed: boolean;
  onToggleDock: () => void;
  missions: MissionDef[];
  user: UserAccount;
  currentAvatar: AvatarDef;
  focusedMissionId: number;
  cameraMode: CameraMode;
  onSelectMission: (missionId: number) => void;
  onChangeCameraMode: (mode: CameraMode) => void;
  onDpadChange: (vec: { x: number; z: number }) => void;
  onOpenAgentSelect: () => void;
  onOpenEvidence: () => void;
  onOpenProfile: () => void;
  onOpenHeroes: () => void;
}

const EXACT_MISSION_LABELS: Record<number, string> = {
  1: 'Sungai Tercemar',
  2: 'Operasi Jejak Punca dan Kesan',
  3: 'Hutan Harapan',
  4: 'Makmal Suara',
  5: 'Operasi EcoWorld',
};

/* ============================================================================
   COMPACT CUSTOM SVG MISSION ICONS (LEFT SIDE OF BUTTON, ZERO EMOJIS)
   ============================================================================ */
function MissionCompactIcon({
  missionId,
  accentColor,
}: {
  missionId: number;
  accentColor: string;
}) {
  if (missionId === 1) {
    // MISI 01: Water droplet / river symbol
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
        <path
          d="M10 2.5C10 2.5 5 8.1 5 11.7a5 5 0 0 0 10 0C15 8.1 10 2.5 10 2.5Z"
          fill={accentColor}
          fillOpacity="0.22"
          stroke={accentColor}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M7.6 12.2c.4 1.3 1.4 2.1 2.7 2.3"
          stroke="#e0f2fe"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (missionId === 2) {
    // MISI 02: Magnifying glass investigation symbol
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
        <circle
          cx="8.8"
          cy="8.8"
          r="5"
          fill={accentColor}
          fillOpacity="0.18"
          stroke={accentColor}
          strokeWidth="1.7"
        />
        <path
          d="M12.6 12.6L16.8 16.8"
          stroke={accentColor}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M6.8 7.2a2.6 2.6 0 0 1 2.7-1.1"
          stroke="#fef3c7"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (missionId === 3) {
    // MISI 03: Tree / forest symbol
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
        <path
          d="M10 2.5L4.8 9.2h3.1L4.2 14h11.6L12.1 9.2h3.1L10 2.5Z"
          fill={accentColor}
          fillOpacity="0.24"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M10 14v3.5M7.5 17.5h5" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (missionId === 4) {
    // MISI 04: Microphone / sound wave symbol
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
        <rect
          x="7.5"
          y="2.8"
          width="5"
          height="8.4"
          rx="2.5"
          fill={accentColor}
          fillOpacity="0.22"
          stroke={accentColor}
          strokeWidth="1.6"
        />
        <path
          d="M4.8 9.8a5.2 5.2 0 0 0 10.4 0M10 15v2.6M7.5 17.6h5"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // MISI 05: Globe / planet symbol
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="6.8"
        fill={accentColor}
        fillOpacity="0.18"
        stroke={accentColor}
        strokeWidth="1.6"
      />
      <ellipse cx="10" cy="10" rx="3.1" ry="6.8" stroke={accentColor} strokeWidth="1.3" />
      <path d="M3.4 10h13.2M4.8 6.8h10.4M4.8 13.2h10.4" stroke={accentColor} strokeWidth="1.2" />
    </svg>
  );
}

/* ============================================================================
   CUSTOM VECTOR STATUS & NAVIGATION & ACTION ICONS (NO EMOJIS)
   ============================================================================ */
function StatusVectorBadge({ done, unlocked }: { done: boolean; unlocked: boolean }) {
  if (done) {
    return (
      <span
        title="Misi Selesai"
        className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#28B98A]/25 border border-[#28B98A] text-[#6ee7b7] shrink-0"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" aria-hidden="true">
          <path
            d="M3.2 8.4L6.4 11.6L12.8 4.6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (unlocked) {
    return (
      <span
        title="Misi Dibuka"
        className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#43C7F4]/20 border border-[#43C7F4]/80 text-[#7dd3fc] shrink-0"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor" aria-hidden="true">
          <path d="M4.5 3.2L12.5 8L4.5 12.8V3.2Z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      title="Misi Terkunci"
      className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-800/80 border border-slate-600/70 text-slate-400 shrink-0"
    >
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden="true">
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function CameraModeVectorIcon({ mode, active }: { mode: CameraMode; active: boolean }) {
  const stroke = active ? '#0b121e' : '#e7bd58';
  if (mode === 'overview') {
    // Pulau (Globe)
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.2" stroke={stroke} strokeWidth="1.6" />
        <ellipse cx="10" cy="10" rx="3.3" ry="7.2" stroke={stroke} strokeWidth="1.4" />
        <path d="M3 10h14M4.5 6.5h11M4.5 13.5h11" stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }
  if (mode === 'follow') {
    // Ikut Ejen (Agent Crest)
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
        <circle cx="8" cy="6.5" r="2.7" stroke={stroke} strokeWidth="1.6" />
        <path d="M3.2 15.8c.5-2.7 2.4-4.1 4.8-4.1s4.3 1.4 4.8 4.1" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="14.2" cy="7.5" r="2" stroke={stroke} strokeWidth="1.4" />
        <path d="M13.5 15.5h3.5c-.3-2-1.4-3-2.9-3.2" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (mode === 'firstPerson') {
    // Mata Ejen (First-Person Sight Star/Eye)
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M2.2 10s2.9-4.8 7.8-4.8S17.8 10 17.8 10s-2.9 4.8-7.8 4.8S2.2 10 2.2 10Z"
          stroke={stroke}
          strokeWidth="1.6"
        />
        <circle cx="10" cy="10" r="2.3" fill={stroke} />
      </svg>
    );
  }
  // Zon (Waypoint Pin)
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M10 17s5.2-4.8 5.2-8.7A5.2 5.2 0 1 0 4.8 8.3C4.8 12.2 10 17 10 17Z"
        stroke={stroke}
        strokeWidth="1.6"
      />
      <circle cx="10" cy="8.3" r="2" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function DirectionChevron({ dir }: { dir: 'left' | 'up' | 'down' | 'right' }) {
  const rotate =
    dir === 'left'
      ? 'rotate(180deg)'
      : dir === 'up'
      ? 'rotate(-90deg)'
      : dir === 'down'
      ? 'rotate(90deg)'
      : 'rotate(0deg)';
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5 text-[#43C7F4]"
      style={{ transform: rotate }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 3.5L10.5 8L5.5 12.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================================================================
   MAIN COMPONENT: AAA ADVENTURE GAME DASHBOARD CONTROL BOARD
   ============================================================================ */
export function EcoWorldControlDock({
  dockCollapsed,
  onToggleDock,
  missions,
  user,
  currentAvatar,
  focusedMissionId,
  cameraMode,
  onSelectMission,
  onChangeCameraMode,
  onDpadChange,
  onOpenAgentSelect,
  onOpenEvidence,
  onOpenProfile,
  onOpenHeroes,
}: EcoWorldControlDockProps) {
  const evidenceCount = user.progress?.m1.evidence.length || 0;
  const badgeCount = (user.badges || []).length;

  return (
    <div
      className={`no-print fixed bottom-3 left-3 md:left-6 xl:left-1/2 xl:-translate-x-[calc(50%+125px)] z-30 w-[min(900px,calc(100vw-24px))] md:w-[min(900px,calc(100vw-360px))] transition-transform duration-300 ${
        dockCollapsed ? 'translate-y-[calc(100%-38px)]' : 'translate-y-0'
      }`}
    >
      {/* Top Winged Crest Toggle Button */}
      <div className="flex justify-center mb-1.5">
        <button
          type="button"
          onClick={onToggleDock}
          className="group relative flex items-center gap-2.5 px-5 py-1.5 rounded-xl bg-gradient-to-b from-[#1e2f47] via-[#121d2e] to-[#0b1320] border border-[#E7BD58]/75 text-xs font-game font-bold text-slate-100 shadow-[0_6px_18px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-[#43C7F4] hover:shadow-[0_0_18px_rgba(67,199,244,0.35)] transition-all cursor-pointer"
        >
          {/* Custom Twin-Leaf Metallic Crest */}
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-[#28B98A] to-[#0f5132] border border-[#E7BD58]/80 shadow-inner">
            <svg viewBox="0 0 18 18" className="w-3.5 h-3.5" fill="none" aria-hidden="true">
              <path
                d="M9 14.5C9 9.5 11.5 5.5 15.5 3.5C15 8.5 13 12 9 14.5Z"
                fill="#86efac"
              />
              <path
                d="M9 14.5C9 10.2 6.8 6.8 2.8 5.2C3.3 9.2 5.2 12.2 9 14.5Z"
                fill="#28B98A"
              />
            </svg>
          </span>
          <span className="tracking-wide text-slate-100 group-hover:text-white">
            {dockCollapsed ? 'Papar Kawalan (H)' : 'Sembunyi Kawalan (H)'}
          </span>
          <svg
            viewBox="0 0 16 16"
            className={`w-3.5 h-3.5 text-[#E7BD58] transition-transform duration-200 ${
              dockCollapsed ? 'rotate-180' : ''
            }`}
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Main Metallic RPG Control Board Shell */}
      <div
        className="relative rounded-2xl p-3 sm:p-3.5 space-y-2.5 border border-[#43C7F4]/45 shadow-[0_18px_50px_rgba(2,6,23,0.88),inset_0_1px_0_rgba(255,255,255,0.14)]"
        style={{
          background:
            'linear-gradient(180deg, rgba(24, 38, 56, 0.97) 0%, rgba(16, 24, 39, 0.98) 56%, rgba(11, 17, 29, 0.99) 100%)',
        }}
      >
        {/* Subtle Gold Corner Brackets */}
        <span
          className="pointer-events-none absolute top-0 left-3 right-3 h-[2px] rounded-full opacity-75"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, #E7BD58 20%, #43C7F4 50%, #E7BD58 80%, transparent 100%)',
          }}
        />

        {/* ================================================================
            ROW 1: FIVE COMPACT HORIZONTAL MISSION BUTTONS
           ================================================================ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {missions.map((m) => {
            const mp = user.progress![`m${m.id}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5'];
            const done = 'submitted' in mp ? mp.submitted : mp.completed;
            const unlocked = m.id <= (user.unlockedMission || 1) && m.active;
            const isFocused = focusedMissionId === m.id;
            const displayName = EXACT_MISSION_LABELS[m.id] || m.shortTitle;

            const buttonTone = isFocused
              ? 'border-[#E7BD58] bg-gradient-to-b from-[#1f3450] via-[#152438] to-[#0f1929] shadow-[0_0_16px_rgba(231,189,88,0.42),0_0_10px_rgba(67,199,244,0.28)]'
              : done
              ? 'border-[#28B98A]/85 bg-gradient-to-b from-[#163638] via-[#11272e] to-[#0d1c24] shadow-[0_0_10px_rgba(40,185,138,0.18)] hover:border-[#28B98A]'
              : unlocked
              ? 'border-[#E7BD58]/55 bg-gradient-to-b from-[#1c2c44] via-[#132033] to-[#0d1624] hover:border-[#43C7F4] hover:shadow-[0_0_14px_rgba(67,199,244,0.28)]'
              : 'border-slate-700/75 bg-gradient-to-b from-[#141d2c] to-[#0c121d] opacity-60 hover:opacity-80';

            const iconAccent = isFocused
              ? '#E7BD58'
              : done
              ? '#28B98A'
              : unlocked
              ? '#43C7F4'
              : '#64748b';

            const iconSocketTone = isFocused
              ? 'border-[#E7BD58]/80 bg-[#101827]'
              : done
              ? 'border-[#28B98A]/70 bg-[#101827]'
              : unlocked
              ? 'border-[#43C7F4]/55 bg-[#101827]'
              : 'border-slate-700 bg-[#0d131f]';

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMission(m.id)}
                className={`group relative rounded-xl border px-2.5 py-2 min-h-[54px] text-left flex items-center gap-2 transition-all duration-150 hover:brightness-110 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_10px_rgba(0,0,0,0.45)] ${buttonTone}`}
              >
                {/* Small Custom SVG Icon on Left */}
                <span
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-inner ${iconSocketTone}`}
                >
                  <MissionCompactIcon missionId={m.id} accentColor={iconAccent} />
                </span>

                {/* Mission Number + Title */}
                <div className="min-w-0 flex-1">
                  <div className="font-game text-[9.5px] font-black tracking-wider text-[#E7BD58] leading-none">
                    MISI 0{m.id}
                  </div>
                  <div
                    className={`font-display font-bold text-white mt-0.5 ${
                      m.id === 2
                        ? 'text-[10px] leading-[1.15] whitespace-normal'
                        : 'text-[11px] leading-tight truncate'
                    }`}
                  >
                    {displayName}
                  </div>
                </div>

                {/* Small Status Indicator on Right */}
                <StatusVectorBadge done={done} unlocked={unlocked} />
              </button>
            );
          })}
        </div>

        {/* ================================================================
            ROW 2: CAMERA NAVIGATION PILLS & CIRCULAR WASD CONTROLS
           ================================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl bg-[#182638]/95 border border-slate-700/80 shadow-inner">
          {/* Camera Mode Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['overview', 'Pulau'],
                ['follow', 'Ikut Ejen'],
                ['firstPerson', 'Mata Ejen'],
                ['zone', 'Zon'],
              ] as [CameraMode, string][]
            ).map(([mode, label]) => {
              const active = cameraMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeCameraMode(mode)}
                  className={`px-3 py-1.5 rounded-full font-display text-xs font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer whitespace-nowrap border ${
                    active
                      ? 'bg-gradient-to-b from-[#7dd3fc] via-[#43C7F4] to-[#0284c7] text-[#09121e] border-[#e0f2fe] shadow-[0_0_16px_rgba(67,199,244,0.6)]'
                      : 'bg-gradient-to-b from-[#23344d] to-[#121d2d] text-slate-100 border-slate-600/80 hover:border-[#43C7F4]/70 hover:text-white'
                  }`}
                >
                  <CameraModeVectorIcon mode={mode} active={active} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Subtle Gold Divider */}
          <div
            className="hidden xl:block flex-1 h-[1px] mx-2 opacity-60"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #E7BD58 50%, transparent 100%)',
            }}
          />

          {/* Circular Metallic WASD Controls */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden lg:inline text-[11px] font-medium text-slate-300 tracking-wide">
              Gerak: WASD / Klik Pulau
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onPointerDown={() => onDpadChange({ x: -1, z: 0 })}
                onPointerUp={() => onDpadChange({ x: 0, z: 0 })}
                onPointerLeave={() => onDpadChange({ x: 0, z: 0 })}
                className="w-8 h-8 rounded-full bg-gradient-to-b from-[#273a56] to-[#101827] border border-slate-500/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.6)] hover:border-[#43C7F4] hover:shadow-[0_0_12px_rgba(67,199,244,0.45)] active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Gerak kiri"
              >
                <DirectionChevron dir="left" />
              </button>
              <button
                type="button"
                onPointerDown={() => onDpadChange({ x: 0, z: -1 })}
                onPointerUp={() => onDpadChange({ x: 0, z: 0 })}
                onPointerLeave={() => onDpadChange({ x: 0, z: 0 })}
                className="w-8 h-8 rounded-full bg-gradient-to-b from-[#273a56] to-[#101827] border border-slate-500/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.6)] hover:border-[#43C7F4] hover:shadow-[0_0_12px_rgba(67,199,244,0.45)] active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Gerak depan"
              >
                <DirectionChevron dir="up" />
              </button>
              <button
                type="button"
                onPointerDown={() => onDpadChange({ x: 0, z: 1 })}
                onPointerUp={() => onDpadChange({ x: 0, z: 0 })}
                onPointerLeave={() => onDpadChange({ x: 0, z: 0 })}
                className="w-8 h-8 rounded-full bg-gradient-to-b from-[#273a56] to-[#101827] border border-slate-500/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.6)] hover:border-[#43C7F4] hover:shadow-[0_0_12px_rgba(67,199,244,0.45)] active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Gerak belakang"
              >
                <DirectionChevron dir="down" />
              </button>
              <button
                type="button"
                onPointerDown={() => onDpadChange({ x: 1, z: 0 })}
                onPointerUp={() => onDpadChange({ x: 0, z: 0 })}
                onPointerLeave={() => onDpadChange({ x: 0, z: 0 })}
                className="w-8 h-8 rounded-full bg-gradient-to-b from-[#273a56] to-[#101827] border border-slate-500/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_8px_rgba(0,0,0,0.6)] hover:border-[#43C7F4] hover:shadow-[0_0_12px_rgba(67,199,244,0.45)] active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Gerak kanan"
              >
                <DirectionChevron dir="right" />
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================
            ROW 3: FOUR MAIN ACTION BUTTONS (CUSTOM VECTOR EMBLEMS)
           ================================================================ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Pilih Ejen */}
          <button
            type="button"
            onClick={onOpenAgentSelect}
            className="group relative px-3 py-2 rounded-xl border border-[#28B98A]/80 bg-gradient-to-b from-[#176953] via-[#114f3f] to-[#0b3329] text-white font-game text-xs font-bold flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(16,185,129,0.22)] hover:border-[#E7BD58] hover:shadow-[0_0_18px_rgba(40,185,138,0.42)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[#101827]/75 border border-[#E7BD58]/70 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
                <circle
                  cx="12"
                  cy="8"
                  r="4"
                  fill={currentAvatar.accentColor || '#E7BD58'}
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                />
                <path
                  d="M4.5 20c.8-3.8 3.6-5.8 7.5-5.8s6.7 2 7.5 5.8"
                  fill="#E7BD58"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>Pilih Ejen</span>
          </button>

          {/* 2. Buku Bukti */}
          <button
            type="button"
            onClick={onOpenEvidence}
            className="group relative px-3 py-2 rounded-xl border border-[#43C7F4]/80 bg-gradient-to-b from-[#155a8a] via-[#104269] to-[#0a2a47] text-white font-game text-xs font-bold flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(67,199,244,0.22)] hover:border-[#7dd3fc] hover:shadow-[0_0_18px_rgba(67,199,244,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[#101827]/75 border border-[#43C7F4]/70 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
                <path
                  d="M3.5 6.2C6 5.2 9.5 5.6 12 7.4V19c-2.5-1.6-6-2-8.5-1V6.2Z"
                  fill="#E7BD58"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M20.5 6.2C18 5.2 14.5 5.6 12 7.4V19c2.5-1.6 6-2 8.5-1V6.2Z"
                  fill="#d97706"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>Buku Bukti ({evidenceCount})</span>
          </button>

          {/* 3. Profil & Lencana */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="group relative px-3 py-2 rounded-xl border border-violet-400/75 bg-gradient-to-b from-[#5a2594] via-[#431b70] to-[#2b104c] text-white font-game text-xs font-bold flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_rgba(139,92,246,0.24)] hover:border-violet-300 hover:shadow-[0_0_18px_rgba(167,139,250,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[#101827]/75 border border-violet-300/70 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
                <path
                  d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
                  fill="#E7BD58"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                />
                <path
                  d="M7 5.5H4.5a1.5 1.5 0 0 0 0 3H7M17 5.5h2.5a1.5 1.5 0 0 1 0 3H17M12 14v3.5M8.5 20h7"
                  stroke="#fef3c7"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>Profil &amp; Lencana ({badgeCount}/5)</span>
          </button>

          {/* 4. Dewan Wira ★ (Vector Star Emblem) */}
          <button
            type="button"
            onClick={onOpenHeroes}
            className="group relative px-3 py-2 rounded-xl border border-[#E7BD58] bg-gradient-to-b from-[#a8751d] via-[#7c5211] to-[#4f3309] text-white font-game text-xs font-bold flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_14px_rgba(231,189,88,0.26)] hover:border-[#fef08a] hover:shadow-[0_0_18px_rgba(231,189,88,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[#101827]/75 border border-[#E7BD58] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden="true">
                <path
                  d="M12 3.2l2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.9L12 3.2Z"
                  fill="#E7BD58"
                  stroke="#fef3c7"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="inline-flex items-center gap-1">
              <span>Dewan Wira</span>
              <svg viewBox="0 0 16 16" className="w-3 h-3 text-[#fde047]" fill="currentColor" aria-hidden="true">
                <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.5Z" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
