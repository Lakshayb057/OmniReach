import React, { useEffect, useRef } from 'react';

export const ThreeHeroCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Mouse Parallax Coordinates
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    // 3D Particles & Nodes
    const particleCount = 140;
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      vx: number;
      vy: number;
      vz: number;
      color: string;
      size: number;
      label?: string;
    }> = [];

    const colors = ['#00f0ff', '#0070f3', '#38bdf8', '#60a5fa', '#818cf8'];
    const labels = ['Meta WABA', 'AWS SES', 'URN Hub', 'PostgreSQL', 'SMTP Pool', 'Journey V2', 'DLT Guard'];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 160 + Math.random() * 180;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      particles.push({
        x,
        y,
        z,
        baseX: x,
        baseY: y,
        baseZ: z,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: (Math.random() - 0.5) * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 2.5 + 1,
        label: i < 7 ? labels[i] : undefined,
      });
    }

    // 3D Orbiting Laser Signals
    const signals: Array<{
      t: number;
      speed: number;
      sourceIdx: number;
      targetIdx: number;
      color: string;
    }> = [];

    for (let i = 0; i < 18; i++) {
      signals.push({
        t: Math.random(),
        speed: 0.007 + Math.random() * 0.015,
        sourceIdx: Math.floor(Math.random() * particleCount),
        targetIdx: Math.floor(Math.random() * particleCount),
        color: i % 2 === 0 ? '#00f0ff' : '#38bdf8',
      });
    }

    let rotationX = 0;
    let rotationY = 0;
    const focalLength = 400;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      rotationY += 0.0025 + (mouseX - width / 2) * 0.00001;
      rotationX += 0.0012 + (mouseY - height / 2) * 0.00001;

      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);

      // Transform and project particles
      const projectedParticles: Array<{
        px: number;
        py: number;
        pz: number;
        scale: number;
        color: string;
        size: number;
        label?: string;
      }> = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Organic oscillation
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (Math.abs(p.x - p.baseX) > 30) p.vx *= -1;
        if (Math.abs(p.y - p.baseY) > 30) p.vy *= -1;
        if (Math.abs(p.z - p.baseZ) > 30) p.vz *= -1;

        // 3D Rotations
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;

        const y1 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX + 500;

        const scale = focalLength / Math.max(z2, 10);
        const px = x1 * scale + width / 2;
        const py = y1 * scale + height / 2;

        projectedParticles.push({
          px,
          py,
          pz: z2,
          scale,
          color: p.color,
          size: p.size,
          label: p.label,
        });
      }

      // Draw connecting neural constellation lines
      ctx.lineWidth = 0.6;
      for (let i = 0; i < projectedParticles.length; i++) {
        for (let j = i + 1; j < projectedParticles.length; j++) {
          const p1 = projectedParticles[i];
          const p2 = projectedParticles[j];

          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 85) {
            const alpha = (1 - dist / 85) * 0.25;
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
          }
        }
      }

      // Draw 3D Orbiting Laser Signals
      for (const sig of signals) {
        sig.t += sig.speed;
        if (sig.t > 1) {
          sig.t = 0;
          sig.sourceIdx = Math.floor(Math.random() * particleCount);
          sig.targetIdx = Math.floor(Math.random() * particleCount);
        }

        const p1 = projectedParticles[sig.sourceIdx];
        const p2 = projectedParticles[sig.targetIdx];

        if (p1 && p2) {
          const sx = p1.px + (p2.px - p1.px) * sig.t;
          const sy = p1.py + (p2.py - p1.py) * sig.t;

          ctx.fillStyle = sig.color;
          ctx.shadowColor = sig.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Render projected 3D nodes
      for (const p of projectedParticles) {
        const radius = Math.max(p.size * p.scale * 0.75, 0.8);
        const alpha = Math.min(Math.max((600 - p.pz + 200) / 700, 0.15), 0.95);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
        ctx.fill();

        // Node Glow & Hologram Labels
        if (p.label) {
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(p.px, p.py, radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(p.label, p.px + 8, p.py + 3);
        }

        ctx.globalAlpha = 1.0;
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full h-full absolute inset-0 pointer-events-none overflow-hidden select-none">
      <canvas ref={canvasRef} className="w-full h-full block opacity-90" />
    </div>
  );
};
