import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  Compass,
  Headphones,
  Lightbulb,
  Mic,
  SearchCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { playSFX } from '../utils/sound';

interface DskpObjectivesViewProps {
  onBack: () => void;
}

const OBJECTIVES = [
  {
    num: 1,
    text: 'Mengenal pasti maklumat penting daripada bahan yang didengar.',
    missionHint: 'Dipraktikkan dalam Misi 01 (Zon Sungai Tercemar)',
    icon: Headphones,
    accent: 'from-cyan-400 to-sky-500',
    border: 'border-cyan-400/55',
    badgeBg: 'bg-cyan-950/90 text-cyan-200 border-cyan-400/50',
    glow: 'hover:shadow-[0_12px_32px_rgba(34,211,238,0.32)]',
  },
  {
    num: 2,
    text: 'Menganalisis punca dan kesan isu alam sekitar.',
    missionHint: 'Dipraktikkan dalam Misi 02 (Bandar Udara Beracun)',
    icon: SearchCheck,
    accent: 'from-emerald-400 to-teal-500',
    border: 'border-emerald-400/55',
    badgeBg: 'bg-emerald-950/90 text-emerald-200 border-emerald-400/50',
    glow: 'hover:shadow-[0_12px_32px_rgba(52,211,153,0.32)]',
  },
  {
    num: 3,
    text: 'Menilai cadangan penyelesaian.',
    missionHint: 'Dipraktikkan dalam Misi 03 (Hutan Harapan)',
    icon: Lightbulb,
    accent: 'from-amber-300 to-amber-500',
    border: 'border-amber-400/55',
    badgeBg: 'bg-amber-950/90 text-amber-200 border-amber-400/50',
    glow: 'hover:shadow-[0_12px_32px_rgba(251,191,36,0.32)]',
  },
  {
    num: 4,
    text: 'Menyampaikan pandangan dengan sebutan, intonasi dan gaya yang sesuai.',
    missionHint: 'Dipraktikkan dalam Misi 04 & Misi 05 (Makmal Suara & Kempen Digital)',
    icon: Mic,
    accent: 'from-teal-300 to-emerald-500',
    border: 'border-teal-300/55',
    badgeBg: 'bg-teal-950/90 text-teal-200 border-teal-400/50',
    glow: 'hover:shadow-[0_12px_32px_rgba(45,212,191,0.32)]',
  },
] as const;

export function DskpObjectivesView({ onBack }: DskpObjectivesViewProps) {
  const [activeCard, setActiveCard] = useState<'sk' | 'sp' | number | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 overflow-y-auto eco-scroll p-4 sm:p-6 lg:p-8 flex items-start justify-center">
      <div className="modal-pop-in portal-glass-card w-full max-w-6xl rounded-3xl p-5 sm:p-8 text-slate-100 space-y-7 my-auto border-2 border-cyan-300/60">
        {/* Top Bar with KEMBALI Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-cyan-400/25">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 text-slate-950 flex items-center justify-center shadow-[0_6px_20px_rgba(20,184,166,0.45)] shrink-0">
              <Compass className="w-6 h-6 stroke-[2.4]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-cyan-300 tracking-wide">
                Bahasa Melayu Tahun 6 · Kurikulum Standard Sekolah Rendah
              </p>
              <h1 className="font-game text-xl sm:text-3xl font-black tracking-wide game-title-emerald">
                DSKP &amp; OBJEKTIF PEMBELAJARAN
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSFX('click');
              onBack();
            }}
            className="btn-game-gold px-5 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.8]" />
            <span>KEMBALI</span>
          </button>
        </div>

        {/* Two Main Elegant Cards: Standard Kandungan (SK) & Standard Pembelajaran (SP) */}
        <section aria-labelledby="sk-sp-heading" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* Card 1: Standard Kandungan (SK) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                playSFX('click');
                setActiveCard((prev) => (prev === 'sk' ? null : 'sk'));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveCard((prev) => (prev === 'sk' ? null : 'sk'));
                }
              }}
              className={`portal-glass-sub rounded-3xl p-6 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                activeCard === 'sk'
                  ? 'border-2 border-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.4)]'
                  : 'border border-emerald-400/45 hover:border-emerald-300/80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
                      <BookOpenCheck className="w-5 h-5 stroke-[2.4]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-wider text-emerald-300 block">
                        KOD STANDARD 1.2
                      </span>
                      <h2 className="font-game text-base sm:text-lg font-black text-white">
                        STANDARD KANDUNGAN (SK)
                      </h2>
                    </div>
                  </div>
                  <span className="font-mono-num text-xl font-black text-emerald-300">1.2</span>
                </div>

                <p className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed">
                  1.2 Bertutur untuk menyampaikan maklumat dan idea bagi pelbagai tujuan.
                </p>
              </div>

              <div className="pt-3 border-t border-emerald-400/20 flex items-center justify-between text-xs text-emerald-200/85">
                <span>Fokus Kemahiran: Mendengar &amp; Bertutur</span>
                <span className="font-semibold text-emerald-300">
                  {activeCard === 'sk' ? 'Teras Utama Misi EcoWorld' : 'Klik untuk sorotan'}
                </span>
              </div>
            </div>

            {/* Card 2: Standard Pembelajaran (SP) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                playSFX('click');
                setActiveCard((prev) => (prev === 'sp' ? null : 'sp'));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveCard((prev) => (prev === 'sp' ? null : 'sp'));
                }
              }}
              className={`portal-glass-sub rounded-3xl p-6 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                activeCard === 'sp'
                  ? 'border-2 border-amber-300 shadow-[0_0_28px_rgba(250,204,21,0.38)]'
                  : 'border border-amber-400/45 hover:border-amber-300/80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
                      <Target className="w-5 h-5 stroke-[2.4]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold tracking-wider text-amber-300 block">
                        KOD PEMBELAJARAN 1.2.2
                      </span>
                      <h2 className="font-game text-base sm:text-lg font-black text-white">
                        STANDARD PEMBELAJARAN (SP)
                      </h2>
                    </div>
                  </div>
                  <span className="font-mono-num text-xl font-black text-amber-300">1.2.2</span>
                </div>

                <p className="text-base sm:text-lg font-semibold text-slate-100 leading-relaxed">
                  1.2.2 Bertutur untuk menghujahkan sesuatu perkara menggunakan idea yang kritis dan kreatif berdasarkan maklumat yang tersurat dan tersirat.
                </p>
              </div>

              <div className="pt-3 border-t border-amber-400/20 flex items-center justify-between text-xs text-amber-200/85">
                <span>Pemikiran Kritis · Tersurat &amp; Tersirat</span>
                <span className="font-semibold text-amber-300">
                  {activeCard === 'sp' ? 'Penghujahan & Kempen Digital' : 'Klik untuk sorotan'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Four Separate Interactive Cards: Objektif Pembelajaran */}
        <section aria-labelledby="obj-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>MATLAMAT PENGAJARAN &amp; PEMBELAJARAN</span>
              </div>
              <h2 id="obj-heading" className="font-game text-lg sm:text-2xl font-black text-white mt-0.5">
                OBJEKTIF PEMBELAJARAN
              </h2>
              <p className="text-sm text-cyan-100/90 mt-0.5 font-medium">
                Pada akhir pembelajaran, murid dapat:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {OBJECTIVES.map((obj) => {
              const Icon = obj.icon;
              const isSelected = activeCard === obj.num;
              return (
                <button
                  key={obj.num}
                  type="button"
                  onClick={() => {
                    playSFX('clue');
                    setActiveCard((prev) => (prev === obj.num ? null : obj.num));
                  }}
                  className={`portal-glass-sub rounded-3xl p-5 text-left flex flex-col justify-between gap-4 border-2 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer ${
                    obj.border
                  } ${obj.glow} ${
                    isSelected ? 'ring-2 ring-white/80 scale-[1.02]' : ''
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${obj.accent} text-slate-950 flex items-center justify-center shadow-lg`}
                      >
                        <Icon className="w-6 h-6 stroke-[2.3]" />
                      </div>
                      <span
                        className={`font-mono-num text-sm font-black px-2.5 py-1 rounded-xl border ${obj.badgeBg}`}
                      >
                        0{obj.num}
                      </span>
                    </div>

                    <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                      {obj.num}. {obj.text}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-700/70 text-[11px] font-semibold text-cyan-200/85">
                    {obj.missionHint}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bottom Return Action */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              playSFX('click');
              onBack();
            }}
            className="btn-game-cyan px-8 py-3 text-slate-950 font-game text-xs sm:text-sm font-black tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.8]" />
            <span>KEMBALI KE HALAMAN SEBELUMNYA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
