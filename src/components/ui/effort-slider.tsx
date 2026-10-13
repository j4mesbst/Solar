import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./effort-slider.css";

const PALETTE: number[][] = [[212, 22, 58], [210, 48, 52], [165, 40, 45], [260, 38, 62]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hsl = (c: number[], dl = 0) => `hsl(${c[0].toFixed(1)} ${c[1].toFixed(1)}% ${(c[2] + dl).toFixed(1)}%)`;
function colorAt(p: number) {
  const f = Math.max(0, Math.min(0.9999, p)) * (PALETTE.length - 1), i = Math.floor(f), t = f - i;
  return [0, 1, 2].map(k => lerp(PALETTE[i][k], PALETTE[i + 1][k], t));
}

function MorphText({ text, index }: { text: string; index: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const idRef = useRef(0);
  const previous = useRef({ text, index });
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState([{ id: 0, text, dir: 1, leaving: false }]);

  useEffect(() => {
    if (text === previous.current.text) return;
    const dir = index >= previous.current.index ? 1 : -1;
    previous.current = { text, index };
    const id = ++idRef.current;
    setGroups(g => [...g.map(x => ({ ...x, leaving: true })), { id, text, dir, leaving: false }]);
    const timer = window.setTimeout(() => setGroups(g => g.filter(x => x.id >= id)), 520);
    return () => window.clearTimeout(timer);
  }, [text, index]);

  useLayoutEffect(() => {
    const group = el.current?.querySelector<HTMLElement>(".sl-g:not(.sl-leave)");
    if (group && el.current) el.current.style.width = `${group.offsetWidth}px`;
    if (!ready) requestAnimationFrame(() => setReady(true));
  }, [groups, ready]);

  return <span ref={el} className="sl-mt" data-ready={ready}>
    {groups.map(group => <span key={group.id} className={`sl-g ${group.leaving ? "sl-leave" : "sl-enter"}`} style={{ "--dx": `${group.dir * 12}px` } as React.CSSProperties}>
      {[...group.text].map((char, key) => <span key={key} className="sl-c" style={{ "--k": key } as React.CSSProperties}>{char}</span>)}
    </span>)}
  </span>;
}

type Props = { levels: string[]; value: number; onChange: (index: number) => void; defaultIndex?: number };

export function EffortSlider({ levels, value, onChange, defaultIndex = 1 }: Props) {
  const max = Math.max(1, levels.length - 1);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const motion = useRef({ p: value / max, v: 0, target: value / max, drag: false, raf: 0, t: 0 });
  const [dragging, setDragging] = useState(false);
  const [spin, setSpin] = useState(0);
  const [reduced, setReduced] = useState(false);
  const filterId = useRef(`effort-motion-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const render = () => {
    const state = motion.current, element = root.current;
    if (!element) return;
    const color = colorAt(state.p), flow = value === max ? smoothstep((max - 1) / max, 1, state.p) : 0;
    const width = track.current?.getBoundingClientRect().width ?? 280;
    element.style.setProperty("--p", state.p.toFixed(4));
    element.style.setProperty("--x", `${13 + state.p * Math.max(0, width - 26)}px`);
    element.style.setProperty("--fill", `${state.p * width}px`);
    element.style.setProperty("--c", hsl(color)); element.style.setProperty("--c1", hsl(color, -7)); element.style.setProperty("--c2", hsl(color, 5));
    element.style.setProperty("--flow", flow.toFixed(3)); element.style.setProperty("--glow", (0.7 * flow).toFixed(3));
    blur.current?.setAttribute("stdDeviation", `${reduced ? 0 : Math.min(9, Math.abs(state.v) * width * 0.011).toFixed(2)} 0`);
  };
  const tick = (now: number) => {
    const state = motion.current, dt = Math.min(0.032, (now - state.t) / 1000); state.t = now;
    if (reduced) { state.p = state.target; state.v = 0; }
    else { const stiffness = state.drag ? 520 : 240, damping = state.drag ? 42 : 24; state.v += (stiffness * (state.target - state.p) - damping * state.v) * dt; state.p += state.v * dt; }
    render();
    if (!reduced && (Math.abs(state.v) > 0.0006 || Math.abs(state.target - state.p) > 0.0004 || state.drag)) state.raf = requestAnimationFrame(tick);
    else { state.p = state.target; state.v = 0; render(); state.raf = 0; }
  };
  const kick = () => { const state = motion.current; if (!state.raf) { state.t = performance.now(); state.raf = requestAnimationFrame(tick); } };

  useEffect(() => { motion.current.target = value / max; kick(); }, [value, max]);
  useEffect(() => {
    render();
    const resize = new ResizeObserver(render);
    if (track.current) resize.observe(track.current);
    return () => { cancelAnimationFrame(motion.current.raf); resize.disconnect(); };
  }, []);
  useEffect(() => {
    if (!reduced) return;
    const state = motion.current;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.drag = false;
    state.p = state.target;
    state.v = 0;
    setDragging(false);
    render();
  }, [reduced]);

  const fromEvent = (event: React.PointerEvent) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left - 13) / Math.max(1, rect.width - 26)));
  };
  const move = (event: React.PointerEvent) => { const p = fromEvent(event); motion.current.target = p; onChange(Math.round(p * max)); kick(); };
  const down = (event: React.PointerEvent) => { motion.current.drag = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); move(event); };
  const up = () => { const state = motion.current; if (!state.drag) return; state.drag = false; setDragging(false); state.target = value / max; kick(); };
  const key = (event: React.KeyboardEvent) => {
    let next = value;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(max, value + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, value - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault(); onChange(next);
  };
  const reset = () => { setSpin(n => n + 1); onChange(defaultIndex); };

  return <div ref={root} className="sl">
    <svg width="0" height="0" className="sl-filter" aria-hidden="true" focusable="false"><filter id={filterId.current} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB"><feGaussianBlur ref={blur} stdDeviation="0 0"/></filter></svg>
    <div className="sl-top"><span className="sl-lab" data-max={value === max} aria-live="polite"><MorphText text={levels[value]} index={value}/></span><button type="button" className="sl-reset" aria-label={`Revenir à ${levels[defaultIndex]}`} data-spin={spin % 2} onClick={reset}><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg></button></div>
    <div ref={track} className="sl-track" data-drag={dragging} onPointerDown={down} onPointerMove={event => motion.current.drag && move(event)} onPointerUp={up} onPointerCancel={up}>
      <div className="sl-rail"/><div className="sl-fill"><div className="sl-flow"/></div><div className="sl-head" style={{ filter: `url(#${filterId.current})` }}/>
      <div className="sl-thumb" role="slider" tabIndex={0} aria-label="Effort" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={levels[value]} onKeyDown={key} style={{ filter: `url(#${filterId.current})` }}/>
    </div>
    <div className="sl-labels">{levels.map((label, index) => <button key={label} type="button" aria-pressed={index === value} style={{ left: `calc(13px + ${(index / max) * 100}% - ${(index / max) * 26}px)` }} onClick={() => onChange(index)}>{label}</button>)}</div>
  </div>;
}
