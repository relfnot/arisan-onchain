"use client";

import { useEffect } from "react";
import { PublicKey } from "@solana/web3.js";

/** Ring of members around a pot: the brand mark. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3.3" />
      <circle cx="16" cy="16" r="5.5" fill="var(--accent)" />
      <circle cx="16" cy="4" r="3" fill="var(--accent)" />
      <circle cx="26.4" cy="22" r="3" fill="currentColor" />
      <circle cx="5.6" cy="22" r="3" fill="currentColor" />
    </svg>
  );
}

/** Deterministic color dot for a wallet, so members are easy to tell apart. */
export function Avatar({ wallet, size = 32 }: { wallet: PublicKey; size?: number }) {
  const bytes = wallet.toBytes();
  const hue = ((bytes[0] << 8) | bytes[1]) % 360;
  const hue2 = (hue + 40 + (bytes[2] % 80)) % 360;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${hue2} 60% 42%))`,
      }}
    />
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Eight members in a ring, one highlighted as this round's recipient. */
export function HeroArt() {
  const seats = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 200 + Math.cos(a) * 150, y: 200 + Math.sin(a) * 150 };
  });
  return (
    <svg className="hero-art" viewBox="0 0 400 400" role="img" aria-label="Members in a ring around a shared pot">
      <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(243,239,230,0.18)" strokeWidth="2" strokeDasharray="6 9" />
      <circle className="hero-orbit" cx="200" cy="200" r="150" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="60 882" strokeLinecap="round" />
      <circle cx="200" cy="200" r="70" fill="var(--accent)" />
      <circle cx="200" cy="200" r="46" fill="none" stroke="#13201C" strokeWidth="4" />
      <text x="200" y="207" textAnchor="middle" fontSize="20" fontWeight="700" fill="#13201C" style={{ fontFamily: "var(--font-display), sans-serif" }}>POT</text>
      {seats.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r="22"
          fill={i === 0 ? "var(--accent)" : "#1E302A"}
          stroke={i === 0 ? "var(--accent)" : "rgba(243,239,230,0.55)"}
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}
