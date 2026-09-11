import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ShieldCheck, ArrowRight, Lock, Mail, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OmniReachLogo } from '../components/Brand/OmniReachLogo';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'inactivity') {
      setSessionNotice('Session logged out due to 15 minutes of inactivity.');
    } else if (reason === 'expired') {
      setSessionNotice('Your 15-minute secure session has expired. Please sign in again.');
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSessionNotice(null);

    try {
      const res = await axios.post('/api/auth/login', {
        email: email.trim(),
        password,
      });

      if (res.data.success) {
        login(res.data.token, res.data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials or server error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-y-auto selection:bg-blue-600 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-blue-600/20 via-indigo-500/20 to-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Back to Overview Link */}
      <div className="w-full max-w-md mb-3 flex items-center justify-start text-xs text-slate-400 z-10">
        <Link to="/" className="flex items-center gap-1 hover:text-blue-400 font-medium transition-colors">
          <ArrowLeft size={14} />
          <span>Back to Product Overview</span>
        </Link>
      </div>

      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center space-y-2">
          <OmniReachLogo size="lg" subtitle="Portal Sign In & Authorization" />
        </div>

        {/* 15-Minute Session Inactivity / Expiry Notice */}
        {sessionNotice && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2.5 shadow-md">
            <Clock size={16} className="text-amber-400 shrink-0" />
            <span>{sessionNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5">
            <ShieldCheck size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
