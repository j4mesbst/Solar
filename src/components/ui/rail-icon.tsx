import { Settings2 } from "lucide-react";

// Icons are split into independently choreographed vector parts. No whole-icon spin.
export function RailIcon({ name }: { name?: string }) {
  const common = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "Accueil") return <svg {...common} className="motion-home"><path className="icon-part roof" d="m4 10.2 6.4-5.5a2.45 2.45 0 0 1 3.2 0l6.4 5.5"/><path className="icon-part walls" d="M5.7 9.4v8.35c0 .86.7 1.55 1.55 1.55h9.5c.86 0 1.55-.7 1.55-1.55V9.4"/><path className="icon-part door" d="M10 19.3v-4.15c0-.64.52-1.15 1.15-1.15h1.7c.64 0 1.15.52 1.15 1.15v4.15"/></svg>;
  if(name === "Work") return <svg {...common}><rect className="icon-part work-frame" x="4" y="5.5" width="16" height="13" rx="2.5"/><path className="icon-part work-glyph" d="m10 10-2.4 2.1 2.4 2.1m4-4.2 2.4 2.1-2.4 2.1"/></svg>;
  if (name === "Plugins") return <svg {...common} className="motion-blocks">{[[4.5,4.5],[13.5,4.5],[4.5,13.5],[13.5,13.5]].map(([x,y],i) => <rect key={i} className={`icon-part tile tile-${i}`} x={x} y={y} width="6" height="6" rx="1.45"/>)}</svg>;
  if (name === "Skills") return <svg {...common} className="motion-skills"><path className="icon-part wand" d="m5.7 18.3 9.5-9.5a2.15 2.15 0 1 1 3.05 3.05l-9.5 9.5a2.15 2.15 0 0 1-3.05-3.05ZM12.9 11.1l3 3"/><path className="icon-part star star-one" d="M5 4v4M3 6h4"/><path className="icon-part star star-two" d="M18 3v3M16.5 4.5h3"/></svg>;
  if (name === "Favoris") return <svg {...common} className="motion-heart"><path className="icon-part heart-line" d="M20 8.4c0 4.6-8 10.1-8 10.1S4 13 4 8.4A4.2 4.2 0 0 1 11.3 5.5L12 6.2l.7-.7A4.2 4.2 0 0 1 20 8.4Z"/><path className="heart-echo" d="m8.7 11.3 3.3 3.2 3.3-3.2"/></svg>;
  return <Settings2 {...common} className="motion-settings" />;
}
