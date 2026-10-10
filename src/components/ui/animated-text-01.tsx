import type { HTMLAttributes } from "react";

/** Supplied shine pattern, driven by actual operation state rather than a timer. */
export default function AnimatedShinyText({ children, className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={`shiny animated-shiny-text ${className}`}>{children}</span>;
}
