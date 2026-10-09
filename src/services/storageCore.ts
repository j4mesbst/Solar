import type { AppSettings, Conversation, Draft, Message, Model, Provider } from "../domain/types";
import type { SolarStore } from "./contracts";

export interface StoredData { version: 3; providers: Provider[]; models: Model[]; conversations: Conversation[]; messages: Message[]; drafts: Draft[]; settings: AppSettings; }
export interface StorageDriver { read(): Promise<StoredData | null>; write(data: StoredData): Promise<void>; }
export const emptyData = (): StoredData => ({ version: 3, providers: [], models: [], conversations: [], messages: [], drafts: [], settings: { theme: "dark", sendOnEnter: true } });
export function validateStoredData(value: unknown): StoredData {
  const data = value as StoredData;
  if (!data || data.version !== 3 || ![data.providers, data.models, data.conversations, data.messages, data.drafts].every(Array.isArray) || !data.settings) throw new Error("Version ou format de stockage incompatible. Les données ont été conservées.");
  return data;
}
export function createSolarStore(driver: StorageDriver): SolarStore {
  let data: StoredData; let initial: Promise<void> | null = null; let queue = Promise.resolve();
  const init = () => initial ??= (async () => { data = validateStoredData(await driver.read() ?? emptyData()); data.messages = data.messages.map(message => ["streaming", "pending"].includes(message.status) ? { ...message, status: "interrupted" } : message); })();
  const read = async <T>(select: (data: StoredData) => T): Promise<T> => { await init(); await queue; return structuredClone(select(data)); };
  const mutate = (change: (data: StoredData) => void) => {
    const operation = queue.then(async () => { await init(); const next = structuredClone(data); change(next); await driver.write(next); data = next; });
    queue = operation.catch(() => {}); return operation;
  };
  const upsert = <T extends { id: string }>(items: T[], item: T) => { const index = items.findIndex(value => value.id === item.id); if (index < 0) items.push(item); else items[index] = item; };
  return {
    listProviders: () => read(d => d.providers), listModels: () => read(d => d.models),
    listConversations: () => read(d => [...d.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    listMessages: id => read(d => d.messages.filter(message => message.conversationId === id).sort((a, b) => a.order - b.order)),
    getSettings: () => read(d => d.settings), saveSettings: settings => mutate(d => { d.settings = settings; }),
    saveConversation: conversation => mutate(d => upsert(d.conversations, conversation)),
    deleteConversation: id => mutate(d => { d.conversations = d.conversations.filter(item => item.id !== id); d.messages = d.messages.filter(item => item.conversationId !== id); d.drafts = d.drafts.filter(item => item.conversationId !== id); }),
    saveMessage: message => mutate(d => { if (d.conversations.some(c => c.id === message.conversationId)) upsert(d.messages, message); }),
    saveProvider: provider => mutate(d => upsert(d.providers, provider)),
    deleteProvider: id => mutate(d => { d.providers = d.providers.filter(item => item.id !== id); d.models = d.models.filter(item => item.providerId !== id); }),
    saveModel: model => mutate(d => upsert(d.models, model)), deleteModel: id => mutate(d => { d.models = d.models.filter(item => item.id !== id); }),
    getDraft: id => read(d => d.drafts.find(item => item.conversationId === id) ?? null),
    saveDraft: draft => mutate(d => { const index = d.drafts.findIndex(item => item.conversationId === draft.conversationId); if (index < 0) d.drafts.push(draft); else d.drafts[index] = draft; }),
    deleteDraft: id => mutate(d => { d.drafts = d.drafts.filter(item => item.conversationId !== id); })
  };
}
