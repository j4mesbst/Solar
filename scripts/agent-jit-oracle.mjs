// Apply the same content assertions to both versions. These are narrow task
// oracles, not a general semantic quality judge. Sources must also be executed.
export function answerVerified(task,row){
 if(row.error)return false;const text=row.answer??'';
 if(task==='mail-three')return /\b(?:0?9\s*(?:h|:)|09:00)/i.test(text)&&/contrat/i.test(text)&&/facture|\b120\b/i.test(text)&&(row.sourceTools?row.sourceTools.includes('gmail.latest_messages'):row.toolCalls>=1);
 if(task==='github-two')return /\b42\b/.test(text)&&/2026-10-20|20[\/.-]10[\/.-](?:20)?26|\b20\s+oct(?:obre)?\.?(?:\s+2026\b|(?!\s+20\d\d)\b)/i.test(text)&&(row.sourceTools?['github.profile_activity','github.repository_activity'].every(n=>row.sourceTools.includes(n)):row.toolCalls>=2);
 return false;
}
