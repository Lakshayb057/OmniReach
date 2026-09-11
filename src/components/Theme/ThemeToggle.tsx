import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'pill' | 'icon' | 'switch';
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'pill',
  className = '',
  showLabel = false,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`p-2 rounded-xl transition-all duration-300 cursor-pointer ${
          isDark
            ? 'bg-slate-800/80 hover:bg-slate-700/80 text-amber-400 border border-slate-700/60 shadow-sm'
            : 'bg-slate-100 hover:bg-slate-200 text-indigo-600 border border-slate-300 shadow-sm'
        } ${className}`}
      >
        {isDark ? (
          <Sun size={17} className="transition-transform duration-500 hover:rotate-90 text-amber-400" />
        ) : (
          <Moon size={17} className="transition-transform duration-500 hover:-rotate-12 text-indigo-600" />
        )}
      </button>
    );
  }

  if (variant === 'switch') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 ease-in-out focus:outline-none ${
          isDark
            ? 'bg-slate-900 border-cyan-500/40 shadow-inner'
            : 'bg-indigo-100 border-indigo-400 shadow-inner'
        } ${className}`}
      >
        <span
          className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow-md transition duration-300 ease-in-out mt-0.5 ${
            isDark
              ? 'translate-x-7 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white'
              : 'translate-x-1 bg-amber-400 text-slate-900'
          }`}
        >
          {isDark ? <Moon size={11} /> : <Sun size={11} />}
        </span>
      </button>
    );
  }

  // Default 'pill' variant
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer select-none ${
        isDark
          ? 'bg-[#0c1322] hover:bg-[#131d33] text-slate-300 border border-slate-800 hover:border-cyan-500/40 shadow-md'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-indigo-500/40 shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun
            size={15}
            className="text-amber-400 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110"
          />
        ) : (
          <Moon
            size={15}
            className="text-indigo-600 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110"
          />
        )}
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold tracking-tight">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
          isDark
            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        }`}
      >
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
};
