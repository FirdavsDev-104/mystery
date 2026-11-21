import React, { useState } from 'react';
import { Award, Check, Clock, Gamepad2, Heart, RotateCcw, Save, Trophy, User } from 'lucide-react';
import { AGE_GROUPS, getGameById } from '../data/gamesRegistry';
import type { AgeGroup, GraphicsQuality, UserProfile } from '../data/types';
import { ACHIEVEMENTS } from '../hooks/useUserProfile';
import { GameCard } from '../components/GameCard';
import { soundEngine } from '../utils/sound';

interface ProfilePageProps {
  profile: UserProfile;
  onUpdateProfile: (updates: { nickname?: string; ageGroup?: AgeGroup; quality?: GraphicsQuality }) => void;
  onResetProfile: () => void;
  onPlayGame: (gameId: string) => void;
  onToggleFavorite: (gameId: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} sek`;
  return `${mins} daq ${secs} sek`;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  onUpdateProfile,
  onResetProfile,
  onPlayGame,
  onToggleFavorite,
}) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(profile.ageGroup);
  const [quality, setQuality] = useState<GraphicsQuality>(profile.quality);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim().length < 2) return;
    soundEngine.playSuccess();
    onUpdateProfile({ nickname: nickname.trim(), ageGroup, quality });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const bestScoreOverall = Math.max(0, ...Object.values(profile.highScores));
  const recentGames = profile.recentlyPlayed
    .map((r) => getGameById(r.gameId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const favoriteGames = profile.favorites
    .map((id) => getGameById(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <div className="space-y-10">
      {/* Header & Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#131926] border border-white/10 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-400">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{profile.nickname}</h1>
              <p className="text-sm text-slate-400">
                Yosh toifasi: <span className="text-amber-300 font-semibold">{profile.ageGroup} yosh</span>
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>O&apos;yinlar soni</span>
              </div>
              <div className="font-mono-num text-2xl font-bold text-white">{profile.gamesPlayedCount}</div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Umumiy vaqt</span>
              </div>
              <div className="font-mono-num text-xl font-bold text-white">{formatDuration(profile.totalPlaySeconds)}</div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Sevimlilar</span>
              </div>
              <div className="font-mono-num text-2xl font-bold text-white">{profile.favorites.length}</div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Eng yuqori ball</span>
              </div>
              <div className="font-mono-num text-2xl font-bold text-white">{bestScoreOverall}</div>
            </div>
          </div>
        </div>

        {/* Profile Settings Form */}
        <div className="bg-[#131926] border border-white/10 rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-white mb-4">Profil sozlamalari</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Ismingiz yoki taxallus
              </label>
              <input
                id="profile-name"
                type="text"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label htmlFor="profile-age" className="block text-xs font-medium text-slate-300 mb-1.5">
                Yosh toifasi
              </label>
              <select
                id="profile-age"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} — {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-quality" className="block text-xs font-medium text-slate-300 mb-1.5">
                3D Grafika sifati
              </label>
              <select
                id="profile-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as GraphicsQuality)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="low">Past (zaif qurilmalar uchun)</option>
                <option value="medium">O&apos;rta</option>
                <option value="high">Yuqori (maksimal 3D sifat)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer flex items-center justify-center gap-2 transition-colors"
            >
              {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savedNotice ? 'Saqlandi!' : 'Saqlash'}</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Profilni tiklash (Reset)</span>
              </button>
            ) : (
              <div className="bg-[#0B0E14] border border-rose-500/35 rounded-xl p-3 space-y-2.5">
                <p className="text-xs text-rose-200 text-center">
                  Barcha natijalar o&apos;chiriladi va yosh tanlash ekraniga qaytiladi. Tasdiqlaysizmi?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 py-1.5 rounded-lg bg-white/10 text-xs text-slate-200 cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onResetProfile();
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-rose-500 text-xs font-bold text-white cursor-pointer"
                  >
                    Ha, tiklash
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-4">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">Yutuqlar va medallar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENTS.map((ach) => {
            const current = ach.getProgress(profile);
            const pct = Math.min(100, Math.round((current / ach.target) * 100));
            const unlocked = current >= ach.target;
            return (
              <div
                key={ach.id}
                className={`p-5 rounded-2xl border ${
                  unlocked
                    ? 'bg-[#15202E] border-amber-400/40'
                    : 'bg-[#131926] border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        unlocked ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{ach.title}</h3>
                      <p className="text-xs text-slate-400">{ach.description}</p>
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-amber-300">
                    {current}/{ach.target}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0B0E14] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: unlocked ? '#F59E0B' : '#38BDF8',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recently Played */}
      {recentGames.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white">Yaqinda o&apos;ynalgan o&apos;yinlar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recentGames.slice(0, 4).map((g) => (
              <GameCard
                key={g.id}
                game={g}
                isFavorite={profile.favorites.includes(g.id)}
                highScore={profile.highScores[g.id]}
                onPlay={onPlayGame}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Favorite Games */}
      {favoriteGames.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white">Sevimli o&apos;yinlaringiz</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {favoriteGames.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                isFavorite={true}
                highScore={profile.highScores[g.id]}
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
