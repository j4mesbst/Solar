import { AtlasMascot } from "./AtlasMascot";
import type { AtlasMood } from "./types";

type Props = { mood: AtlasMood; open: boolean; onToggle: () => void; showMascot?:boolean };

export function AtlasHeader({ mood, open, onToggle, showMascot=true }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[10px] z-[28] flex flex-col items-center">
      {/* la mascotte n'est PAS un bouton */}
      {showMascot && <AtlasMascot mood={mood} />}
      {/* le bouton des réglages = uniquement le nom */}
      <button
        type="button"
        aria-label="Réglages d'Atlas"
        aria-expanded={open}
        onClick={onToggle}
        className={`atlas-glass atlas-press atlas-name-button pointer-events-auto inline-flex items-center gap-[5px] rounded-full py-1.5 pl-4 pr-3 text-[14px] font-semibold tracking-[-0.1px] text-black ${showMascot?"atlas-name-under-mascot":""}`}
      >
        <span>Atlas</span>
        <svg
          aria-hidden="true"
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8e8e93"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .25s ease" }}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
