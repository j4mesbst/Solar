"use client";

/** AI Text Loading by @kokonutui, v1.0.0, MIT.
 * https://github.com/kokonut-labs/kokonutui
 * Phase labels are supplied by Solar; reduced motion keeps text readable.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
interface AITextLoadingProps { texts?: string[]; className?: string; interval?: number }
const DEFAULT_TEXTS = ["Thinking...", "Processing...", "Analyzing...", "Computing...", "Almost..."];
export default function AITextLoading({ texts = DEFAULT_TEXTS, className, interval = 10000 }: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const reduced = useReducedMotion();
  const labels = texts.length ? texts : DEFAULT_TEXTS;
  useEffect(() => {
    const timer = setInterval(() => setCurrentTextIndex(prev => (prev + 1) % labels.length), interval);
    return () => clearInterval(timer);
  }, [interval, labels.length]);
  const text = labels[currentTextIndex % labels.length];
  return <div className="ai-text-loading flex items-center justify-start" role="status" aria-live="polite">
    <motion.div animate={{ opacity: 1 }} className="relative w-full" initial={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .4 }}>
      <AnimatePresence mode="wait">
        <motion.div key={text} className={cn("ai-loading-label flex justify-start bg-[length:200%_100%] bg-gradient-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text font-medium text-base text-transparent dark:from-white dark:via-neutral-600 dark:to-white", className)}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0, ...(reduced ? {} : { backgroundPosition: ["200% center", "-200% center"] }) }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ opacity: { duration: reduced ? 0 : .3 }, y: { duration: reduced ? 0 : .3 }, backgroundPosition: { duration: 2.5, ease: "linear", repeat: Infinity } }}>
          {text}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  </div>;
}
