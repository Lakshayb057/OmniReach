import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Smartphone,
  Mail,
  Zap,
  Users,
  Eye,
  MousePointerClick,
  Sparkles,
  Activity,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  PlusCircle,
  Building2,
  Crown,
  RefreshCw,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  onOpenWizard: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenWizard }) => {
  const { user, isSuperadmin } = useAuth();
  const { lastEvent, isConnected } = useSocket();
  const [metrics, setMetrics] = useState<any>(null);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('All Companies (Global)');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSuperadmin) {
      fetchCompanies();
    }
  }, [isSuperadmin]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCompany]);

  useEffect(() => {
    if (lastEvent) {
      fetchDashboardData();
    }
  }, [lastEvent]);

  // Reverse countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBroadcasts((prev) =>
        prev.map((b) => {
          if (b.status === 'scheduled' && b.countdownSeconds > 0) {
            return {
              ...b,
              countdownSeconds: b.countdownSeconds - 1,
            };
          }
          return b;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/api/auth/companies');
      if (res.data.success) {
        setCompanies(res.data.companies);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const companyParam = isSuperadmin && selectedCompany !== 'All Companies (Global)' ? selectedCompany : undefined;

      const [kpiRes, funnelRes, feedRes] = await Promise.all([
        axios.get('/api/dashboard/kpis', { params: { company_name: companyParam } }),
        axios.get('/api/dashboard/funnel', { params: { company_name: companyParam } }),
        axios.get('/api/dashboard/live-feed', { params: { company_name: companyParam } }),
      ]);

      if (kpiRes.data.success) setMetrics(kpiRes.data.data);
      if (funnelRes.data.success) setFunnel(funnelRes.data.funnel);
      if (feedRes.data.success) setActiveBroadcasts(feedRes.data.feed);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00 (Executing)';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const currentWorkspaceName = isSuperadmin
    ? selectedCompany
    : (user?.company_name || 'Assigned Enterprise');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none">
      {/* Header Banner with Multi-Tenant Company Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30">
              Communication & Broadcast Hub
            </span>
            <span className="text-xs text-slate-500">•</span>
            {isSuperadmin ? (
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                <Crown size={12} />
                <span>Superadmin Multi-Tenant Control</span>
              </span>
            ) : (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Building2 size={12} />
                <span>{user?.company_name} Dedicated Workspace</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {isSuperadmin
              ? selectedCompany === 'All Companies (Global)'
                ? 'Global Multi-Tenant Overview'
                : `${selectedCompany} Workspace Analytics`
              : `${user?.company_name || 'Enterprise'} Performance Dashboard`}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isSuperadmin
              ? 'Monitoring multi-channel throughput, delivery funnels, and gateway health across all tenant accounts'
              : `Real-time broadcast metrics, customer reach, and campaign analytics strictly scoped to ${user?.company_name}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Superadmin Company Switcher Dropdown */}
          {isSuperadmin && (
            <div className="flex items-center gap-2 bg-[#070b14] border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
              <Building2 size={14} className="text-cyan-400 shrink-0" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="All Companies (Global)" className="bg-[#0f172a] text-white">
                  🌐 All Companies (Global)
                </option>
                {companies.map((c) => (
                  <option key={c} value={c} className="bg-[#0f172a] text-white">
                    🏢 {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onOpenWizard}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle size={15} />
            <span>Launch 6-Step Wizard</span>
          </button>
        </div>
      </div>

      {/* 4 KPI HUD Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Target Contact Reach */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <ArrowUpRight size={11} />
              Active
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {(metrics?.summary?.targetedAudienceCount ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Target Contact Reach</div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>WhatsApp Opt-In:</span>
            <strong className="text-emerald-400 font-mono font-semibold">
              {(metrics?.optInMetrics?.whatsappOptIn ?? 0).toLocaleString()}
            </strong>
          </div>
        </div>

        {/* KPI 2: Delivery Success Rate */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              {metrics?.summary?.totalCampaigns > 0 ? `${(metrics?.summary?.deliveryRate ?? 0).toFixed(1)}% SLA` : '0.0% SLA'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {(metrics?.summary?.deliveryRate ?? 0).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Delivery Success Rate</div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Meta & AWS SES / Resend</span>
            <strong className="text-slate-300 font-mono">
              {metrics?.summary?.totalCampaigns > 0 ? `${(100 - (metrics?.summary?.deliveryRate ?? 0)).toFixed(1)}% bounce` : '0.0% bounce'}
            </strong>
          </div>
        </div>

        {/* KPI 3: Click-Through Rate (CTR) */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
              <MousePointerClick size={20} />
            </div>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              CTR Tracker
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {(metrics?.summary?.clickThroughRate ?? 0).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Click-Through Rate (CTR)</div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Total Clicks Logged:</span>
            <strong className="text-purple-300 font-mono">
              {(metrics?.summary?.totalClicks ?? 0).toLocaleString()}
            </strong>
          </div>
        </div>

        {/* KPI 4: Total Campaigns Executed */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Send size={20} />
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              Broadcasts
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {(metrics?.summary?.totalCampaigns ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Total Campaigns Executed</div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Completed: {(metrics?.summary?.completedCampaigns ?? 0).toLocaleString()}</span>
            <strong className="text-amber-400 font-mono">
              {(metrics?.summary?.scheduledCampaigns ?? 0).toLocaleString()} queue
            </strong>
          </div>
        </div>
      </div>

      {/* Main Row: Funnel Graph & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Funnel Graph */}
        <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-sm text-white">Channel Performance Funnel</h2>
              <p className="text-[11px] text-slate-400">Step-by-step conversion from broadcast dispatch to CTR clicks</p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-[#070b14] px-2.5 py-1 rounded-lg border border-slate-800">
              {currentWorkspaceName}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {funnel.map((step) => (
              <div key={step.step} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">{step.step}</span>
                  <div className="flex items-center space-x-2 font-mono text-[11px]">
                    <span className="text-white font-bold">{step.count.toLocaleString()}</span>
                    <span className="text-slate-500">({step.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-[#070b14] rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{
                      width: `${Math.min(100, Math.max(5, step.percentage))}%`,
                      backgroundColor: step.color,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Broadcast Activity & Reverse Countdown Timers */}
        <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="font-extrabold text-sm text-white">Live Broadcast Feed</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">5s Poller Active</span>
          </div>

          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
            {activeBroadcasts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active or scheduled broadcasts found for {currentWorkspaceName}.
              </div>
            ) : (
              activeBroadcasts.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-md hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="font-bold text-xs text-white truncate flex items-center gap-2">
                      <span>{b.name}</span>
                      {b.company_name && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-normal">
                          {b.company_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="capitalize">{b.channel} Broadcast</span>
                      <span>•</span>
                      <span>Target: {b.total_target_count || 0}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-xs font-mono font-bold text-cyan-400">
                      {formatCountdown(b.countdownSeconds)}
                    </div>
                    <span
                      className={`inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        b.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : b.status === 'processing'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
