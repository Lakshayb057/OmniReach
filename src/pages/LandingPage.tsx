import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  Mail,
  Users,
  Send,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Radio,
  Layers,
  Database,
  Crown,
  Building2,
  GitFork,
  Check,
  Zap,
  Menu,
  X,
  Lock,
  ChevronRight,
  ExternalLink,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Clock,
  Sparkles,
  ShieldAlert,
  LayoutDashboard,
  Sliders,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { OmniReachLogo } from '../components/Brand/OmniReachLogo';
import { HeroVideoPlayer } from '../components/Landing/HeroVideoPlayer';
import { ThemeToggle } from '../components/Theme/ThemeToggle';

// Live Continuous 1-per-second Days, Hours, Minutes, Seconds Counter (persisted across page refreshes)
const LiveDispatchesCounter: React.FC = () => {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    try {
      const stored = localStorage.getItem('omnireach_dispatch_start_time');
      if (stored) {
        const start = parseInt(stored, 10);
        if (!isNaN(start)) {
          return Math.max(0, Math.floor((Date.now() - start) / 1000));
        }
      }
      const now = Date.now();
      localStorage.setItem('omnireach_dispatch_start_time', now.toString());
      return 0;
    } catch (e) {
      return 0;
    }
  });

  useEffect(() => {
    let start = Date.now();
    try {
      const stored = localStorage.getItem('omnireach_dispatch_start_time');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) start = parsed;
      } else {
        localStorage.setItem('omnireach_dispatch_start_time', start.toString());
      }
    } catch (e) {}

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);

    return () => clearInterval(timer);
  }, []);

  const days = Math.floor(elapsedSeconds / 86400);
  const hours = Math.floor((elapsedSeconds % 86400) / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      {/* 4-Segment Digital Counter: 00:00:00:00 Days, Hours, Min, Sec */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-5 my-2 select-none">
        {/* Days */}
        <div className="flex flex-col items-center">
          <div className="px-3 sm:px-5 md:px-6 py-2 sm:py-3.5 rounded-2xl bg-[#080d1a] border border-cyan-500/30 dark:bg-[#0c1428] shadow-lg flex items-center justify-center min-w-[65px] sm:min-w-[95px] md:min-w-[125px]">
            <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-white dark:via-cyan-200 dark:to-cyan-400">
              {pad(days)}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-cyan-500 dark:text-cyan-400">
            Days
          </span>
        </div>

        <span className="text-2xl sm:text-4xl md:text-6xl font-black text-cyan-500/80 dark:text-cyan-400/80 -mt-6 animate-pulse">
          :
        </span>

        {/* Hours */}
        <div className="flex flex-col items-center">
          <div className="px-3 sm:px-5 md:px-6 py-2 sm:py-3.5 rounded-2xl bg-[#080d1a] border border-cyan-500/30 dark:bg-[#0c1428] shadow-lg flex items-center justify-center min-w-[65px] sm:min-w-[95px] md:min-w-[125px]">
            <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-white dark:via-cyan-200 dark:to-cyan-400">
              {pad(hours)}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-cyan-500 dark:text-cyan-400">
            Hours
          </span>
        </div>

        <span className="text-2xl sm:text-4xl md:text-6xl font-black text-cyan-500/80 dark:text-cyan-400/80 -mt-6 animate-pulse">
          :
        </span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <div className="px-3 sm:px-5 md:px-6 py-2 sm:py-3.5 rounded-2xl bg-[#080d1a] border border-cyan-500/30 dark:bg-[#0c1428] shadow-lg flex items-center justify-center min-w-[65px] sm:min-w-[95px] md:min-w-[125px]">
            <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-white dark:via-cyan-200 dark:to-cyan-400">
              {pad(minutes)}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-cyan-500 dark:text-cyan-400">
            Min
          </span>
        </div>

        <span className="text-2xl sm:text-4xl md:text-6xl font-black text-cyan-500/80 dark:text-cyan-400/80 -mt-6 animate-pulse">
          :
        </span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <div className="px-3 sm:px-5 md:px-6 py-2 sm:py-3.5 rounded-2xl bg-[#080d1a] border border-cyan-500/30 dark:bg-[#0c1428] shadow-lg flex items-center justify-center min-w-[65px] sm:min-w-[95px] md:min-w-[125px]">
            <span className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-white dark:via-cyan-200 dark:to-cyan-400">
              {pad(seconds)}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-cyan-500 dark:text-cyan-400">
            Sec
          </span>
        </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [globalMouse, setGlobalMouse] = useState({ x: -500, y: -500 });

  // Global Mouse Tracking for Full-Page Cursor Follower Spotlight Background Effect
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      setGlobalMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // ESC key listener to close 3D menu smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Dynamic Cursor Tracking for 3D Tilt on Hero Card
  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const [cursorPos, setCursorPos] = useState({ rx: 0, ry: 0 });

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroCardRef.current) return;
    const rect = heroCardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    setCursorPos({
      rx: normY * -5,
      ry: normX * 5,
    });
  };

  const handleHeroMouseLeave = () => {
    setCursorPos({ rx: 0, ry: 0 });
  };

  // Interactive Live Dispatch Simulator State
  const [simChannel, setSimChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [simRecipient, setSimRecipient] = useState('+91 98765 43210');
  const [simName, setSimName] = useState('Alexander Morgan');
  const [simStatus, setSimStatus] = useState<'idle' | 'routing' | 'delivered'>('idle');
  const [simLatency, setSimLatency] = useState<number | null>(null);

  const handlePortalAccess = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleRunSimulatedDispatch = () => {
    setSimStatus('routing');
    setSimLatency(null);
    const start = performance.now();

    setTimeout(() => {
      const end = performance.now();
      setSimLatency(Math.round(end - start + 8));
      setSimStatus('delivered');
    }, 650);
  };

  return (
    <div className="h-screen w-screen bg-[#03060f] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black font-sans antialiased relative overflow-y-auto overflow-x-hidden">
      {/* Full-Page Dynamic Cursor Spotlight Following Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(750px circle at ${globalMouse.x}px ${globalMouse.y}px, rgba(0, 240, 255, 0.12) 0%, rgba(30, 64, 175, 0.04) 45%, transparent 75%)`,
        }}
      />
      <div
        className="fixed pointer-events-none rounded-full blur-[120px] z-0 transition-all duration-75 ease-out"
        style={{
          left: `${globalMouse.x - 250}px`,
          top: `${globalMouse.y - 250}px`,
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 70%)',
        }}
      />

      {/* Permanently Fixed Brand Logo (Always Visible on Scroll) */}
      <div className="fixed top-8 left-8 sm:top-10 sm:left-12 z-50 select-none">
        <Link to="/" className="flex items-center group">
          <OmniReachLogo size="lg" showText={true} />
        </Link>
      </div>

      {/* Fixed Orangewood Circular 3-Bar Menu Button (Top Right) with 3D Motion */}
      <div className="fixed top-8 right-8 sm:top-10 sm:right-12 z-50">
        <motion.button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          whileHover={{ scale: 1.1, rotate: isMenuOpen ? 90 : 8 }}
          whileTap={{ scale: 0.9, rotate: isMenuOpen ? -90 : -12 }}
          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          className="h-[44px] w-[44px] sm:h-[58px] sm:w-[58px] rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(0,240,255,0.45)] transition-shadow cursor-pointer select-none"
          title={isMenuOpen ? 'Close Menu (Esc)' : 'Open 3D Navigation Menu'}
        >
          <AnimatePresence mode="wait">
            {isMenuOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                <X size={24} className="text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                <Menu size={24} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Slide-Over 3D Orangewood Menu Modal with 3D Reverse Exit */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-40 flex justify-end [perspective:1400px] overflow-hidden">
            {/* Backdrop with Smooth 3D Depth Fade - Background Page Remains Clearly Visible */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] cursor-pointer"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,240,255,0.08)_0%,transparent_60%)]" />
            </motion.div>

            {/* 3D Perspective Animated Menu Panel */}
            <motion.div
              initial={{
                opacity: 0,
                x: '100%',
                rotateY: 45,
                rotateX: -10,
                scale: 0.86,
                filter: 'blur(12px)',
              }}
              animate={{
                opacity: 1,
                x: 0,
                rotateY: 0,
                rotateX: 0,
                scale: 1,
                filter: 'blur(0px)',
                transition: {
                  type: 'spring',
                  damping: 24,
                  stiffness: 160,
                  mass: 0.85,
                  staggerChildren: 0.05,
                  delayChildren: 0.08,
                },
              }}
              exit={{
                opacity: 0,
                x: '100%',
                rotateY: 45,
                rotateX: 10,
                scale: 0.86,
                filter: 'blur(14px)',
                transition: {
                  duration: 0.38,
                  ease: [0.32, 0, 0.67, 0],
                },
              }}
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'top right',
              }}
              className="relative w-full max-w-md bg-[#070d1d] border-l border-cyan-500/30 h-full p-8 flex flex-col justify-between overflow-y-auto z-10 shadow-[-25px_0_70px_rgba(0,0,0,0.95)]"
            >
              <div className="space-y-7 pt-4">
                {/* Header inside Menu with Brand & Close Button */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/90">
                  <OmniReachLogo size="md" showText={true} />

                  {/* Dedicated Close Button */}
                  <motion.button
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.12, rotate: 90 }}
                    whileTap={{ scale: 0.92, rotate: -90 }}
                    className="h-10 w-10 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-cyan-400 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                    title="Close Menu (Esc)"
                  >
                    <X size={18} />
                  </motion.button>
                </div>

                {/* Modules Navigation with 3D Staggered Entrance */}
                <div className="space-y-2.5">
                  <div className="space-y-2 text-sm font-bold">
                    {[
                      { to: '/dashboard', label: 'Executive Real-Time Dashboard', icon: LayoutDashboard },
                      { to: '/journeys', label: 'Autonomous Customer Journeys', icon: GitFork },
                      { to: '/broadcasts', label: 'Campaigns & Blast Scheduler', icon: Send },
                      { to: '/templates', label: 'Meta Cloud API Template Studio', icon: Smartphone },
                      { to: '/leads', label: 'Zero-Duplicate Master Data Center', icon: Database },
                      { to: '/settings', label: 'Multi-Tenant Gateway & Keys Vault', icon: Sliders },
                    ].map((item, idx) => (
                      <motion.div
                        key={item.to}
                        initial={{ opacity: 0, x: 40, rotateX: -12 }}
                        animate={{ opacity: 1, x: 0, rotateX: 0 }}
                        exit={{ opacity: 0, x: 25, transition: { duration: 0.15 } }}
                        transition={{ delay: 0.03 * idx, duration: 0.25 }}
                      >
                        <Link
                          to={item.to}
                          onClick={() => setIsMenuOpen(false)}
                          className="group flex items-center justify-between p-3.5 rounded-2xl bg-[#0c1428] hover:bg-[#121f3d] border border-slate-800/90 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-300 transition-all duration-200 shadow-md hover:translate-x-1"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 transition-colors">
                              <item.icon size={15} />
                            </div>
                            <span className="text-xs sm:text-sm font-bold">{item.label}</span>
                          </div>
                          <ChevronRight size={15} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer inside Panel */}
              <div className="pt-6 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-400">Theme Mode</span>
                  <ThemeToggle variant="pill" showLabel />
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handlePortalAccess();
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Login Admin</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Page Layout (Exact Orangewood Structure) */}
      <main className="relative z-10 pt-16 sm:pt-20 md:pt-24">
        <div className="m-auto max-w-[1300px] px-6 sm:px-10 space-y-[60px] sm:space-y-[120px]">
          
          {/* 1. HERO SECTION (Video/Canvas Card + Giant Typography) */}
          <section>
            <div
              ref={heroCardRef}
              onMouseMove={handleHeroMouseMove}
              onMouseLeave={handleHeroMouseLeave}
              className="max-w-[760px] sm:max-w-[880px] aspect-[16/10] sm:aspect-[16/9] mx-auto overflow-hidden rounded-3xl sm:rounded-[36px] border border-white/15 bg-[#060b17] shadow-[0_20px_80px_rgba(0,0,0,0.95)] transition-transform duration-150 ease-out"
              style={{
                transform: `perspective(1000px) rotateX(${cursorPos.rx}deg) rotateY(${cursorPos.ry}deg)`,
              }}
            >
              <HeroVideoPlayer videoSrc="/Video_Production_Blueprint_.mp4" />
            </div>

            {/* Giant Hero Typography & Action Button */}
            <div className="mt-8 space-y-4">
              <div>
                <p className="text-[60px] font-extrabold leading-[55px] sm:text-[90px] sm:leading-[80px] md:text-[130px] md:leading-[100px] text-white tracking-tight uppercase">
                  BROADCASTS
                </p>
                <p className="text-[36px] font-extrabold sm:text-[50px] md:text-[64px] text-cyan-400 tracking-tight uppercase">
                  ARE HERE!
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handlePortalAccess}
                  className="rounded-full border border-cyan-400 px-8 py-3.5 leading-none text-black bg-cyan-400 font-black text-sm uppercase tracking-wider min-w-[189px] transition-all duration-300 hover:bg-cyan-300 hover:scale-105 shadow-[0_0_30px_rgba(0,240,255,0.4)] cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Launch Console Now!</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* 2. DEMOCRATIZING SECTION (Split 2-Column) */}
          <section className="py-8">
            <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
              {/* Left Live Simulator Card */}
              <div className="w-full lg:w-[48%] rounded-3xl bg-[#060b17] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Radio size={14} className="animate-pulse text-cyan-400" />
                    <span>Neural Dispatch Simulator</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {simLatency ? `${simLatency}ms Latency` : 'Live Preview'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSimChannel('whatsapp')}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        simChannel === 'whatsapp'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-[#040814] text-slate-400 border-slate-800'
                      }`}
                    >
                      <Smartphone size={13} />
                      <span>WhatsApp WABA</span>
                    </button>
                    <button
                      onClick={() => setSimChannel('email')}
                      className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        simChannel === 'email'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                          : 'bg-[#040814] text-slate-400 border-slate-800'
                      }`}
                    >
                      <Mail size={13} />
                      <span>AWS SES Email</span>
                    </button>
                  </div>

                  <div className="p-3 bg-[#040814] border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300">
                    {simChannel === 'whatsapp'
                      ? `Hi ${simName}, your verified renewal milestone is confirmed via Meta Graph API!`
                      : `Subject: Verified Service Alert for ${simName} • Region ap-south-1 Delivery Verified.`}
                  </div>

                  <button
                    onClick={handleRunSimulatedDispatch}
                    disabled={simStatus === 'routing'}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] transition-all"
                  >
                    {simStatus === 'routing' ? 'Routing Through Neural Gateway...' : 'Execute Live Test Dispatch'}
                  </button>
                </div>
              </div>

              {/* Right Text Column */}
              <div className="w-full lg:w-[48%] space-y-6">
                <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
                  Democratizing <br />
                  <span className="text-cyan-400 font-medium">Broadcasting</span>
                </h3>

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
                  OmniReach builds AI-powered broadcasting engines that are simple to operate. We make high-volume Meta WhatsApp WABA and AWS SES email broadcasting safe, zero-duplicate, and capable of coping with modern-day enterprise outreach challenges.
                </p>

                <div>
                  <button
                    onClick={handlePortalAccess}
                    className="rounded-full border border-cyan-400 px-8 py-3.5 leading-none text-white font-bold min-w-[189px] transition-all duration-300 hover:bg-cyan-400 hover:text-black cursor-pointer"
                  >
                    Book a Demo / Open Console
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 3. ROBO/OMNI GPT & JOURNEYS HIGHLIGHT */}
          <section className="space-y-6">
            <div className="overflow-hidden rounded-2xl sm:rounded-[40px] border border-white/10 bg-[#060b17] shadow-2xl relative aspect-[16/8] flex items-center justify-center">
              <video
                src="/🎬_Video_Blueprint_Visual_Mul.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#03060f] via-[#03060f]/20 to-transparent"></div>
            </div>

            <div className="space-y-4">
              <h3 className="sm:leading-[80px]">
                <span className="text-[50px] font-extrabold sm:text-[100px] lg:text-[140px] text-white">OMNI </span>
                <span className="text-[50px] font-extrabold sm:text-[100px] lg:text-[140px] text-cyan-400 font-black">GPT</span>
              </h3>

              <div className="flex">
                <button
                  onClick={handlePortalAccess}
                  className="rounded-full border border-cyan-400 px-8 py-3.5 leading-none text-white font-bold min-w-[189px] transition-colors duration-300 hover:bg-cyan-400 hover:text-black cursor-pointer"
                >
                  Explore Journeys Studio
                </button>
              </div>
            </div>
          </section>

          {/* 4. USE CASES (Bento Grid matching Orangewood layout with Generated HD Interfaces) */}
          <section className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold uppercase tracking-wider mb-3">
                  <Sparkles size={13} className="text-cyan-400 animate-pulse" />
                  <span>OmniChannel Infrastructure In Action</span>
                </div>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight">
                  Use <span className="text-cyan-400 font-medium">Cases</span>
                </h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base max-w-md">
                Production-tested broadcasting and journey sequences built for extreme scale, 99.4% SLA delivery, and zero-duplicate reliability.
              </p>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Critical Alerts (1 Col) */}
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl p-6 space-y-4">
                {/* Image showcase */}
                <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner">
                  <img
                    src="/images/use-cases/critical_alerts.jpg"
                    alt="Critical Alerts Interface"
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                    <Radio size={12} className="animate-pulse text-rose-400" />
                    <span>99.4% SLA Active</span>
                  </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 text-[11px] font-mono uppercase tracking-widest font-bold">
                    <ShieldAlert size={13} />
                    <span>Tier-1 Emergency Failover</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    CRITICAL ALERTS
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Immediate WhatsApp critical broadcast <span className="text-rose-400 font-bold">→</span> 2h delay <span className="text-cyan-400 font-bold">→</span> Secure acknowledgement email with 99.4% SLA.
                  </p>
                </div>
              </div>

              {/* Card 2: Lifecycle Nurturing (2 Col Span on lg) */}
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl p-6 col-span-1 md:col-span-2 lg:col-span-2">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  
                  {/* Left / Top Image Showcase */}
                  <div className="lg:col-span-7 relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner">
                    <img
                      src="/images/use-cases/lifecycle_nurturing.jpg"
                      alt="Lifecycle Nurturing Automation Canvas"
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                      <GitFork size={12} className="text-cyan-400" />
                      <span>30-Day Automated Trees</span>
                    </div>
                  </div>

                  {/* Right Content */}
                  <div className="lg:col-span-5 space-y-3.5">
                    <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-mono uppercase tracking-widest font-bold">
                      <Clock size={13} />
                      <span>Behavioral State Machine</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white">
                      LIFECYCLE NURTURING
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      Streamline customer onboarding with 30-day automated branching sequences, link-click triggers, and automated renewal reminders.
                    </p>

                    <div className="pt-2 space-y-2 text-xs text-slate-300 font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
                        <span>Link-click intent detection & branching</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
                        <span>Dynamic churn prevention & renewal nudges</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Zero-Duplicate Engine (1 Col) */}
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl p-6 space-y-4">
                {/* Image showcase */}
                <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner">
                  <img
                    src="/images/use-cases/zero_dup_engine.jpg"
                    alt="Zero-Dup Deduplication Engine"
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                    <Database size={12} className="text-purple-400" />
                    <span>Zero Overhead</span>
                  </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 text-[11px] font-mono uppercase tracking-widest font-bold">
                    <Database size={13} />
                    <span>Ground Truth Normalizer</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    ZERO-DUP ENGINE
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Automatic normalization against ground truth leads repository with sequential FMCB URN key generation.
                  </p>
                </div>
              </div>

              {/* Card 4: Meta Cloud WABA (1 Col) */}
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl p-6 space-y-4">
                {/* Image showcase */}
                <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner">
                  <img
                    src="/images/use-cases/meta_cloud_waba.jpg"
                    alt="Meta Cloud WABA Platform"
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                    <Smartphone size={12} className="text-emerald-400" />
                    <span>Meta Verified Badge</span>
                  </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-mono uppercase tracking-widest font-bold">
                    <CheckCircle2 size={13} />
                    <span>Direct Graph API Tier-1</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    META CLOUD WABA
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Direct Meta Graph API template submission, automated sync, dynamic variable chips, and official verified badges.
                  </p>
                </div>
              </div>

              {/* Card 5: AWS SES Dispatch (1 Col) */}
              <div className="flex flex-col justify-between overflow-hidden rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl p-6 space-y-4">
                {/* Image showcase */}
                <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner">
                  <img
                    src="/images/use-cases/aws_ses_dispatch.jpg"
                    alt="AWS SES High-Throughput Dispatch"
                    className="w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060b17] via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-sky-500/40 text-sky-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                    <Mail size={12} className="text-sky-400" />
                    <span>50k / Day Quotas</span>
                  </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 text-[11px] font-mono uppercase tracking-widest font-bold">
                    <Zap size={13} />
                    <span>Multi-SMTP Cloud Engine</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    AWS SES DISPATCH
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    50,000/day high-throughput email sending quotas with multi-SMTP failover pools and 100% TRAI DLT suppression.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* 5. TRUSTED BY INDUSTRY (Big Bold Telemetry) */}
          <section className="p-6 sm:p-12 rounded-3xl bg-[#060b17] border border-white/10 shadow-2xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-4xl sm:text-5xl md:text-6xl font-bold text-white">Trusted </span>
                <span className="text-4xl font-medium sm:text-5xl md:text-6xl text-cyan-400">By Industry</span>
              </div>
            </div>

            <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
              At the forefront of enterprise innovation, we empower organizations with real-time metrics that showcase the scale at which OmniReach broadcasting operates.
            </p>

            <div className="flex flex-col items-center text-center py-6">
              <LiveDispatchesCounter />
              <span className="mt-4 text-xl sm:text-2xl md:text-3xl font-bold text-white">
                Messages Dispatched by OmniReach Engine
              </span>
              <span className="mt-2 text-xs text-slate-500">
                Guaranteed with 99.4% SLA Delivery and strict multi-tenant corporate data isolation.
              </span>
            </div>
          </section>

          {/* 6. JOIN THE COMMUNITY & GLOBAL NETWORK */}
          <section className="py-6">
            <div className="flex flex-col items-center justify-between gap-8 lg:flex-row-reverse">
              <div className="w-full lg:w-[48%] rounded-3xl bg-[#060b17] border border-white/10 p-8 flex flex-col items-center justify-center min-h-[250px] shadow-2xl">
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
                    <Building2 size={28} />
                  </div>
                  <h4 className="text-xl font-bold text-white">Enterprise Ready</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Multi-tenant data isolation, dedicated WhatsApp Phone IDs, and custom AWS SES credentials per company partition.
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-[48%] space-y-6">
                <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
                  Join the <br />
                  <span className="text-cyan-400 font-medium">Enterprise Network</span>
                </h3>

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                  Join global companies using OmniReach to orchestrate mission-critical broadcasts across multiple communication channels with zero duplicate overhead.
                </p>

                <div>
                  <button
                    onClick={handlePortalAccess}
                    className="rounded-full border border-cyan-400 px-8 py-3.5 leading-none text-white font-bold min-w-[189px] transition-all duration-300 hover:bg-cyan-400 hover:text-black cursor-pointer"
                  >
                    Get Started Now
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 7. LUXURY FOOTER (Matching Orangewood HTML Structure) */}
      <footer className="mt-24 border-t border-white/10 bg-[#02050c] text-white py-16 px-6 sm:px-12 relative z-10">
        <div className="max-w-[1400px] mx-auto space-y-12">
          <p className="text-5xl sm:text-6xl font-bold text-white">Contact</p>

          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="space-y-4 max-w-md">
              <a href="mailto:support@omnireach.io" className="underline text-lg sm:text-xl text-cyan-300 hover:text-cyan-200">
                support@omnireach.io
              </a>
              <div className="space-y-1 text-sm text-slate-300">
                <p className="font-bold text-white">OmniReach Global Technologies Inc.</p>
                <p className="text-slate-400">Enterprise High-Throughput Broadcasting & Journey Engine</p>
                <p className="text-slate-400">Silicon Valley • Bengaluru • London • Singapore</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xl font-bold text-white">Technology Partners & Certified Infrastructure</p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
                    Meta Cloud API Tier 1
                  </span>
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-blue-300">
                    AWS SES ap-south-1
                  </span>
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300">
                    PostgreSQL 18 Multi-Tenant
                  </span>
                </div>
              </div>

              {/* Social Icons */}
              <div className="flex gap-3 pt-2">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="h-[44px] w-[44px] rounded-full border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-300 hover:text-cyan-300 transition-colors">
                  <Instagram size={18} />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="h-[44px] w-[44px] rounded-full border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-300 hover:text-cyan-300 transition-colors">
                  <Twitter size={18} />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="h-[44px] w-[44px] rounded-full border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-300 hover:text-cyan-300 transition-colors">
                  <Youtube size={18} />
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="h-[44px] w-[44px] rounded-full border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-300 hover:text-cyan-300 transition-colors">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <Link to="/unsubscribe" className="hover:text-cyan-300 transition-colors">Privacy & Opt-Out Policy</Link>
              <span>•</span>
              <Link to="/contact-center" className="hover:text-cyan-300 transition-colors">Terms of Service</Link>
            </div>
            <span>© 2026 OmniReach Global Technologies. All Rights Reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default LandingPage;
