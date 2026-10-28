import type { AtlasPermissionDecision, AtlasPermissionRequest } from "./types";

type Props = {
  request: AtlasPermissionRequest;
  onDecision: (d: AtlasPermissionDecision) => void;
};

export function PermissionCard({ request, onDecision }: Props) {
  return (
    <div className="atlas-row atlas-glass mt-[22px] flex flex-col gap-3.5 rounded-[30px] p-[18px]">
      <div className="flex items-center gap-2.5 text-[16px] font-semibold tracking-[-0.2px]">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
        <span>{request.title}</span>
      </div>

      <div className="flex flex-col gap-0.5 rounded-[18px] bg-[rgba(120,120,128,0.10)] px-4 py-[11px]">
        <span className="text-[12px] font-medium text-[#6e6e73]">Résumé de la tâche</span>
        <span className="text-[15px] text-[#1c1c1e]">{request.summary}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onDecision("allow")} className="atlas-blue rounded-full bg-[#0a84ff] px-[22px] py-[11px] text-[15px] font-semibold text-white">
          Autoriser
        </button>
        <button type="button" onClick={() => onDecision("deny")} className="atlas-soft rounded-full bg-[rgba(120,120,128,0.12)] px-[22px] py-[11px] text-[15px] font-semibold text-[#1c1c1e]">
          Refuser
        </button>
      </div>
    </div>
  );
}
