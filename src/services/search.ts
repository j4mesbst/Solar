import type { Conversation, Message } from "../domain/types";
export const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export interface SearchItem { conversationId: string; title: string; content: string; updatedAt: string; messageId?: string; normalizedTitle: string; normalizedContent: string; }
export interface SearchResult extends SearchItem { excerpt: string; score: number; }
export function buildSearchIndex(conversations: Conversation[], messages: Message[]): SearchItem[] {
  return conversations.flatMap(conversation => [{ conversationId: conversation.id, title: conversation.title, content: "", updatedAt: conversation.updatedAt, normalizedTitle: normalize(conversation.title), normalizedContent: "" }, ...messages.filter(m => m.conversationId === conversation.id && m.content).map(message => ({ conversationId: conversation.id, title: conversation.title, content: message.content, messageId: message.id, updatedAt: conversation.updatedAt, normalizedTitle: normalize(conversation.title), normalizedContent: normalize(message.content) }))]);
}
export function searchIndex(index: SearchItem[], text: string, limit = 30): SearchResult[] {
  const query = normalize(text.trim());
  if (!query) return index.filter(item => !item.messageId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,limit).map(item => ({...item, excerpt:"", score:0}));
  return index.flatMap(item => {
    const titleMatch = item.normalizedTitle.indexOf(query); const contentMatch = item.normalizedContent.indexOf(query);
    if (item.messageId ? contentMatch < 0 : titleMatch < 0) return [];
    const start = Math.max(0, contentMatch - 45); const excerpt = item.messageId ? `${start ? "…" : ""}${item.content.slice(start, start + 150).replace(/[*_`#|]/g, "").replace(/\s+/g," ")}${item.content.length > start + 150 ? "…" : ""}` : "";
    return [{ ...item, excerpt, score: (item.normalizedTitle === query ? 6 : titleMatch === 0 ? 4 : titleMatch >= 0 ? 3 : 0) + (contentMatch >= 0 ? 2 : 0) }];
  }).sort((a,b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)).slice(0,limit);
}
export function matchingParts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = normalize(query.trim()); if (!needle) return [{ text, match:false }];
  let normalized=""; const offsets: number[]=[]; let offset=0;
  for (const char of text) { const part=normalize(char); for(let i=0;i<part.length;i++) offsets.push(offset); normalized+=part; offset+=char.length; }
  offsets.push(text.length); const parts=[]; let position=0; let found=normalized.indexOf(needle);
  while(found>=0){ const start=offsets[found]; const end=offsets[found+needle.length]; if(start>position) parts.push({text:text.slice(position,start),match:false}); parts.push({text:text.slice(start,end),match:true}); position=end; found=normalized.indexOf(needle,found+needle.length); }
  if(position<text.length) parts.push({text:text.slice(position),match:false}); return parts;
}
