import { scopedKey } from './accountScope.ts';
export function projectConsentKey(){return scopedKey('solar.default-workspace-cloud-consent.v2');}
export function projectConsentScope(workspace:string,provider?:{id:string;baseUrl:string}){
  // Exact matching is intentional; do not inherit the old global boolean or a
  // grant for another account, workspace, endpoint or selected provider.
  return JSON.stringify([workspace,provider?.id??null,provider?.baseUrl??null]);
}
