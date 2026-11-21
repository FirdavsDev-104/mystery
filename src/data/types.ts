import type { ComponentType, LazyExoticComponent } from 'react';

export type AgeGroup = '3-5' | '6-9' | '10-15' | '16-20';

export type GameCategory =
  | 'Poyga'
  | 'Sport'
  | 'Sarguzasht'
  | 'Simulator'
  | 'Puzzle'
  | "Ta'limiy"
  | 'Qurilish'
  | '3D Action';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type PageView = 'home' | 'games' | 'categories' | 'favorites' | 'profile' | 'play';

export interface GameComponentProps {
  game: GameDefinition;
  quality: GraphicsQuality;
  soundEnabled: boolean;
  isPaused: boolean;
  restartToken: number;
  onScoreUpdate: (score: number) => void;
  onGameComplete: (finalScore: number, won?: boolean) => void;
  onTogglePause: () => void;
}

export interface GameDefinition {
  id: string;
  slug: string;
  title: string;
  ageGroup: AgeGroup;
  category: GameCategory;
  shortDescription: string;
  controlsText: string;
  objectiveText: string;
  accentColor: string;
  secondaryColor: string;
  isPopular?: boolean;
  isNew?: boolean;
  isRecommended?: boolean;
  difficulty: 'Oson' | "O'rtacha" | 'Qiyin';
  iconKey: string;
  component: LazyExoticComponent<ComponentType<GameComponentProps>>;
}

export interface RecentPlayEntry {
  gameId: string;
  playedAt: number;
}

export interface UserProfile {
  nickname: string;
  ageGroup: AgeGroup;
  createdAt: number;
  totalPlaySeconds: number;
  gamesPlayedCount: number;
  favorites: string[];
  recentlyPlayed: RecentPlayEntry[];
  playCounts: Record<string, number>;
  highScores: Record<string, number>;
  unlockedAchievements: string[];
  quality: GraphicsQuality;
  soundEnabled: boolean;
  language: 'uz';
}

export interface AgeGroupInfo {
  id: AgeGroup;
  label: string;
  title: string;
  subtitle: string;
  image: string;
  accent: string;
  description: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  target: number;
  getProgress: (profile: UserProfile) => number;
}
