'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplets,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Coins,
  Undo2,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  VEHICLE TYPES (POPULAR PH VEHICLES)                               */
/* ------------------------------------------------------------------ */
type VehicleType = 'motorcycle' | 'sedan' | 'suv';

const VEHICLES: VehicleType[] = ['motorcycle', 'sedan', 'suv'];

/* ------------------------------------------------------------------ */
/*  BUBBLES GENERATOR                                                 */
/* ------------------------------------------------------------------ */
function useAtmosphericParticles(bubbleCount: number) {
  return useMemo(
    () =>
      Array.from({ length: bubbleCount }, (_, i) => ({
        id: `bubble-${i}`,
        left: 3 + (i * 94) / bubbleCount + ((i * 7) % 6 - 3),
        size: 10 + (i % 5) * 6 + ((i * 3) % 6),
        duration: 10 + (i % 6) * 3 + ((i * 5) % 4),
        delay: (i * 0.7) % 7,
      })),
    [bubbleCount]
  );
}

/* ================================================================== */
/*  WELCOME OVERLAY BUBBLES (deterministic, SSR-safe)                 */
/* ================================================================== */
const WELCOME_BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  left: 4 + i * 6.8,
  size: 8 + ((i * 13) % 26),
  duration: 4 + (i % 5),
  delay: (i * 0.45) % 3,
}));

/* ================================================================== */
/*  WASH STAGE STORYTELLING (synced to the 8s gantry sweep)           */
/* ================================================================== */
const WASH_STAGES = [
  { label: 'PRE-RINSE', color: '#38BDF8' },
  { label: 'FOAM BATH', color: '#F8FAFC' },
  { label: 'SCRUB MODE', color: '#F59E0B' },
  { label: 'RINSE CYCLE', color: '#22D3EE' },
  { label: 'AIR DRY', color: '#A5F3FC' },
];

/* ================================================================== */
/*  LOGIN PAGE COMPONENT                                              */
/* ================================================================== */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [credits, setCredits] = useState(0);
  const [coinAnim, setCoinAnim] = useState(false);
  const [returning, setReturning] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [slotGlow, setSlotGlow] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  // Automatic vehicle transition state
  const [activeVehicleIdx, setActiveVehicleIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const router = useRouter();
  const bubbles = useAtmosphericParticles(16);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    // Restore remembered email
    const remembered = localStorage.getItem('remembered_email');
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }

    // Wash-stage storytelling — 5 stages x 1.6s = 8s, synced to the gantry sweep
    const stageTimer = setInterval(() => {
      setStageIdx((prev) => (prev + 1) % WASH_STAGES.length);
    }, 1600);

    // Automatic smooth vehicle changing cycle
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveVehicleIdx((prev) => (prev + 1) % VEHICLES.length);
        setIsTransitioning(false);
      }, 650);
    }, 5500);

    return () => {
      clearInterval(interval);
      clearInterval(stageTimer);
    };
  }, []);

  const currentVehicleType = VEHICLES[activeVehicleIdx];
  const formReady = email.includes('@') && password.trim().length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || coinAnim || welcomeName) return;
    setError('');
    setRejected(false);

    // Coin drops into the slot before the machine processes the sign-in
    setCoinAnim(true);
    setTimeout(async () => {
      setCoinAnim(false);
      setCredits((c) => c + 20);
      setIsLoading(true);

      try {
        const auth = await api.login(email, password);
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        // Celebrate with a welcome animation before entering the hub
        const name: string = auth?.user?.full_name || auth?.user?.username || 'Administrator';
        setWelcomeName(name);
        setTimeout(() => router.push('/'), 2600);
      } catch {
        setRejected(true);
        setError('INVALID COIN — REJECTED');
        setTimeout(() => setRejected(false), 600);
        setIsLoading(false);
      }
    }, 750);
  };

  const handleCoinReturn = () => {
    if (returning) return;
    setReturning(true);
    setCredits(0);
    setTimeout(() => setReturning(false), 1000);
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030712] text-white flex flex-col justify-between select-none">
      {/* ============================================================ */}
      {/* 1. LAYER: SIDE-PROFILE 3D CAR WASH & VEHICLE SCENE           */}
      {/* ============================================================ */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none perspective-stage">
        {/* Blueprint grid */}
        <div className="absolute inset-0 blueprint-grid opacity-70" />

        {/* Ambient atmospheric vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 65%, rgba(0, 180, 216, 0.18) 0%, rgba(4, 11, 28, 0.8) 50%, #030712 90%)',
          }}
        />

        {/* ============================================================ */}
        {/* SIDE-PROFILE SVG CAR WASH (SWEEPING GANTRY & CHANGING CARS)  */}
        {/* ============================================================ */}
        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full object-cover"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Neon Glow Filter */}
            <filter id="neonGlowSide" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur1" />
              <feGaussianBlur stdDeviation="15" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft glow for headlights */}
            <filter id="headlightGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* High Pressure Downward Water Spray */}
            <linearGradient id="downSprayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#00B4D8" stopOpacity="0.75" />
              <stop offset="85%" stopColor="#90E0EF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
            </linearGradient>

            {/* High Pressure Angled Jets */}
            <linearGradient id="angledJetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#00B4D8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="angledJetRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#00B4D8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.05" />
            </linearGradient>

            {/* ─── GANTRY METALLIC GRADIENTS ─── */}
            <linearGradient id="gantrySteel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="20%" stopColor="#1E293B" />
              <stop offset="45%" stopColor="#334155" />
              <stop offset="55%" stopColor="#475569" />
              <stop offset="80%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            <linearGradient id="gantryTopBeam" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            <linearGradient id="gantrySteelWet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="30%" stopColor="#334155" />
              <stop offset="50%" stopColor="#475569" />
              <stop offset="70%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            {/* Wet Floor Track Gradient */}
            <linearGradient id="sideFloorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="30%" stopColor="#090E1D" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>

            {/* ─── VEHICLE PAINT GRADIENTS (Realistic Metallic) ─── */}
            {/* Honda Click 125i — Candy Red Metallic */}
            <linearGradient id="motoRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4444" />
              <stop offset="25%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="75%" stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </linearGradient>
            <linearGradient id="motoRedHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>

            {/* Toyota Vios — Pearl White */}
            <linearGradient id="sedanPaintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="20%" stopColor="#F8FAFC" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="75%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <linearGradient id="sedanPaintLower" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            {/* Toyota Fortuner — Attitude Blue Mica */}
            <linearGradient id="suvPaintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="25%" stopColor="#0284C7" />
              <stop offset="55%" stopColor="#0369A1" />
              <stop offset="80%" stopColor="#075985" />
              <stop offset="100%" stopColor="#0C4A6E" />
            </linearGradient>
            <linearGradient id="suvPaintHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
            </linearGradient>

            {/* ─── SHARED VEHICLE COMPONENT GRADIENTS ─── */}
            {/* Rubber tire */}
            <radialGradient id="tireRubber" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="60%" stopColor="#0F172A" />
              <stop offset="85%" stopColor="#0B0F19" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>

            {/* Alloy wheel face */}
            <radialGradient id="alloyFace" cx="40%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="40%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </radialGradient>

            {/* Chrome trim */}
            <linearGradient id="chromeTrim" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="30%" stopColor="#CBD5E1" />
              <stop offset="50%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            {/* Window glass tint */}
            <linearGradient id="windowTint" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0C4A6E" />
              <stop offset="30%" stopColor="#082F49" />
              <stop offset="60%" stopColor="#0A3A5C" />
              <stop offset="100%" stopColor="#064E7A" />
            </linearGradient>
            <linearGradient id="windowReflection" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Disc brake */}
            <radialGradient id="discBrake" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#64748B" />
              <stop offset="80%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </radialGradient>

            {/* Exhaust chrome */}
            <linearGradient id="exhaustChrome" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="30%" stopColor="#94A3B8" />
              <stop offset="50%" stopColor="#CBD5E1" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Brush spindle */}
            <linearGradient id="brushSpindleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* Underbody / chassis */}
            <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>


          {/* ────────────────────────────────────────────────────────── */}
          {/* BACKGROUND WASH BAY WALLS & STRUCTURE                     */}
          {/* ────────────────────────────────────────────────────────── */}
          <rect x="0" y="150" width="1600" height="520" fill="#060C1B" />
          <line x1="0" y1="280" x2="1600" y2="280" stroke="#0F1E36" strokeWidth="2" />
          <line x1="0" y1="440" x2="1600" y2="440" stroke="#0F1E36" strokeWidth="2" />

          {/* Vertical Structural Pylons */}
          {[150, 450, 750, 1050, 1350].map((x) => (
            <g key={`wall-beam-${x}`}>
              <rect x={x} y="150" width="24" height="520" fill="#0A1428" stroke="#122442" strokeWidth="1" />
              <circle cx={x + 12} cy="220" r="3" fill="#00B4D8" opacity="0.3" />
              <circle cx={x + 12} cy="380" r="3" fill="#00B4D8" opacity="0.3" />
              <circle cx={x + 12} cy="540" r="3" fill="#00B4D8" opacity="0.3" />
            </g>
          ))}

          {/* Overhead Water Supply Lines */}
          <line x1="0" y1="210" x2="1600" y2="210" stroke="#1E293B" strokeWidth="10" />
          <line x1="0" y1="225" x2="1600" y2="225" stroke="#0284C7" strokeWidth="4" opacity="0.8" />
          <line x1="0" y1="235" x2="1600" y2="235" stroke="#38BDF8" strokeWidth="2" opacity="0.4" />

          {/* ────────────────────────────────────────────────────────── */}
          {/* CONVEYOR TRACK & WET FLOOR                                */}
          {/* ────────────────────────────────────────────────────────── */}
          <rect x="0" y="670" width="1600" height="230" fill="url(#sideFloorGrad)" />
          <rect x="0" y="670" width="1600" height="18" fill="#020617" stroke="#1E293B" strokeWidth="2" />
          <line x1="0" y1="679" x2="1600" y2="679" stroke="#00B4D8" strokeWidth="2" strokeDasharray="10 8" opacity="0.5" className="animate-conveyor" />

          <rect x="0" y="688" width="1600" height="26" fill="#0B132B" stroke="#334155" strokeWidth="2" />
          <line x1="0" y1="701" x2="1600" y2="701" stroke="#F59E0B" strokeWidth="3" strokeDasharray="24 16" opacity="0.8" className="animate-conveyor" />

            {/* Wet-floor light reflection tracking the gantry */}
            <ellipse cx="0" cy="668" rx="110" ry="9" fill="#38BDF8" opacity="0.3" filter="url(#neonGlowSide)" className="animate-reflection-sweep" />

          {[100, 250, 400, 550, 700, 850, 1000, 1150, 1300, 1450].map((rx) => (
            <circle key={`roller-${rx}`} cx={rx} cy="701" r="7" fill="#1E293B" stroke="#64748B" strokeWidth="2" />
          ))}

          {/* Puddle Reflections */}
          <ellipse cx="800" cy="740" rx="550" ry="35" fill="#00B4D8" opacity="0.1" filter="url(#neonGlowSide)" />
          <ellipse cx="800" cy="745" rx="350" ry="20" fill="#38BDF8" opacity="0.14" />

          {/* ────────────────────────────────────────────────────────── */}
          {/* DYNAMIC VEHICLE WITH SMOOTH TRANSITION (DRIVE IN / OUT)    */}
          {/* ────────────────────────────────────────────────────────── */}
          <g id="active-vehicle-container" transform="translate(800, 670)">
            <g className={isTransitioning ? 'animate-vehicle-out' : 'animate-vehicle-in'}>
            {/* 1. POPULAR PHILIPPINE SCOOTER (HONDA CLICK 125i) */}
            {currentVehicleType === 'motorcycle' && (
              <g id="ph-scooter-125cc">
                {/* Shadow */}
                <ellipse cx="0" cy="-2" rx="160" ry="12" fill="#000000" opacity="0.85" />
                <ellipse cx="0" cy="4" rx="120" ry="7" fill="#00B4D8" opacity="0.22" filter="url(#neonGlowSide)" />

                {/* Rear 14-inch Cast Wheel */}
                <g transform="translate(-115, -42)">
                  <circle cx="0" cy="0" r="38" fill="#0F172A" stroke="#1E293B" strokeWidth="6" />
                  <circle cx="0" cy="0" r="30" fill="#030712" stroke="#334155" strokeWidth="2" />
                  <g className="animate-tire-spin">
                    <line x1="-28" y1="0" x2="28" y2="0" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="0" y1="-28" x2="0" y2="28" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="-20" y1="-20" x2="20" y2="20" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="20" y1="-20" x2="-20" y2="20" stroke="#00B4D8" strokeWidth="2.5" />
                  </g>
                  <circle cx="0" cy="0" r="10" fill="#475569" stroke="#94A3B8" strokeWidth="1.5" />
                </g>

                {/* Front 14-inch Cast Wheel & Disc */}
                <g transform="translate(115, -42)">
                  <circle cx="0" cy="0" r="38" fill="#0F172A" stroke="#1E293B" strokeWidth="6" />
                  <circle cx="0" cy="0" r="30" fill="#030712" stroke="#334155" strokeWidth="2" />
                  <circle cx="0" cy="0" r="20" fill="none" stroke="#94A3B8" strokeWidth="3" strokeDasharray="5 3" />
                  <rect x="12" y="-12" width="10" height="14" rx="2" fill="#F59E0B" />
                  <g className="animate-tire-spin">
                    <line x1="-28" y1="0" x2="28" y2="0" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="0" y1="-28" x2="0" y2="28" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="-20" y1="-20" x2="20" y2="20" stroke="#00B4D8" strokeWidth="2.5" />
                    <line x1="20" y1="-20" x2="-20" y2="20" stroke="#00B4D8" strokeWidth="2.5" />
                  </g>
                  <circle cx="0" cy="0" r="10" fill="#475569" stroke="#94A3B8" strokeWidth="1.5" />
                </g>

                {/* Telescopic Front Forks */}
                <line x1="115" y1="-42" x2="88" y2="-125" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                <line x1="112" y1="-42" x2="85" y2="-125" stroke="#334155" strokeWidth="3" />
                <path d="M 80 -65 C 95 -90 140 -85 150 -55" fill="none" stroke="url(#motoRedGrad)" strokeWidth="8" strokeLinecap="round" />

                {/* Engine Crankcase */}
                <rect x="-115" y="-55" width="85" height="30" rx="8" fill="#1E293B" stroke="#334155" strokeWidth="2" />
                <circle cx="-90" cy="-40" r="8" fill="#0F172A" />

                {/* Rear Shock */}
                <line x1="-95" y1="-50" x2="-75" y2="-110" stroke="#EF4444" strokeWidth="5" strokeDasharray="3 3" />

                {/* Upswept Muffler */}
                <path d="M -70 -35 L -10 -40 L -120 -60 L -130 -48 Z" fill="#18181B" stroke="#3F3F46" strokeWidth="1.5" />
                <polygon points="-125,-60 -105,-63 -102,-52 -122,-49" fill="#00B4D8" opacity="0.8" />
                <line x1="-95" y1="-53" x2="-25" y2="-40" stroke="#71717A" strokeWidth="3" />

                {/* Underbody & Deck */}
                <path d="M -70 -50 L 55 -50 L 70 -80 L -40 -75 Z" fill="#0F172A" stroke="#1E293B" strokeWidth="1.5" />
                <polygon points="-25,-75 45,-75 55,-95 20,-95" fill="#1E293B" />

                {/* Main Body Fairing */}
                <path
                  d="M 60 -75 L 115 -125 L 125 -145 L 90 -150 L 60 -115 L 20 -95 L -35 -95 L -95 -125 L -140 -125 L -110 -90 L -50 -80 Z"
                  fill="url(#motoRedGrad)"
                  stroke="#DC2626"
                  strokeWidth="2"
                />

                {/* Front Headlight Visor & Dual LED */}
                <polygon points="115,-125 140,-132 125,-155 90,-150" fill="#0F172A" />
                <polygon points="120,-130 138,-134 130,-144 118,-140" fill="#E0F2FE" filter="url(#neonGlowSide)" />
                <line x1="125" y1="-132" x2="134" y2="-139" stroke="#38BDF8" strokeWidth="2" />

                {/* Tinted Sport Windscreen */}
                <path d="M 92 -150 L 114 -170 L 122 -146 L 100 -138 Z" fill="#0EA5E9" opacity="0.4" stroke="#7DD3FC" strokeWidth="1.2" />
                <path d="M 96 -150 L 113 -164" stroke="#E0F2FE" strokeWidth="1" opacity="0.6" fill="none" />

                {/* Headlight Beam Cone */}
                <polygon points="126,-136 226,-152 226,-114 130,-124" fill="#E0F2FE" opacity="0.12" />
                <polygon points="126,-136 196,-146 196,-124 130,-126" fill="#E0F2FE" opacity="0.1" />

                {/* Stepped Seat */}
                <path
                  d="M 15 -97 C -10 -118 -50 -125 -95 -127 C -115 -128 -135 -125 -135 -120 C -135 -115 -110 -110 -80 -105 L 10 -95 Z"
                  fill="#18181B"
                  stroke="#27272A"
                  strokeWidth="2"
                />
                <path d="M 5 -100 C -20 -118 -60 -123 -115 -123" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 2" />

                {/* Handlebars & Mirror */}
                <path d="M 85 -145 L 80 -168 L 65 -168" fill="none" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
                <circle cx="65" cy="-168" r="4" fill="#1E293B" />
                <path d="M 80 -165 L 92 -185 L 105 -188" fill="none" stroke="#64748B" strokeWidth="2" />
                <polygon points="102,-192 115,-188 112,-180 99,-184" fill="#0284C7" stroke="#38BDF8" strokeWidth="1" />

                {/* Philippine Badge */}
                <text x="-45" y="-102" fill="#FFFFFF" fontSize="8" fontWeight="900" fontFamily="sans-serif" fontStyle="italic">CLICK</text>
                <text x="-15" y="-102" fill="#38BDF8" fontSize="7" fontWeight="bold" fontFamily="sans-serif">125i</text>
              </g>
            )}

            {/* 2. MODERN AERODYNAMIC SEDAN */}
            {currentVehicleType === 'sedan' && (
              <g id="ph-sedan-vios">
                <ellipse cx="0" cy="-2" rx="240" ry="14" fill="#000000" opacity="0.85" />
                <ellipse cx="0" cy="5" rx="200" ry="9" fill="#00B4D8" opacity="0.22" filter="url(#neonGlowSide)" />

                {/* Rear Wheel */}
                <g transform="translate(-140, -42)">
                  <circle cx="0" cy="0" r="42" fill="#0B0F19" stroke="#1E293B" strokeWidth="8" />
                  <circle cx="0" cy="0" r="33" fill="#030712" stroke="#475569" strokeWidth="2" />
                  <g className="animate-tire-spin">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => (
                      <line
                        key={`sedan-rw-${ang}`}
                        x1="0"
                        y1="0"
                        x2={30 * Math.cos((ang * Math.PI) / 180)}
                        y2={30 * Math.sin((ang * Math.PI) / 180)}
                        stroke="#E2E8F0"
                        strokeWidth="2.5"
                      />
                    ))}
                  </g>
                  <circle cx="0" cy="0" r="11" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
                  <circle cx="0" cy="0" r="4" fill="#00B4D8" />
                </g>

                {/* Front Wheel */}
                <g transform="translate(140, -42)">
                  <circle cx="0" cy="0" r="42" fill="#0B0F19" stroke="#1E293B" strokeWidth="8" />
                  <circle cx="0" cy="0" r="33" fill="#030712" stroke="#475569" strokeWidth="2" />
                  <g className="animate-tire-spin">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => (
                      <line
                        key={`sedan-fw-${ang}`}
                        x1="0"
                        y1="0"
                        x2={30 * Math.cos((ang * Math.PI) / 180)}
                        y2={30 * Math.sin((ang * Math.PI) / 180)}
                        stroke="#E2E8F0"
                        strokeWidth="2.5"
                      />
                    ))}
                  </g>
                  <circle cx="0" cy="0" r="11" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
                  <circle cx="0" cy="0" r="4" fill="#00B4D8" />
                </g>

                {/* Sill */}
                <path d="M -195 -45 L -100 -45 L -90 -45 L 90 -45 L 100 -45 L 195 -45 L 210 -40 L -210 -40 Z" fill="#1E293B" />

                {/* Body Shell */}
                <path
                  d="M -235 -48 L -240 -70 C -240 -85 -215 -95 -180 -98 L -120 -100 L -60 -150 C -30 -160 50 -160 85 -150 L 155 -100 L 220 -88 C 240 -82 248 -70 245 -48 Z"
                  fill="url(#sedanPaintGrad)"
                  stroke="#475569"
                  strokeWidth="2"
                />

                {/* Tinted Windows */}
                <path
                  d="M -55 -145 L 75 -145 L 140 -102 L -105 -102 Z"
                  fill="#0369A1"
                  opacity="0.85"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                />
                <rect x="15" y="-145" width="10" height="43" fill="#0F172A" />
                <polygon points="-40,-142 -10,-142 30,-105 0,-105" fill="#FFFFFF" opacity="0.25" />

                {/* Headlight & Taillight */}
                <polygon points="230,-82 245,-70 225,-60 215,-75" fill="#E0F2FE" filter="url(#neonGlowSide)" />
                <polygon points="-232,-85 -240,-72 -225,-68 -220,-82" fill="#EF4444" filter="url(#neonGlowSide)" />

                {/* Taillight Glow Bloom */}
                <ellipse cx="-234" cy="-76" rx="16" ry="7" fill="#EF4444" opacity="0.35" filter="url(#neonGlowSide)" />
                {/* Belt-line Chrome Accent */}
                <path d="M -180 -98 L 155 -100 L 220 -88" fill="none" stroke="#E2E8F0" strokeWidth="1.5" opacity="0.5" />
                {/* Headlight Beam Cone */}
                <polygon points="240,-74 336,-88 336,-56 242,-66" fill="#E0F2FE" opacity="0.1" />

                {/* Door Handles */}
                <line x1="-120" y1="-85" x2="160" y2="-85" stroke="#F8FAFC" strokeWidth="1.5" opacity="0.6" />
                <rect x="-40" y="-88" width="16" height="4" rx="2" fill="#334155" stroke="#94A3B8" strokeWidth="1" />
                <rect x="45" y="-88" width="16" height="4" rx="2" fill="#334155" stroke="#94A3B8" strokeWidth="1" />
                <polygon points="105,-105 120,-115 110,-100" fill="#334155" stroke="#64748B" strokeWidth="1" />
              </g>
            )}

            {/* 3. MID-SIZE SUV */}
            {currentVehicleType === 'suv' && (
              <g id="ph-suv-fortuner">
                <ellipse cx="0" cy="-2" rx="255" ry="16" fill="#000000" opacity="0.9" />
                <ellipse cx="0" cy="6" rx="215" ry="10" fill="#00B4D8" opacity="0.22" filter="url(#neonGlowSide)" />

                {/* Rear SUV Wheel */}
                <g transform="translate(-145, -48)">
                  <circle cx="0" cy="0" r="48" fill="#0F172A" stroke="#1E293B" strokeWidth="10" />
                  <circle cx="0" cy="0" r="36" fill="#030712" stroke="#334155" strokeWidth="2" />
                  <g className="animate-tire-spin">
                    {[0, 60, 120, 180, 240, 300].map((ang) => (
                      <polygon
                        key={`suv-rw-${ang}`}
                        points="0,0 8,-32 -8,-32"
                        transform={`rotate(${ang})`}
                        fill="#94A3B8"
                        stroke="#475569"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                  <circle cx="0" cy="0" r="14" fill="#1E293B" stroke="#00B4D8" strokeWidth="2" />
                </g>

                {/* Front SUV Wheel */}
                <g transform="translate(145, -48)">
                  <circle cx="0" cy="0" r="48" fill="#0F172A" stroke="#1E293B" strokeWidth="10" />
                  <circle cx="0" cy="0" r="36" fill="#030712" stroke="#334155" strokeWidth="2" />
                  <g className="animate-tire-spin">
                    {[0, 60, 120, 180, 240, 300].map((ang) => (
                      <polygon
                        key={`suv-fw-${ang}`}
                        points="0,0 8,-32 -8,-32"
                        transform={`rotate(${ang})`}
                        fill="#94A3B8"
                        stroke="#475569"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                  <circle cx="0" cy="0" r="14" fill="#1E293B" stroke="#00B4D8" strokeWidth="2" />
                </g>

                {/* Step Board */}
                <rect x="-85" y="-46" width="170" height="7" rx="3" fill="#334155" stroke="#64748B" strokeWidth="1" />

                {/* Body Silhouette */}
                <path
                  d="M -245 -55 L -250 -115 C -250 -125 -235 -135 -205 -138 L -165 -140 L -95 -180 C -70 -185 45 -185 75 -180 L 150 -125 L 235 -110 C 255 -100 258 -80 252 -55 Z"
                  fill="url(#suvPaintGrad)"
                  stroke="#0284C7"
                  strokeWidth="2"
                />

                {/* Roof Rails */}
                <line x1="-120" y1="-185" x2="60" y2="-185" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
                <line x1="-100" y1="-185" x2="-100" y2="-180" stroke="#94A3B8" strokeWidth="3" />
                <line x1="40" y1="-185" x2="40" y2="-180" stroke="#94A3B8" strokeWidth="3" />

                {/* Cabin Glass */}
                <path
                  d="M -90 -175 L 65 -175 L 135 -128 L -150 -128 Z"
                  fill="#082F49"
                  opacity="0.9"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                />
                <rect x="-30" y="-175" width="12" height="47" fill="#0F172A" />
                <rect x="40" y="-175" width="10" height="47" fill="#0F172A" />

                {/* Headlight & Taillight */}
                <polygon points="238,-105 252,-90 235,-80 225,-95" fill="#E0F2FE" filter="url(#neonGlowSide)" />
                <polygon points="-242,-110 -250,-95 -238,-90 -232,-105" fill="#EF4444" filter="url(#neonGlowSide)" />

                {/* Taillight Glow Bloom */}
                <ellipse cx="-242" cy="-100" rx="16" ry="7" fill="#EF4444" opacity="0.35" filter="url(#neonGlowSide)" />
                {/* Headlight Beam Cone */}
                <polygon points="248,-96 348,-110 348,-74 250,-86" fill="#E0F2FE" opacity="0.1" />
                {/* Window Glare Streak */}
                <polygon points="-70,-172 -20,-172 30,-132 -14,-132" fill="#FFFFFF" opacity="0.12" />

                {/* Door Handles */}
                <rect x="-55" y="-115" width="18" height="5" rx="2" fill="#1E293B" stroke="#64748B" strokeWidth="1" />
                <rect x="35" y="-115" width="18" height="5" rx="2" fill="#1E293B" stroke="#64748B" strokeWidth="1" />
              </g>
            )}

            {/* ===== WASH POLISH OVERLAYS (exhaust, drips, sparkles, shine) ===== */}
            {isTransitioning && (
              <g>
                {/* Exhaust puffs while driving in / out */}
                <circle cx="-262" cy="-58" r="13" fill="#E2E8F0" opacity="0.5" className="animate-exhaust" />
                <circle cx="-262" cy="-64" r="8" fill="#F1F5F9" opacity="0.4" className="animate-exhaust" style={{ animationDelay: '0.55s' }} />
                <circle cx="-258" cy="-52" r="6" fill="#FFFFFF" opacity="0.35" className="animate-exhaust" style={{ animationDelay: '1.1s' }} />
              </g>
            )}
            {!isTransitioning && (
              <g>
                {/* Water drip beads under the freshly washed body */}
                {[-180, -60, 60, 180].map((dx, i) => (
                  <ellipse key={`veh-drip-${dx}`} cx={dx} cy="-16" rx="2.5" ry="4.5" fill="#7DD3FC" opacity="0.75" className="animate-drip" style={{ animationDelay: `${i * 0.45}s` }} />
                ))}
                {/* Sparkle glints on clean paintwork */}
                <path d="M 150 -150 L 156 -138 L 168 -132 L 156 -126 L 150 -114 L 144 -126 L 132 -132 L 144 -138 Z" fill="#FFFFFF" opacity="0.9" className="animate-sparkle" />
                <path d="M -90 -160 L -95 -150 L -105 -145 L -95 -140 L -90 -130 L -85 -140 L -75 -145 L -85 -150 Z" fill="#FFFFFF" opacity="0.85" className="animate-sparkle" style={{ animationDelay: '0.6s' }} />
                <path d="M 40 -120 L 44 -112 L 52 -108 L 44 -104 L 40 -96 L 36 -104 L 28 -108 L 36 -112 Z" fill="#FEF9C3" opacity="0.8" className="animate-sparkle" style={{ animationDelay: '1.2s' }} />
                {/* Shine bar sweeping across the body */}
                <rect x="-60" y="-185" width="26" height="160" fill="#FFFFFF" opacity="0.16" className="animate-shine-sweep" />
              </g>
            )}
            </g>
          </g>

          {/* ────────────────────────────────────────────────────────── */}
          {/* DISTANT WASH BAYS (depth / perspective)                    */}
          {/* ────────────────────────────────────────────────────────── */}
          <g opacity="0.16">
            <path d="M 300 -150 L 300 -468 L 530 -468 L 530 -150" fill="none" stroke="#1E3A5F" strokeWidth="18" />
            <path d="M 1070 -150 L 1070 -468 L 1300 -468 L 1300 -150" fill="none" stroke="#1E3A5F" strokeWidth="18" />
            <line x1="290" y1="-205" x2="540" y2="-205" stroke="#00B4D8" strokeWidth="4" opacity="0.5" />
            <line x1="1060" y1="-205" x2="1310" y2="-205" stroke="#00B4D8" strokeWidth="4" opacity="0.5" />
            <circle cx="310" cy="-250" r="3" fill="#00B4D8" />
            <circle cx="520" cy="-250" r="3" fill="#00B4D8" />
            <circle cx="1080" cy="-250" r="3" fill="#00B4D8" />
            <circle cx="1290" cy="-250" r="3" fill="#00B4D8" />
          </g>

          {/* Laser scan line sweeping over the vehicle */}
          <g className="animate-laser-scan">
            <line x1="-270" y1="-60" x2="270" y2="-60" stroke="#22D3EE" strokeWidth="3" strokeDasharray="7 7" opacity="0.8" />
            <line x1="-270" y1="-58" x2="270" y2="-58" stroke="#0E7490" strokeWidth="1" opacity="0.4" />
          </g>

           {/* ────────────────────────────────────────────────────────── */}
           {/* HYPER-REALISTIC AUTOMATIC CAR WASH PORTAL GANTRY         */}
           {/* ────────────────────────────────────────────────────────── */}
           <g id="sweeping-gantry-assembly" transform="translate(800, 670)">
             {/* Drifting mist trail along the gantry travel path */}
            <g opacity="0.5">
              {[
                { x: -330, d: 0 },
                { x: 0, d: 0.9 },
                { x: 330, d: 1.8 },
              ].map((m, i) => (
                <ellipse key={`mist-${i}`} cx={m.x} cy="-240" rx="60" ry="34" fill="#BAE6FD" className="animate-mist" style={{ animationDelay: `${m.d}s` }} />
              ))}
            </g>

            <g className="animate-gantry-sweep">
              <g className="animate-gantry-lean">
                <g className="animate-gantry-bob">
               {/* ===== GROUND REFLECTION & FLOOR CONTACT SHADOWS ===== */}
               <ellipse cx="0" cy="10" rx="360" ry="24" fill="#000000" opacity="0.9" filter="url(#neonGlowSide)" />
               <ellipse cx="0" cy="8" rx="260" ry="14" fill="#000000" opacity="0.75" />
               <ellipse cx="0" cy="7" rx="170" ry="9" fill="#00B4D8" opacity="0.3" filter="url(#neonGlowSide)" />

               {/* ===== REAR PORTAL PILLAR (Right, depth layer) ===== */}
               <polygon points="218,0 262,0 252,-480 224,-480" fill="#080E1C" stroke="#1E3A5F" strokeWidth="2.5" />
               <line x1="228" y1="-40" x2="252" y2="-40" stroke="#1E293B" strokeWidth="6" />
               <line x1="228" y1="-180" x2="252" y2="-180" stroke="#1E293B" strokeWidth="6" />
               <line x1="228" y1="-320" x2="252" y2="-320" stroke="#1E293B" strokeWidth="6" />
               <line x1="228" y1="-440" x2="252" y2="-440" stroke="#1E293B" strokeWidth="6" />
               {/* Rear hydraulic hose bundle */}
               <path d="M 238 -475 C 245 -350 232 -200 240 -10" fill="none" stroke="#0284C7" strokeWidth="4" opacity="0.6" />

               {/* ===== STRUCTURAL TIE-BEAMS & ENERGY CABLE CARRIER ===== */}
               <rect x="-214" y="-462" width="428" height="12" rx="4" fill="#162033" stroke="#334155" strokeWidth="2" />
               <rect x="-214" y="-310" width="428" height="10" rx="3" fill="#162033" stroke="#334155" strokeWidth="2" />
               <rect x="-214" y="-158" width="428" height="10" rx="3" fill="#162033" stroke="#334155" strokeWidth="2" />
               {/* Articulated Energy Drag Chain (Caterpillar track) */}
               <path d="M -180 -456 Q -90 -445 0 -456 Q 90 -465 180 -456" fill="none" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />
               <path d="M -180 -456 Q -90 -445 0 -456 Q 90 -465 180 -456" fill="none" stroke="#38BDF8" strokeWidth="4" strokeDasharray="6 6" />

               {/* ===== FRONT PORTAL PILLAR (Left, main industrial column) ===== */}
               <polygon points="-268,0 -204,0 -212,-480 -260,-480" fill="url(#gantrySteel)" stroke="#475569" strokeWidth="3" />
               {/* Heavy industrial rib plates & gussets */}
               <line x1="-262" y1="-60" x2="-210" y2="-60" stroke="#0F172A" strokeWidth="3" opacity="0.8" />
               <line x1="-260" y1="-170" x2="-212" y2="-170" stroke="#0F172A" strokeWidth="3" opacity="0.8" />
               <line x1="-258" y1="-280" x2="-214" y2="-280" stroke="#0F172A" strokeWidth="3" opacity="0.8" />
               <line x1="-256" y1="-390" x2="-216" y2="-390" stroke="#0F172A" strokeWidth="3" opacity="0.8" />
               {/* Hex bolts / Rivets */}
               {[-30, -115, -200, -285, -370, -455].map((ry) => (
                 <g key={`bolt-${ry}`}>
                   <circle cx="-252" cy={ry} r="3.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="1" />
                   <circle cx="-220" cy={ry} r="3.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="1" />
                 </g>
               ))}

               {/* High-intensity Neon Cyan LED Pillar Strip */}
               <rect x="-228" y="-476" width="10" height="470" rx="5" fill="#00B4D8" filter="url(#neonGlowSide)" className="animate-neon-cyan" />
               <rect x="-225" y="-476" width="4" height="470" rx="2" fill="#FFFFFF" />

               {/* Advanced PLC Control Touch Panel on Pillar */}
               <g transform="translate(-268, -340)">
                 <rect x="0" y="0" width="60" height="85" rx="8" fill="#050B14" stroke="#334155" strokeWidth="2.5" />
                 <rect x="6" y="8" width="48" height="28" rx="4" fill="#020617" stroke="#00B4D8" strokeWidth="1.5" />
                 <text x="30" y="21" textAnchor="middle" fill="#38BDF8" fontSize="7" fontWeight="bold" fontFamily="monospace">PORTAL OK</text>
                 <text x="30" y="29" textAnchor="middle" fill="#34D399" fontSize="6" fontFamily="monospace">ONLINE 99.8%</text>
                 <circle cx="15" cy="58" r="5" fill="#34D399" className="animate-blink-light" />
                 <circle cx="30" cy="58" r="5" fill="#F59E0B" className="animate-blink-light" style={{ animationDelay: '0.4s' }} />
                 <circle cx="45" cy="58" r="5" fill="#EF4444" className="animate-blink-light" style={{ animationDelay: '0.8s' }} />
                 <rect x="10" y="70" width="40" height="7" rx="3.5" fill="#1E293B" />
               </g>

               {/* ===== HEAVY OVERHEAD BOX-GIRDER CROSSBEAM ===== */}
               <rect x="-276" y="-514" width="552" height="46" rx="12" fill="url(#gantryTopBeam)" stroke="#38BDF8" strokeWidth="2.5" />
               {/* Safety hazard chevron end plates */}
               <polygon points="-276,-514 -232,-514 -258,-468 -302,-468" fill="#F59E0B" opacity="0.9" />
               <polygon points="-232,-514 -198,-514 -224,-468 -258,-468" fill="#020617" opacity="0.8" />
               <polygon points="276,-514 232,-514 258,-468 302,-468" fill="#F59E0B" opacity="0.9" />
               <polygon points="232,-514 198,-514 224,-468 258,-468" fill="#020617" opacity="0.8" />
               {/* LED Chase Light Array */}
               <rect x="-252" y="-506" width="504" height="8" rx="4" fill="none" stroke="#22D3EE" strokeWidth="6" strokeDasharray="16 14" className="animate-led-chase" />
               {/* Central Telemetry LCD Matrix Display */}
               <rect x="-124" y="-510" width="248" height="34" rx="6" fill="#020617" stroke="#00B4D8" strokeWidth="2" />
               <text x="0" y="-489" textAnchor="middle" fill={WASH_STAGES[stageIdx].color} fontSize="12" fontWeight="900" fontFamily="monospace" letterSpacing="3">
                 STAGE {stageIdx + 1}/5: {WASH_STAGES[stageIdx].label} • ACTIVE
               </text>
               {/* Emergency Strobe Light on top center */}
               <ellipse cx="0" cy="-522" rx="16" ry="7" fill="#F59E0B" filter="url(#neonGlowSide)" />
               <ellipse cx="0" cy="-522" rx="10" ry="4" fill="#FEF08A" className="animate-blink-light" />

               {/* ===== MULTI-STAGE HIGH-PRESSURE SPRAY MANIFOLDS ===== */}
               <g className="animate-water-downward">
                 <polygon points="-280,-468 280,-468 340,-110 -340,-110" fill="url(#downSprayGrad)" />
                 <polygon points="-190,-468 190,-468 240,-60 -240,-60" fill="url(#downSprayGrad)" opacity="0.85" />
                 <polygon points="-100,-468 100,-468 130,-30 -130,-30" fill="#E0F2FE" opacity="0.4" />
               </g>

               {/* Tri-Color Foam Suds Curtain (White / Cyan / Gold) */}
               <g className="animate-foam-puff" transform="translate(0, -420)">
                 <path d="M -260 0 Q 0 -30 260 0 L 250 40 Q 0 10 -250 40 Z" fill="#FFFFFF" opacity="0.35" filter="url(#neonGlowSide)" />
                 <path d="M -200 10 Q 0 -15 200 10 L 190 45 Q 0 20 -190 45 Z" fill="#38BDF8" opacity="0.3" filter="url(#neonGlowSide)" />
                 <path d="M -120 20 Q 0 0 120 20 L 110 50 Q 0 30 -110 50 Z" fill="#F59E0B" opacity="0.25" />
               </g>

               {/* Side Jet Nozzles */}
               <polygon points="-276,-468 -216,-468 -320,-190 -355,-210" fill="url(#angledJetLeft)" opacity="0.8" />
               <polygon points="216,-468 276,-468 355,-210 320,-190" fill="url(#angledJetRight)" opacity="0.8" />

               {/* ===== HEAVY MOTORIZED SIDE BRUSHES (Left & Right) ===== */}
               {/* Left Side Brush Assembly */}
               <g>
                 <rect x="-268" y="-468" width="16" height="320" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="2" />
                 <rect x="-268" y="-160" width="16" height="54" rx="5" fill="#0A1428" stroke="#00B4D8" strokeWidth="2" />
                 <line x1="-260" y1="-138" x2="-260" y2="-110" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" />
                 <g transform="translate(-260, -110)">
                   <g className="animate-side-brush">
                     <ellipse cx="0" cy="0" rx="21" ry="78" fill="url(#brushSpindleGrad)" stroke="#00B4D8" strokeWidth="2.5" opacity="0.95" />
                     {[-62, -42, -21, 0, 21, 42, 62].map((by) => (
                       <line key={`sbl-h-${by}`} x1="-18" y1={by} x2="18" y2={by} stroke="#E0F2FE" strokeWidth="2.8" opacity="0.7" />
                     ))}
                     <line x1="-20" y1="0" x2="20" y2="0" stroke="#FFFFFF" strokeWidth="2.5" />
                   </g>
                 </g>
               </g>
               {/* Right Side Brush Assembly */}
               <g>
                 <rect x="252" y="-468" width="16" height="320" rx="5" fill="#1E293B" stroke="#334155" strokeWidth="2" />
                 <rect x="252" y="-160" width="16" height="54" rx="5" fill="#0A1428" stroke="#00B4D8" strokeWidth="2" />
                 <line x1="260" y1="-138" x2="260" y2="-110" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" />
                 <g transform="translate(260, -110)">
                   <g className="animate-side-brush" style={{ animationDirection: 'reverse' }}>
                     <ellipse cx="0" cy="0" rx="21" ry="78" fill="url(#brushSpindleGrad)" stroke="#00B4D8" strokeWidth="2.5" opacity="0.95" />
                     {[-62, -42, -21, 0, 21, 42, 62].map((by) => (
                       <line key={`sbr-h-${by}`} x1="-18" y1={by} x2="18" y2={by} stroke="#E0F2FE" strokeWidth="2.8" opacity="0.7" />
                     ))}
                     <line x1="-20" y1="0" x2="20" y2="0" stroke="#FFFFFF" strokeWidth="2.5" />
                   </g>
                 </g>
               </g>

               {/* ===== ARTICULATED PNEUMATIC TOP CONTOUR BRUSH ===== */}
               <g className="animate-brush-bob">
                 <line x1="0" y1="-468" x2="0" y2="-280" stroke="#475569" strokeWidth="12" strokeLinecap="round" />
                 <line x1="-7" y1="-468" x2="-7" y2="-280" stroke="#CBD5E1" strokeWidth="3" opacity="0.8" />
                 <line x1="-32" y1="-340" x2="-7" y2="-310" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                 <line x1="32" y1="-340" x2="7" y2="-310" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                 {/* Pneumatic Cylinder Actuator */}
                 <rect x="-24" y="-345" width="15" height="54" rx="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
                 <rect x="-19" y="-296" width="6" height="28" rx="2" fill="#E2E8F0" />
                 {/* Pivot Joint */}
                 <circle cx="0" cy="-280" r="13" fill="#334155" stroke="#CBD5E1" strokeWidth="2.5" />
                 <circle cx="0" cy="-280" r="5" fill="#020617" />
                 {/* Top Rotary Brush Drum */}
                 <g transform="translate(0, -232)">
                   <ellipse cx="0" cy="0" rx="82" ry="30" fill="url(#brushSpindleGrad)" stroke="#00B4D8" strokeWidth="2.5" opacity="0.95" className="animate-top-brush" />
                   {[-64, -44, -22, 0, 22, 44, 64].map((bx) => (
                     <line key={`br-top-${bx}`} x1={bx} y1="-26" x2={bx} y2="26" stroke="#E0F2FE" strokeWidth="2.8" opacity="0.7" />
                   ))}
                   <line x1="-76" y1="0" x2="76" y2="0" stroke="#FFFFFF" strokeWidth="2.5" />
                 </g>
               </g>

               {/* ===== LOWER ROTARY WHEEL BLASTERS (Tire scrubbers) ===== */}
               <g>
                 <line x1="0" y1="-38" x2="0" y2="-124" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
                 <rect x="-18" y="-124" width="36" height="12" rx="4" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
                 <circle cx="0" cy="-130" r="6" fill="#CBD5E1" />
                 <g transform="translate(0, -110)">
                   <circle cx="0" cy="0" r="34" fill="url(#brushSpindleGrad)" stroke="#00B4D8" strokeWidth="2.5" opacity="0.9" className="animate-wheel-brush" />
                   <line x1="-30" y1="0" x2="30" y2="0" stroke="#FFFFFF" strokeWidth="2.8" />
                   <line x1="0" y1="-30" x2="0" y2="30" stroke="#FFFFFF" strokeWidth="2.8" />
                   <circle cx="0" cy="0" r="10" fill="#020617" stroke="#38BDF8" strokeWidth="2" />
                 </g>
               </g>

               {/* ===== CASCADING WATER DROPLETS & MIST PARTICLES ===== */}
               <g>
                 {[
                   { x: -220, d: 0 },
                   { x: -140, d: 0.5 },
                   { x: -70, d: 1.0 },
                   { x: 0, d: 0.2 },
                   { x: 70, d: 0.8 },
                   { x: 140, d: 1.3 },
                   { x: 220, d: 0.4 },
                 ].map((dp, i) => (
                   <circle
                     key={`drop-hyper-${i}`}
                     cx={dp.x}
                     cy={-430}
                     r="4.5"
                     fill="#7DD3FC"
                     opacity="0.9"
                     className="animate-droplet"
                     style={{ animationDelay: `${dp.d}s` }}
                   />
                 ))}
               </g>

               {/* ===== HEAVY BASE FOOTING ON RAILS ===== */}
               <rect x="-280" y="-38" width="560" height="36" rx="9" fill="url(#gantrySteel)" stroke="#334155" strokeWidth="2.5" />
               <rect x="-268" y="-34" width="536" height="11" rx="4" fill="#020617" />
               <g>
                 {[-260, -200, -140, -80, -20, 40, 100, 160, 220].map((sx) => (
                   <polygon key={`chev-hyper-${sx}`} points={`${sx},-19 ${sx + 15},-19 ${sx + 6},-3 ${sx - 9},-3`} fill="#F59E0B" opacity="0.85" />
                 ))}
               </g>
               {/* Flanged steel floor carriage wheels */}
               {[-230, -115, 0, 115, 230].map((wx) => (
                 <g key={`base-wheel-${wx}`}>
                   <circle cx={wx} cy="-6" r="11" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
                   <circle cx={wx} cy="-6" r="4" fill="#CBD5E1" />
                 </g>
               ))}
               <rect x="-276" y="-40" width="552" height="4" rx="2" fill="#00B4D8" opacity="0.75" />
               <ellipse cx="0" cy="0" rx="280" ry="8" fill="#00B4D8" opacity="0.22" filter="url(#neonGlowSide)" />
               </g>
             </g>
             </g>
           </g>

          {/* Rising steam from the wet floor */}
          <g>
            {[-260, -160, -60, 40, 140, 240].map((sx, i) => (
              <ellipse
                key={`steam-${i}`}
                cx={sx}
                cy="-16"
                rx="58"
                ry="16"
                fill="#E2E8F0"
                opacity="0"
                className="animate-steam"
                style={{ animationDelay: `${i * 0.9}s` }}
              />
            ))}
          </g>
        </svg>

        {/* Floating Soap Bubbles */}
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${b.left}%`,
              bottom: '-8%',
              width: b.size,
              height: b.size,
              background:
                'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22), rgba(0, 180, 216, 0.08) 55%, transparent 80%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
              animation: `bubbleFloat ${b.duration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ============================================================ */}
      {/* 2. LAYER: TOP MINIMAL BRAND HEADER                           */}
      {/* ============================================================ */}
      <header className="relative z-20 w-full px-6 py-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25"
            style={{ background: 'linear-gradient(135deg, #00B4D8, #0284C7)' }}
          >
            <Droplets size={22} className="text-white animate-pulse" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white font-display">
              Quick<span className="font-light text-[#00B4D8]">Wash</span>
            </span>
            <span className="ml-2 text-xs uppercase font-mono tracking-widest text-cyan-300/80">
              Smart Hub
            </span>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. LAYER: COIN-OP MACHINE (right side — scene stays visible) */}
      {/* ============================================================ */}
      {/* Fade veil so the wash scene blends into the machine column */}
      <div className="hidden lg:block absolute inset-y-0 right-0 w-[620px] z-10 pointer-events-none bg-gradient-to-l from-[#040A16] via-[#040A16]/60 to-transparent" />

      <main className="relative z-20 flex-1 w-full flex items-center justify-center lg:justify-end py-4">
        <div className="relative w-full max-w-[540px] px-4 lg:px-12 animate-fade-in">
          {/* Ambient machine glow */}
          <div className="absolute -inset-3 rounded-[34px] bg-cyan-500/15 blur-2xl animate-pulse pointer-events-none" />
          {/* ============================================================ */}
          {/* COIN-OP VENDING MACHINE                                      */}
          {/* ============================================================ */}
          <div className={`qw-vendo-body rounded-[26px] p-3 sm:p-3.5 relative overflow-hidden shadow-2xl ${rejected ? 'qw-shake' : ''}`}>
            {/* Metal sheen + corner rivets */}
            <div className="qw-vendo-sheen absolute inset-0 pointer-events-none z-10" />
            <div className="qw-rivet absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full" />
            <div className="qw-rivet absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full" />
            <div className="qw-rivet absolute bottom-2.5 left-2.5 w-1.5 h-1.5 rounded-full" />
            <div className="qw-rivet absolute bottom-2.5 right-2.5 w-1.5 h-1.5 rounded-full" />

            {/* ===== LED MESSAGE TICKER ===== */}
            <div className="qw-ticker relative z-20 mb-3 rounded-lg h-7 flex items-center">
              <div className="qw-ticker-text font-mono text-[9px] tracking-[0.22em] text-[#38BDF8]">
                ◈ WELCOME TO QUICKWASH SMART HUB ◈ INSERT COIN TO BEGIN ◈ OPERATOR SIGN-IN REQUIRED ◈ CHOOSE YOUR CYCLE: STANDARD ₱50 · PREMIUM ₱100 ◈
              </div>
            </div>

            {/* ===== TOP BRAND PLATE ===== */}
            <div className="qw-brand-plate relative z-20 mb-3 flex items-center justify-between px-4 py-3 rounded-xl border border-cyan-500/30 shadow-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30"
                  style={{ background: 'linear-gradient(135deg, #00B4D8, #0284C7)' }}
                >
                  <Droplets size={22} className="text-white animate-pulse" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-black tracking-tight leading-none text-white font-display drop-shadow-[0_2px_10px_rgba(0,180,216,0.5)]">
                    Quick<span className="font-light text-[#00B4D8]">Wash</span>
                  </p>
                  <p className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-cyan-300/80 mt-1">
                    Smart IoT Coin-Op Hub v2.5
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                <span className="qw-led qw-led-green animate-pulse" />
                <span className="text-[8px] font-mono uppercase tracking-widest text-emerald-400 font-bold">ONLINE</span>
              </div>
            </div>

             {/* ===== COIN SLOT + LCD SCREEN ===== */}
             <div className="flex gap-3 mb-3 relative z-20">
               {/* Coin slot column */}
               <div className="qw-coin-slot relative flex flex-col items-center justify-between w-[112px] shrink-0 rounded-2xl px-2.5 pt-3.5 pb-3 overflow-visible border border-cyan-500/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                 {coinAnim && <div className="qw-coin-fall" />}
                 <div className="text-center">
                   <span className="text-[7.5px] font-mono tracking-[0.25em] text-cyan-400 font-bold block">SMART COIN</span>
                   <span className="text-[6px] font-mono tracking-[0.15em] text-white/40">ACCEPTOR ₱5-20</span>
                 </div>

                 {/* 3D Beveled Coin Slot Bezel */}
                 <div className="qw-slot-bezel relative w-[76px] h-[54px] rounded-xl flex flex-col items-center justify-center shadow-2xl border border-cyan-400/40 my-1">
                   <div
                     className="qw-slot-opening"
                     style={slotGlow ? { boxShadow: '0 0 20px rgba(0, 180, 216, 1), inset 0 3px 8px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(255, 255, 255, 0.4)', borderColor: '#22D3EE' } : undefined}
                   />
                   <div className="flex items-center gap-2 mt-1">
                     <span className="qw-led qw-led-green animate-pulse" title="Ready" />
                     <span className="qw-led qw-led-amber" title="Active" />
                   </div>
                 </div>

                 {/* Denominations */}
                 <div className="flex gap-1 my-1">
                   <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 font-bold">₱5</span>
                   <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 font-bold">₱10</span>
                   <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 border border-cyan-500/30 font-bold">₱20</span>
                 </div>

                 {/* Credit Balance VFD Display */}
                 <div className="w-full text-center py-2 rounded-lg bg-black/80 border border-cyan-500/40 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
                   <span key={credits} className="qw-credit-pop font-mono text-cyan-300 font-black text-base leading-none flex items-center justify-center gap-1.5 drop-shadow-[0_0_10px_rgba(0,180,216,0.8)]">
                     <Coins size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} /> ₱{credits}
                   </span>
                 </div>
                 <span className="text-[7px] font-mono tracking-[0.2em] text-cyan-400/70 font-semibold mt-1">CREDIT METER</span>
               </div>

               {/* LCD screen with form */}
               <div className="qw-screen relative flex-1 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                 <div className="qw-scanlines absolute inset-0 pointer-events-none z-10 opacity-60" />
                 <div className="relative z-20">
                   {/* Screen status bar */}
                   <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 border-b border-cyan-500/20 bg-black/40">
                     <span className="flex items-center gap-2 text-[8.5px] font-mono uppercase tracking-[0.2em] text-cyan-300 font-bold">
                       <span className="qw-led qw-led-green animate-pulse" /> IOT SECURE TERMINAL
                     </span>
                     <span className="text-[8.5px] font-mono text-cyan-400/80 font-bold">QWS v2.5.0</span>
                   </div>

                   <div className="px-5 py-4">
                     <div>
                       <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-display drop-shadow-[0_2px_8px_rgba(0,180,216,0.4)]">
                         Operator Sign In
                       </h1>
                       <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-300/70 mt-0.5 font-semibold">
                         Authenticate credentials to access hub
                       </p>
                     </div>

                     {/* Error — LCD reject message */}
                     {error && (
                       <div className="qw-lcd-error mt-3 p-2.5 rounded-lg bg-red-500/15 border border-red-500/60 text-red-300 text-[10px] font-mono tracking-widest text-center animate-fade-in shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                         ✕ {error}
                       </div>
                     )}

                     <form onSubmit={handleLogin} id="login-form" className="mt-4 space-y-3.5">
                       {/* Email Field */}
                       <div className="space-y-1.5">
                         <label htmlFor="login-email" className="text-[9px] font-mono uppercase tracking-widest text-cyan-300/80 pl-1 block font-bold">
                           Operator ID (Email)
                         </label>
                         <div className="relative group">
                           <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-transparent group-focus-within:bg-[#00B4D8] transition-colors" />
                           <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400/50 group-focus-within:text-[#00B4D8] transition-colors" size={16} />
                           <input
                             id="login-email"
                             type="email"
                             required
                             value={email}
                             onChange={(e) => setEmail(e.target.value)}
                             placeholder="admin@quickwash.hub"
                             className="w-full pl-10 pr-3 py-3 rounded-xl bg-black/60 border border-cyan-500/25 text-xs text-white placeholder:text-white/30 transition-all outline-none focus:ring-2 focus:ring-[#00B4D8]/60 focus:border-[#00B4D8] shadow-inner"
                           />
                         </div>
                       </div>

                       {/* Password Field */}
                       <div className="space-y-1.5">
                         <div className="flex justify-between items-center px-1">
                           <label htmlFor="login-password" className="text-[9px] font-mono uppercase tracking-widest text-cyan-300/80 font-bold">
                             Access Key (Password)
                           </label>
                           <button
                             type="button"
                             title="Contact the facility administrator to reset your password"
                             className="text-[8.5px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-help"
                           >
                             Forgot Key?
                           </button>
                         </div>
                         <div className="relative group">
                           <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-transparent group-focus-within:bg-[#00B4D8] transition-colors" />
                           <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400/50 group-focus-within:text-[#00B4D8] transition-colors" size={16} />
                           <input
                             id="login-password"
                             type={showPassword ? 'text' : 'password'}
                             required
                             value={password}
                             onChange={(e) => setPassword(e.target.value)}
                             placeholder="••••••••••••"
                             className="w-full pl-10 pr-10 py-3 rounded-xl bg-black/60 border border-cyan-500/25 text-xs text-white placeholder:text-white/30 transition-all outline-none focus:ring-2 focus:ring-[#00B4D8]/60 focus:border-[#00B4D8] shadow-inner"
                           />
                           <button
                             type="button"
                             onClick={() => setShowPassword(!showPassword)}
                             className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                             aria-label={showPassword ? 'Hide password' : 'Show password'}
                           >
                             {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                           </button>
                         </div>
                       </div>

                       {/* Remember Me Toggle */}
                       <div className="flex items-center gap-3 pl-1 pt-0.5">
                         <button
                           type="button"
                           role="switch"
                           aria-checked={rememberMe}
                           onClick={() => setRememberMe(!rememberMe)}
                           className={`relative w-9 h-5 rounded-full transition-colors duration-300 flex-shrink-0 cursor-pointer ${
                             rememberMe ? 'bg-[#00B4D8]' : 'bg-white/20'
                           }`}
                         >
                           <span
                             className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                               rememberMe ? 'translate-x-4' : 'translate-x-0'
                             }`}
                           />
                         </button>
                         <span className="text-[10px] text-cyan-200/70 font-medium">Remember operator session</span>
                       </div>
                     </form>

                     {/* Demo Credentials */}
                     <div className="mt-4 pt-3 border-t border-cyan-500/20 text-center">
                       <p className="text-[9px] text-cyan-300/80 font-mono font-medium">
                         DEMO ACCESS: <span className="text-white font-bold">admin@quickwash.hub</span> /{' '}
                         <span className="text-white font-bold">admin123</span>
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

            {/* ===== ARCADE BUTTONS ===== */}
            <div className="flex gap-3 mb-3 relative z-20">
              <button
                type="submit"
                form="login-form"
                disabled={isLoading || coinAnim}
                onMouseEnter={() => setSlotGlow(true)}
                onMouseLeave={() => setSlotGlow(false)}
                onClick={(e) => { e.preventDefault(); handleLogin(e); }}
                className={`qw-btn-arcade flex-1 h-12 rounded-xl font-black text-[11px] tracking-[0.15em] uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${formReady && !isLoading ? 'qw-btn-ready' : ''}`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Coins size={16} className={formReady ? 'animate-pulse' : ''} />
                    Insert Coin · Sign In
                  </>
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={handleCoinReturn}
                  disabled={returning}
                  className="qw-btn-return w-[108px] h-12 rounded-xl font-black text-[10px] tracking-[0.12em] uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                >
                  <Undo2 size={14} />
                  Coin Return
                </button>
              </div>
            </div>

            {/* ===== CYCLE PRICES ===== */}
            <div className="grid grid-cols-2 gap-3 mb-3 relative z-20">
              <div className="qw-chip rounded-xl px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[7.5px] font-mono uppercase tracking-[0.18em] text-white/40">Standard Cycle</p>
                  <p className="text-sm font-black text-white leading-tight mt-0.5">₱50.00</p>
                </div>
                <span className="qw-led qw-led-green" />
              </div>
              <div className="qw-chip rounded-xl px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[7.5px] font-mono uppercase tracking-[0.18em] text-white/40">Premium Cycle</p>
                  <p className="text-sm font-black text-white leading-tight mt-0.5">₱100.00</p>
                </div>
                <span className="qw-led qw-led-amber" />
              </div>
            </div>

            {/* ===== BOTTOM GRILL ===== */}
            <div className="qw-grill h-7 rounded-lg relative z-20" />

            {/* ===== COIN RETURN TRAY ===== */}
            <div className="qw-tray relative z-20 mt-2 h-9 rounded-lg flex items-center justify-end px-3 gap-1.5 overflow-hidden">
              <span className="text-[7px] font-mono tracking-[0.18em] text-white/30 mr-auto">COIN RETURN</span>
              {/* Resting coins */}
              <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#FDE68A] via-[#F59E0B] to-[#B45309] border border-[#B45309]" />
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#475569] border border-[#64748B]" />
              {/* Popped coin on return */}
              {returning && (
                <div className="qw-coin-return w-4 h-4 rounded-full bg-gradient-to-br from-[#FDE68A] via-[#F59E0B] to-[#B45309] border-2 border-[#B45309] shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              )}
            </div>

            {/* ===== SERIAL / STICKERS ===== */}
            <div className="flex justify-between items-center mt-2 px-1 relative z-20">
              <span className="text-[7.5px] font-mono tracking-widest text-white/30">SERIAL QWS-HUB-2026</span>
              <span className="flex items-center gap-1.5">
                <span className="qw-led qw-led-red" />
                <span className="text-[7.5px] font-mono tracking-widest text-white/30">MAINT REQ: NONE</span>
              </span>
            </div>
            <div className="flex justify-between items-center mt-1 px-1 relative z-20">
              <span className="text-[6.5px] font-mono tracking-widest text-white/20">NO REFUNDS · MACHINE ID 01</span>
              <span className="text-[6.5px] font-mono tracking-widest text-white/20">DO NOT INSERT FOREIGN OBJECTS</span>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes qwPopIn {
          0% { opacity: 0; transform: scale(0.85) translateY(14px); }
          60% { transform: scale(1.03) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .qw-pop-in {
          animation: qwPopIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
        }
        @keyframes qwWelcomeFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .qw-welcome-fade {
          animation: qwWelcomeFade 0.4s ease-out both;
        }
        @keyframes qwBubbleRise {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.8; }
          100% { transform: translateY(-110vh); opacity: 0; }
        }
        .qw-bubble {
          animation-name: qwBubbleRise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes qwRingDraw {
          to { stroke-dashoffset: 0; }
        }
        .qw-ring-draw {
          animation: qwRingDraw 1s ease-out 0.3s forwards;
        }
        @keyframes qwCheckDraw {
          to { stroke-dashoffset: 0; }
        }
        .qw-check-draw {
          animation: qwCheckDraw 0.6s ease-out 1.15s forwards;
        }
        @keyframes qwBarFill {
          from { width: 0%; }
          to { width: 100%; }
        }
        .qw-bar-fill {
          width: 0%;
          animation: qwBarFill 2.2s ease-in-out 0.2s forwards;
        }
      `}</style>

      {/* ============================================================ */}
      {/* 4. LAYER: MINIMAL FOOTER                                     */}
      {/* ============================================================ */}
      <footer className="relative z-20 w-full px-6 py-4 text-center text-[11px] text-white/30">
        © 2026 QuickWash Smart Hub
      </footer>

      {/* ============================================================ */}
      {/* 5. LAYER: WELCOME ANIMATION (after successful login)         */}
      {/* ============================================================ */}
      {welcomeName && (
        <div className="qw-welcome-fade fixed inset-0 z-[200] overflow-hidden flex items-center justify-center" style={{ background: 'rgba(3,7,18,0.97)', backdropFilter: 'blur(10px)' }}>
          {WELCOME_BUBBLES.map((b, i) => (
            <span
              key={`wb-${i}`}
              className="qw-bubble rounded-full absolute"
              style={{
                left: `${b.left}%`,
                bottom: -60,
                width: b.size,
                height: b.size,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
                background: 'radial-gradient(circle at 30% 30%, rgba(56,189,248,0.4), rgba(56,189,248,0.06))',
                border: '1px solid rgba(56,189,248,0.25)',
              }}
            />
          ))}

          <div className="qw-pop-in relative z-10 text-center px-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-8">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="44" fill="none" stroke="#00B4D8" strokeWidth="6"
                  strokeLinecap="round" strokeDasharray="277" strokeDashoffset="277"
                  className="qw-ring-draw" transform="rotate(-90 50 50)"
                />
                <path
                  d="M32 52 L45 65 L70 38" fill="none" stroke="#00F5A0" strokeWidth="7"
                  strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60"
                  className="qw-check-draw"
                />
              </svg>
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-cyan-400/80">Access Granted</p>
            <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tight mt-4 text-white">Welcome Back</h2>
            <p className="text-lg sm:text-xl font-bold text-white/70 mt-2 truncate max-w-xs sm:max-w-md mx-auto">{welcomeName}</p>

            <div className="w-56 h-1.5 mx-auto mt-9 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full qw-bar-fill rounded-full" style={{ background: 'linear-gradient(90deg,#00B4D8,#00F5A0)' }} />
            </div>
            <p className="text-[9px] font-mono uppercase tracking-[0.35em] text-white/30 mt-4">Entering Smart Hub...</p>
          </div>
        </div>
      )}
    </div>
  );
}
