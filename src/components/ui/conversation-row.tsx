import { ContextMenu } from "radix-ui";
import { Trash2 } from "lucide-react";
import type { Conversation } from "../../domain/types";
export function ConversationRow({conversation,active,onSelect,onDelete,style}:{conversation:Conversation;active:boolean;onSelect:()=>void;onDelete:()=>void;style:React.CSSProperties}){
 return <ContextMenu.Root><ContextMenu.Trigger asChild><div className={`thread-wrap fx ${active?"active":""}`} style={style}><button className="thread" onClick={onSelect} aria-current={active?"page":undefined}><span>{conversation.title}</span></button></div></ContextMenu.Trigger><ContextMenu.Portal container={document.querySelector<HTMLElement>(".shell")??undefined}><ContextMenu.Content className="conversation-context-menu" alignOffset={4}><ContextMenu.Item className="conversation-delete" onSelect={onDelete}><Trash2 size={15}/>Supprimer</ContextMenu.Item></ContextMenu.Content></ContextMenu.Portal></ContextMenu.Root>;
}
