import type { Effort } from "../domain/types.ts";

/** Medium effort uses the model for the answer without a second hidden essay
 * on straightforward, fully sourced reads or explicit text transformations.
 * Complex/open tasks and every high effort retain the model's reasoning.
 * This changes neither the output allowance nor permissions or verification. */
export function agentLocalReasoning(capabilities:string[],effort:Effort,prompt:string,completeRead=false){
 if(!capabilities.includes('reasoning')||effort==='low')return false;
 if(effort!=='medium')return true;
 if(/réfléch|raisonne|reason|think|approfond|détail|stratég|compare|comparaison|arbitrag|diagnosti|démontre|prouve|architecture|risque|exhaust|toutes les|tous les|chaque|pourquoi/i.test(prompt))return true;
 if(completeRead)return false;
 return !/^\s*(?:(?:reformule|traduis|traduire|extrais|corrige (?:ce|le|mon) texte|résume (?:ce|le) texte)\b|à partir de (?:ce|cette|ces)\b)/i.test(prompt);
}
