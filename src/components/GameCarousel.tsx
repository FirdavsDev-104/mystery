import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameDefinition } from '../data/types';
import { GameCard } from './GameCard';

interface GameCarouselProps {
  title: string;
  games: GameDefinition[];
  favorites: string[];
  highScores: Record<string, number>;
  onPlay: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
}

export const GameCarousel: React.FC<GameCarouselProps> = ({
  title,
  games,
  favorites,
  highScores,
  onPlay,
  onToggleFavorite,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (games.length === 0) return null;

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            aria-label="Oldingi o'yinlar"
            className="w-9 h-9 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            aria-label="Keyingi o'yinlar"
            className="w-9 h-9 rounded-lg bg-[#131926] border border-white/10 hover:border-white/25 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
      >
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            compact
            isFavorite={favorites.includes(game.id)}
            highScore={highScores[game.id]}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
};
