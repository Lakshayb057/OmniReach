import React from 'react';

interface OmniReachLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  animate?: boolean;
}

export const OmniReachLogo: React.FC<OmniReachLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle = 'Broadcast Center',
  className = '',
  animate = true,
}) => {
  const sizeMap = {
    xs: { icon: 22, text: 'text-xs', sub: 'text-[8px]' },
    sm: { icon: 28, text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 38, text: 'text-base', sub: 'text-[11px]' },
    lg: { icon: 48, text: 'text-xl', sub: 'text-xs' },
    xl: { icon: 64, text: 'text-2xl', sub: 'text-sm' },
    '2xl': { icon: 84, text: 'text-3xl', sub: 'text-base' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* 3D Hexagonal Mobius Ribbon Vector Mark */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full drop-shadow-[0_4px_16px_rgba(6,182,212,0.4)] ${
            animate ? 'hover:scale-110 hover:rotate-6 transition-all duration-300' : ''
          }`}
        >
          <defs>
            {/* Top Pink-to-Lavender Gradient */}
            <linearGradient id="omniPinkLavender" x1="15%" y1="70%" x2="85%" y2="15%">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="35%" stopColor="#e879f9" />
              <stop offset="70%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#d8b4fe" />
            </linearGradient>

            {/* Twist Fold Shading Gradient */}
            <linearGradient id="omniTwistFold" x1="10%" y1="10%" x2="90%" y2="90%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="45%" stopColor="#a855f7" />
              <stop offset="80%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>

            {/* Bottom Cyan-to-SkyBlue Gradient */}
            <linearGradient id="omniCyanBlue" x1="0%" y1="10%" x2="100%" y2="90%">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="25%" stopColor="#38bdf8" />
              <stop offset="70%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>

            {/* Surface Specular Highlight */}
            <linearGradient id="omniSpecular" x1="20%" y1="0%" x2="60%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Orb Glow Filter */}
            <filter id="omniOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#e0f2fe" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* 1. Bottom-Right & Bottom-Left Cyan-Blue Ribbon */}
          <path
            d="M 22 56 
               L 22 78 Q 22 84 27 87 
               L 55 103 Q 60 106 65 103 
               L 93 87 Q 98 84 98 78 
               L 98 52 
               L 81 59 
               L 81 74 Q 81 77 78 79 
               L 62 88 Q 60 89 58 88 
               L 42 79 Q 39 77 39 74 
               L 39 52 
               Z"
            fill="url(#omniCyanBlue)"
          />

          {/* 2. Inner Möbius Twist Transition (Top-Right Depth Facet) */}
          <path
            d="M 98 52 
               L 98 38 Q 98 34 94 32 
               L 72 20 
               L 68 38 
               L 81 59 
               Z"
            fill="url(#omniTwistFold)"
          />

          {/* 3. Top Pink-to-Lavender Ribbon (Outer Arch) */}
          <path
            d="M 22 56 
               L 22 38 Q 22 32 27 29 
               L 55 13 Q 60 10 65 13 
               L 94 30 Q 98 32 98 38 
               L 78 48 
               L 63 36 Q 60 35 57 36 
               L 42 45 Q 39 47 39 51 
               L 39 56 
               Z"
            fill="url(#omniPinkLavender)"
          />

          {/* 4. Subtle Inner Twist Glass Sheen */}
          <path
            d="M 68 38 
               L 81 59 
               L 78 74 
               L 63 36 
               Z"
            fill="#ffffff"
            fillOpacity="0.15"
          />

          {/* 5. Specular Edge Highlight on Top Arch */}
          <path
            d="M 27 29 
               L 55 13 Q 60 10 65 13 
               L 94 30"
            stroke="url(#omniSpecular)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* 6. Floating Top-Right Accent Orb */}
          <circle
            cx="98"
            cy="24"
            r="6.5"
            fill="#f8fafc"
            filter="url(#omniOrbGlow)"
          />
          <circle
            cx="98"
            cy="24"
            r="3.5"
            fill="#ffffff"
          />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className={`font-black tracking-tight text-white flex items-center gap-0.5 ${currentSize.text}`}>
            <span>Omni</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-300">
              Reach
            </span>
          </div>
          {subtitle && (
            <span className={`text-slate-400 font-semibold tracking-wide ${currentSize.sub}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
