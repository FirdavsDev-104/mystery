import React, { useState } from 'react';
import { Globe, Menu, Search, User, X } from 'lucide-react';
import type { PageView, UserProfile } from '../data/types';
import { BrandLogo } from './BrandLogo';
import { soundEngine } from '../utils/sound';

interface NavbarProps {
  profile: UserProfile;
  activePage: PageView;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (page: PageView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  activePage,
  searchQuery,
  onSearchChange,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: PageView; label: string }[] = [
    { id: 'home', label: 'Bosh sahifa' },
    { id: 'games', label: "Barcha o'yinlar" },
    { id: 'categories', label: 'Kategoriyalar' },
    { id: 'favorites', label: 'Sevimlilar' },
    { id: 'profile', label: 'Profil' },
  ];

  const handleNav = (page: PageView) => {
    soundEngine.playClick();
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B0E14]/92 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
          aria-label="PLAYVERSE bosh sahifa"
        >
          <BrandLogo />
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Asosiy menyu">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-[21px] h-0.5 bg-amber-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Search + Language + Profile action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center relative w-52 xl:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (activePage !== 'games' && activePage !== 'home') {
                  onNavigate('games');
                }
              }}
              placeholder="O'yin qidirish..."
              aria-label="O'yin qidirish"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131926] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-[#131926] border border-white/10 rounded-lg px-2.5 py-1.5 whitespace-nowrap shrink-0">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <select
              aria-label="Tilni tanlash"
              defaultValue="uz"
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="uz" className="bg-[#131926]">O&apos;zbekcha</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleNav('profile')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span className="max-w-[96px] truncate">{profile.nickname}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg bg-[#131926] border border-white/10 text-slate-200 cursor-pointer"
            aria-label="Menyu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0E131D] px-4 py-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="O'yin qidirish..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#131926] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left cursor-pointer ${
                  activePage === item.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#131926] text-slate-200 border border-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
