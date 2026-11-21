import { useCallback, useEffect, useState } from 'react';
import type { AchievementDefinition, AgeGroup, GraphicsQuality, UserProfile } from '../data/types';
import { soundEngine } from '../utils/sound';

const STORAGE_KEY = 'playverse_user_profile_v1';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-step',
    title: 'Ilk qadam',
    description: "Birinchi 3D o'yinni ishga tushiring",
    target: 1,
    getProgress: (p) => Math.min(1, p.gamesPlayedCount),
  },
  {
    id: 'explorer-3',
    title: 'Olam kashfiyotchisi',
    description: "3 xil o'yinni sinab ko'ring",
    target: 3,
    getProgress: (p) => Math.min(3, Object.keys(p.playCounts).length),
  },
  {
    id: 'fan-collector',
    title: 'Sevimli kolleksiya',
    description: "Kamida 3 ta o'yinni sevimlilarga qo'shing",
    target: 3,
    getProgress: (p) => Math.min(3, p.favorites.length),
  },
  {
    id: 'champion-score',
    title: 'Rekordchi geymer',
    description: "Istalgan o'yinda 100+ ball to'plang",
    target: 100,
    getProgress: (p) => {
      const max = Math.max(0, ...Object.values(p.highScores));
      return Math.min(100, max);
    },
  },
  {
    id: 'dedicated-player',
    title: 'Faol ishtirokchi',
    description: "Platformada jami 3 daqiqa (180s) o'ynang",
    target: 180,
    getProgress: (p) => Math.min(180, p.totalPlaySeconds),
  },
  {
    id: 'veteran-10',
    title: 'PLAYVERSE ustasi',
    description: "Jami 10 marta o'yin sessiyasini boshlang",
    target: 10,
    getProgress: (p) => Math.min(10, p.gamesPlayedCount),
  },
];

function createDefaultProfile(nickname: string, ageGroup: AgeGroup): UserProfile {
  return {
    nickname: nickname.trim(),
    ageGroup,
    createdAt: Date.now(),
    totalPlaySeconds: 0,
    gamesPlayedCount: 0,
    favorites: [],
    recentlyPlayed: [],
    playCounts: {},
    highScores: {},
    unlockedAchievements: [],
    quality: 'high',
    soundEnabled: true,
    language: 'uz',
  };
}

function evaluateAchievements(profile: UserProfile): string[] {
  const unlocked = new Set(profile.unlockedAchievements);
  for (const ach of ACHIEVEMENTS) {
    if (ach.getProgress(profile) >= ach.target) {
      unlocked.add(ach.id);
    }
  }
  return Array.from(unlocked);
}

function loadStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || !parsed.nickname || !parsed.ageGroup) return null;
    return {
      ...createDefaultProfile(parsed.nickname, parsed.ageGroup),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredProfile());

  useEffect(() => {
    if (profile) {
      soundEngine.setEnabled(profile.soundEnabled);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // Ignore storage quota issues
      }
    }
  }, [profile]);

  const completeOnboarding = useCallback((nickname: string, ageGroup: AgeGroup) => {
    const next = createDefaultProfile(nickname, ageGroup);
    setProfile(next);
  }, []);

  const updateProfileInfo = useCallback((updates: { nickname?: string; ageGroup?: AgeGroup; quality?: GraphicsQuality }) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...updates,
        nickname: updates.nickname !== undefined ? updates.nickname.trim() : prev.nickname,
      };
    });
  }, []);

  const toggleSound = useCallback(() => {
    setProfile((prev) => {
      if (!prev) return prev;
      const nextSound = !prev.soundEnabled;
      soundEngine.setEnabled(nextSound);
      return { ...prev, soundEnabled: nextSound };
    });
  }, []);

  const toggleFavorite = useCallback((gameId: string) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const exists = prev.favorites.includes(gameId);
      const favorites = exists ? prev.favorites.filter((id) => id !== gameId) : [gameId, ...prev.favorites];
      const updated = { ...prev, favorites };
      updated.unlockedAchievements = evaluateAchievements(updated);
      return updated;
    });
  }, []);

  const recordGameLaunch = useCallback((gameId: string) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const recentlyPlayed = [{ gameId, playedAt: Date.now() }, ...prev.recentlyPlayed.filter((r) => r.gameId !== gameId)].slice(0, 12);
      const playCounts = {
        ...prev.playCounts,
        [gameId]: (prev.playCounts[gameId] || 0) + 1,
      };
      const updated: UserProfile = {
        ...prev,
        gamesPlayedCount: prev.gamesPlayedCount + 1,
        recentlyPlayed,
        playCounts,
      };
      updated.unlockedAchievements = evaluateAchievements(updated);
      return updated;
    });
  }, []);

  const recordHighScore = useCallback((gameId: string, score: number) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const currentBest = prev.highScores[gameId] || 0;
      if (score <= currentBest) return prev;
      const updated: UserProfile = {
        ...prev,
        highScores: {
          ...prev.highScores,
          [gameId]: Math.round(score),
        },
      };
      updated.unlockedAchievements = evaluateAchievements(updated);
      return updated;
    });
  }, []);

  const addPlaySeconds = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setProfile((prev) => {
      if (!prev) return prev;
      const updated: UserProfile = {
        ...prev,
        totalPlaySeconds: prev.totalPlaySeconds + seconds,
      };
      updated.unlockedAchievements = evaluateAchievements(updated);
      return updated;
    });
  }, []);

  const resetProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setProfile(null);
  }, []);

  return {
    profile,
    completeOnboarding,
    updateProfileInfo,
    toggleSound,
    toggleFavorite,
    recordGameLaunch,
    recordHighScore,
    addPlaySeconds,
    resetProfile,
  };
}
