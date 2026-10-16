import type { Model } from "../domain/types";
export const isLegacySolar9B = (id: string) => /ornith[-_/]1[._]0[-_/].*9b/i.test(id);
export function localModelIdentity(model: Model): Model {
  const id=model.providerModelId??model.name;
  const label=id==="ornith-1.5:9b"?"Solar 9B":isLegacySolar9B(id)?"Solar 9B · Ornith 1.0 (ancien)":id==="qwen3:4b"?"Solar 4B":id==="gemma3:12b"?"Solar 12B":undefined;
  if(!label)return model;
  return {...model,name:label,displayName:label,displayNameSource:label,capabilities:[...new Set([...model.capabilities,...(/ornith|gemma3/.test(id)?["solar-code-recommended"]:[]),...(id==="ornith-1.5:9b"?["solar-cortex"]:[])])]};
}
