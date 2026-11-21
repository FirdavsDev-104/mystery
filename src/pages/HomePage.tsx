import React from 'react';
import { AGE_GROUPS, GAME_CATEGORIES, getGamesByAgeGroup } from '../data/gamesRegistry';
import type { GameCategory, PageView, UserProfile } from '../data/types';
import { HeroBanner } from '../components/HeroBanner';
import { GameCarousel } from '../components/GameCarousel';
import { GameCard } from '../components/GameCard';
import { soundEngine } from '../utils/sound';

interface HomePageProps {
  profile: UserProfile;
  view: Extract<PageView, 'home' | 'games' | 'categories' | 'favorites'>;
  selectedCategory: GameCategory | 'Barchasi';
  searchQuery: string;
  onSelectCategory: (cat: GameCategory | 'Barchasi') => void;
  onPlayGame: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  profile,
  view,
  selectedCategory,
  searchQuery,
  onSelectCategory,
  onPlayGame,
  onToggleFavorite,
}) => {
  const ageGames = getGamesByAgeGroup(profile.ageGroup);
  const ageInfo = AGE_GROUPS.find((a) => a.id === profile.ageGroup);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGames = ageGames.filter((g) => {
    const matchesCat = selectedCategory === 'Barchasi' || g.category === selectedCategory;
    const matchesSearch =
      !normalizedQuery ||
      g.title.toLowerCase().includes(normalizedQuery) ||
      g.category.toLowerCase().includes(normalizedQuery) ||
      g.shortDescription.toLowerCase().includes(normalizedQuery);
    return matchesCat && matchesSearch;
  });

  const recommendedGames = ageGames.filter((g) => g.isRecommended);
  const popularGames = ageGames.filter((g) => g.isPopular);
  const newGames = ageGames.filter((g) => g.isNew);

  const recentGames = profile.recentlyPlayed
    .map((entry) => ageGames.find((g) => g.id === entry.gameId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const mostPlayedGames = [...ageGames]
    .filter((g) => (profile.playCounts[g.id] || 0) > 0)
    .sort((a, b) => (profile.playCounts[b.id] || 0) - (profile.playCounts[a.id] || 0));

  const favoriteGames = ageGames.filter((g) => profile.favorites.includes(g.id));

  const showSearchOrCategoryGrid =
    view === 'games' || view === 'categories' || normalizedQuery.length > 0 || selectedCategory !== 'Barchasi';

  if (view === 'favorites') {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Sevimli o&apos;yinlar</h1>
          <p className="text-sm text-slate-400">
            {profile.ageGroup} yosh toifasi uchun saqlangan sevimli o&apos;yinlaringiz
          </p>
        </div>

        {favoriteGames.length === 0 ? (
          <div className="bg-[#131926] border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-slate-300 font-medium mb-2">Hozircha sevimli o&apos;yinlar yo&apos;q</p>
            <p className="text-xs text-slate-400">
              O&apos;yin kartasidagi yurakcha tugmasini bosib sevimli o&apos;yinlaringizni bu yerga qo&apos;shing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favoriteGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                isFavorite={true}
                highScore={profile.highScores[game.id]}
                onPlay={onPlayGame}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {view === 'home' && !normalizedQuery && (
        <HeroBanner
          ageGroup={profile.ageGroup}
          nickname={profile.nickname}
          onStartClick={() => {
            soundEngine.playClick();
            const firstGame = recommendedGames[0] || ageGames[0];
            if (firstGame) onPlayGame(firstGame.id);
          }}
        />
      )}

      {/* Age-Filtered Category Bar */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              {view === 'categories' ? 'Kategoriyalar' : view === 'games' ? "Barcha o'yinlar" : `${ageInfo?.label} — ${ageInfo?.title}`}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{ageInfo?.description}</p>
          </div>
          <span className="text-xs font-mono-num text-slate-400">
            {filteredGames.length} ta 3D o&apos;yin
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onSelectCategory('Barchasi');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedCategory === 'Barchasi'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-[#131926] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            Barchasi
          </button>
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSelectCategory(cat);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#131926] border border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {showSearchOrCategoryGrid ? (
        <section>
          {filteredGames.length === 0 ? (
            <div className="bg-[#131926] border border-white/10 rounded-2xl p-10 text-center">
              <p className="text-slate-300 font-medium mb-1">Mos o&apos;yinlar topilmadi</p>
              <p className="text-xs text-slate-400">Qidiruv so&apos;zini yoki kategoriyani o&apos;zgartirib ko&apos;ring.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isFavorite={profile.favorites.includes(game.id)}
                  highScore={profile.highScores[game.id]}
                  onPlay={onPlayGame}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-10">
          <GameCarousel
            title="Siz uchun tavsiya etilgan"
            games={recommendedGames}
            favorites={profile.favorites}
            highScores={profile.highScores}
            onPlay={onPlayGame}
            onToggleFavorite={onToggleFavorite}
          />

          <GameCarousel
            title="Mashhur o'yinlar"
            games={popularGames}
            favorites={profile.favorites}
            highScores={profile.highScores}
            onPlay={onPlayGame}
            onToggleFavorite={onToggleFavorite}
          />

          <GameCarousel
            title="Yangi o'yinlar"
            games={newGames}
            favorites={profile.favorites}
            highScores={profile.highScores}
            onPlay={onPlayGame}
            onToggleFavorite={onToggleFavorite}
          />

          {recentGames.length > 0 && (
            <GameCarousel
              title="Yaqinda o'ynalgan"
              games={recentGames}
              favorites={profile.favorites}
              highScores={profile.highScores}
              onPlay={onPlayGame}
              onToggleFavorite={onToggleFavorite}
            />
          )}

          {mostPlayedGames.length > 0 && (
            <GameCarousel
              title="Eng ko'p o'ynalgan"
              games={mostPlayedGames}
              favorites={profile.favorites}
              highScores={profile.highScores}
              onPlay={onPlayGame}
              onToggleFavorite={onToggleFavorite}
            />
          )}

          {favoriteGames.length > 0 && (
            <GameCarousel
              title="Sevimli o'yinlar"
              games={favoriteGames}
              favorites={profile.favorites}
              highScores={profile.highScores}
              onPlay={onPlayGame}
              onToggleFavorite={onToggleFavorite}
            />
          )}

          {/* Full catalog showcase for age group */}
          <section className="space-y-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Yoshingizga mos barcha o&apos;yinlar
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {ageGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isFavorite={profile.favorites.includes(game.id)}
                  highScore={profile.highScores[game.id]}
                  onPlay={onPlayGame}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
