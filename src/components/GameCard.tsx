import React from 'react';
import { motion } from 'motion/react';
import { Heart, Play } from 'lucide-react';
import type { GameDefinition } from '../data/types';
import { GameThumbnail } from './GameThumbnail';
import { soundEngine } from '../utils/sound';

interface GameCardProps {
  game: GameDefinition;
  isFavorite: boolean;
  highScore?: number;
  onPlay: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
  compact?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  isFavorite,
  highScore,
  onPlay,
  onToggleFavorite,
  compact = false,
}) => {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      className={`group flex flex-col bg-[#131926] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-colors ${
        compact ? 'w-[270px] sm:w-[290px] shrink-0' : 'w-full'
      }`}
    >
      <div
        onClick={() => {
          soundEngine.playClick();
          onPlay(game.id);
        }}
        className="relative aspect-[16/10] w-full overflow-hidden cursor-pointer"
      >
        <GameThumbnail game={game} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundEngine.playClick();
            onToggleFavorite(game.id);
          }}
          aria-label={isFavorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo'shish"}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
            isFavorite
              ? 'bg-rose-500/90 border-rose-400 text-white'
              : 'bg-[#0B0E14]/75 border-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
            <span>{game.category}</span>
            <span aria-hidden="true">·</span>
            <span>{game.ageGroup} yosh</span>
            {highScore !== undefined && highScore > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-400">{highScore} ball</span>
              </>
            )}
          </div>
          <h3 className="font-display text-lg font-bold text-white leading-snug mb-1.5 truncate">
            {game.title}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">
            {game.shortDescription}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onPlay(game.id);
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-amber-500 text-white hover:text-slate-950 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>O&apos;ynash</span>
        </button>
      </div>
    </motion.article>
  );
};
