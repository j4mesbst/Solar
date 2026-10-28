import {solarCloudModelLabel} from "./solarCloud.ts";
import type { Model, Provider } from "../domain/types.ts";
// Exact deployment profiles, checked 2026-10-22. Never infer a capacity from a
// family name. Explicit API metadata or a user setting takes precedence.
// Gonka's serving registry: https://gonka.pro/models/ (input + output).
// Router specifications: https://gonkarouter.io/docs#limits-specifications
const gonka:Record<string,number>={"zai-org/GLM-5.3-Flash":400000,"deepseek-ai/DeepSeek-V4-Flash-0731":400000,"MiniMaxAI/MiniMax-M2.7":180000};
export function modelWithProviderLimits(model:Model,provider:Pick<Provider,"protocol"|"baseUrl">):Model{
 let host="";try{host=new URL(provider.baseUrl).hostname;}catch{return model;}
 const label=solarCloudModelLabel(model,provider);
 if(label)model={...model,displayName:label,displayNameSource:model.name};
 const context=host==="api.gonkarouter.io"?gonka[model.providerModelId??model.name]:undefined;
 return context?{...model,...(!model.contextWindow?{contextWindow:context,contextSource:"documented" as const,contextSourceUrl:"https://gonka.pro/models/"}:{}),maxOutputTokens:model.maxOutputTokens??4096,capabilities:[...new Set([...(model.capabilities??[]),"tools"]) ]}:model;
}
