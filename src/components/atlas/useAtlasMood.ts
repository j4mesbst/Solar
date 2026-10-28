import { useEffect, useState } from "react";
import type { AtlasMood, AtlasStatus } from "./types";
export function useAtlasMood(status: AtlasStatus, completedRevision = 0): AtlasMood {
  const [happy, setHappy] = useState(false);
  useEffect(() => { if (!completedRevision) return; setHappy(true); const timer = setTimeout(() => setHappy(false), 2000); return () => clearTimeout(timer); }, [completedRevision]);
  return status !== "idle" ? status : happy ? "happy" : "idle";
}
