// Frozen pre-fix query and relevance gate for the reported Open AI regression.
// Intentionally retains the old behavior; never imported by the application.
import type {SearchSource} from "../../src/domain/extensions";
function needsWeb(text:string){return /dernier|latest|newest|current/i.test(text);}
const SEARCH_STOP=new Set('quel quelle quels quelles est sont qui que quoi comment pourquoi quand ou où dernier dernière derniers dernières nouveau nouvelle nouveautés récent récente actuelles actuel actuelle plus latest newest current latest modèle modèles model models version versions stable officielle officiel officielles sources source vérifie vérifier donne donner lien liens cite citer recherche cherche trouve moi nous pour dans avec sans sur des une les aux du de le la un et ou ce cette ces mon mes ton tes son ses what which is are the of for in a an and please search find verify cite source sources'.split(' '));
export function searchTerms(text:string){return [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_.+-]{1,}/gu)??[]).filter(t=>!SEARCH_STOP.has(t)))].slice(0,16);}
/** Query normalization names the topic, never a frozen model/version answer. */
export function publicSearchQuery(text:string){
 const clean=text.trim().slice(0,1500);
 if(/chatgpt|openai|gpt[- ]?\d/i.test(clean)&&/mod[eè]le|model|dernier|latest|nouveau|current/i.test(clean)&&!/(?:site:|https?:)/i.test(clean))return /chatgpt/i.test(clean)&&! /\b(?:work|codex|api)\b/i.test(clean)?'ChatGPT latest models site:help.openai.com':'OpenAI latest models site:developers.openai.com';
 if(/(?:site:|https?:|"[^"\n]+")/i.test(clean))return clean;
 const terms=searchTerms(clean);return terms.length?terms.join(' ')+(needsWeb(clean)?' latest':''):clean;
}
export function relevantSources(sources:SearchSource[],query:string){
 const terms=searchTerms(query).filter(t=>t.length>=3),special=/chatgpt|openai|gpt[- ]?\d/i.test(query);
 const relevant=sources.filter(s=>{const text=(s.title+' '+s.snippet+' '+s.site).toLocaleLowerCase();return special?/chatgpt|openai|gpt[- ‑]?\d/i.test(text):!terms.length||terms.some(t=>text.includes(t));});
 if(!relevant.length)throw Error('Les moteurs n’ont pas renvoyé de source pertinente. Réessaie avec une requête plus précise.');
 return relevant;
}
