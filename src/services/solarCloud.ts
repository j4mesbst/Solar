import type {Model,Provider} from '../domain/types.ts';

export const SOLAR_CLOUD_NAME='Solar Cloud';
export const SOLAR_CLOUD_BUSY_MESSAGE='Solar est trop occupé pour le moment. Réessaie plus tard.';
const aliases:Readonly<Record<string,string>>={
 'zai-org/GLM-5.3-Flash':'GLM 5.3 Flash',
 'deepseek-ai/DeepSeek-V4-Flash-0731':'DeepSeek V4 Flash',
 'MiniMaxAI/MiniMax-M2.7':'MiniMax M2.7',
};
/** Presentation only: never replace wire identifiers, endpoints or vault refs. */
export function isSolarCloudProvider(provider:Pick<Provider,'protocol'|'baseUrl'>){
 try{return provider.protocol==='openai-compatible'&&new URL(provider.baseUrl).hostname==='api.gonkarouter.io';}catch{return false;}
}
export function solarCloudModelLabel(model:Model,provider:Pick<Provider,'protocol'|'baseUrl'>){return isSolarCloudProvider(provider)?aliases[model.providerModelId??model.name]:undefined;}
export function presentedProvider(provider:Provider):Provider{return isSolarCloudProvider(provider)?{...provider,name:SOLAR_CLOUD_NAME}:provider;}
export const solarCloudBusyStatus=(status:number)=>status===408||status===425||status===429||status>=500;
/** Provider's error payload is never rendered. Structured codes can distinguish
 * authentication/configuration from a temporary outage, even inside a 200 SSE. */
export function solarCloudStreamError(error:unknown):'unauthorized'|'model'|'busy'{
 const value=typeof error==='string'?error:JSON.stringify(error)??'';
 if(/unauthoriz|invalid[_ -]?(?:api[_ -]?)?key|authentication|permission[_ -]denied|\b40[13]\b/i.test(value))return 'unauthorized';
 if(/model[_ -]not[_ -]found|context[_ -]length[_ -]exceeded|invalid[_ -](?:request|parameter)|unsupported[_ -](?:tool|format)/i.test(value))return 'model';
 return 'busy';
}
