import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState(false);
  return <div className="code-block"><div className="code-header"><span>Code</span><button onClick={async event => { const code = event.currentTarget.closest(".code-block")?.querySelector("code")?.textContent ?? ""; try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setError(true); } }} aria-label="Copier le code">{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? "Copié" : error ? "Copie indisponible" : "Copier"}</button></div><pre>{children}</pre></div>;
}
export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ pre: ({ children }) => <CodeBlock>{children}</CodeBlock>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>, table: ({ children }) => <div className="table-scroll"><table>{children}</table></div> }}>{content}</ReactMarkdown>;
});
