"use client";

/** Adapted from AI Text Loading by @kokonutui, v1.0.0 (MIT).
 * https://github.com/kokonut-labs/kokonutui
 * Compact app sizing; labels come from observed provider phases.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
}
const DEFAULT_TEXTS = ["Solar prépare la réponse…"];
export default function AITextLoading({ texts = DEFAULT_TEXTS, className, interval = 1500 }: AITextLoadingProps) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const labels = texts.length ? texts : DEFAULT_TEXTS;
  useEffect(() => {
    if (labels.length < 2) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % labels.length), interval);
    return () => clearInterval(timer);
  }, [interval, labels.length]);
  const text = labels[index % labels.length];
  return <div className={cn("ai-text-loading", className)} role="status">
    <span className="normal-loading-dots" aria-hidden="true"><i/><i/><i/></span>
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={text} className="ai-loading-label"
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={{ opacity: 1, y: 0, ...(reduced ? {} : { backgroundPosition: ["200% center", "-200% center"] }) }}
        exit={{ opacity: 0, y: reduced ? 0 : -4 }}
        transition={{ opacity: { duration: .2 }, y: { duration: .2 }, backgroundPosition: { duration: 2.5, ease: "linear", repeat: Infinity } }}>
        {text}
      </motion.span>
    </AnimatePresence>
  </div>;
}
