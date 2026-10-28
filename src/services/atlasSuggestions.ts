import { pluginCatalog, type PluginId } from "./pluginCatalog.ts";
import { savedConnection } from "./pluginAccounts.ts";
import { solarAgentStore } from "./solarAgentStore.ts";
export interface AtlasSuggestion { id:string; service:PluginId; text:string }
const prompts:Partial<Record<PluginId,string[]>>={
 gmail:["Résume mes trois derniers e-mails et les suites à donner","Trouve les e-mails dont je peux me désabonner, sans rien modifier","Repère les e-mails récents qui attendent une réponse"],
 outlook:["Résume mes trois derniers e-mails Outlook","Repère les messages Outlook qui attendent une réponse","Fais le point sur mes derniers échanges Outlook"],
 "google-drive":["Retrouve mes fichiers Google Drive récemment modifiés","Fais le point sur mes fichiers Google Drive récemment modifiés","Retrouve les documents utiles à mon projet dans Google Drive"],
 "google-calendar":["Prépare-moi pour ma prochaine réunion Google Agenda","Fais le point sur mon programme Google Agenda de demain","Trouve mes créneaux disponibles cette semaine dans Google Agenda"],
 "ms-calendar":["Prépare-moi pour ma prochaine réunion Microsoft Calendrier","Résume mon programme Microsoft Calendrier de demain","Trouve un créneau libre dans Microsoft Calendrier cette semaine"],
 github:["Fais le point sur l’activité récente de mes dépôts GitHub","Vérifie depuis quand mon dépôt GitHub n’a pas été mis à jour","Résume les contributions accessibles sur mon profil GitHub"],
 slack:["Retrouve les décisions récentes dans mes canaux Slack","Résume les échanges récents de mon équipe sur Slack","Repère les questions en attente dans mes canaux Slack"],
 linear:["Fais le point sur mes issues Linear et leurs priorités","Repère les tâches Linear à reprendre en premier","Résume l’avancement de mes projets Linear"],
 notion:["Retrouve mes pages Notion liées à mon projet","Résume les pages récemment partagées dans Notion"],
 "google-contacts":["Retrouve les contacts Google utiles à mon projet"],"google-docs":["Aide-moi à retrouver et résumer un document Google Docs"],"google-sheets":["Aide-moi à analyser un tableau Google Sheets"],"google-tasks":["Fais le point sur mes tâches Google Tasks"],onedrive:["Retrouve mes fichiers OneDrive récemment modifiés"],"ms-todo":["Fais le point sur mes tâches Microsoft To Do"],"ms-contacts":["Retrouve mes contacts Microsoft utiles"],onenote:["Retrouve mes notes de projet dans OneNote"],
 discord:["Résume les échanges Discord accessibles à mon bot"],todoist:["Fais le point sur mes tâches Todoist"],airtable:["Fais le point sur les bases Airtable accessibles"],figma:["Aide-moi à analyser un fichier Figma"],asana:["Résume l’avancement de mes projets Asana"],clickup:["Fais le point sur mes tâches ClickUp"],monday:["Résume les éléments de mes tableaux monday.com"],gitlab:["Fais le point sur mes projets et issues GitLab"],hubspot:["Résume mes opportunités HubSpot"],vercel:["Vérifie l’état de mes derniers déploiements Vercel"],netlify:["Vérifie l’état de mes derniers déploiements Netlify"],cloudflare:["Fais le point sur mes zones et DNS Cloudflare"],webflow:["Fais le point sur mes sites et collections Webflow"],brevo:["Fais le point sur mes listes de contacts Brevo"],readwise:["Retrouve mes lectures et passages surlignés dans Readwise"]
};
const priority=["gmail","google-drive","google-calendar","outlook","ms-calendar","github","linear","slack"];
export function selectAtlasSuggestions(connected:PluginId[],history:{goal:string;updatedAt:string}[],seed:string):AtlasSuggestion[]{
 const services=[...new Set(connected)];if(services.length<3)return [];
 const score=(service:PluginId)=>{const info=pluginCatalog.find(p=>p.id===service)!;return history.slice(-50).reduce((n,item)=>n+(info.aliases.some(alias=>item.goal.toLocaleLowerCase().includes(alias.toLocaleLowerCase()))?5:0),0)+(priority.includes(service)?(priority.length-priority.indexOf(service))*.1:0);};
 return services.sort((a,b)=>score(b)-score(a)).slice(0,3).map(service=>{const options=prompts[service]??[];const recent=history.filter(h=>options.includes(h.goal));const unused=options.filter(t=>!recent.slice(-2).some(h=>h.goal===t));const choices=unused.length?unused:options;const hash=[...seed+service].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);let text=choices[hash%choices.length];
  if(service==="github"){const last=[...history].reverse().find(h=>/github/i.test(h.goal)&&/(?:github\.com\/)?[\w.-]+\/[\w.-]+/.test(h.goal));const repo=last?.goal.match(/(?:github\.com\/)?([\w.-]+\/[\w.-]+)/)?.[1];if(repo&&repo.length<=100&&!repo.includes(".."))text=`Fais le point sur l’activité récente de mon dépôt GitHub ${repo}`;}
  return {id:`${service}:${hash}`,service,text};});
}
export async function preloadAtlasSuggestions(conversationId:string){
 const connected=(await Promise.all(pluginCatalog.map(async p=>await savedConnection(p.id)?p.id:undefined))).filter((id):id is PluginId=>Boolean(id));
 const data=await solarAgentStore.snapshot();const history=data.missions.filter(m=>m.agentId===data.atlas?.agentId&&m.status==="completed"&&!m.origin).map(m=>({goal:m.requestText??m.goal,updatedAt:m.updatedAt}));
 return selectAtlasSuggestions(connected,history,conversationId);
}
