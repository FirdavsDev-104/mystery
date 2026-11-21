import React from 'react';
import {
  Apple,
  Blocks,
  Bot,
  Building2,
  Car,
  Compass,
  Gauge,
  Palette,
  PawPrint,
  Plane,
  Rocket,
  Shapes,
  Shield,
  Sparkles,
  Sprout,
  Trophy,
  Zap,
} from 'lucide-react';
import type { GameDefinition } from '../data/types';

interface GameThumbnailProps {
  game: GameDefinition;
  className?: string;
}

function getGameIcon(key: string) {
  switch (key) {
    case 'palette':
      return Palette;
    case 'sprout':
      return Sprout;
    case 'shapes':
      return Shapes;
    case 'apple':
      return Apple;
    case 'paw':
      return PawPrint;
    case 'car':
      return Car;
    case 'blocks':
      return Blocks;
    case 'bot':
      return Bot;
    case 'sparkles':
      return Sparkles;
    case 'trophy':
      return Trophy;
    case 'zap':
      return Zap;
    case 'compass':
      return Compass;
    case 'rocket':
      return Rocket;
    case 'gauge':
      return Gauge;
    case 'plane':
      return Plane;
    case 'building':
      return Building2;
    case 'shield':
      return Shield;
    default:
      return Sparkles;
  }
}

export const GameThumbnail: React.FC<GameThumbnailProps> = ({ game, className = '' }) => {
  const Icon = getGameIcon(game.iconKey);

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(circle at 75% 22%, ${game.accentColor}44 0%, transparent 55%), radial-gradient(circle at 20% 85%, ${game.secondaryColor}33 0%, transparent 55%), linear-gradient(145deg, #0E1420 0%, #172033 100%)`,
      }}
    >
      {/* Subtle 3D perspective floor grid */}
      <svg
        viewBox="0 0 320 180"
        className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`g-${game.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={game.accentColor} stopOpacity="0" />
            <stop offset="100%" stopColor={game.accentColor} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path d="M0 120 L320 120 M0 142 L320 142 M0 165 L320 165" stroke={game.accentColor} strokeWidth="0.8" strokeOpacity="0.4" />
        <path d="M160 95 L20 180 M160 95 L90 180 M160 95 L160 180 M160 95 L230 180 M160 95 L300 180" stroke={game.secondaryColor} strokeWidth="0.8" strokeOpacity="0.35" />
        <polygon points="0,180 320,180 320,120 0,120" fill={`url(#g-${game.id})`} />
      </svg>

      {/* 3D Isometric Emblem Container */}
      <div className="relative z-10 flex flex-col items-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border border-white/15 transform -rotate-3 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${game.accentColor}38, ${game.secondaryColor}28)`,
          }}
        >
          <Icon className="w-8 h-8 text-white drop-shadow" />
        </div>
      </div>

      {/* Subtle top-left 3D tag */}
      <span className="absolute top-2.5 left-2.5 text-[11px] font-mono-num font-bold text-white/80 bg-[#0B0E14]/70 px-2 py-0.5 rounded border border-white/10">
        3D
      </span>
    </div>
  );
};
