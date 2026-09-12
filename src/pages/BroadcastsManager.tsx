import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Send,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Layers,
  Smartphone,
  Mail,
  Eye,
  Radio,
  FileText,
  X,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

interface BroadcastsManagerProps {
  onOpenWizard: (initialData?: any) => void;
}

export const BroadcastsManager: React.FC<BroadcastsManagerProps> = ({ onOpenWizard }) => {
  const { user, isSuperadmin } = useAuth();
  const { lastEvent } = useSocket();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedLogs, setSelectedLogs] = useState<any[] | null>(null);
  const [activeCampaignName, setActiveCampaignName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
    if (isSuperadmin) {
      fetchCompanies();
    }
  }, [selectedCompanyFilter]);

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

  useEffect(() => {
    if (lastEvent) {
      fetchCampaigns();
    }
  }, [lastEvent]);

  // Reverse countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCampaigns((prev) =>
        prev.map((c) => {
          if (c.status === 'scheduled' && c.countdownSeconds > 0) {
            return {
              ...c,
              countdownSeconds: c.countdownSeconds - 1,
            };
          }
          return c;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/campaigns', {
        params: {
          company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
        },
      });
      if (res.data.success) {
        setCampaigns(res.data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchNow = async (id: string) => {
    try {
      await axios.post(`/api/campaigns/${id}/resume`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch broadcast.');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await axios.post(`/api/campaigns/${id}/pause`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to pause broadcast.');
    }
  };

  const handleRetrigger = (broadcast: any) => {
    // Opens the 6-Step Wizard with ALL data prefilled from this broadcast
    onOpenWizard(broadcast);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      await axios.delete(`/api/campaigns/${id}`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete broadcast.');
    }
  };

  const handleViewLogs = async (broadcast: any) => {
    try {
      setActiveCampaignName(broadcast.name);
      const res = await axios.get(`/api/campaigns/${broadcast.id}/logs`);
      if (res.data.success) {
        setSelectedLogs(res.data.logs);
      }
    } catch (err) {
      alert('Failed to load audit logs.');
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00 (Executing)';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30">
              Module 3: Campaigns Orchestrator
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-emerald-400 font-semibold">6-Step Creation Wizard & Scheduler</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Broadcast Campaigns Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Schedule high-throughput broadcasts • Real-time Play, Pause & Retrigger controls • Chunked database dispatching
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSuperadmin && (
            <div className="flex items-center gap-2 bg-[#070b14] border border-slate-800 rounded-xl px-3 py-1.5">
              <Building2 size={14} className="text-cyan-400" />
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              >
                <option value="all">🏢 All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => onOpenWizard()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle size={15} />
            <span>Launch 6-Step Wizard</span>
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Broadcast Campaign</th>
                {isSuperadmin && <th className="p-4">Company</th>}
                <th className="p-4">Channel & Gateways</th>
                <th className="p-4">Status & Countdown</th>
                <th className="p-4">Total Audience</th>
                <th className="p-4">Delivered</th>
                <th className="p-4">Suppressed</th>
                <th className="p-4">Clicks</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={isSuperadmin ? 9 : 8} className="p-8 text-center text-slate-500">
                    No campaigns created yet. Click "Launch 6-Step Wizard" to get started!
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-[#070b14]/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{c.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{c.description || 'Omnichannel broadcast'}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.tags && c.tags.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[9px] rounded font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    {isSuperadmin && (
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-cyan-300 border border-slate-700">
                          {c.company_name}
                        </span>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="font-bold uppercase text-[10px] text-slate-200 flex items-center gap-1.5 mb-1">
                        {c.channel === 'whatsapp' ? <Smartphone size={13} className="text-emerald-400" /> : c.channel === 'email' ? <Mail size={13} className="text-blue-400" /> : <Layers size={13} className="text-purple-400" />}
                        <span>{c.channel}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs font-medium">
                        {c.whatsapp_gateway_name || c.email_gateway_name || 'Multi-Gateway Pool'}
                      </div>
                    </td>
                    <td className="p-4">
                      {c.status === 'scheduled' ? (
                        <div className="space-y-1">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                            <Clock size={12} className="animate-spin" />
                            <span>{formatCountdown(c.countdownSeconds)}</span>
                          </span>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {new Date(c.scheduled_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : c.status === 'processing' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 w-fit animate-pulse">
                          <Radio size={12} />
                          <span>Processing Batch...</span>
                        </span>
                      ) : c.status === 'paused' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                          <Pause size={12} />
                          <span>Paused</span>
                        </span>
                      ) : c.status === 'cooling_down' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 w-fit animate-pulse">
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Cooling Down</span>
                        </span>
                      ) : c.status === 'completed' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
                          <CheckCircle2 size={12} />
                          <span>Completed</span>
                        </span>
                      ) : c.status === 'completed_with_errors' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                          <AlertCircle size={12} />
                          <span>With Warnings</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 w-fit">
                          {c.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-semibold text-white">{c.total_target_count || 0}</td>
                    <td className="p-4 font-mono font-bold text-emerald-400">
                      {(c.whatsapp_delivered || 0) + (c.email_delivered || 0)}
                    </td>
                    <td className="p-4 font-mono text-amber-400 font-semibold">{c.total_suppressed || 0}</td>
                    <td className="p-4 font-mono text-blue-400 font-semibold">{c.total_clicks || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Play / Resume Button */}
                        {c.status === 'paused' && (
                          <button
                            onClick={() => handleDispatchNow(c.id)}
                            className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-1 text-[11px] font-bold"
                            title="Resume Broadcast Dispatch"
                          >
                            <Play size={12} />
                            <span>Play</span>
                          </button>
                        )}

                        {/* Pause Button */}
                        {(c.status === 'processing' || c.status === 'cooling_down') && (
                          <button
                            onClick={() => handlePause(c.id)}
                            className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg transition-colors border border-amber-500/30 flex items-center gap-1 text-[11px] font-bold"
                            title="Pause Broadcast Dispatch"
                          >
                            <Pause size={12} />
                            <span>Pause</span>
                          </button>
                        )}

                        {/* Scheduled Action Controls */}
                        {c.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleDispatchNow(c.id)}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors border border-blue-500/30"
                              title="Dispatch Immediately"
                            >
                              <Play size={13} />
                            </button>
                            <button
                              onClick={() => handlePause(c.id)}
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg transition-colors border border-amber-500/30"
                              title="Pause Schedule"
                            >
                              <Pause size={13} />
                            </button>
                          </>
                        )}

                        {/* Retrigger Button (Prepopulates 6-step Wizard with all broadcast configuration) */}
                        <button
                          onClick={() => handleRetrigger(c)}
                          className="px-2.5 py-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-300 border border-blue-500/40 rounded-lg flex items-center gap-1.5 text-[11px] font-bold shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                          title="Open 6-Step Wizard with this campaign's channels, templates, and contact filters to edit or re-run"
                        >
                          <RotateCcw size={12} className="text-blue-400" />
                          <span>Retrigger</span>
                        </button>

                        <button
                          onClick={() => handleViewLogs(c)}
                          className="px-2.5 py-1 bg-[#070b14] hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors border border-slate-800"
                        >
                          Logs
                        </button>

                        {isSuperadmin && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Campaign (Superadmin Only)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Logs Modal */}
      {selectedLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Delivery Logs: {activeCampaignName}</h3>
                <p className="text-xs text-slate-400">Recipient-level audit trail with Meta WAMID / AWS SES IDs</p>
              </div>
              <button
                onClick={() => setSelectedLogs(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="p-2.5">Customer Name</th>
                    <th className="p-2.5">Contact / Email</th>
                    <th className="p-2.5">URN / FMCB ID</th>
                    <th className="p-2.5">Channel</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Message / Error Details</th>
                    <th className="p-2.5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {selectedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No delivery logs recorded for this campaign yet.
                      </td>
                    </tr>
                  ) : (
                    selectedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#070b14]/40">
                        <td className="p-2.5 font-bold text-white">{log.lead_name || 'Customer'}</td>
                        <td className="p-2.5 font-mono text-slate-200">{log.recipient}</td>
                        <td className="p-2.5 font-mono text-[10px] text-cyan-400">{log.lead_urn || log.lead_fmcb_id || '—'}</td>
                        <td className="p-2.5 uppercase text-[10px] font-bold text-slate-400">{log.channel}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : log.status === 'suppressed'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-xs font-mono">
                          {log.error_message || log.meta_message_id || log.ses_message_id || 'Dispatched successfully'}
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px]">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-[#070b14] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLogs(null)}
                className="px-4 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
