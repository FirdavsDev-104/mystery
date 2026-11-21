import React from 'react';
import { Play, RotateCcw, Trophy, Pause } from 'lucide-react';

export type GamePhase = 'start' | 'playing' | 'paused' | 'ended';

interface GameShellProps {
  title: string;
  objective: string;
  controls: string;
  phase: GamePhase;
  score: number;
  scoreLabel?: string;
  extraHud?: React.ReactNode;
  accentColor?: string;
  won?: boolean;
  endMessage?: string;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
  children: React.ReactNode;
  mobileControls?: React.ReactNode;
}

export const GameShell: React.FC<GameShellProps> = ({
  title,
  objective,
  controls,
  phase,
  score,
  scoreLabel = 'Ball',
  extraHud,
  accentColor = '#F59E0B',
  won = true,
  endMessage,
  onStart,
  onResume,
  onRestart,
  children,
  mobileControls,
}) => {
  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#090D14] overflow-hidden select-none rounded-xl border border-white/10">
      {/* 3D WebGL Mount Area */}
      <div className="w-full h-full">{children}</div>

      {/* Minimal Top-Left Live HUD */}
      {phase !== 'start' && (
        <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-start justify-between gap-3 z-10">
          <div className="flex flex-wrap items-center gap-3 bg-[#0B0E14]/85 border border-white/15 px-3.5 py-2 rounded-lg">
            <div>
              <div className="text-[11px] text-slate-400 leading-none mb-1">{scoreLabel}</div>
              <div className="font-mono-num text-lg font-bold text-white leading-none">{score}</div>
            </div>
            {extraHud}
          </div>
        </div>
      )}

      {/* Mobile / Touch Controls Slot */}
      {phase === 'playing' && mobileControls && (
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex justify-between items-end">
          {mobileControls}
        </div>
      )}

      {/* Start Screen Overlay */}
      {phase === 'start' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0E14]/88 p-5">
          <div className="max-w-md w-full bg-[#131926] border border-white/15 rounded-2xl p-6 text-center shadow-2xl">
            <div
              className="mx-auto mb-3 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}22`, border: `1px solid ${accentColor}55` }}
            >
              <Play className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">{title}</h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{objective}</p>
            <div className="bg-[#0B0E14]/70 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 mb-5 text-left">
              <span className="font-semibold text-white block mb-1">Boshqaruv:</span>
              {controls}
            </div>
            <button
              type="button"
              onClick={onStart}
              className="w-full py-3 px-5 rounded-xl font-semibold text-slate-950 transition-transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Play className="w-4 h-4 fill-current" />
              O&apos;yinni boshlash
            </button>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0E14]/85 p-5">
          <div className="max-w-xs w-full bg-[#131926] border border-white/15 rounded-2xl p-6 text-center">
            <Pause className="w-9 h-9 text-amber-400 mx-auto mb-3" />
            <h3 className="font-display text-xl font-bold text-white mb-2">Pauza</h3>
            <p className="text-xs text-slate-400 mb-5">O&apos;yin vaqtincha to&apos;xtatildi</p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer transition-colors"
              >
                Davom ettirish
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm cursor-pointer transition-colors"
              >
                Qayta boshlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End / Completion Overlay */}
      {phase === 'ended' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0E14]/88 p-5">
          <div className="max-w-sm w-full bg-[#131926] border border-white/15 rounded-2xl p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-1">
              {won ? 'Ajoyib natija!' : "O'yin tugadi"}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {endMessage || `Siz ${score} ball to'pladingiz.`}
            </p>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl py-3 px-4 mb-5">
              <div className="text-xs text-slate-400 mb-1">Yakuniy natija</div>
              <div className="font-mono-num text-3xl font-bold text-amber-400">{score}</div>
            </div>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Qayta o&apos;ynash
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
