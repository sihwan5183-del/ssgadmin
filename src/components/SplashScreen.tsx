import { useEffect, useState } from "react";
import udakLogo from "@/assets/udak-logo.png";

/**
 * 앱 진입 시 표시되는 스플래시 화면.
 * - 흰색 배경 + 중앙 로고 등장 애니메이션 (CSS)
 * - 약 1.6초 후 부드럽게 fade-out
 */
export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1500);
    const t2 = window.setTimeout(() => onDone(), 2050);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden
      style={{ backgroundColor: "#FFFFFF", colorScheme: "light" }}
      className={`splash-root fixed inset-0 z-[9999] grid place-items-center transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 은은한 배경 글로우 */}
      <div className="absolute inset-0 splash-bg-glow" />

      <div className="relative flex flex-col items-center gap-5">
        {/* 로고 등장 */}
        <div className="relative">
          <span className="absolute inset-0 rounded-3xl splash-ring" />
          <img
            src={udakLogo}
            alt="UDak"
            className="relative size-36 md:size-40 object-contain rounded-3xl splash-logo"
            draggable={false}
          />
        </div>

        {/* 슬로건 */}
        <p className="splash-tagline text-[11px] md:text-xs tracking-[0.32em] uppercase text-neutral-400 font-medium">
          Advanced Telecom Solution
        </p>

        {/* 로딩 인디케이터 */}
        <div className="splash-loader mt-1 flex gap-1.5">
          <span />
          <span />
          <span />
        </div>
      </div>

      <style>{`
        .splash-root { background-color: #FFFFFF !important; color-scheme: light; }
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: translateY(24px) scale(0.82); filter: blur(8px); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.25); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1.2); filter: blur(0); }
        }
        @keyframes splashRing {
          0%   { opacity: 0; transform: scale(0.6); box-shadow: 0 0 0 0 hsl(325 85% 52% / 0.35); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.6); box-shadow: 0 0 0 24px hsl(325 85% 52% / 0); }
        }
        @keyframes splashTagline {
          0%   { opacity: 0; transform: translateY(8px); letter-spacing: 0.18em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.32em; }
        }
        @keyframes splashBg {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1; }
        }
        .splash-logo {
          animation: splashLogoIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          box-shadow:
            0 0 0 6px rgba(255, 255, 255, 0.9),
            0 18px 50px -12px hsl(325 85% 52% / 0.45),
            0 8px 24px -6px hsl(22 95% 55% / 0.30);
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.08));
        }
        .splash-ring {
          animation: splashRing 1400ms ease-out 200ms both;
          border: 2px solid hsl(325 85% 52% / 0.55);
        }
        .splash-tagline {
          animation: splashTagline 700ms ease-out 700ms both;
        }
        .splash-bg-glow {
          background:
            radial-gradient(60% 50% at 50% 45%, hsl(325 85% 52% / 0.06), transparent 70%),
            radial-gradient(40% 35% at 50% 55%, hsl(22 95% 55% / 0.05), transparent 70%);
          animation: splashBg 600ms ease-out both;
        }
        .splash-loader span {
          width: 6px; height: 6px; border-radius: 9999px;
          background: linear-gradient(135deg, hsl(325 85% 52%), hsl(22 95% 55%));
          display: inline-block;
          animation: splashDot 1.1s ease-in-out infinite both;
        }
        .splash-loader span:nth-child(1) { animation-delay: 0s; }
        .splash-loader span:nth-child(2) { animation-delay: 0.15s; }
        .splash-loader span:nth-child(3) { animation-delay: 0.30s; }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo, .splash-ring, .splash-tagline, .splash-bg-glow, .splash-loader span {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;