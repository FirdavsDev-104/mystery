import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Baby, Gamepad2, Rocket, ShieldCheck, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { AGE_GROUPS } from '../data/gamesRegistry';
import type { AgeGroup } from '../data/types';
import { BrandLogo } from './BrandLogo';
import { soundEngine } from '../utils/sound';

interface OnboardingFlowProps {
  onComplete: (nickname: string, ageGroup: AgeGroup) => void;
}

function getAgeIcon(id: AgeGroup) {
  switch (id) {
    case '3-5':
      return Baby;
    case '6-9':
      return Gamepad2;
    case '10-15':
      return Rocket;
    case '16-20':
      return ShieldCheck;
  }
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAge, setSelectedAge] = useState<AgeGroup | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleAgeSelect = (age: AgeGroup) => {
    soundEngine.playClick();
    setSelectedAge(age);
    setTimeout(() => {
      setStep(2);
    }, 180);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nickname.trim();
    if (cleaned.length < 2) {
      soundEngine.playError();
      setError("Iltimos, kamida 2 ta harfdan iborat ism yoki taxallus kiriting.");
      return;
    }
    if (!selectedAge) return;
    soundEngine.playSuccess();
    onComplete(cleaned, selectedAge);
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0E14] text-slate-100 flex flex-col justify-between px-4 sm:px-8 py-6 relative overflow-hidden">
      {/* Subtle atmospheric radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 15%, rgba(245,158,11,0.12), transparent 45%), radial-gradient(circle at 80% 80%, rgba(6,182,212,0.12), transparent 45%)',
        }}
      />

      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between">
        <BrandLogo />
        <div className="text-xs font-medium text-slate-400 font-mono-num">
          Qadam {step} / 2
        </div>
      </header>

      <main className="relative z-10 max-w-6xl w-full mx-auto my-auto py-8">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step-age"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="max-w-2xl mx-auto text-center mb-10">
                <h1 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight text-balance mb-3">
                  Salom! PLAYVERSE platformasiga xush kelibsiz!
                </h1>
                <p className="text-base sm:text-lg text-slate-300">
                  Avval yoshingizni tanlang.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {AGE_GROUPS.map((group) => {
                  const Icon = getAgeIcon(group.id);
                  const isSelected = selectedAge === group.id;
                  return (
                    <motion.button
                      key={group.id}
                      type="button"
                      whileHover={{ y: -6 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAgeSelect(group.id)}
                      className={`group text-left rounded-2xl overflow-hidden bg-[#131926] border transition-colors cursor-pointer flex flex-col ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#18202F]">
                        <img
                          src={group.image}
                          alt={group.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-transparent to-transparent" />
                        <div
                          className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center bg-[#0B0E14]/80 border border-white/15"
                          style={{ color: group.accent }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className="font-display text-2xl font-extrabold"
                              style={{ color: group.accent }}
                            >
                              {group.label}
                            </span>
                            {isSelected && <Check className="w-5 h-5 text-amber-400" />}
                          </div>
                          <h2 className="font-semibold text-white text-base mb-1.5">{group.title}</h2>
                          <p className="text-xs text-slate-400 leading-relaxed">{group.description}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-white">
                          <span>Tanlash</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step-name"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="max-w-md mx-auto bg-[#131926] border border-white/12 rounded-2xl p-7 sm:p-8 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setStep(1);
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white mb-6 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Yosh toifasini o&apos;zgartirish ({selectedAge} yosh)
              </button>

              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Ismingiz nima?
              </h1>
              <p className="text-sm text-slate-400 mb-6">
                O&apos;yin profili uchun faqat ismingiz yoki taxallusingizni kiriting. Shaxsiy ma&apos;lumotlar talab qilinmaydi.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="pv-nickname" className="sr-only">
                    Ismingiz
                  </label>
                  <input
                    id="pv-nickname"
                    type="text"
                    maxLength={20}
                    autoFocus
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Ismingizni kiriting..."
                    className="w-full px-4 py-3.5 rounded-xl bg-[#0B0E14] border border-white/15 text-white placeholder-slate-500 text-base focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  {error && <p className="mt-2 text-xs font-medium text-rose-400">{error}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Boshlash</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
        PLAYVERSE · Xavfsiz va yoshga moslashtirilgan 3D o&apos;yinlar olami
      </footer>
    </div>
  );
};
