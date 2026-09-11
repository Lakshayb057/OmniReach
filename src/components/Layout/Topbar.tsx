import React from 'react';
import { useLocation } from 'react-router-dom';
import { PlusCircle, Sparkles, Zap, Activity, Cpu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OmniReachLogo } from '../Brand/OmniReachLogo';

interface TopbarProps {
  onOpenWizard: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenWizard }) => {
  const { user, isSuperadmin } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'AI Telemetry & Funnels Dashboard';
      case '/leads':
        return 'Neural Master Data Center (Zero-Dup)';
      case '/broadcasts':
        return 'Broadcast Campaigns & Smart Scheduler';
      case '/templates':
        return 'AI Templates Studio & Meta Graph API Sync';
      case '/gateways':
        return 'Multi-Gateway Mesh (AWS SES, SMTP, Meta WABA)';
      case '/settings':
        return 'Superadmin Neural Core & Engine Diagnostics';
      default:
        return 'OmniReach AI Broadcast Console';
    }
  };

  return (
    <header className="h-16 bg-[#080d1a]/85 backdrop-blur-xl border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-20 shadow-xl">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-cyan-400">
            <OmniReachLogo size="xs" showText={false} />
            <span>OmniReach.AI</span>
          </div>
          <span className="text-slate-600">/</span>
          <span className="text-slate-100 font-sans font-semibold text-xs tracking-tight">{getPageTitle()}</span>
        </div>
      </div>

      {/* AI Telemetry Badges & Action Button */}
      <div className="flex items-center space-x-3">
        {/* Real-Time AI Telemetry Pill */}
        <div className="hidden lg:flex items-center space-x-3 px-3 py-1.5 rounded-full bg-[#050811] border border-cyan-500/20 text-[11px] font-mono text-slate-400 shadow-inner">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            5s Dispatch Engine
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1 text-cyan-300">
            <Zap size={11} className="text-amber-400" />
            Latency: 12ms
          </span>
        </div>

        {/* 6-Step Campaign Wizard Launch Button */}
        <button
          onClick={onOpenWizard}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl ai-gradient-btn text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles size={14} className="animate-pulse" />
          <span>Launch AI Broadcast Wizard</span>
        </button>
      </div>
    </header>
  );
};
