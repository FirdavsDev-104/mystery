import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getGamesByAgeGroup } from '../data/gamesRegistry';
import type { GameDefinition, GraphicsQuality, UserProfile } from '../data/types';
import { GameCard } from '../components/GameCard';
import { soundEngine } from '../utils/sound';

interface GamePlayerPageProps {
  game: GameDefinition;
  profile: UserProfile;
  onBack: () => void;
  onPlayGame: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
  onToggleSound: () => void;
  onChangeQuality: (quality: GraphicsQuality) => void;
  onScoreUpdate: (gameId: string, score: number) => void;
  onAddPlaySeconds: (seconds: number) => void;
}

export const GamePlayerPage: React.FC<GamePlayerPageProps> = ({
  game,
  profile,
  onBack,
  onPlayGame,
  onToggleFavorite,
  onToggleSound,
  onChangeQuality,
  onScoreUpdate,
  onAddPlaySeconds,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);

  const GameComponent = game.component;
  const isFavorite = profile.favorites.includes(game.id);
  const highScore = profile.highScores[game.id] || 0;

  const similarGames = getGamesByAgeGroup(profile.ageGroup).filter((g) => g.id !== game.id);

  // Track active playing seconds
  useEffect(() => {
    setIsPaused(false);
    setCurrentScore(0);
    const interval = window.setInterval(() => {
      if (!isPaused) {
        onAddPlaySeconds(5);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [game.id, isPaused, onAddPlaySeconds]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    soundEngine.playClick();
    const el = playerContainerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in nested iframes; ignore safely
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Orqaga</span>
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">{game.title}</h1>
            <div className="text-xs text-slate-400">
              {game.category} · {game.ageGroup} yosh · {game.difficulty}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setIsPaused((p) => !p);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isPaused ? 'Davom etish' : 'Pauza'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setIsPaused(false);
              setRestartToken((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Qayta boshlash</span>
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {profile.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            <span>{profile.soundEnabled ? 'Ovoz yoqilgan' : "Ovoz o'chirilgan"}</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#131926] border border-white/10 text-xs font-semibold text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <select
              aria-label="Grafika sifati"
              value={profile.quality}
              onChange={(e) => onChangeQuality(e.target.value as GraphicsQuality)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="low" className="bg-[#131926]">Past sifat</option>
              <option value="medium" className="bg-[#131926]">O&apos;rta sifat</option>
              <option value="high" className="bg-[#131926]">Yuqori sifat</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleFavorite(game.id);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              isFavorite
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : 'bg-[#131926] border-white/10 hover:border-white/25 text-slate-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current text-rose-400' : ''}`} />
            <span>{isFavorite ? 'Sevimlida' : 'Sevimlilarga'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Kichraytirish' : "To'liq ekran"}</span>
          </button>
        </div>
      </div>

      {/* Responsive 3D Game Stage */}
      <div
        ref={playerContainerRef}
        className="w-full h-[500px] sm:h-[580px] lg:h-[640px] rounded-2xl overflow-hidden bg-[#090D14]"
      >
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D131F] border border-white/10 rounded-xl gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-slate-300">3D o&apos;yin sahnasi yuklanmoqda...</p>
            </div>
          }
        >
          <GameComponent
            key={`${game.id}-${restartToken}`}
            game={game}
            quality={profile.quality}
            soundEnabled={profile.soundEnabled}
            isPaused={isPaused}
            restartToken={restartToken}
            onScoreUpdate={(sc) => {
              setCurrentScore(sc);
              onScoreUpdate(game.id, sc);
            }}
            onGameComplete={(finalSc) => {
              setCurrentScore(finalSc);
              onScoreUpdate(game.id, finalSc);
            }}
            onTogglePause={() => setIsPaused((p) => !p)}
          />
        </Suspense>
      </div>

      {/* Game Info & Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#131926] border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">O&apos;yin haqida va boshqaruv</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{game.shortDescription}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-400 mb-1">Maqsad</div>
              <p className="text-xs text-slate-300 leading-relaxed">{game.objectiveText}</p>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="text-xs font-semibold text-cyan-400 mb-1">Boshqaruv</div>
              <p className="text-xs text-slate-300 leading-relaxed">{game.controlsText}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#131926] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white mb-4">Shaxsiy rekordlar</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-xs text-slate-400">Joriy natija</span>
                <span className="font-mono-num text-base font-bold text-white">{currentScore}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-xs text-slate-400">Eng yaxshi natija</span>
                <span className="font-mono-num text-base font-bold text-amber-400">{Math.max(highScore, currentScore)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-400">O&apos;ynalgan soni</span>
                <span className="font-mono-num text-base font-bold text-slate-200">{profile.playCounts[game.id] || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Games */}
      {similarGames.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white">O&apos;xshash o&apos;yinlar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similarGames.slice(0, 4).map((sim) => (
              <GameCard
                key={sim.id}
                game={sim}
                isFavorite={profile.favorites.includes(sim.id)}
                highScore={profile.highScores[sim.id]}
                onPlay={onPlayGame}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
