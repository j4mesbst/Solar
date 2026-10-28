import {followupTools} from "./followupTools.ts";
import { integrationRequest, identifyIntegration } from "./integrationApi.ts";
import { savedConnection } from "./pluginAccounts.ts";
import type { PluginId } from "./pluginCatalog.ts";
import type { ToolDefinition,ToolRisk } from "./toolRegistry.ts";
import {draftTools} from "./draftTools.ts";
import { productivityTools } from "./productivityTools.ts";
import { keyIntegrationTools } from "./keyIntegrationTools.ts";
const string=(description:string,maxLength=500)=>({type:"string",minLength:1,maxLength,description});
const optional=(description:string,maxLength=500)=>({type:"string",maxLength,description});
const integer=(description:string)=>({type:"integer",minimum:1,maximum:2147483647,description});
const e=encodeURIComponent;
const repo=(input:any)=>{if(!/^[\w.-]+\/[\w.-]+$/.test(input.repository))throw Error("Dépôt invalide (owner/repository).");return input.repository;};
const ghPath=(input:any)=>`/repos/${repo(input)}`;
const idPath=(input:any,key="id")=>{if(!/^[\w-]{1,100}$/.test(input[key]))throw Error("Identifiant de ressource invalide.");return e(input[key]);};
function tool(pluginId:PluginId,name:string,description:string,properties:Record<string,unknown>,required:string[],run:(input:any,signal:AbortSignal)=>Promise<unknown>,risk:ToolRisk="read"):ToolDefinition{
 return {name:`${pluginId}.${name}`,pluginId,description,parameters:{type:"object",properties,required,additionalProperties:false},parallelSafe:risk==="read",permissions:[`${pluginId}.${risk==="read"?"read":"write"}`],risk,externalEffects:risk!=="read",execute:(input,signal)=>run(input,signal)};
}
const api=(id:PluginId,path:string,signal:AbortSignal,body?:unknown,method?:string)=>integrationRequest(id,path,{signal,body,method:method??(body===undefined?"GET":"POST")});
const graphql=async(query:string,variables:unknown,signal:AbortSignal)=>{const result=await api("linear","/graphql",signal,{query,variables});return result.data;};
export const integrationTools:ToolDefinition[]=[
 ...productivityTools,...keyIntegrationTools,...draftTools,...followupTools,
 tool("github","search_repositories","Rechercher les dépôts GitHub accessibles au compte.",{query:optional("Filtre du nom")},[],async(i,s)=>{const values=await api("github","/user/repos?per_page=100&sort=updated",s);return values.filter((item:any)=>item.full_name.toLowerCase().includes((i.query??"").toLowerCase())).map((item:any)=>({name:item.full_name,description:item.description,url:item.html_url,updatedAt:item.updated_at,lastPushAt:item.pushed_at}));}),
 tool("github","profile_activity","Lire le profil GitHub connecté et son nombre de contributions sur une période explicite (365 derniers jours par défaut).",{from:optional("Date ISO de début, maximum un an avant to"),to:optional("Date ISO de fin")},[],async(i,s)=>{
  const profile=await api("github","/user",s);const to=i.to?new Date(i.to):new Date(),from=i.from?new Date(i.from):new Date(to.getTime()-365*86400000);
  if(!Number.isFinite(to.getTime())||!Number.isFinite(from.getTime())||from>=to||to.getTime()-from.getTime()>366*86400000)throw Error("Choisis une période valide d’au plus un an.");
  let contributions=null,limitation:string|undefined;
  try{const result=await api("github","/graphql",s,{query:"query($from: DateTime!, $to: DateTime!) { viewer { login contributionsCollection(from:$from, to:$to) { contributionCalendar { totalContributions } totalCommitContributions totalIssueContributions totalPullRequestContributions totalPullRequestReviewContributions restrictedContributionsCount } } }",variables:{from:from.toISOString(),to:to.toISOString()}});
   contributions=result.data?.viewer?.contributionsCollection??null;if(!contributions)limitation="GitHub n’a pas renvoyé les contributions avec ces permissions.";
  }catch(error){s.throwIfAborted();limitation=error instanceof Error?error.message:"Contributions indisponibles.";}
  return {observedAt:new Date().toISOString(),profile:{login:profile.login,name:profile.name,bio:profile.bio,publicRepos:profile.public_repos,followers:profile.followers,url:profile.html_url},period:{from:from.toISOString(),to:to.toISOString()},contributions,limitation,visibility:"Les contributions privées dépendent de leur visibilité et des permissions accordées. Une valeur indisponible n’est pas zéro."};
 }),
 tool("github","repository_activity","Lire la dernière mise à jour, le dernier push et les commits récents d’un dépôt GitHub accessible.",{repository:string("owner/repository")},["repository"],async(i,s)=>{
  const metadata=await api("github",ghPath(i),s);let commits:unknown[]=[],limitation:string|undefined;
  try{const rows=await api("github",`${ghPath(i)}/commits?per_page=10`,s);commits=rows.map((c:any)=>({sha:c.sha,date:c.commit?.committer?.date,message:c.commit?.message,url:c.html_url}));}catch(error){s.throwIfAborted();limitation=error instanceof Error?error.message:"Historique indisponible.";}
  return {observedAt:new Date().toISOString(),repository:metadata.full_name,url:metadata.html_url,description:metadata.description,stars:metadata.stargazers_count,forks:metadata.forks_count,openIssues:metadata.open_issues_count,language:metadata.language,isPrivate:metadata.private,updatedAt:metadata.updated_at,lastPushAt:metadata.pushed_at,defaultBranch:metadata.default_branch,commits,limitation,note:"updatedAt inclut les métadonnées ; lastPushAt et les commits décrivent l’activité du code."};
 }),
 tool("github","read_issue","Lire une issue GitHub précise.",{repository:string("owner/repository"),number:integer("Numéro de l’issue")},["repository","number"],(i,s)=>api("github",`${ghPath(i)}/issues/${i.number}`,s)),
 tool("github","list_commits","Lire les derniers commits d’un dépôt.",{repository:string("owner/repository")},["repository"],(i,s)=>api("github",`${ghPath(i)}/commits?per_page=20`,s)),
 tool("github","create_issue","Créer une issue GitHub après inspection et approbation du titre et du contenu.",{repository:string("owner/repository"),title:string("Titre",250),body:string("Contenu complet à publier",20000)},["repository","title","body"],(i,s)=>api("github",`${ghPath(i)}/issues`,s,{title:i.title,body:i.body}),"publish"),
 tool("github","create_pull_request","Créer une pull request entre deux branches existantes après approbation. Ne crée ni commit ni branche.",{repository:string("owner/repository"),title:string("Titre",250),body:string("Description complète",20000),head:string("Branche source existante"),base:string("Branche cible existante")},["repository","title","body","head","base"],(i,s)=>api("github",`${ghPath(i)}/pulls`,s,{title:i.title,body:i.body,head:i.head,base:i.base}),"publish"),
 tool("notion","search_pages","Rechercher les pages et sources de données Notion partagées.",{query:optional("Recherche")},[],(i,s)=>api("notion","/search",s,{query:i.query??"",page_size:30})),
 tool("notion","read_page","Lire les propriétés d’une page Notion autorisée.",{id:string("Identifiant de page")},["id"],(i,s)=>api("notion",`/pages/${idPath(i)}`,s)),
 tool("notion","read_blocks","Lire les blocs enfants d’une page ou d’un bloc Notion.",{id:string("Identifiant page/bloc"),cursor:optional("Curseur de pagination")},["id"],(i,s)=>api("notion",`/blocks/${idPath(i)}/children?page_size=100${i.cursor?`&start_cursor=${e(i.cursor)}`:""}`,s)),
 tool("notion","read_database","Lire une base Notion et ses sources de données.",{id:string("Identifiant base")},["id"],(i,s)=>api("notion",`/databases/${idPath(i)}`,s)),
 tool("notion","query_data_source","Consulter les pages d’une source de données Notion autorisée.",{id:string("Identifiant source de données"),cursor:optional("Curseur")},["id"],(i,s)=>api("notion",`/data_sources/${idPath(i)}/query`,s,{page_size:50,...(i.cursor?{start_cursor:i.cursor}:{})})),
 tool("notion","create_page","Créer une page texte sous une page autorisée, après validation.",{parentId:string("Page parente"),title:string("Titre",500),content:string("Texte complet",12000)},["parentId","title","content"],(i,s)=>api("notion","/pages",s,{parent:{page_id:i.parentId},properties:{title:{type:"title",title:[{type:"text",text:{content:i.title}}]}},children:paragraphs(i.content)}),"write"),
 tool("notion","append_content","Ajouter des paragraphes à une page Notion après approbation du texte.",{id:string("Page/bloc parent"),content:string("Texte à ajouter",12000)},["id","content"],(i,s)=>api("notion",`/blocks/${idPath(i)}/children`,s,{children:paragraphs(i.content)},"PATCH"),"write"),
 tool("notion","update_block","Remplacer le texte d’un paragraphe Notion identifié, après approbation.",{id:string("Identifiant du bloc paragraphe"),content:string("Nouveau texte",2000)},["id","content"],(i,s)=>api("notion",`/blocks/${idPath(i)}`,s,{paragraph:{rich_text:[{type:"text",text:{content:i.content}}]}},"PATCH"),"write"),
 tool("slack","list_channels","Lister les canaux Slack accessibles.",{cursor:optional("Curseur")},[],(i,s)=>api("slack",`/conversations.list?limit=100&exclude_archived=true${i.cursor?`&cursor=${e(i.cursor)}`:""}`,s)),
 tool("slack","search_messages","Rechercher les messages Slack autorisés (scope search:read).",{query:string("Recherche Slack")},["query"],(i,s)=>api("slack",`/search.messages?count=30&query=${e(i.query)}`,s)),
 tool("slack","read_thread","Lire un fil Slack autorisé.",{channel:string("Identifiant canal"),ts:string("Horodatage du message parent")},["channel","ts"],(i,s)=>api("slack",`/conversations.replies?channel=${e(i.channel)}&ts=${e(i.ts)}&limit=100`,s)),
 tool("slack","read_messages","Lire les derniers messages d’un canal autorisé.",{channel:string("Identifiant canal")},["channel"],(i,s)=>api("slack",`/conversations.history?channel=${e(i.channel)}&limit=50`,s)),
 tool("slack","send_message","Publier exactement ce texte dans un canal Slack, après confirmation.",{channel:string("Identifiant canal"),text:string("Message complet à envoyer",10000),thread_ts:optional("Parent du fil")},["channel","text"],(i,s)=>api("slack","/chat.postMessage",s,{channel:i.channel,text:i.text,...(i.thread_ts?{thread_ts:i.thread_ts}:{})}),"publish"),
 // Current-viewer scope avoids guessing a user ID; pagination stays explicit.
 tool("linear","list_issues","Lire les tickets affectés au compte Linear connecté, avec priorité et échéance. Si partial=true, continuer avec nextCursor avant une conclusion exhaustive.",{cursor:optional("Curseur nextCursor de la page précédente")},[],async(i,s)=>{
  const data=await graphql("query($after:String) { viewer { assignedIssues(first:50,after:$after) { nodes { id identifier title description url priority priorityLabel dueDate state {name} } pageInfo { hasNextPage endCursor } } } }",{after:i.cursor??null},s);
  const page=data?.viewer?.assignedIssues;if(!Array.isArray(page?.nodes)||!page.pageInfo||typeof page.pageInfo.hasNextPage!=="boolean"||page.pageInfo.hasNextPage&&!page.pageInfo.endCursor)throw Error("Linear n’a pas renvoyé une page de tickets vérifiable.");
  return {issues:page.nodes,partial:page.pageInfo.hasNextPage,nextCursor:page.pageInfo.hasNextPage?page.pageInfo.endCursor:undefined,scope:"Tickets affectés au compte connecté",priorityOrder:"1 urgent, 2 élevé, 3 normal, 4 faible ; 0 sans priorité"};
 }),
 tool("linear","list_teams","Lire les équipes accessibles dans Linear.",{},[],(_i,s)=>graphql("query { teams(first:50) { nodes { id name key } } }",{},s)),
 tool("linear","list_projects","Lire les projets Linear accessibles.",{},[],(_i,s)=>graphql("query { projects(first:50) { nodes { id name description url } } }",{},s)),
 tool("linear","search_issues","Rechercher des issues Linear par titre.",{query:string("Recherche")},["query"],(i,s)=>graphql("query($query:String!) { issues(first:50,filter:{title:{containsIgnoreCase:$query}}) { nodes { id identifier title description url priority priorityLabel dueDate state {name} } } }",{query:i.query},s)),
 tool("linear","read_issue","Lire une issue Linear précise.",{id:string("ID ou identifiant de l’issue")},["id"],(i,s)=>graphql("query($id:String!) { issue(id:$id) { id identifier title description url state {name} project {name} } }",{id:i.id},s)),
 tool("linear","create_issue","Créer une issue Linear après approbation.",{teamId:string("Équipe"),title:string("Titre",250),description:string("Description",20000)},["teamId","title","description"],(i,s)=>graphql("mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id identifier url}}}",{input:i},s),"write"),
 tool("linear","update_issue","Modifier le titre et la description d’une issue Linear après validation.",{id:string("ID issue"),title:string("Titre",250),description:string("Description",20000)},["id","title","description"],(i,s)=>graphql("mutation($id:String!,$input:IssueUpdateInput!){issueUpdate(id:$id,input:$input){success issue{id identifier url}}}",{id:i.id,input:{title:i.title,description:i.description}},s),"write"),
 tool("todoist","list_tasks","Lire les tâches actives Todoist (connexion API personnelle).",{},[],(_i,s)=>api("todoist","/tasks?limit=100",s)),
 tool("todoist","list_projects","Lire les projets Todoist.",{},[],(_i,s)=>api("todoist","/projects?limit=100",s)),
 tool("todoist","search_tasks","Rechercher les tâches Todoist avec un filtre officiel.",{query:string("Filtre Todoist, ex. today | overdue")},["query"],(i,s)=>api("todoist",`/tasks/filter?query=${e(i.query)}&limit=100`,s)),
 tool("todoist","create_task","Créer une tâche Todoist après validation.",{content:string("Texte",2000),project_id:optional("Projet"),due_string:optional("Échéance naturelle")},["content"],(i,s)=>api("todoist","/tasks",s,i),"write"),
 tool("todoist","update_task","Modifier le texte d’une tâche Todoist après validation.",{id:string("ID tâche"),content:string("Nouveau texte",2000)},["id","content"],(i,s)=>api("todoist",`/tasks/${idPath(i)}`,s,{content:i.content}),"write"),
 tool("todoist","complete_task","Terminer une tâche Todoist après validation.",{id:string("ID tâche")},["id"],(i,s)=>api("todoist",`/tasks/${idPath(i)}/close`,s,{}),"write"),
 tool("discord","list_guilds","Lister les serveurs autorisés à l’identité Discord connectée.",{},[],(_i,s)=>api("discord","/users/@me/guilds?limit=100",s)),
 tool("discord","list_channels","Lire les canaux d’un serveur où le bot officiel est installé.",{guildId:string("ID serveur")},["guildId"],async(i,s)=>{await requireBot();return api("discord",`/guilds/${idPath(i,"guildId")}/channels`,s);}),
 tool("discord","read_messages","Lire les messages d’un canal autorisé au bot officiel.",{channelId:string("ID canal")},["channelId"],async(i,s)=>{await requireBot();return api("discord",`/channels/${idPath(i,"channelId")}/messages?limit=50`,s);}),
 tool("discord","send_message","Publier un message avec le bot officiel, après confirmation du canal et du texte.",{channelId:string("ID canal"),content:string("Message complet",2000)},["channelId","content"],async(i,s)=>{await requireBot();return api("discord",`/channels/${idPath(i,"channelId")}/messages`,s,{content:i.content,allowed_mentions:{parse:[]}});},"publish"),
 tool("gmail","read_thread","Lire un fil de courriels Gmail autorisé.",{id:string("ID fil Gmail")},["id"],(i,s)=>api("gmail",`/threads/${idPath(i)}?format=full`,s)),
 tool("gmail","send_message","Envoyer un e-mail Gmail après confirmation du destinataire, du sujet et du contenu exacts.",{to:string("Destinataire",320),subject:string("Sujet",500),body:string("Corps en texte brut",20000)},["to","subject","body"],async(i,s)=>{
  if(/[\r\n]/.test(i.to+i.subject)||!/^\S+@\S+\.\S+$/.test(i.to))throw Error("Destinataire ou sujet invalide.");
  const account=await savedConnection("gmail");if(!account?.scopes?.includes("https://www.googleapis.com/auth/gmail.send"))throw Error("Permission Gmail d’envoi manquante. Reconnecte Gmail en activant l’envoi.");
  const subject=btoa(String.fromCharCode(...new TextEncoder().encode(i.subject)));
  const content=btoa(String.fromCharCode(...new TextEncoder().encode(i.body)));
  const raw=btoa(`To: ${i.to}\r\nSubject: =?UTF-8?B?${subject}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}`).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  return api("gmail","/messages/send",s,{raw});
 },"publish"),
];
function paragraphs(content:string){return content.match(/[\s\S]{1,1800}/g)?.map(text=>({object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:text}}]}}))??[];}
async function requireBot(){if((await savedConnection("discord"))?.auth!=="bot")throw Error("Cette opération exige un bot officiel installé dans le serveur, pas la connexion utilisateur Discord.");}

// Code-owned postconditions for the main collaborative writes. Provider ACKs
// alone are not advertised as independently verified by the mission runtime.
for(const definition of integrationTools){
 if(['github.create_issue','github.create_pull_request'].includes(definition.name))definition.verify=async(value,result,signal)=>{
  const input=value as any,r=result as any;if(!Number.isInteger(r?.number))throw Error('GitHub a acquitté l’action sans numéro vérifiable. Ne pas recréer.');
  const pull=definition.name.endsWith('pull_request'),read=await api('github',`${ghPath(input)}/${pull?'pulls':'issues'}/${r.number}`,signal);
  if(read.number!==r.number||read.title!==input.title||(read.body??'')!==input.body||pull&&(read.head?.ref!==input.head||read.base?.ref!==input.base))throw Error('La relecture GitHub ne confirme pas le contenu demandé. Ne pas recréer.');r.verification='verified';
 };
 if(['linear.create_issue','linear.update_issue'].includes(definition.name))definition.verify=async(value,result,signal)=>{
  const input=value as any,r=result as any,created=r?.issueCreate??r?.issueUpdate,id=created?.issue?.id;
  if(created?.success!==true||!id)throw Error('Linear n’a pas confirmé un identifiant d’issue. Vérifie avant une reprise.');
  const read=(await graphql('query($id:String!){issue(id:$id){id title description}}',{id},signal))?.issue;
  if(read?.id!==id||read.title!==input.title||(read.description??'')!==input.description)throw Error('La relecture Linear ne confirme pas les modifications. Ne pas recréer.');r.verification='verified';
 };
 if(definition.name==='slack.send_message')definition.verify=async(value,result,signal)=>{
  const input=value as any,r=result as any;if(!r?.channel||!r?.ts)throw Error('Slack a acquitté le message sans reçu vérifiable. Ne pas renvoyer.');
  const read=await api('slack',`/conversations.replies?channel=${e(r.channel)}&ts=${e(input.thread_ts??r.ts)}&limit=100`,signal);
  if(!read.messages?.some((m:any)=>m.ts===r.ts&&m.text===input.text))throw Error('Le message Slack n’a pas été retrouvé avec son contenu exact. Ne pas renvoyer.');r.verification='verified';
 };
}
