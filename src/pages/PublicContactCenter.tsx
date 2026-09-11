import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { LifeBuoy, ShieldCheck, Smartphone, Mail, CheckCircle2, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { OmniReachLogo } from '../components/Brand/OmniReachLogo';

export const PublicContactCenter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead');
  const phoneParam = searchParams.get('phone');
  const emailParam = searchParams.get('email');

  const [lead, setLead] = useState<any | null>(null);
  const [whatsappOptin, setWhatsappOptin] = useState(true);
  const [emailOptin, setEmailOptin] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (leadId || phoneParam || emailParam) {
      fetchLeadInfo(leadId, phoneParam, emailParam);
    }
  }, [leadId, phoneParam, emailParam]);

  const fetchLeadInfo = async (id?: string | null, phone?: string | null, email?: string | null) => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/public/lead-info', {
        params: { lead_id: id, phone, email },
      });
      if (res.data.success) {
        setLead(res.data.lead);
        setWhatsappOptin(res.data.lead.whatsapp_optin);
        setEmailOptin(res.data.lead.email_optin);
      }
    } catch (err) {
      console.error('Failed to load lead info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.includes('@')) {
      fetchLeadInfo(null, null, searchQuery.trim());
    } else {
      fetchLeadInfo(null, searchQuery.trim(), null);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setIsLoading(true);
    try {
      const res = await axios.post('/api/public/update-preferences', {
        lead_id: lead.id,
        whatsapp_optin: whatsappOptin,
        email_optin: emailOptin,
      });

      if (res.data.success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 4000);
      }
    } catch (err) {
      alert('Failed to update preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-6 overflow-y-auto selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-xl mb-4 flex items-center justify-between text-xs text-slate-400">
        <Link to="/" className="flex items-center gap-1 hover:text-blue-400 font-medium transition-colors">
          <ArrowLeft size={14} />
          <span>Back to OmniReach</span>
        </Link>
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
          TRAI & DLT Compliant Portal
        </span>
      </div>

      <div className="w-full max-w-xl bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center space-y-3">
          <OmniReachLogo size="lg" subtitle="TRAI & DLT Compliant Preference Center" />
          <h1 className="text-xl font-extrabold text-white">Communication Preference Center</h1>
          <p className="text-xs text-slate-400">
            Control which channels OmniReach uses to send you announcements, offers, and updates.
          </p>
        </div>

        {/* If no lead preloaded, show search */}
        {!lead && (
          <form onSubmit={handleManualSearch} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Lookup Your Registered Mobile Number or Email Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. 9876543210 or user@example.com"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
              >
                {isLoading ? 'Searching...' : 'Find Preferences'}
              </button>
            </div>
          </form>
        )}

        {/* Lead Preferences Card */}
        {lead && (
          <form onSubmit={handleSavePreferences} className="space-y-6">
            <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-1">
              <div className="text-xs font-bold text-white">{lead.full_name}</div>
              <div className="text-[11px] text-slate-400">
                Phone: +{lead.phone} • Email: {lead.email || 'None'}
              </div>
              <div className="text-[10px] text-purple-400 font-mono font-semibold pt-1">
                Ref ID: {lead.urn || lead.fmcb_id}
              </div>
            </div>

            <div className="space-y-3">
              {/* WhatsApp Toggle */}
              <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">WhatsApp Messaging</div>
                    <div className="text-[11px] text-slate-400">
                      Receive rate alerts, pre-approved offers, and customer support via WhatsApp
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappOptin}
                  onChange={(e) => setWhatsappOptin(e.target.checked)}
                  className="w-5 h-5 rounded bg-[#0f172a] border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Email Toggle */}
              <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Email Newsletters & Statements</div>
                    <div className="text-[11px] text-slate-400">
                      Receive monthly financial summaries, exclusive credit offers, and regulatory notices
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emailOptin}
                  onChange={(e) => setEmailOptin(e.target.checked)}
                  className="w-5 h-5 rounded bg-[#0f172a] border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            {isSaved && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 size={16} />
                <span>Your communication preferences have been saved successfully.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01]"
            >
              {isLoading ? 'Saving Changes...' : 'Save Communication Preferences'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
