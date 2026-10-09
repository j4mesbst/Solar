import { useState } from "react";
import { ChevronDown, FilePlus2, MoreHorizontal, PanelLeftClose, Send, Settings2 } from "lucide-react";

const threads = ["Welcome to Solar"];
export function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  return <main className={collapsed ? "shell collapsed" : "shell"}>
    <aside className="sidebar" aria-label="Conversations">
      <div className="side-top"><button className="icon-button" onClick={() => setCollapsed(true)} aria-label="Hide sidebar"><PanelLeftClose size={17}/></button><span>Solar</span></div>
      <button className="new-thread"><FilePlus2 size={16}/><span>New conversation</span></button>
      <div className="thread-label">Recent</div>
      <nav>{threads.map(thread => <button key={thread} className="thread active"><span>{thread}</span><MoreHorizontal size={16}/></button>)}</nav>
      <button className="settings"><Settings2 size={16}/><span>Settings</span></button>
    </aside>
    <section className="workspace">
      <header className="header"><button className="reveal icon-button" onClick={() => setCollapsed(false)} aria-label="Show sidebar"><PanelLeftClose size={17}/></button><span className="title">Welcome to Solar</span><button className="icon-button" aria-label="Conversation menu"><MoreHorizontal size={18}/></button></header>
      <div className="canvas"><div className="welcome"><p className="eyebrow">SOLAR · FOUNDATION</p><h1>Local-first AI,<br/>without the noise.</h1><p className="intro">The app shell is ready. Providers, models and secure local storage will connect here next.</p></div></div>
      <div className="composer-wrap"><div className="composer"><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message Solar…" rows={1}/><div className="composer-footer"><button className="model-control" type="button">No model selected <ChevronDown size={14}/></button><button className="send" type="button" disabled={!draft.trim()} aria-label="Send message"><Send size={16}/></button></div></div><p className="hint">Solar runs locally by default. Configure a provider in Settings.</p></div>
    </section>
  </main>;
}
