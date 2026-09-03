"use client";

import { useEffect, useState } from "react";
import "./hubi-mascot.css";

export type HubiState =
  | "idle"
  | "thinking"
  | "talking"
  | "error"
  | "grateful"
  | "confused"
  | "surprised"
  | "love"
  | "sleepy"
  | "charging";

interface HubiMascotProps {
  state?: HubiState;
  size?: number;
  className?: string;
}

export function HubiMascot({
  state = "idle",
  size = 72,
  className = "",
}: HubiMascotProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 3000 + Math.random() * 4000);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  const eyeClass = blink ? "hubi-blink" : "";

  return (
    <div className={`hubi-mascot hubi-state-${state} ${className}`} style={{ width: size, height: size }} role="img" aria-label={`Hubi ${state}`}>
      <svg viewBox="0 0 180 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="hubi-svg" shapeRendering="geometricPrecision">
        <defs>
          <radialGradient id="hubi-shadow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="robot-metal-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="robot-blue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <radialGradient id="robot-head-grad" cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          <radialGradient id="robot-eye-grad" cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="30%" stopColor="#7dd3fc" />
            <stop offset="70%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </radialGradient>
          <radialGradient id="robot-chest-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </radialGradient>
          <radialGradient id="robot-heart-grad" cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </radialGradient>
        </defs>

        {/* Sombra */}
        <ellipse cx="90" cy="205" rx="50" ry="8" fill="url(#hubi-shadow-grad)" className="hubi-shadow" />

        <g className="hubi-robot">
          {/* Antena parabólica — solo aparece en thinking */}
          <g className="hubi-parabolic-antenna">
            {/* Poste */}
            <line x1="90" y1="14" x2="90" y2="-8" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            {/* Parábola */}
            <path d="M76,-8 Q90,-20 104,-8" fill="url(#robot-metal-grad)" stroke="#475569" strokeWidth="1" />
            <path d="M76,-8 Q90,-16 104,-8" fill="rgba(56,189,248,0.3)" />
            {/* LED central */}
            <circle cx="90" cy="-10" r="2.5" fill="#38BDF8" className="hubi-antenna-led" />
          </g>

          {/* Brazo izquierdo — animado */}
          <g className="hubi-arm-left">
            <rect x="38" y="100" width="18" height="42" rx="9" fill="url(#robot-metal-grad)" />
            <circle cx="47" cy="142" r="8" fill="#475569" />
          </g>

          {/* Brazo derecho — animado */}
          <g className="hubi-arm-right">
            <rect x="124" y="100" width="18" height="42" rx="9" fill="url(#robot-metal-grad)" />
            <circle cx="133" cy="142" r="8" fill="#475569" />
          </g>

          {/* Cuerpo completo — cabeza + cuello + torso, estilo casco kawaii */}
          <g className="hubi-body">
            <path
              d="M50,48 Q50,8 90,8 Q130,8 130,48 L130,76 Q128,86 116,90 Q112,91 112,94 Q112,98 122,100 Q128,101 128,108 L128,150 Q128,175 90,175 Q52,175 52,150 L52,108 Q52,101 58,100 Q68,98 68,94 Q68,91 64,90 Q52,86 50,76 Z"
              fill="url(#robot-head-grad)"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            {/* Sombra lateral para 3D */}
            <path
              d="M50,48 Q50,8 90,8 L90,175 Q52,175 52,150 L52,108 Q52,101 58,100 Q68,98 68,94 Q68,91 64,90 Q52,86 50,76 Z"
              fill="rgba(0,0,0,0.1)"
            />
            {/* Brillo superior para 3D */}
            <ellipse cx="70" cy="22" rx="26" ry="10" fill="rgba(255,255,255,0.5)" />
            {/* Pantalla de cara — oscura, redondeada, tipo referencia */}
            <rect x="55" y="24" width="70" height="58" rx="28" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            {/* Brillo sutil en la pantalla */}
            <rect x="60" y="26" width="60" height="14" rx="20" fill="rgba(255,255,255,0.06)" />

            {/* Ojos con expresiones según estado/emoción */}
            <g className={`hubi-eyes ${eyeClass}`}>
              {/* Normal / contento */}
              <g className="hubi-eye-normal">
                <circle cx="75" cy="46" r="6" fill="#e0f2fe" />
                <circle cx="73" cy="43" r="2.5" fill="#ffffff" opacity="0.9" />
                <circle cx="105" cy="46" r="6" fill="#e0f2fe" />
                <circle cx="103" cy="43" r="2.5" fill="#ffffff" opacity="0.9" />
              </g>
              {/* Feliz ^^ (grateful) */}
              <g className="hubi-eye-happy" opacity="0">
                <path d="M70,49 Q75,44 80,49" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
                <path d="M100,49 Q105,44 110,49" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
              </g>
              {/* Corazón (love) — blancos, ligeramente más pequeños */}
              <g className="hubi-eye-heart" opacity="0">
                <path d="M75,51 C70,43 64,43 64,51 C64,57 69,61 75,65 C81,61 86,57 86,51 C86,43 80,43 75,51" fill="#ffffff" />
                <ellipse cx="70" cy="47" rx="2.5" ry="3" fill="#e0f2fe" opacity="0.8" />
                <path d="M105,51 C100,43 94,43 94,51 C94,57 99,61 105,65 C111,61 116,57 116,51 C116,43 110,43 105,51" fill="#ffffff" />
                <ellipse cx="100" cy="47" rx="2.5" ry="3" fill="#e0f2fe" opacity="0.8" />
              </g>
              {/* Pensando — gran signo de interrogación centrado */}
              <g className="hubi-eye-thinking" opacity="0">
                <text x="90" y="62" fontSize="34" fontFamily="sans-serif" fill="#7dd3fc" textAnchor="middle" fontWeight="bold" className="hubi-thinking-qmark">?</text>
              </g>
              {/* Confundido — ojos en espiral / gracioso */}
              <g className="hubi-eye-confused" opacity="0">
                <path d="M70,48 Q73,45 76,48 Q79,51 82,48" fill="none" stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" />
                <path d="M97,48 Q100,45 103,48 Q106,51 109,48" fill="none" stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" />
                <path d="M72,46 Q75,50 78,46" fill="none" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M99,46 Q102,50 105,46" fill="none" stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" />
              </g>
              {/* Sorprendido — puntitos grandes */}
              <g className="hubi-eye-surprised" opacity="0">
                <circle cx="75" cy="47" r="7" fill="#e0f2fe" />
                <circle cx="73" cy="44" r="2.5" fill="#ffffff" opacity="0.9" />
                <circle cx="105" cy="47" r="7" fill="#e0f2fe" />
                <circle cx="103" cy="44" r="2.5" fill="#ffffff" opacity="0.9" />
              </g>
              {/* Dormido — ojos cerrados + zzz */}
              <g className="hubi-eye-sleepy" opacity="0">
                <path d="M70,50 Q75,53 80,50" fill="none" stroke="#e0f2fe" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M100,50 Q105,53 110,50" fill="none" stroke="#e0f2fe" strokeWidth="2.5" strokeLinecap="round" />
                <text x="115" y="35" fontSize="12" fontFamily="sans-serif" fill="#7dd3fc" fontWeight="bold">z</text>
                <text x="122" y="28" fontSize="9" fontFamily="sans-serif" fill="#7dd3fc" fontWeight="bold">z</text>
                <text x="128" y="22" fontSize="7" fontFamily="sans-serif" fill="#7dd3fc" fontWeight="bold">z</text>
              </g>
              {/* Cargando — batería grande y brillante en el centro de la cara */}
              <g className="hubi-eye-charging" opacity="0">
                <rect x="68" y="30" width="44" height="24" rx="5" fill="#1e293b" stroke="#e0f2fe" strokeWidth="2.5" />
                <rect x="114" y="37" width="7" height="10" rx="2.5" fill="#e0f2fe" />
                <rect x="73" y="35" width="29" height="14" rx="3" fill="#22c55e" className="hubi-charge-level" />
                <path d="M85,25 L88,38 L80,38 L89,54" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="hubi-charge-bolt" />
                <circle cx="90" cy="55" r="14" fill="rgba(34,197,94,0.15)" />
              </g>
            </g>

            {/* Ojos de error */}
            <g className="hubi-error-eyes" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" opacity={state === "error" ? 1 : 0}>
              <line x1="70" y1="42" x2="80" y2="52" />
              <line x1="80" y1="42" x2="70" y2="52" />
              <line x1="100" y1="42" x2="110" y2="52" />
              <line x1="110" y1="42" x2="100" y2="52" />
            </g>

            {/* Boca — pequeña sonrisa kawaii */}
            <path
              d="M86,64 Q90,68 94,64"
              fill="none"
              stroke={state === "error" ? "#f43f5e" : "#4ade80"}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="hubi-mouth-led"
            />

            {/* LED del pecho */}
            <circle cx="90" cy="125" r="10" fill="url(#robot-chest-grad)" className="hubi-chest-led" />
            <circle cx="90" cy="125" r="5" fill="#fff" opacity="0.4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
