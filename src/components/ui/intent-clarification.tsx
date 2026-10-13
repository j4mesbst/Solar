import { useState } from "react";
import type { IntentQuestion, IntentResolution } from "../../services/intentClarification";
import { Button } from "./button";

export function IntentClarification({ prompt, questions, onContinue, onSkip }: { prompt: string; questions: IntentQuestion[]; onContinue: (resolution: IntentResolution) => void; onSkip: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const complete = questions.every(question => (answers[question.id]?.length ?? 0) > 0);
  const toggle = (question: IntentQuestion, option: string) => setAnswers(current => {
    const previous = current[question.id] ?? [];
    const next = question.multiple ? previous.includes(option) ? previous.filter(value => value !== option) : [...previous, option] : previous.includes(option) ? [] : [option];
    return { ...current, [question.id]: next };
  });
  const submit = () => {
    const resolved = Object.fromEntries(questions.map(question => [question.id, (answers[question.id] ?? []).map(value => value === "Autre" ? `Autre : ${other[question.id]?.trim() || "à préciser"}` : value)]));
    onContinue({ prompt, answers: resolved });
  };

  return <section className="intent-clarification" aria-label="Préciser la demande" aria-live="polite">
    <div className="intent-clarification-head"><strong>Pour viser juste</strong><span>Quelques précisions · tu peux passer</span></div>
    <div className="intent-question-list">{questions.map(question => <fieldset className="intent-question" key={question.id}><legend>{question.label}</legend><div className="intent-options">{[...question.options, "Autre"].map(option => <button type="button" className="intent-option" aria-pressed={(answers[question.id] ?? []).includes(option)} key={option} onClick={() => toggle(question, option)}>{option}</button>)}</div>{(answers[question.id] ?? []).includes("Autre") && <input className="intent-other" aria-label={`Autre réponse : ${question.label}`} placeholder="Précise en quelques mots" value={other[question.id] ?? ""} onChange={event => setOther(current => ({ ...current, [question.id]: event.target.value }))}/>}</fieldset>)}</div>
    <div className="intent-clarification-actions"><Button variant="ghost" onClick={onSkip}>Passer</Button><Button disabled={!complete} onClick={submit}>Continuer</Button></div>
  </section>;
}
