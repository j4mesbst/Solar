import {integrationRequest} from "./integrationApi.ts";
import type {KeyPluginId} from "./pluginCatalog.ts";
import type {ToolDefinition,ToolRisk} from "./toolRegistry.ts";
const str=(description:string,maxLength=500)=>({type:"string",minLength:1,maxLength,description});
const opt=(description:string,maxLength=500)=>({type:"string",maxLength,description});
const e=encodeURIComponent;
const id=(v:string)=>{if(!v||v==="."||v===".."||/[\/\\?#\x00-\x1f]/.test(v))throw Error("Identifiant de ressource invalide.");return e(v);};
const api=(plugin:KeyPluginId,path:string,s:AbortSignal,body?:unknown,method?:string)=>integrationRequest(plugin,path,{signal:s,body,method:method??(body===undefined?"GET":"POST")});
function tool(pluginId:KeyPluginId,name:string,description:string,properties:Record<string,unknown>,required:string[],run:(i:any,s:AbortSignal)=>Promise<unknown>,risk:ToolRisk="read"):ToolDefinition{return {name:`${pluginId}.${name}`,pluginId,description,parameters:{type:"object",properties,required,additionalProperties:false},permissions:[`${pluginId}.${risk==="read"?"read":"write"}`],risk,externalEffects:risk!=="read",execute:(i,s)=>run(i,s)};}
const email=(v:string)=>{if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error("Adresse e-mail invalide.");return v;};
export const keyIntegrationTools:ToolDefinition[]=[
 tool("airtable","list_bases","Lister les bases Airtable autorisées au jeton.",{},[],(_i,s)=>api("airtable","/meta/bases",s)),
 tool("airtable","list_tables","Lire le schéma des tables d’une base Airtable.",{baseId:str("ID base")},["baseId"],(i,s)=>api("airtable",`/meta/bases/${id(i.baseId)}/tables`,s)),
 tool("airtable","list_records","Lire les enregistrements d’une table Airtable, avec pagination.",{baseId:str("ID base"),tableId:str("ID ou nom table"),offset:opt("Curseur offset")},["baseId","tableId"],(i,s)=>api("airtable",`/${id(i.baseId)}/${id(i.tableId)}?pageSize=100${i.offset?`&offset=${e(i.offset)}`:""}`,s)),
 tool("airtable","create_record","Créer un enregistrement Airtable après confirmation des champs exacts.",{baseId:str("ID base"),tableId:str("ID table"),fields:{type:"object",minProperties:1,maxProperties:50,additionalProperties:{type:["string","number","boolean","null"],maxLength:10000}}},["baseId","tableId","fields"],(i,s)=>api("airtable",`/${id(i.baseId)}/${id(i.tableId)}`,s,{fields:i.fields}),"write"),
 tool("figma","read_file","Lire la structure d’un fichier Figma connu (profondeur limitée).",{fileKey:str("Clé du fichier dans son URL")},["fileKey"],(i,s)=>api("figma",`/files/${id(i.fileKey)}?depth=2`,s)),
 tool("figma","list_comments","Lire les commentaires d’un fichier Figma.",{fileKey:str("Clé fichier")},["fileKey"],(i,s)=>api("figma",`/files/${id(i.fileKey)}/comments`,s)),
 tool("figma","create_comment","Ajouter un commentaire Figma après confirmation du texte.",{fileKey:str("Clé fichier"),message:str("Commentaire exact",5000)},["fileKey","message"],(i,s)=>api("figma",`/files/${id(i.fileKey)}/comments`,s,{message:i.message}),"publish"),
 tool("asana","list_workspaces","Lister les espaces Asana accessibles.",{},[],(_i,s)=>api("asana","/workspaces?limit=100",s)),
 tool("asana","list_projects","Lister les projets d’un espace Asana.",{workspaceId:str("ID espace")},["workspaceId"],(i,s)=>api("asana",`/workspaces/${id(i.workspaceId)}/projects?limit=100&archived=false`,s)),
 tool("asana","read_task","Lire une tâche Asana.",{id:str("ID tâche")},["id"],(i,s)=>api("asana",`/tasks/${id(i.id)}`,s)),
 tool("asana","create_task","Créer une tâche Asana dans un projet après confirmation.",{projectId:str("ID projet"),name:str("Titre"),notes:opt("Description",10000)},["projectId","name"],(i,s)=>api("asana","/tasks",s,{data:{name:i.name,notes:i.notes??"",projects:[i.projectId]}}),"write"),
 tool("clickup","list_workspaces","Lister les espaces de travail ClickUp autorisés.",{},[],(_i,s)=>api("clickup","/team",s)),
 tool("clickup","list_spaces","Lister les espaces d’un workspace ClickUp.",{teamId:str("ID workspace")},["teamId"],(i,s)=>api("clickup",`/team/${id(i.teamId)}/space?archived=false`,s)),
 tool("clickup","list_lists","Lister les listes sans dossier d’un espace ClickUp.",{spaceId:str("ID espace")},["spaceId"],(i,s)=>api("clickup",`/space/${id(i.spaceId)}/list?archived=false`,s)),
 tool("clickup","list_tasks","Lire les tâches d’une liste ClickUp.",{listId:str("ID liste")},["listId"],(i,s)=>api("clickup",`/list/${id(i.listId)}/task?archived=false&page=0`,s)),
 tool("clickup","create_task","Créer une tâche ClickUp après confirmation.",{listId:str("ID liste"),name:str("Titre"),description:opt("Description",10000)},["listId","name"],(i,s)=>api("clickup",`/list/${id(i.listId)}/task`,s,{name:i.name,description:i.description??""}),"write"),
 tool("monday","list_boards","Lister les tableaux monday.com accessibles.",{},[],(_i,s)=>api("monday","/v2",s,{query:"query { boards(limit:50) { id name description } }"})),
 tool("monday","read_board","Lire les premiers éléments d’un tableau monday.com.",{boardId:str("ID tableau")},["boardId"],(i,s)=>api("monday","/v2",s,{query:"query($ids:[ID!]) { boards(ids:$ids) { id name items_page(limit:50) { cursor items {id name} } } }",variables:{ids:[i.boardId]}})),
 tool("monday","create_item","Créer un élément monday.com après confirmation.",{boardId:str("ID tableau"),name:str("Nom exact")},["boardId","name"],(i,s)=>api("monday","/v2",s,{query:"mutation($board:ID!,$name:String!) { create_item(board_id:$board,item_name:$name) {id name} }",variables:{board:i.boardId,name:i.name}}),"write"),
 tool("gitlab","search_projects","Rechercher les projets GitLab.com auxquels le compte appartient.",{query:opt("Recherche")},[],(i,s)=>api("gitlab",`/projects?membership=true&per_page=50&search=${e(i.query??"")}`,s)),
 tool("gitlab","list_issues","Lire les issues d’un projet GitLab.com.",{projectId:str("ID numérique projet")},["projectId"],(i,s)=>api("gitlab",`/projects/${id(i.projectId)}/issues?per_page=50`,s)),
 tool("gitlab","create_issue","Créer une issue GitLab après confirmation.",{projectId:str("ID projet"),title:str("Titre"),description:opt("Description",10000)},["projectId","title"],(i,s)=>api("gitlab",`/projects/${id(i.projectId)}/issues`,s,{title:i.title,description:i.description??""}),"write"),
 tool("hubspot","list_contacts","Lire les contacts HubSpot autorisés au jeton privé.",{after:opt("Curseur")},[],(i,s)=>api("hubspot",`/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname${i.after?`&after=${e(i.after)}`:""}`,s)),
 tool("hubspot","list_deals","Lire les opportunités HubSpot.",{},[],(_i,s)=>api("hubspot","/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage",s)),
 tool("hubspot","create_contact","Créer un contact HubSpot après confirmation.",{email:str("E-mail",320),firstName:str("Prénom"),lastName:opt("Nom")},["email","firstName"],(i,s)=>api("hubspot","/crm/v3/objects/contacts",s,{properties:{email:email(i.email),firstname:i.firstName,lastname:i.lastName??""}}),"write"),
 tool("vercel","list_projects","Lire les projets Vercel accessibles au jeton.",{},[],(_i,s)=>api("vercel","/v9/projects?limit=100",s)),
 tool("vercel","list_deployments","Lire l’état des déploiements Vercel, sans les modifier.",{projectId:opt("ID projet")},[],(i,s)=>api("vercel",`/v6/deployments?limit=50${i.projectId?`&projectId=${e(i.projectId)}`:""}`,s)),
 tool("netlify","list_sites","Lire les sites Netlify autorisés.",{},[],(_i,s)=>api("netlify","/sites?per_page=100",s)),
 tool("netlify","list_deployments","Lire l’historique des déploiements d’un site Netlify.",{siteId:str("ID site")},["siteId"],(i,s)=>api("netlify",`/sites/${id(i.siteId)}/deploys?per_page=50`,s)),
 tool("cloudflare","list_zones","Lire les zones Cloudflare autorisées au jeton limité.",{},[],(_i,s)=>api("cloudflare","/zones?per_page=50",s)),
 tool("cloudflare","list_dns_records","Lire les enregistrements DNS d’une zone Cloudflare. Aucune écriture.",{zoneId:str("ID zone")},["zoneId"],(i,s)=>api("cloudflare",`/zones/${id(i.zoneId)}/dns_records?per_page=100`,s)),
 tool("webflow","list_sites","Lire les sites Webflow autorisés au jeton.",{},[],(_i,s)=>api("webflow","/sites",s)),
 tool("webflow","list_collections","Lire les collections CMS d’un site Webflow.",{siteId:str("ID site")},["siteId"],(i,s)=>api("webflow",`/sites/${id(i.siteId)}/collections`,s)),
 tool("webflow","list_items","Lire les éléments d’une collection CMS Webflow.",{collectionId:str("ID collection")},["collectionId"],(i,s)=>api("webflow",`/collections/${id(i.collectionId)}/items?limit=100`,s)),
 tool("brevo","list_contacts","Lire les contacts Brevo.",{},[],(_i,s)=>api("brevo","/contacts?limit=50",s)),
 tool("brevo","list_lists","Lire les listes de contacts Brevo.",{},[],(_i,s)=>api("brevo","/contacts/lists?limit=50",s)),
 tool("brevo","create_contact","Créer un contact Brevo sans envoyer de campagne, après confirmation.",{email:str("E-mail",320)},["email"],(i,s)=>api("brevo","/contacts",s,{email:email(i.email),updateEnabled:false}),"write"),
 tool("readwise","list_documents","Lire les documents Reader (abonnement requis après essai).",{cursor:opt("Page suivante")},[],(i,s)=>api("readwise",`/v3/list/${i.cursor?`?pageCursor=${e(i.cursor)}`:""}`,s)),
 tool("readwise","list_highlights","Lire les passages surlignés Readwise.",{},[],(_i,s)=>api("readwise","/v2/highlights/?page_size=100",s)),
 tool("readwise","save_document","Enregistrer un lien public dans Readwise Reader après confirmation.",{url:str("URL HTTPS publique",2000)},["url"],(i,s)=>{const u=new URL(i.url);if(u.protocol!=="https:"||u.username||u.password||/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname))throw Error("Utilise une URL HTTPS publique.");return api("readwise","/v3/save/",s,{url:u.href});},"write"),
];
