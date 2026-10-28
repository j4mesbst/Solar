import type { DirectPluginId,PluginId } from "./pluginCatalog.ts";
export interface DirectOAuthProfile {provider:"google"|"microsoft";envKey:string;authorize:string;token:string;scopes:string[];required:string[]}
const g="https://www.googleapis.com/auth/";
const google=(...scopes:string[]):DirectOAuthProfile=>({provider:"google",envKey:"VITE_GOOGLE_DESKTOP_CLIENT_ID",authorize:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",scopes:["openid","email",...scopes.map(scope=>g+scope)],required:scopes.map(scope=>g+scope)});
const ms=(...scopes:string[]):DirectOAuthProfile=>({provider:"microsoft",envKey:"VITE_MICROSOFT_CLIENT_ID",authorize:"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",token:"https://login.microsoftonline.com/common/oauth2/v2.0/token",scopes:["openid","email","offline_access","User.Read",...scopes],required:["User.Read",...scopes]});
const profiles:Partial<Record<DirectPluginId,DirectOAuthProfile>>={
 gmail:{...google("gmail.readonly","gmail.send"),scopes:[...google("gmail.readonly","gmail.send").scopes,g+"gmail.compose"]},"google-drive":google("drive.readonly","drive.file"),"google-calendar":google("calendar.readonly","calendar.events"),"google-contacts":google("contacts"),"google-docs":google("documents"),"google-sheets":google("spreadsheets"),"google-tasks":google("tasks"),
 outlook:{...ms("Mail.Read","Mail.Send"),scopes:[...ms("Mail.Read","Mail.Send").scopes,"Mail.ReadWrite"]},"ms-calendar":ms("Calendars.ReadWrite"),onedrive:ms("Files.ReadWrite"),"ms-todo":ms("Tasks.ReadWrite"),"ms-contacts":ms("Contacts.ReadWrite"),onenote:ms("Notes.ReadWrite"),
};
export const directOAuthProfile=(id:PluginId)=>profiles[id as DirectPluginId];
export function missingOAuthScopes(profile:DirectOAuthProfile,scope:string|undefined){
 const granted=(scope??"").split(/[ ,]+/).map(value=>value.replace(/^https:\/\/graph.microsoft.com\//,""));
 return profile.required.filter(value=>!granted.includes(value));
}
