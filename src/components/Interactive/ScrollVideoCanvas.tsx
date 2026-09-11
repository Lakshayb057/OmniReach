import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
  Layers,
  Send,
  Smartphone,
  Mail,
  ShieldCheck,
  Zap,
  Activity,
  Maximize2,
} from 'lucide-react';

interface ScrollVideoCanvasProps {
  scrollProgress?: number;
}

export const ScrollVideoCanvas: React.FC<ScrollVideoCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames] = useState(300);
  const [activeStage, setActiveStage] = useState(1);
  const [fps, setFps] = useState(60);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Animation Loop State
  const frameRef = useRef(0);
  const isPlayingRef = useRef(true);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Track window scroll to synchronize frame progress
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || isScrubbing) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate visibility progress within viewport
      const start = windowHeight;
      const end = -rect.height;
      const current = rect.top;
      
      const progress = Math.min(Math.max((start - current) / (start - end), 0), 1);
      const targetFrame = Math.floor(progress * (totalFrames - 1));
      
      if (!isPlayingRef.current) {
        frameRef.current = targetFrame;
        setCurrentFrame(targetFrame);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [totalFrames, isScrubbing]);

  // Main Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const render = (time: number) => {
      // FPS Counter calculation
      frameCount++;
      if (time - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = time;
      }

      if (isPlayingRef.current) {
        frameRef.current = (frameRef.current + 1) % totalFrames;
        setCurrentFrame(frameRef.current);
      }

      const frame = frameRef.current;
      const progress = frame / totalFrames;

      // Update active stage
      if (progress < 0.25) setActiveStage(1);
      else if (progress < 0.5) setActiveStage(2);
      else if (progress < 0.75) setActiveStage(3);
      else setActiveStage(4);

      // Canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Clear background with obsidian gradient
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Futuristic Grid Lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Draw Ambient Glow Orbs
      const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 320);
      glowGrad.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
      glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.08)');
      glowGrad.addColorStop(1, 'rgba(7, 11, 20, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 4. Central OmniReach Node
      const pulse = Math.sin(frame * 0.08) * 6;
      ctx.save();
      ctx.translate(cx, cy);

      // Rotating Outer Hexagon / Tech Rings
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 70 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 85 - pulse, frame * 0.02, frame * 0.02 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central Glowing Core
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
      coreGrad.addColorStop(0, '#3b82f6');
      coreGrad.addColorStop(0.7, '#1d4ed8');
      coreGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Core Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OMNIREACH', 0, -6);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('BROADCAST HUB', 0, 10);
      ctx.restore();

      // 5. Surrounding Satellite Nodes
      const nodes = [
        { id: 'leads', name: 'Master Data Hub', sub: 'Zero-Duplicate & URN', angle: -Math.PI * 0.75, dist: 220, color: '#a855f7' },
        { id: 'meta', name: 'Meta WhatsApp WABA', sub: '+91 98765 43210 (GREEN)', angle: -Math.PI * 0.25, dist: 220, color: '#10b981' },
        { id: 'ses', name: 'AWS SES / Multi-SMTP', sub: '500K Quota • ap-south-1', angle: Math.PI * 0.25, dist: 220, color: '#3b82f6' },
        { id: 'ctr', name: 'Universal CTR & Opt-in', sub: 'TRAI / DLT Compliance', angle: Math.PI * 0.75, dist: 220, color: '#f43f5e' },
      ];

      nodes.forEach((node, i) => {
        const nx = cx + Math.cos(node.angle) * node.dist;
        const ny = cy + Math.sin(node.angle) * node.dist;

        // Connecting Laser Circuit Lines
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        // Traveling Energy Packets
        const packetCount = 3;
        for (let p = 0; p < packetCount; p++) {
          const packetOffset = ((frame * 2 + p * (totalFrames / packetCount)) % totalFrames) / totalFrames;
          const px = cx + (nx - cx) * packetOffset;
          const py = cy + (ny - cy) * packetOffset;

          ctx.fillStyle = node.color;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Node Box
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        const nw = 160;
        const nh = 54;
        const bx = nx - nw / 2;
        const by = ny - nh / 2;

        ctx.beginPath();
        ctx.roundRect(bx, by, nw, nh, 12);
        ctx.fill();
        ctx.stroke();

        // Node Texts
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, nx, ny - 6);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(node.sub, nx, ny + 10);
      });

      // 6. Stage-Specific Animated Graphics Overlay
      ctx.save();
      if (activeStage === 1) {
        // Stage 1: Zero-Duplicate URN Matching
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - 150, height - 75, 300, 45, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e9d5ff';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ MATCHING: Ground Truth URN -> FM2026A0100001', cx, height - 56);
        ctx.fillStyle = '#c084fc';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Zero-Duplicate Upsert Verified • Phone Indexed', cx, height - 40);
      } else if (activeStage === 2) {
        // Stage 2: Dynamic Template Merge Tags
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - 160, height - 75, 320, 45, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#bfdbfe';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔄 RESOLVING: {name} -> Rahul Sharma | Limit: ₹5L', cx, height - 56);
        ctx.fillStyle = '#60a5fa';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Meta Graph API Template Synced • DKIM Signed', cx, height - 40);
      } else if (activeStage === 3) {
        // Stage 3: 5s Poller Dispatch & High-Speed Batch
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - 150, height - 75, 300, 45, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🚀 DISPATCHING: 100 msgs/sec Batch Transmission', cx, height - 56);
        ctx.fillStyle = '#34d399';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('5-Second Poller Active • Cooldown Safeguard Active', cx, height - 40);
      } else {
        // Stage 4: Universal CTR Tracking & Unsubscribe
        ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - 150, height - 75, 300, 45, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fecdd3';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 CTR INTERCEPTED: /api/c/t/... -> 302 Redirect', cx, height - 56);
        ctx.fillStyle = '#fb7185';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('1-Click Unsubscribe & Preference Sync Live', cx, height - 40);
      }
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [totalFrames, activeStage]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    frameRef.current = val;
    setCurrentFrame(val);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-3xl overflow-hidden bg-[#070b14] border border-slate-800 shadow-2xl group"
    >
      {/* Video HUD Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-[#070b14]/90 via-[#070b14]/50 to-transparent z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-3 pointer-events-auto">
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-semibold">
            <Radio size={12} className="animate-pulse text-blue-400" />
            <span>LIVE VIDEO GRAPHICAL STREAM</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            FRAME: <span className="text-white font-bold">{String(currentFrame).padStart(3, '0')}</span> / {totalFrames}
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 pointer-events-auto">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            {fps} FPS
          </span>
          <span className="px-2 py-0.5 rounded bg-[#0f172a] border border-slate-800 text-slate-300">
            4K UHD SIMULATOR
          </span>
        </div>
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-[320px] sm:h-[420px] md:h-[500px] object-cover bg-[#070b14] block"
      />

      {/* Video Control Bar */}
      <div className="p-4 bg-[#0b0f19] border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-colors shrink-0"
            title={isPlaying ? 'Pause Animation' : 'Play Animation'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={() => {
              frameRef.current = 0;
              setCurrentFrame(0);
            }}
            className="w-9 h-9 rounded-xl bg-[#0f172a] hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition-colors shrink-0"
            title="Reset Frame"
          >
            <RotateCcw size={15} />
          </button>
          <div className="text-xs text-slate-300 font-semibold truncate">
            {activeStage === 1 && 'Stage 1: Zero-Duplicate Ground Truth URN Ingestion'}
            {activeStage === 2 && 'Stage 2: Meta Graph API & Dynamic Token Studio'}
            {activeStage === 3 && 'Stage 3: 5s Poller Dispatch & Multi-Gateway Blast'}
            {activeStage === 4 && 'Stage 4: Universal CTR Clicks & Regulatory Opt-in'}
          </div>
        </div>

        {/* Video Scrubber Slider */}
        <div className="flex items-center space-x-3 w-full sm:w-72">
          <span className="text-[10px] font-mono text-slate-500">SCRUB</span>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentFrame}
            onChange={handleScrub}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            onTouchStart={() => setIsScrubbing(true)}
            onTouchEnd={() => setIsScrubbing(false)}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <span className="text-[10px] font-mono text-blue-400 font-bold">
            {Math.round((currentFrame / totalFrames) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
