"use client";

import { useId } from "react";

type Tone = "dark" | "light";
type Variant = "mark" | "wordmark" | "horizontal";

function WingedMark() {
  return (
    <>
      <img
        src="/brand/fused-ai-logo.png"
        alt=""
        aria-hidden="true"
        className="fused-logo-mark-image fused-logo-image-light"
        width={1520}
        height={998}
      />
      <img
        src="/brand/fused-ai-logo-white.png"
        alt=""
        aria-hidden="true"
        className="fused-logo-mark-image fused-logo-image-dark"
        width={1520}
        height={998}
      />
    </>
  );
}

function Mark({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 256 256" className="fused-logo-mark" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-ring-l`} x1="40" y1="20" x2="120" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C8FF4A" />
          <stop offset="0.55" stopColor="#34D399" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={`${uid}-ring-r`} x1="140" y1="20" x2="220" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7DD3FC" />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={`${uid}-brain`} x1="90" y1="100" x2="170" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#93C5FD" />
          <stop offset="0.45" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
        <linearGradient id={`${uid}-base`} x1="70" y1="180" x2="190" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22C55E" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-soft`}>
          <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#071422" floodOpacity="0.18" />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round">
        <path d="M57.3 194.7A100 100 0 0 1 128 24" stroke={`url(#${uid}-ring-l)`} strokeWidth="20" />
        <path d="M198.7 194.7A100 100 0 0 0 128 24" stroke={`url(#${uid}-ring-r)`} strokeWidth="20" />
      </g>
      <path fill={`url(#${uid}-base)`} d="M68 220 104 174l24 26 24-30 36 50c-24 12-88 12-120 0Z" />
      <g filter={`url(#${uid}-glow)`}>
        <path fill={`url(#${uid}-brain)`} d="M128 104c-22-12-48-4-52 22-4 24 12 44 36 48 6 2 10-4 12-10 2 6 6 12 12 10 24-4 40-24 36-48-4-26-30-34-44-22z" />
        <g fill="none" stroke="#E0E7FF" strokeWidth="1.7" strokeLinecap="round" opacity="0.9">
          <path d="M96 126 112 118 128 128 144 116 160 126" />
          <path d="M92 140 110 136 128 148 146 136 164 142" />
          <path d="M108 156 128 148 148 156" />
          <path d="M112 118 110 136 108 156" />
          <path d="M144 116 146 136 148 156" />
          <path d="M128 112 128 128 128 148" />
        </g>
        <g fill="#fff">
          <circle cx="96" cy="126" r="3.1" />
          <circle cx="112" cy="118" r="3.4" />
          <circle cx="144" cy="116" r="3.5" />
          <circle cx="160" cy="126" r="3.2" />
          <circle cx="92" cy="140" r="2.8" />
          <circle cx="110" cy="136" r="3" />
          <circle cx="128" cy="128" r="4.2" fill="#EEF2FF" />
          <circle cx="146" cy="136" r="3" />
          <circle cx="164" cy="142" r="2.9" />
          <circle cx="108" cy="156" r="2.8" />
          <circle cx="128" cy="148" r="3.2" />
          <circle cx="148" cy="156" r="2.8" />
          <circle cx="128" cy="112" r="3" />
        </g>
      </g>
      <g fill="none" strokeLinecap="round">
        <path d="M90 124H48" stroke="#4ADE80" strokeWidth="3.2" />
        <path d="M94 140H56" stroke="#22D3EE" strokeWidth="2.6" />
        <path d="M98 110H60" stroke="#86EFAC" strokeWidth="2.4" />
        <path d="M166 124h42" stroke="#38BDF8" strokeWidth="3.2" />
        <path d="M164 142h40" stroke="#60A5FA" strokeWidth="2.6" />
        <path d="M162 110h40" stroke="#7DD3FC" strokeWidth="2.4" />
        <circle cx="44" cy="124" r="4" fill="#4ADE80" stroke="none" />
        <circle cx="52" cy="140" r="3.2" fill="#22D3EE" stroke="none" />
        <circle cx="56" cy="110" r="3" fill="#86EFAC" stroke="none" />
        <circle cx="212" cy="124" r="4" fill="#38BDF8" stroke="none" />
        <circle cx="208" cy="142" r="3.2" fill="#60A5FA" stroke="none" />
        <circle cx="206" cy="110" r="3" fill="#7DD3FC" stroke="none" />
      </g>
      <path d="M150 102C140 124 134 146 136 168" fill="none" stroke="#F8FAFC" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      <path d="M150 102C140 124 134 146 136 168" fill="none" stroke="#BFDBFE" strokeWidth="3.2" strokeLinecap="round" opacity="0.5" />
      <g transform="translate(166 82) rotate(30)" filter={`url(#${uid}-soft)`}>
        <path fill="#22C55E" d="M-14 12 -32 34 -8 22z" />
        <path fill="#16A34A" d="M14 12 32 34 8 22z" />
        <path fill="#fff" d="M0-38c10 0 15 11 15 24v30c0 8-7 13-15 13s-15-5-15-13V-14c0-13 5-24 15-24z" />
        <path fill="#4ADE80" d="M0-42c8.5 0 13 9 13 18H-13c0-9 4.5-18 13-18z" />
        <circle cx="0" cy="-10" r="7.4" fill="#38BDF8" />
        <circle cx="-1.6" cy="-12.2" r="2.5" fill="#fff" opacity="0.75" />
      </g>
    </svg>
  );
}

export function FusedLogo({
  variant = "horizontal",
  tone = "dark",
  className = "",
}: {
  variant?: Variant;
  tone?: Tone;
  className?: string;
}) {
  const uid = `fa${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={`fused-brand fused-brand-${variant} ${className}`.trim()} data-tone={tone}>
      {variant !== "wordmark" ? variant === "mark" ? <WingedMark /> : <Mark uid={uid} /> : null}
      {variant !== "mark" ? (
        <span className="fused-brand-word">
          <span className="fused-brand-fused">FUSED</span>
          <span className="fused-brand-ai">AI</span>
        </span>
      ) : (
        <span className="fused-sr-only">FUSED AI</span>
      )}
    </span>
  );
}
