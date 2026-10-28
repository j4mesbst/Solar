import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolExecutionContext } from "../../services/toolRegistry";
import {ActivityPresentation,type ActivityDisplay} from './activityPresentation';
export type ToolActivityEvent = Parameters<NonNullable<ToolExecutionContext["onEvent"]>>[0];

/** Counts pending calls, including overlapping calls to the same tool. No data
 * from inputs, results, reasoning or credentials enters this display state. */
export function useToolActivity() {
  const [display,setDisplay]=useState<ActivityDisplay>();
  const tracker=useRef<ActivityPresentation>();if(!tracker.current)tracker.current=new ActivityPresentation(setDisplay);
  useEffect(()=>()=>tracker.current?.reset(),[]);
  const reset=useCallback(()=>tracker.current?.reset(),[]),finish=useCallback(()=>tracker.current?.finish(),[]);
  const observe=useCallback((event:ToolActivityEvent)=>tracker.current?.observe(event),[]);
  return {activity:display?.id,tool:display?.tool,phase:display?.phase,observe,reset,finish};
}
