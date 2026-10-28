/** Display chunks only; the original answer is kept intact for storage/copy/context.
 * Structured Markdown stays together, so code, tables and lists remain usable. */
function rawMessageBubbles(text:string):string[]{
 const blocks:string[]=[];let block:string[]=[],fence=false;
 const flush=()=>{if(block.length){blocks.push(block.join('\n').trim());block=[];}};
 for(const line of text.split('\n')){if(/^\s*```/.test(line)){if(!fence)flush();block.push(line);fence=!fence;if(!fence)flush();continue;}if(!fence&&!line.trim()){flush();continue;}block.push(line);}flush();
 return blocks.filter(Boolean).flatMap(paragraph=>{
  if(/^\s*```|^\s*\|/m.test(paragraph))return [paragraph];
  if(/^\s*(?:[-*+]\s|\d+[.)]\s)/m.test(paragraph)){
   const rows=paragraph.split(/\n(?=\s*(?:[-*+]\s|\d+[.)]\s))/);const groups:string[]=[];let group='';
   for(const row of rows){if(group&&(group.length+row.length>360||group.split('\n').length>=3)){groups.push(group);group='';}group+=(group?'\n':'')+row;}if(group)groups.push(group);return groups;
  }
  // Inline Markdown is atomic: punctuation inside bold, links or code cannot
  // split a delimiter and leak literal asterisks into the following bubble.
  const tokens:string[]=[];const protectedText=paragraph.replace(/\*\*[\s\S]+?\*\*|__[\s\S]+?__|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|https?:\/\/[^\s]+/g,value=>`\uE000${tokens.push(value)-1}\uE001`);
  const restore=(value:string)=>value.replace(/\uE000(\d+)\uE001/g,(_,i)=>tokens[Number(i)]);
  const sentences=protectedText.match(/[^.!?…]+(?:[.!?…]+[”’"']?(?=\s|$)|$)/gu)?.map(t=>t.trim()).filter(Boolean)??[protectedText];
  return sentences.flatMap(sentence=>{
   const greeting=sentence.match(/^(salut|bonjour|bonsoir|oui|non|d’accord|d'accord|ok|parfait|merci)[,，]\s*(.+)$/iu);
   const clauses=(greeting?greeting[2]:sentence).split(/[,;]\s+(?=(?:tu|vous)\s+(?:veux|voulez|souhaites|souhaitez|préfères|préférez|as|avez)\b)/iu).filter(Boolean).map((part,i,all)=>part[0].toLocaleUpperCase()+part.slice(1)+(i<all.length-1&&!/[.!?…]$/.test(part)?'.':''));
   return (greeting?[greeting[1][0].toLocaleUpperCase()+greeting[1].slice(1)+'.',...clauses]:clauses).flatMap(value=>{
    const chunks:string[]=[];let current='';for(const word of value.split(/\s+/)){if(current&&restore(current+' '+word).length>280){chunks.push(restore(current));current='';}current+=(current?' ':'')+word;}if(current)chunks.push(restore(current));return chunks;
   });
  });
 });
}

/** Group conversational fragments, retaining all content in at most three bubbles. */
export function messageBubbles(text:string):string[]{
 const raw=rawMessageBubbles(text),merged:string[]=[];
 for(const part of raw){if(merged.length&&!/^\s*(?:```|\||[-*+]\s|\d+[.)]\s)/m.test(part)&&!/^\s*(?:```|\||[-*+]\s|\d+[.)]\s)/m.test(merged.at(-1)!)&&(/^(?:salut|bonjour|bonsoir|oui|non|ok|parfait|merci)[.!…]*$/iu.test(merged.at(-1)!)||merged.at(-1)!.length<55&&part.length<170))merged[merged.length-1]+=' '+part;else merged.push(part);}
 if(merged.length<=3)return merged;
 const size=Math.ceil(merged.length/3),groups:string[]=[];
 for(let i=0;i<merged.length;i+=size)groups.push(merged.slice(i,i+size).join('\n\n'));
 return groups;
}

let audio:AudioContext|undefined;
export function unlockMessageSound(){try{audio??=new AudioContext();void audio.resume().catch(()=>{});}catch{}}
export function playMessageSound(){
 if(!audio||audio.state!=='running'||document.hidden)return;
 const time=audio.currentTime,gain=audio.createGain(),tone=audio.createOscillator();tone.type='sine';tone.frequency.setValueAtTime(660,time);tone.frequency.exponentialRampToValueAtTime(880,time+.1);gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.035,time+.018);gain.gain.exponentialRampToValueAtTime(.0001,time+.18);tone.connect(gain);gain.connect(audio.destination);tone.start(time);tone.stop(time+.19);tone.onended=()=>{tone.disconnect();gain.disconnect();};
}
