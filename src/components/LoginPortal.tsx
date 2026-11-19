import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpenCheck, Check, ChevronRight, Lock, Plus, X } from 'lucide-react';
import { ClassRoom, UserAccount, UserRole } from '../types/game';
import { playSFX } from '../utils/sound';

interface LoginPortalProps {
  classes: ClassRoom[];
  students: UserAccount[];
  onBackToSplash: () => void;
  onOpenDskp?: () => void;
  onLoginStaff: (identifier: string, password: string, role: 'guru' | 'admin') => void;
  onEnterStudent: (fullName: string, studentId: string, className: string) => void;
  onRegisterStudent: (
    fullName: string,
    studentId: string,
    className: string
  ) => { ok: boolean; error?: string; student?: UserAccount };
}

/* ============================================================================
   CUSTOM FUTURISTIC VECTOR EMBLEMS (ZERO EMOJIS)
   ============================================================================ */

function EcoWorldCrestSVG() {
  return (
    <svg viewBox="0 0 180 150" className="w-36 h-28 md:w-44 md:h-36 drop-shadow-[0_12px_24px_rgba(14,165,233,0.45)] hero-globe-float" aria-hidden="true">
      <defs>
        <radialGradient id="crestOcean" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="48%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        <linearGradient id="crestLand" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="crestOrbit" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#fef08a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Ambient Glow Ring */}
      <ellipse cx="90" cy="84" rx="74" ry="20" fill="none" stroke="url(#crestOrbit)" strokeWidth="4" transform="rotate(-12 90 84)" />

      {/* Sprout Leaves on Top of Globe */}
      <path d="M90 36 C82 14, 52 10, 48 28 C64 38, 82 36, 90 36 Z" fill="url(#crestLand)" stroke="#ecfccb" strokeWidth="1.5" />
      <path d="M90 36 C98 10, 128 8, 134 26 C116 38, 98 37, 90 36 Z" fill="url(#crestLand)" stroke="#ecfccb" strokeWidth="1.5" />
      <path d="M90 42 L90 22" stroke="#d9f99d" strokeWidth="3" strokeLinecap="round" />

      {/* 3D Planet Sphere */}
      <circle cx="90" cy="82" r="46" fill="url(#crestOcean)" stroke="#bae6fd" strokeWidth="2.5" />

      {/* Continents */}
      <path
        d="M58 64 C66 56, 82 58, 84 70 C86 80, 74 86, 78 96 C82 106, 68 116, 58 106 C48 96, 48 74, 58 64 Z"
        fill="url(#crestLand)"
      />
      <path
        d="M98 54 C112 52, 126 64, 124 78 C122 92, 108 98, 100 88 C94 80, 92 60, 98 54 Z"
        fill="url(#crestLand)"
      />
      <path
        d="M96 98 C108 94, 118 102, 112 114 C104 122, 92 116, 96 98 Z"
        fill="url(#crestLand)"
      />

      {/* Specular Shine */}
      <ellipse cx="72" cy="60" rx="16" ry="8" fill="#ffffff" opacity="0.28" transform="rotate(-24 72 60)" />

      {/* Front Orbital Arc */}
      <path d="M18 96 C46 112, 136 104, 162 72" fill="none" stroke="#a5f3fc" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <circle cx="156" cy="76" r="4" fill="#fef08a" />
      <circle cx="24" cy="94" r="3" fill="#34d399" />
    </svg>
  );
}

function RoleAdminIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path
        d="M14 2.5L23.5 6.2V13.4C23.5 19.2 19.4 23.9 14 25.6C8.6 23.9 4.5 19.2 4.5 13.4V6.2L14 2.5Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 8.2L15.6 11.5L19.2 12L16.6 14.5L17.2 18.1L14 16.4L10.8 18.1L11.4 14.5L8.8 12L12.4 11.5L14 8.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RoleGuruIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path
        d="M14 4.5L25 10L14 15.5L3 10L14 4.5Z"
        fill="currentColor"
        fillOpacity="0.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 13.2V19.2C7.5 21.4 10.4 23 14 23C17.6 23 20.5 21.4 20.5 19.2V13.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M23.5 11.2V17.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RoleMuridIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
      <circle cx="10.5" cy="9.5" r="3.6" fill="currentColor" fillOpacity="0.26" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="19" cy="10.5" r="2.8" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 22.5C4 18.8 6.9 16.5 10.5 16.5C14.1 16.5 17 18.8 17 22.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M16.8 17C19.6 17 22.8 18.6 23.4 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PillarSproutIcon() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
      <path d="M18 29V15" stroke="#86efac" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18 18C12 18 7 14 7 8C13 8 18 12 18 18Z" fill="#4ade80" stroke="#dcfce7" strokeWidth="1.4" />
      <path d="M18 15C18 9 23 5 29 5C29 11 24 15 18 15Z" fill="#22c55e" stroke="#dcfce7" strokeWidth="1.4" />
      <ellipse cx="18" cy="30" rx="8" ry="2.2" fill="#34d399" opacity="0.45" />
    </svg>
  );
}

function PillarGlobeIcon() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
      <circle cx="18" cy="18" r="11" fill="#0ea5e9" stroke="#bae6fd" strokeWidth="1.8" />
      <path d="M12 13C15 11 18 14 17 18C16 21 19 24 15 26C11 24 10 17 12 13Z" fill="#4ade80" />
      <path d="M21 11C25 12 27 16 25 21C23 23 20 20 21 16C21.5 14 20 12 21 11Z" fill="#22c55e" />
      <ellipse cx="18" cy="18" rx="14.5" ry="4.5" fill="none" stroke="#fde047" strokeWidth="1.4" transform="rotate(-22 18 18)" />
    </svg>
  );
}

function PillarRecycleIcon() {
  return (
    <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
      <path
        d="M14 9L18 4L22 9M25 14L29 21L23 24M11 24L7 21L11 14"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 26H24"
        stroke="#22d3ee"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="18" cy="18" r="3" fill="#fef08a" />
    </svg>
  );
}

function StudentIllustratedAvatar({
  fullName,
  studentId,
  selected,
}: {
  fullName: string;
  studentId: string;
  selected: boolean;
}) {
  const lower = fullName.toLowerCase();
  const isFemale =
    /\bbinti\b|\bnur\b|\bsiti\b|\baisyah\b|\baleesya\b|\bsofea\b|\bputeri\b|\bain\b|\bamira\b|\bfatin\b/.test(
      lower
    );

  const hash = (studentId + fullName)
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const girlPalettes = [
    { hijab: '#0ea5e9', hijabShade: '#0369a1', suit: '#14b8a6', bg: '#082f49' },
    { hijab: '#8b5cf6', hijabShade: '#6d28d9', suit: '#06b6d4', bg: '#1e1b4b' },
    { hijab: '#ec4899', hijabShade: '#be185d', suit: '#10b981', bg: '#3b0764' },
  ];
  const boyPalettes = [
    { hair: '#3b2516', suit: '#10b981', trim: '#22d3ee', bg: '#064e3b' },
    { hair: '#1e1b18', suit: '#0ea5e9', trim: '#fde047', bg: '#0c4a6e' },
    { hair: '#451a03', suit: '#14b8a6', trim: '#6ee7b7', bg: '#083344' },
  ];

  const gp = girlPalettes[hash % girlPalettes.length];
  const bp = boyPalettes[hash % boyPalettes.length];
  const gradId = `avBg-${studentId.replace(/[^a-zA-Z0-9_-]/g, '') || 'stu'}-${hash}`;

  return (
    <div
      className={`relative w-11 h-11 rounded-2xl overflow-hidden shrink-0 border-2 transition-all duration-300 ${
        selected
          ? 'border-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.8)] scale-105'
          : 'border-cyan-400/50'
      }`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="100%" stopColor={isFemale ? gp.bg : bp.bg} />
          </radialGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#${gradId})`} />

        {isFemale ? (
          <>
            {/* Hijab Back & Shoulders */}
            <path d="M12 64 C13 47, 21 42, 32 42 C43 42, 51 47, 52 64 Z" fill={gp.suit} />
            <path d="M15 30 C15 16, 23 11, 32 11 C41 11, 49 16, 49 30 L50 47 C44 51, 20 51, 14 47 Z" fill={gp.hijabShade} />
            <path d="M17 29 C17 17, 24 12, 32 12 C40 12, 47 17, 47 29 C47 39, 41 46, 32 46 C23 46, 17 39, 17 29 Z" fill={gp.hijab} />
            {/* Face */}
            <ellipse cx="32" cy="30" rx="10.5" ry="11.5" fill="#fde6d0" />
            {/* Eyes & Friendly Smile */}
            <circle cx="28" cy="29.5" r="1.7" fill="#1e293b" />
            <circle cx="36" cy="29.5" r="1.7" fill="#1e293b" />
            <circle cx="28.6" cy="29" r="0.6" fill="#ffffff" />
            <circle cx="36.6" cy="29" r="0.6" fill="#ffffff" />
            <ellipse cx="25.5" cy="33" rx="2" ry="1" fill="#fda4af" opacity="0.6" />
            <ellipse cx="38.5" cy="33" rx="2" ry="1" fill="#fda4af" opacity="0.6" />
            <path d="M28.5 34.5 Q32 37.8 35.5 34.5" fill="none" stroke="#9f1239" strokeWidth="1.6" strokeLinecap="round" />
            {/* Eco Badge on Collar */}
            <circle cx="32" cy="52" r="3.4" fill="#fef08a" stroke="#ffffff" strokeWidth="1" />
          </>
        ) : (
          <>
            {/* Futuristic Eco Jacket */}
            <path d="M12 64 C13 48, 21 44, 32 44 C43 44, 51 48, 52 64 Z" fill={bp.suit} />
            <path d="M24 44 L32 54 L40 44" fill="#ffffff" opacity="0.9" />
            <path d="M27 44 L32 51 L37 44" fill={bp.trim} />
            {/* Neck & Ears */}
            <rect x="28.5" y="38" width="7" height="7" rx="3" fill="#f5cba7" />
            <circle cx="20.5" cy="30" r="3" fill="#f5cba7" />
            <circle cx="43.5" cy="30" r="3" fill="#f5cba7" />
            {/* Face */}
            <ellipse cx="32" cy="29" rx="11.5" ry="12" fill="#fde6d0" />
            {/* Hair */}
            <path
              d="M20 27 C20 15, 27 11, 34 12 C41 13, 45 19, 44 27 C41 21, 35 19, 28 21 C24 22, 22 24, 20 27 Z"
              fill={bp.hair}
            />
            <path d="M25 14 C30 10, 38 11, 41 16" fill="none" stroke={bp.trim} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
            {/* Eyes & Confident Smile */}
            <circle cx="27.5" cy="29.5" r="1.8" fill="#1e293b" />
            <circle cx="36.5" cy="29.5" r="1.8" fill="#1e293b" />
            <circle cx="28.1" cy="29" r="0.65" fill="#ffffff" />
            <circle cx="37.1" cy="29" r="0.65" fill="#ffffff" />
            <path d="M28 35 Q32 38.5 36 35" fill="none" stroke="#9f1239" strokeWidth="1.7" strokeLinecap="round" />
            {/* Collar Glow Pin */}
            <circle cx="32" cy="56" r="2.6" fill="#fef08a" />
          </>
        )}
      </svg>
    </div>
  );
}

/* ============================================================================
   MAIN ACCESS PORTAL COMPONENT
   ============================================================================ */

export function LoginPortal({
  classes,
  students,
  onBackToSplash,
  onOpenDskp,
  onLoginStaff,
  onEnterStudent,
  onRegisterStudent,
}: LoginPortalProps) {
  const [role, setRole] = useState<UserRole>('murid');

  // Murid login state
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentClass, setStudentClass] = useState(classes[0]?.name || '6 Bestari');
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);

  // Add New Student Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newClass, setNewClass] = useState(classes[0]?.name || '6 Bestari');
  const [addError, setAddError] = useState<string | null>(null);

  // Guru / Admin login state
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Ensure classes list supports all student classes cleanly
  const availableClasses = useMemo(() => {
    const names = classes.map((c) => c.name);
    if (!names.includes('6 Cemerlang')) names.push('6 Cemerlang');
    return names;
  }, [classes]);

  const handleRoleSwitch = (nextRole: UserRole) => {
    playSFX('click');
    setRole(nextRole);
    setSelectedNotice(null);
    if (nextRole === 'guru') {
      setStaffIdentifier('Cikgu Amina binti Razak');
      setStaffPassword('guru123');
    } else if (nextRole === 'admin') {
      setStaffIdentifier('admin');
      setStaffPassword('admin123');
    }
  };

  const handleSelectStudentCard = (stu: UserAccount) => {
    playSFX('clue');
    setStudentName(stu.fullName);
    setStudentId(stu.studentId || '');
    setStudentClass(stu.className || availableClasses[0] || '6 Bestari');
    setSelectedNotice(`Profil dipilih: ${stu.fullName}`);
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentId.trim()) return;
    onEnterStudent(studentName.trim(), studentId.trim().toUpperCase(), studentClass);
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'guru' || role === 'admin') {
      onLoginStaff(staffIdentifier.trim(), staffPassword, role);
    }
  };

  const handleOpenAddModal = () => {
    playSFX('click');
    const nextNum = students.length + 1;
    const padded = String(nextNum).padStart(3, '0');
    setNewName('');
    setNewId(`BM6-${padded}`);
    setNewClass(availableClasses[0] || '6 Bestari');
    setAddError(null);
    setShowAddModal(true);
  };

  const handleSaveNewStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanId = newId.trim().toUpperCase();

    if (cleanName.length < 3) {
      playSFX('error');
      setAddError('Sila masukkan nama penuh murid yang sah.');
      return;
    }
    if (!cleanId) {
      playSFX('error');
      setAddError('Sila masukkan ID Murid (contoh: BM6-006).');
      return;
    }

    const result = onRegisterStudent(cleanName, cleanId, newClass);
    if (!result.ok) {
      setAddError(result.error || 'ID Murid telah didaftarkan. Sila guna ID lain.');
      return;
    }

    setStudentName(cleanName);
    setStudentId(cleanId);
    setStudentClass(newClass);
    setSelectedNotice(`Murid baharu didaftarkan: ${cleanName}`);
    setShowAddModal(false);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-5 lg:p-8 pb-24 sm:pb-16 lg:pb-8 pointer-events-none overflow-y-auto">
      {/* Landscape 16:9 Floating Mission Control Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pointer-events-auto my-auto">
        {/* =====================================================================
            LEFT PANEL: FUTURISTIC ECOWORLD HERO SHOWCASE
           ===================================================================== */}
        <div className="lg:col-span-6 portal-glass-card rounded-3xl p-5 sm:p-7 text-slate-100 flex flex-col justify-between gap-5">
          {/* Top Chip + DSKP & Back to Splash Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-xl bg-cyan-950/80 border border-cyan-400/45 text-[11px] font-game font-bold text-cyan-200 tracking-wider">
              BM TAHUN 6 · SK 1.2 / SP 1.2.2
            </span>
            <div className="flex items-center gap-2">
              {onOpenDskp && (
                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    onOpenDskp();
                  }}
                  className="btn-game-cyan btn-game-sm px-3 py-1.5 text-xs font-game font-black text-slate-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpenCheck className="w-3.5 h-3.5" />
                  <span>DSKP &amp; Objektif</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  onBackToSplash();
                }}
                className="btn-game-slate btn-game-sm px-3 py-1.5 text-xs font-game font-bold text-cyan-100 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-300" />
                <span>Skrin Utama</span>
              </button>
            </div>
          </div>

          {/* Center Emblem + Gaming Title */}
          <div className="flex flex-col items-center text-center space-y-2 py-1">
            <EcoWorldCrestSVG />

            <h1 className="font-game text-2xl sm:text-4xl font-black tracking-tight leading-none text-white drop-shadow-[0_4px_12px_rgba(14,165,233,0.55)]">
              Suara Generasi{' '}
              <span className="block game-title-emerald text-3xl sm:text-5xl mt-1">
                Prihatin
              </span>
            </h1>

            <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border-2 border-yellow-100 text-slate-950 font-game text-xs sm:text-sm font-black tracking-widest shadow-[0_4px_0_#78350f,0_8px_20px_rgba(250,204,21,0.45)]">
              MISI 3D
            </div>

            <p className="text-xs sm:text-sm text-cyan-100/90 font-medium pt-1">
              Terokai Pulau EcoWorld 3D dan selamatkan alam sekitar.
            </p>
          </div>

          {/* 3 Compact Visual Icon Pillars */}
          <div className="portal-glass-sub rounded-2xl p-3 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1 px-1">
              <div className="w-11 h-11 rounded-2xl bg-emerald-950/80 border border-emerald-400/50 flex items-center justify-center shadow-inner">
                <PillarSproutIcon />
              </div>
              <span className="text-[11px] font-display font-bold text-emerald-200 leading-tight">
                Belajar Bersama
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 px-1 border-x border-cyan-400/20">
              <div className="w-11 h-11 rounded-2xl bg-sky-950/80 border border-sky-400/50 flex items-center justify-center shadow-inner">
                <PillarGlobeIcon />
              </div>
              <span className="text-[11px] font-display font-bold text-cyan-200 leading-tight">
                Jaga Alam Kita
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 px-1">
              <div className="w-11 h-11 rounded-2xl bg-teal-950/80 border border-teal-400/50 flex items-center justify-center shadow-inner">
                <PillarRecycleIcon />
              </div>
              <span className="text-[11px] font-display font-bold text-teal-200 leading-tight">
                Untuk Masa Depan
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            RIGHT PANEL: FLOATING GLASS ACCESS PORTAL
           ===================================================================== */}
        <div className="lg:col-span-6 portal-glass-card rounded-3xl p-5 sm:p-6 text-slate-100 space-y-4">
          {/* Glowing Curved Header */}
          <div className="text-center">
            <div className="inline-block px-6 py-2 rounded-2xl bg-gradient-to-r from-cyan-500/25 via-sky-500/35 to-emerald-500/25 border border-cyan-300/65 shadow-[0_0_24px_rgba(56,189,248,0.35)]">
              <h2 className="font-game text-lg sm:text-xl font-black text-white tracking-wider">
                Pilih Akses Portal
              </h2>
            </div>
            <p className="text-[11px] text-cyan-200/80 font-semibold mt-1.5 tracking-wide">
              Pilih peranan anda untuk log masuk ke sistem misi
            </p>
          </div>

          {/* 3 Role Tabs in Exact Required Order: 1. ADMIN | 2. GURU | 3. MURID */}
          <div className="grid grid-cols-3 gap-2.5 p-1.5 rounded-2xl bg-slate-950/75 border border-cyan-400/30">
            {(
              [
                { id: 'admin', label: 'ADMIN', icon: <RoleAdminIcon /> },
                { id: 'guru', label: 'GURU', icon: <RoleGuruIcon /> },
                { id: 'murid', label: 'MURID', icon: <RoleMuridIcon /> },
              ] as { id: UserRole; label: string; icon: React.ReactNode }[]
            ).map((tab) => {
              const active = role === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRoleSwitch(tab.id)}
                  className={`py-2.5 px-2 rounded-xl font-game text-xs font-black tracking-widest flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 ${
                    active
                      ? 'btn-game-emerald portal-role-active text-slate-950 scale-[1.04] z-10'
                      : 'btn-game-slate text-cyan-100/85 opacity-70 hover:opacity-100 hover:scale-[1.02]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Animated Tab Content Body */}
          <div key={role} className="portal-tab-slide">
            {role === 'murid' ? (
              <div className="space-y-3.5">
                {/* Student Login Fields + Enter Button */}
                <form onSubmit={handleStudentSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                      NAMA MURID
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => {
                        setStudentName(e.target.value);
                        setSelectedNotice(null);
                      }}
                      placeholder="Pilih kad murid di bawah atau taip nama penuh"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/85 border-2 border-cyan-400/40 text-white text-sm font-medium focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                        ID MURID
                      </label>
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => {
                          setStudentId(e.target.value);
                          setSelectedNotice(null);
                        }}
                        placeholder="BM6-001"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950/85 border-2 border-cyan-400/40 text-white text-sm font-mono-num font-bold uppercase focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                        KELAS
                      </label>
                      <select
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/85 border-2 border-cyan-400/40 text-white text-sm font-semibold focus:outline-none focus:border-emerald-400 transition-colors"
                      >
                        {availableClasses.map((clsName) => (
                          <option key={clsName} value={clsName}>
                            {clsName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedNotice && (
                    <div className="confirm-green-pulse px-3 py-1.5 rounded-xl bg-emerald-950/85 border border-emerald-400/75 text-[11px] font-bold text-emerald-200 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{selectedNotice} — sedia masuk portal!</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-game-emerald w-full py-3 px-5 text-slate-950 font-game font-black text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <span className="btn-icon-3d w-7 h-7">
                      <ChevronRight className="w-5 h-5" />
                    </span>
                    <span>Masuk Portal</span>
                  </button>
                </form>

                {/* Interactive Preloaded + Registered Student Selection Panel */}
                <div className="portal-glass-sub rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
                        <RoleMuridIcon />
                      </span>
                      <div className="min-w-0">
                        <div className="font-game text-xs font-black text-white tracking-wide truncate">
                          SENARAI MURID ({students.length})
                        </div>
                        <div className="text-[10px] text-cyan-200/80 truncate">
                          Klik nama anda untuk isi maklumat secara automatik
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="btn-game-gold btn-game-sm px-3 py-1.5 text-slate-950 font-game text-[11px] font-black tracking-wide flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>TAMBAH MURID</span>
                    </button>
                  </div>

                  <div className="max-h-[215px] overflow-y-auto eco-scroll pr-1 space-y-2">
                    {students.map((stu) => {
                      const stuId = stu.studentId || '';
                      const isSelected =
                        studentId.trim().toUpperCase() === stuId.toUpperCase() &&
                        stuId.length > 0;
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleSelectStudentCard(stu)}
                          className={`w-full p-2.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2.5 cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'confirm-green-pulse bg-gradient-to-r from-cyan-500/30 via-sky-500/25 to-emerald-500/30 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.45)] scale-[1.01]'
                              : 'bg-slate-950/75 border-slate-700/80 hover:border-cyan-400/70 hover:bg-slate-900/90'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <StudentIllustratedAvatar
                              fullName={stu.fullName}
                              studentId={stuId}
                              selected={isSelected}
                            />
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-white leading-snug break-words">
                                {stu.fullName}
                              </div>
                              <div className="text-[11px] text-cyan-200 font-semibold mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-mono-num text-amber-300 font-bold">
                                  ID: {stuId}
                                </span>
                                <span className="text-cyan-500">|</span>
                                <span>Kelas: {stu.className}</span>
                              </div>
                            </div>
                          </div>

                          <div
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'bg-emerald-400 border-white text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.85)]'
                                : 'bg-slate-900/80 border-slate-600 text-slate-400'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ADMIN & GURU FUTURISTIC AUTHENTICATION PANELS */
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div className="portal-glass-sub rounded-2xl p-3 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 shrink-0 ${
                      role === 'admin'
                        ? 'bg-amber-950/70 border-amber-400/70 text-amber-300'
                        : 'bg-sky-950/70 border-sky-400/70 text-sky-300'
                    }`}
                  >
                    {role === 'admin' ? <RoleAdminIcon /> : <RoleGuruIcon />}
                  </div>
                  <div>
                    <div className="font-game text-sm font-black text-white tracking-wider">
                      {role === 'admin' ? 'KAWALAN PENTADBIR' : 'AKSES PAPAN GURU'}
                    </div>
                    <div className="text-xs text-cyan-200/80">
                      {role === 'admin'
                        ? 'Urus akaun guru, kelas dan status misi'
                        : 'Pantau kemajuan, markah & maklum balas murid'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1.5">
                    {role === 'guru' ? 'NAMA GURU / NAMA PENGGUNA' : 'NAMA PENGGUNA PENTADBIR'}
                  </label>
                  <input
                    type="text"
                    required
                    value={staffIdentifier}
                    onChange={(e) => setStaffIdentifier(e.target.value)}
                    placeholder={
                      role === 'guru' ? 'Cikgu Amina binti Razak / cikgu_amina' : 'admin'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/85 border-2 border-cyan-400/40 text-white text-sm font-medium focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1.5">
                    KATA LALUAN
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Masukkan kata laluan"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950/85 border-2 border-cyan-400/40 text-white text-sm font-medium focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                    <Lock className="w-4 h-4 text-cyan-400/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-game-gold w-full py-3 px-5 text-slate-950 font-game font-black text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span className="btn-icon-3d w-7 h-7">
                    {role === 'admin' ? <RoleAdminIcon /> : <RoleGuruIcon />}
                  </span>
                  <span>
                    {role === 'guru' ? 'Masuk Papan Guru' : 'Masuk Kawalan Pentadbir'}
                  </span>
                </button>

                <div className="p-3 rounded-xl bg-slate-950/75 border border-cyan-400/25 text-xs text-cyan-100/80">
                  {role === 'guru' ? (
                    <>
                      <strong className="text-amber-300">Akses Demo Guru:</strong>{' '}
                      <code className="text-cyan-300">cikgu_amina</code> · Kata Laluan:{' '}
                      <code className="text-emerald-300">guru123</code>
                    </>
                  ) : (
                    <>
                      <strong className="text-amber-300">Akses Demo Pentadbir:</strong>{' '}
                      <code className="text-cyan-300">admin</code> · Kata Laluan:{' '}
                      <code className="text-emerald-300">admin123</code>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          FLOATING POPUP MODAL: + TAMBAH MURID
         ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 pointer-events-auto">
          <form
            onSubmit={handleSaveNewStudent}
            className="modal-pop-in portal-glass-card w-full max-w-md rounded-3xl p-6 text-slate-100 space-y-4 border-2 border-cyan-300/80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-game text-base sm:text-lg font-black text-white tracking-wide">
                    TAMBAH MURID BAHARU
                  </h3>
                  <p className="text-[11px] text-cyan-200">
                    Rekod disimpan kekal dalam sistem EcoWorld 3D
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setShowAddModal(false);
                }}
                className="btn-game-slate btn-game-sm w-8 h-8 flex items-center justify-center text-slate-200 cursor-pointer"
                aria-label="Tutup tetingkap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                  NAMA PENUH MURID
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setAddError(null);
                  }}
                  placeholder="Contoh: Nurul Huda binti Zulkifli"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border-2 border-cyan-400/45 text-white text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                    ID MURID
                  </label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={(e) => {
                      setNewId(e.target.value);
                      setAddError(null);
                    }}
                    placeholder="BM6-006"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border-2 border-cyan-400/45 text-white text-sm font-mono-num font-bold uppercase focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-game font-bold text-cyan-200 tracking-wide mb-1">
                    KELAS
                  </label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/90 border-2 border-cyan-400/45 text-white text-sm font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    {availableClasses.map((clsName) => (
                      <option key={clsName} value={clsName}>
                        {clsName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {addError && (
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-400 text-rose-100 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setShowAddModal(false);
                }}
                className="btn-game-slate py-2.5 px-4 text-slate-200 font-game text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>BATAL</span>
              </button>

              <button
                type="submit"
                className="btn-game-emerald py-2.5 px-4 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>SIMPAN</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
