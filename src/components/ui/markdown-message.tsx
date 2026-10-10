import { memo, useState, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";
function CodeBlock({ children }: { children?: ReactNode }) {
  const [state, setState] = useState("");
  const child = children as { props?: { className?: string } };
  const language = child?.props?.className?.match(/language-([^\s]+)/)?.[1] ?? "Code";
  return <div className="code-block"><div className="code-header"><span>{language}</span><button onClick={async event => { const code = event.currentTarget.closest(".code-block")?.querySelector("code")?.textContent ?? ""; try { await navigator.clipboard.writeText(code.replace(/\n$/, "")); setState("Copié"); } catch { setState("Copie indisponible"); } }} aria-label="Copier le code">{state === "Copié" ? <Check size={13}/> : <Copy size={13}/>} {state || "Copier"}</button></div><pre>{children}</pre></div>;
}
function Table({ children }: { children?: ReactNode }) {
  const [state, setState] = useState("");
  return <div className="rich-table"><div className="table-scroll"><table>{children}</table></div><button className="table-copy" onClick={async event => { const table = event.currentTarget.closest(".rich-table")?.querySelector("table"); const data = [...(table?.rows ?? [])].map(row => [...row.cells].map(cell => cell.textContent).join("\t")).join("\n"); try { await navigator.clipboard.writeText(data); setState("Copié"); } catch { setState("Copie indisponible"); } }}><Copy size={12}/>{state || "Copier le tableau"}</button></div>;
}
const RESPONSE_MOTION={animation:"wordIn",duration:450,easing:"ease",sep:"word" as const,stagger:60};
export const MarkdownMessage = memo(function MarkdownMessage({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return <Streamdown mode={streaming ? "streaming" : "static"} isAnimating={streaming} animated={streaming?RESPONSE_MOTION:false} parseIncompleteMarkdown={streaming} controls={false} urlTransform={url=>{try{const parsed=new URL(url,"https://solar.invalid/");return ["https:","http:","mailto:"].includes(parsed.protocol)?url:"";}catch{return "";}}} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false, strict: "ignore" }], [rehypeHighlight, { detect: false, ignoreMissing: true }]]} skipHtml components={{ pre: ({ children }) => <CodeBlock>{children}</CodeBlock>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>, table: ({ children }) => <Table>{children}</Table> }}>{content}</Streamdown>;
});
