import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { HERO_BANNER_IMAGE } from '../data/gamesRegistry';
import type { AgeGroup } from '../data/types';

interface HeroBannerProps {
  ageGroup: AgeGroup;
  nickname: string;
  onStartClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ ageGroup, nickname, onStartClick }) => {
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.2 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.25 - Math.random() * 0.45,
      alpha: 0.25 + Math.random() * 0.5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${p.alpha})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#121722] min-h-[340px] sm:min-h-[420px] flex items-end">
      {/* Cinematic 3D Backdrop */}
      <img
        src={HERO_BANNER_IMAGE}
        alt="PLAYVERSE 3D o'yinlar arenasi"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Ambient Floating Particles */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />

      {/* Contrast Scrim */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B0E14]/95 via-[#0B0E14]/75 to-[#0B0E14]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/90 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 max-w-2xl p-6 sm:p-10 lg:p-12"
      >
        <p className="text-xs sm:text-sm font-medium text-amber-300 mb-3">
          Xush kelibsiz, {nickname} · {ageGroup} yosh toifasi
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] text-balance mb-4">
          Cheksiz o&apos;yinlar olamiga xush kelibsiz!
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-7 max-w-xl">
          Sevimli o&apos;yinlaringizni tanlang va yangi sarguzashtlarni boshlang.
        </p>

        <button
          type="button"
          onClick={onStartClick}
          className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm sm:text-base transition-transform active:scale-[0.98] cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>O&apos;yinlarni boshlash</span>
        </button>
      </motion.div>
    </section>
  );
};
