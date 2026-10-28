import {scopedKey} from './accountScope';
import type {Model,Provider} from '../domain/types.ts';
import {isSolarCloudProvider,presentedProvider} from './solarCloud.ts';
import {modelWithProviderLimits} from './providerCapabilities.ts';
/** Explicit account selection first. No silent fallback from an unavailable selection. */
export function teamCloud(providers:Provider[],models:Model[],preferredModelId?:string){
 const preferred=preferredModelId??(typeof localStorage!=='undefined'?localStorage.getItem(scopedKey('solar.team.model')):null);
 const chosen=models.find(m=>m.id===preferred&&m.enabled&&m.available!==false&&providers.some(p=>p.id===m.providerId&&p.enabled));
 if(chosen){const provider=providers.find(p=>p.id===chosen.providerId)!;return {provider,model:modelWithProviderLimits(chosen,provider)};}
 if(preferred)return undefined;
 const local=models.find(m=>m.enabled&&m.available!==false&&providers.some(p=>p.id===m.providerId&&p.enabled&&p.protocol==='ollama'));
 if(local){const provider=providers.find(p=>p.id===local.providerId)!;return{provider,model:modelWithProviderLimits(local,provider)};}
 const eligible=models.filter(m=>m.enabled&&m.available!==false&&providers.some(p=>p.id===m.providerId&&p.enabled&&isSolarCloudProvider(p)));
 const model=eligible.find(m=>/DeepSeek-V4-Flash/i.test(m.providerModelId??m.name))??eligible[0];
 if(!model)return undefined;
 const provider=presentedProvider(providers.find(p=>p.id===model.providerId)!);
 return {provider,model:{...modelWithProviderLimits(model,provider),displayName:"Solar Cloud",displayNameSource:model.name}};
}
