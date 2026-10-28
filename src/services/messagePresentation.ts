/** Display chunks only; the original answer is kept intact for storage/copy/context.
 * Structured Markdown stays together, so code, tables and lists remain usable. */
export function messageBubbles(text:string):string[]{
 if(/```|^\s*(?:\||[-*+]\s|\d+[.)]\s|#{1,6}\s)/m.test(text))return [text];
 const paragraphs=text.split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean);
 // Messaging punctuation and short acknowledgements are actual separate bubbles.
 // Preserve source links, abbreviations and Markdown/code before splitting prose.
 return paragraphs.flatMap(paragraph=>{
  if(/https?:\/\/|\[[^\]]+\]\(|\b(?:M|Mme|Dr|etc)\./.test(paragraph))return [paragraph];
  const sentences=paragraph.match(/[^.!?…]+(?:[.!?…]+[”’"']?(?=\s|$)|$)/gu)?.map(t=>t.trim()).filter(Boolean)??[paragraph];
  return sentences.flatMap(sentence=>{
   const greeting=sentence.match(/^(salut|bonjour|bonsoir|oui|non|d’accord|d'accord|ok|parfait|merci)[,，]\s*(.+)$/iu);
   const clauses=(greeting?greeting[2]:sentence).split(/[,;]\s+(?=(?:tu|vous)\s+(?:veux|voulez|souhaites|souhaitez|préfères|préférez|as|avez)\b)/iu).map((part,i,all)=>part[0].toLocaleUpperCase()+part.slice(1)+(i<all.length-1&&!/[.!?…]$/.test(part)?'.':''));
   return greeting?[greeting[1][0].toLocaleUpperCase()+greeting[1].slice(1)+'.',...clauses]:clauses;
  });
 });
}
let audio:AudioContext|undefined;
export function unlockMessageSound(){try{audio??=new AudioContext();void audio.resume().catch(()=>{});}catch{}}
export function playMessageSound(){
 if(!audio||audio.state!=='running'||document.hidden)return;
 const time=audio.currentTime,gain=audio.createGain(),tone=audio.createOscillator();tone.type='sine';tone.frequency.setValueAtTime(660,time);tone.frequency.exponentialRampToValueAtTime(880,time+.1);gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.035,time+.018);gain.gain.exponentialRampToValueAtTime(.0001,time+.18);tone.connect(gain);gain.connect(audio.destination);tone.start(time);tone.stop(time+.19);tone.onended=()=>{tone.disconnect();gain.disconnect();};
}
