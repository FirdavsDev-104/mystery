import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false }) => {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width="30"
        height="30"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="pvGradA" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient id="pvGradB" x1="36" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <polygon points="18,2 33,10.5 33,25.5 18,34 3,25.5 3,10.5" fill="#131926" stroke="url(#pvGradA)" strokeWidth="2.2" />
        <polygon points="18,2 33,10.5 18,18 3,10.5" fill="url(#pvGradB)" fillOpacity="0.25" />
        <polygon points="14,12.5 25.5,18 14,23.5" fill="url(#pvGradA)" />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-extrabold tracking-wider text-white">
          PLAY<span className="text-amber-400">VERSE</span>
        </span>
      )}
    </span>
  );
};
