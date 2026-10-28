import { useId } from "react";
import type { AtlasMood } from "./types";

type Props = {
  mood?: AtlasMood;
  size?: number;
  /** false = version fixe (ex. dans la fenêtre de réglages) */
  animated?: boolean;
};

export function AtlasMascot({ mood = "idle", size = 64, animated = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const busy = mood === "thinking" || mood === "working";

  const o = {
    eyeL: mood === "happy" ? 0 : 1,
    eyeR: mood === "happy" || mood === "working" ? 0 : 1,
    arcL: mood === "happy" ? 1 : 0,
    arcR: mood === "happy" || mood === "working" ? 1 : 0,
    flat: mood === "thinking" ? 1 : 0,
    tongue: mood === "working" ? 1 : 0,
    smile: mood === "happy" || mood === "working" ? 1 : 0,
  };

  const svgClass = animated && busy ? "atlas-pulse atlas-fast" : undefined;
  const lookClass = animated ? (busy ? "atlas-think" : "atlas-look") : undefined;

  return (
    <div className={animated ? "atlas-float" : undefined} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label="Atlas"
        className={svgClass}
        style={{ overflow: "visible", filter: "drop-shadow(0 5px 9px rgba(47,120,255,0.30))" }}
      >
        <defs>
          <radialGradient id={`${uid}-body`} cx="50%" cy="68%" r="62%">
            <stop offset="0" stopColor="#2f78ff" />
            <stop offset="0.42" stopColor="#5a9cff" />
            <stop offset="0.78" stopColor="#cfe0ff" />
            <stop offset="1" stopColor="#ffffff" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <circle cx="50" cy="50" r="46" />
          </clipPath>
          <filter id={`${uid}-blur`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id={`${uid}-blur2`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <circle cx="50" cy="50" r="46" fill={`url(#${uid}-body)`} />
        <g clipPath={`url(#${uid}-clip)`}>
          <ellipse className={animated ? "atlas-blobA" : undefined} cx="62" cy="72" rx="20" ry="14" fill="#7a6bff" opacity="0.45" filter={`url(#${uid}-blur)`} />
          <ellipse className={animated ? "atlas-blobB" : undefined} cx="36" cy="66" rx="18" ry="13" fill="#2fd0ff" opacity="0.45" filter={`url(#${uid}-blur)`} />
        </g>
        <ellipse cx="37" cy="22" rx="15" ry="7" transform="rotate(-18 37 22)" fill="#fff" opacity="0.6" filter={`url(#${uid}-blur2)`} />
        <circle cx="50" cy="50" r="45.5" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.4" />

        {/* yeux ouverts (clignent + regardent) */}
        <g className={lookClass}>
          <g className={animated ? "atlas-blink" : undefined}>
            <ellipse className="atlas-face" cx="38" cy="42" rx="3.6" ry="5" fill="#1b1b1f" style={{ opacity: o.eyeL }} />
            <ellipse className="atlas-face" cx="62" cy="42" rx="3.6" ry="5" fill="#1b1b1f" style={{ opacity: o.eyeR }} />
          </g>
        </g>
        {/* yeux en arc (content / clin d'œil) */}
        <path className="atlas-face" d="M33 44 Q38 37 43 44" fill="none" stroke="#1b1b1f" strokeWidth="2.6" strokeLinecap="round" style={{ opacity: o.arcL }} />
        <path className="atlas-face" d="M57 44 Q62 37 67 44" fill="none" stroke="#1b1b1f" strokeWidth="2.6" strokeLinecap="round" style={{ opacity: o.arcR }} />
        {/* bouche */}
        <path className="atlas-face" d="M45.5 59 L54.5 59" fill="none" stroke="#1b1b1f" strokeWidth="2.4" strokeLinecap="round" style={{ opacity: o.flat }} />
        <ellipse className="atlas-face" cx="52" cy="63.5" rx="3.2" ry="3.8" fill="#ff7f98" style={{ opacity: o.tongue }} />
        <path className="atlas-face" d="M43.5 57 Q50 64 56.5 57" fill="none" stroke="#1b1b1f" strokeWidth="2.4" strokeLinecap="round" style={{ opacity: o.smile }} />
      </svg>
    </div>
  );
}
