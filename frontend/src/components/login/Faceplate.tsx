'use client';

import { ReactNode, useState, useRef, MouseEvent } from 'react';
import { ShieldCheck, Activity, Radio, Cpu } from 'lucide-react';

interface FaceplateProps {
  children: ReactNode;
}

/**
 * Premium Machined Heavy-Duty Enamel Control Faceplate.
 * Features 3D dynamic tilt, telemetry status bar, metallic hex bolts,
 * brushed aluminum texture, and chamfered lit edges.
 */
export default function Faceplate({ children }: FaceplateProps) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    // Limit rotation angle to 6 degrees max for subtle luxury depth
    const rotateX = (-mouseY / (rect.height / 2)) * 5;
    const rotateY = (mouseX / (rect.width / 2)) * 5;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div className="faceplate-wrapper relative flex items-center justify-center p-2 sm:p-4 perspective-1000">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transition: 'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="faceplate relative w-full max-w-[460px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900/90 text-slate-100"
      >
        {/* Machined Corner Hex Screws */}
        <span className="fp-screw fp-screw-tl" aria-hidden />
        <span className="fp-screw fp-screw-tr" aria-hidden />
        <span className="fp-screw fp-screw-bl" aria-hidden />
        <span className="fp-screw fp-screw-br" aria-hidden />

        {/* Lit Chamfer Top Edge Highlight */}
        <div className="fp-top-bevel" aria-hidden />

        {/* Industrial Telemetry Bar */}
        <div className="fp-telemetry flex items-center justify-between border-b border-slate-700/60 bg-slate-950/60 px-5 py-2.5 text-[10.5px] font-mono tracking-wider text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-semibold text-cyan-300">HUB-01</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Cpu size={12} className="text-sky-400" />
              ONLINE
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <Activity size={12} className="text-emerald-400" />
              4.2 BAR
            </span>
            <span className="flex items-center gap-1">
              <Radio size={12} className="text-cyan-400" />
              99%
            </span>
          </div>
        </div>

        {/* Main Content Card Container */}
        <div className="fp-card p-6 sm:p-8 relative z-10">{children}</div>

        {/* Bottom Security / Authenticity Seal */}
        <div className="border-t border-slate-800/80 bg-slate-950/40 px-6 py-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500 select-none">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck size={13} className="text-cyan-400" />
            <span>AUTHENTICATED OPERATOR PORTAL</span>
          </div>
          <span className="tracking-widest text-slate-600">v2.5.0-PRO</span>
        </div>
      </div>
    </div>
  );
}

