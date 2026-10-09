// Icons are split into independently choreographed vector parts. No whole-icon spin.
export function RailIcon({ name }: { name?: string }) {
  const common = { viewBox: "0 0 24 24", width: 21, height: 21, fill: "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (name === "Accueil") return <svg {...common} className="motion-home"><path className="icon-part roof" d="m3 10 9-7 9 7"/><path className="icon-part walls" d="M5 9v11h14V9"/><path className="icon-part door" d="M9 20v-7h6v7"/></svg>;
  if (name === "Plugins") return <svg {...common} className="motion-blocks">{[[4,4],[13,4],[4,13],[13,13]].map(([x,y],i) => <rect key={i} className={`icon-part tile tile-${i}`} x={x} y={y} width="7" height="7" rx="1.5"/>)}</svg>;
  if (name === "Skills") return <svg {...common} className="motion-skills"><path className="icon-part wand" d="m4 20 12-12 3 3L7 23ZM13 11l3 3"/><path className="icon-part star star-one" d="M5 3v6M2 6h6"/><path className="icon-part star star-two" d="M17 2v4M15 4h4"/><path className="icon-part star star-three" d="M21 17v4M19 19h4"/></svg>;
  if (name === "Favoris") return <svg {...common} className="motion-heart"><path className="icon-part heart-line" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path className="heart-echo" d="m8 12 4 4 4-4"/></svg>;
  return <svg {...common} className="motion-settings"><g className="icon-part gear-teeth"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z"/></g><circle className="icon-part gear-center" cx="12" cy="11" r="3"/></svg>;
}
