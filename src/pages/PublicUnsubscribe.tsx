import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, CheckCircle2, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { OmniReachLogo } from '../components/Brand/OmniReachLogo';

export const PublicUnsubscribe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead');
  const broadcastId = searchParams.get('b');
  const emailParam = searchParams.get('email');
  const phoneParam = searchParams.get('phone');

  const [inputVal, setInputVal] = useState(emailParam || phoneParam || '');
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 1-Click direct opt-out if parameters are present
  useEffect(() => {
    if (leadId || emailParam || phoneParam) {
      handleDirectUnsubscribe();
    }
  }, [leadId, emailParam, phoneParam]);

  const handleDirectUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post('/api/public/unsubscribe-1click', {
        lead_id: leadId,
        broadcast_id: broadcastId,
        email: emailParam,
        phone: phoneParam,
      });

      if (res.data.success) {
        setIsUnsubscribed(true);
        setMessage(res.data.message);
      }
    } catch (err) {
      setMessage('Failed to process unsubscribe request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload: any = {};
      if (inputVal.includes('@')) {
        payload.email = inputVal.trim();
      } else {
        payload.phone = inputVal.trim();
      }

      const res = await axios.post('/api/public/unsubscribe-1click', payload);
      if (res.data.success) {
        setIsUnsubscribed(true);
        setMessage(res.data.message);
      }
    } catch (err) {
      setMessage('Failed to process unsubscribe request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-6 overflow-y-auto selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md mb-4 flex items-center justify-between text-xs text-slate-400">
        <Link to="/" className="flex items-center gap-1 hover:text-blue-400 font-medium transition-colors">
          <ArrowLeft size={14} />
          <span>Back to OmniReach</span>
        </Link>
        <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30">
          1-Click Regulatory Compliance
        </span>
      </div>

      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        <div className="flex flex-col items-center space-y-3">
          <OmniReachLogo size="lg" subtitle="Broadcast Preference & Opt-Out" />
          <h1 className="text-xl font-extrabold text-white">1-Click Unsubscribe</h1>
          <p className="text-xs text-slate-400">
            Opt-out from all OmniReach promotional WhatsApp and Email broadcast communications instantly.
          </p>
        </div>

        {isUnsubscribed ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 text-left">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
              <CheckCircle2 size={16} />
              Unsubscribe Confirmed
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {message || 'You have been successfully unsubscribed from all OmniReach promotional campaigns.'}
            </p>
            <div className="pt-2">
              <Link
                to="/contact-center"
                className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
              >
                Need to re-enable or customize channels? Visit Preference Center
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualUnsubscribe} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Enter Mobile Number or Email
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 9876543210 or user@example.com"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition-all hover:scale-[1.01]"
            >
              {isLoading ? 'Processing...' : 'Unsubscribe from All Broadcasts'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
