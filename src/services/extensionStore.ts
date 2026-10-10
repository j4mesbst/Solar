import { scopedKey } from "./accountScope.ts";
import type { Artifact, WorkOperation } from "../domain/extensions";
interface ExtensionData {
  artifacts: Artifact[];
  operations: WorkOperation[];
}
let queue = Promise.resolve();
const deleted=new Set<string>();
const temporary: ExtensionData = { artifacts: [], operations: [] };
const native = () =>
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
async function read(): Promise<ExtensionData> {
  if (native()) {
    const store = await (
      await import("@tauri-apps/plugin-store")
    ).load(scopedKey("solar.extensions")+".json", { defaults: {}, autoSave: false });
    return (
      (await store.get<ExtensionData>("data")) ?? {
        artifacts: [],
        operations: [],
      }
    );
  }
  return JSON.parse(
    localStorage.getItem(scopedKey("solar.extensions.v1")) ??
      '{"artifacts":[],"operations":[]}',
  );
}
export const extensionStore = {
  async listArtifacts(id: string) {
    await queue;
    return (id.startsWith("temp:") ? temporary : await read()).artifacts.filter(
      (a) => a.conversationId === id,
    );
  },
  async listOperations(id: string) {
    await queue;
    return (
      id.startsWith("temp:") ? temporary : await read()
    ).operations.filter((a) => a.conversationId === id);
  },
  save(item: Artifact | WorkOperation) {
    if(deleted.has(item.conversationId))return Promise.resolve();
    if (item.conversationId.startsWith("temp:")) {
      const list = "kind" in item ? temporary.artifacts : temporary.operations;
      const index = list.findIndex((a) => a.id === item.id);
      if (index < 0) (list as (Artifact | WorkOperation)[]).push(item);
      else (list as (Artifact | WorkOperation)[])[index] = item;
      return Promise.resolve();
    }
    const operation = queue.then(async () => {
      if(deleted.has(item.conversationId))return;
      const data = await read();
      const list = "kind" in item ? data.artifacts : data.operations;
      const index = list.findIndex((a) => a.id === item.id);
      if (index < 0) (list as (Artifact | WorkOperation)[]).push(item);
      else (list as (Artifact | WorkOperation)[])[index] = item;
      if (native()) {
        const store = await (
          await import("@tauri-apps/plugin-store")
        ).load(scopedKey("solar.extensions")+".json", { defaults: {}, autoSave: false });
        await store.set("data", data);
        await store.save();
      } else localStorage.setItem(scopedKey("solar.extensions.v1"), JSON.stringify(data));
    });
    queue = operation.catch(() => {});
    return operation;
  },
  clearConversation(id: string) {
    deleted.add(id);
    if (id.startsWith("temp:")) {
      temporary.artifacts = temporary.artifacts.filter(
        (a) => a.conversationId !== id,
      );
      temporary.operations = temporary.operations.filter(
        (a) => a.conversationId !== id,
      );
      return Promise.resolve();
    }
    const operation = queue.then(async () => {
      const data = await read();
      data.artifacts = data.artifacts.filter((a) => a.conversationId !== id);
      data.operations = data.operations.filter((a) => a.conversationId !== id);
      if (native()) {
        const store = await (
          await import("@tauri-apps/plugin-store")
        ).load(scopedKey("solar.extensions")+".json", { defaults: {}, autoSave: false });
        await store.set("data", data);
        await store.save();
      } else localStorage.setItem(scopedKey("solar.extensions.v1"), JSON.stringify(data));
    });
    queue = operation.catch(() => {});
    return operation;
  },
};
