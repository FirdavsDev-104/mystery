import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getGameById } from './data/gamesRegistry';
import type { GameCategory, PageView } from './data/types';
import { useUserProfile } from './hooks/useUserProfile';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { GamePlayerPage } from './pages/GamePlayerPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  const {
    profile,
    completeOnboarding,
    updateProfileInfo,
    toggleSound,
    toggleFavorite,
    recordGameLaunch,
    recordHighScore,
    addPlaySeconds,
    resetProfile,
  } = useUserProfile();

  const [activePage, setActivePage] = useState<PageView>('home');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | 'Barchasi'>('Barchasi');
  const [searchQuery, setSearchQuery] = useState('');

  if (!profile) {
    return (
      <OnboardingFlow
        onComplete={(nickname, ageGroup) => {
          completeOnboarding(nickname, ageGroup);
          setActivePage('home');
        }}
      />
    );
  }

  const handlePlayGame = (gameId: string) => {
    recordGameLaunch(gameId);
    setActiveGameId(gameId);
    setActivePage('play');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (page: PageView) => {
    setActivePage(page);
    if (page !== 'play') {
      setActiveGameId(null);
    }
    if (page === 'home') {
      setSelectedCategory('Barchasi');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeGame = activeGameId ? getGameById(activeGameId) : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0E14] text-slate-100">
      <Navbar
        profile={profile}
        activePage={activePage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNavigate={handleNavigate}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-9">
        <AnimatePresence mode="wait">
          {activePage === 'play' && activeGame ? (
            <motion.div
              key={`play-${activeGame.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GamePlayerPage
                game={activeGame}
                profile={profile}
                onBack={() => handleNavigate('home')}
                onPlayGame={handlePlayGame}
                onToggleFavorite={toggleFavorite}
                onToggleSound={toggleSound}
                onChangeQuality={(q) => updateProfileInfo({ quality: q })}
                onScoreUpdate={recordHighScore}
                onAddPlaySeconds={addPlaySeconds}
              />
            </motion.div>
          ) : activePage === 'profile' ? (
            <motion.div
              key="profile-page"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ProfilePage
                profile={profile}
                onUpdateProfile={updateProfileInfo}
                onResetProfile={() => {
                  resetProfile();
                  setActivePage('home');
                  setActiveGameId(null);
                }}
                onPlayGame={handlePlayGame}
                onToggleFavorite={toggleFavorite}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`catalog-${activePage}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <HomePage
                profile={profile}
                view={activePage === 'play' ? 'home' : activePage}
                selectedCategory={selectedCategory}
                searchQuery={searchQuery}
                onSelectCategory={setSelectedCategory}
                onPlayGame={handlePlayGame}
                onToggleFavorite={toggleFavorite}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/10 bg-[#090C12] py-6 px-4 sm:px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} PLAYVERSE — Yangi avlod 3D onlayn o&apos;yinlar platformasi.</p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => handleNavigate('home')} className="hover:text-white cursor-pointer">
              Bosh sahifa
            </button>
            <button type="button" onClick={() => handleNavigate('games')} className="hover:text-white cursor-pointer">
              Barcha o&apos;yinlar
            </button>
            <button type="button" onClick={() => handleNavigate('favorites')} className="hover:text-white cursor-pointer">
              Sevimlilar
            </button>
            <button type="button" onClick={() => handleNavigate('profile')} className="hover:text-white cursor-pointer">
              Profil
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
