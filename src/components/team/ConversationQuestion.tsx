import {useId} from 'react';
import type {AgentQuestion} from '../../domain/types';

export function ConversationQuestion({question,disabled,onSelect}:{question:AgentQuestion;disabled?:boolean;onSelect?:(id:string)=>void}){
 const titleId=useId(),selected=question.options.find(o=>o.id===question.selectedId);
 return <section className={`conversation-question ${selected?'is-answered':''}`} aria-labelledby={titleId} data-answered={!!selected}>
  <p id={titleId}>{question.title}</p>
  <div className="conversation-question-options">{(selected?[selected]:question.options).map(option=>{
   const index=question.options.indexOf(option),label=String.fromCharCode(65+index);
   return <button key={option.id} type="button" disabled={disabled||!!selected||question.dismissed||!onSelect} className="conversation-question-option" onClick={()=>onSelect?.(option.id)} aria-label={`${label}. ${option.label}`}>
    <span className="conversation-choice-key" aria-hidden="true">{label}</span><span><span className="conversation-choice-label">{option.label}</span>{!selected&&option.description&&<small>{option.description}</small>}</span>
   </button>;
  })}</div>
 </section>;
}
