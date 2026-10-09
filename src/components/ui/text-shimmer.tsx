import type { ReactNode } from "react";
export function TextShimmer({children,className=""}:{children:ReactNode;className?:string}) {return <span className={`text-shimmer ${className}`}>{children}</span>;}
