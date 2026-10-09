import { useEffect, useState } from "react";
// Keep the surface for its brief exit, while immediately removing it from interaction/a11y.
export function useAnimatedPresence(open: boolean, duration = 140) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return { mounted: open || mounted, closing: !open };
}
