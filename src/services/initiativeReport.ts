import {missionProof} from './missionVerification';
import type {AgentMission} from './solarAgentStore';
export const isMissionBudgetError=(text:string)=>/budget (?:de (?:cette )?mission|de temps|de génération)|délai de génération|TimeoutError|timed out/i.test(text);
/** Acknowledged tool calls are not proof that the whole goal was completed. */
export function initiativeReport(mission:AgentMission){
 const objective=(mission.goal||'Vérification de routine').replace(/\s+/g,' ').slice(0,240);
 const completed=missionProof(mission.checkpoint?.calls??[]).checked;
 const interrupted=mission.status!=='completed';
 if(!interrupted&&mission.result?.trim())return mission.result;
 const detail=mission.error||'';
 const reason=isMissionBudgetError(detail)?'La vérification a atteint sa limite de traitement avant la synthèse finale.':mission.status==='paused'?'La vérification a été interrompue.':detail||'La vérification n’a pas abouti.';
 const proof=completed?`${completed} étape${completed>1?'s ont':' a'} produit un résultat confirmé, mais je n’ai pas de conclusion complète à te donner.`:'Je n’ai pas de résultat vérifié à te donner.';
 const result=mission.result?.trim();
 return `Vérification : ${objective}\n\n${result?result+'\n\n':proof+'\n\n'}${reason} ${isMissionBudgetError(detail)?'Les éléments déjà lus sont conservés ; une reprise devra porter sur un point précis.':''}`.trim();
}
export function readableMissionText(text:string){
 // Old transcripts remain intact in storage; do not display the opaque internal diagnostic.
 return text.replace(/(?:signal is aborted without reason|The (?:operation|user) aborted (?:a |the )?request\.?|AbortError(?::[^\n]*)?)/gi,'Demande interrompue.').replace(/Aucune preuve indépendante ne confirme encore cette tâche\./g,'Je n’ai pas pu confirmer le résultat. Tu peux réessayer.').replace(/Budget de mission atteint ; résultats conservés pour une reprise ciblée\./g,'Vérification inachevée : la limite de traitement a été atteinte avant le compte rendu. Aucun résultat complet n’est confirmé.');
}
