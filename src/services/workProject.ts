import type { WorkChange, WorkOperation } from "../domain/extensions";
import { extensionStore } from "./extensionStore.ts";
export interface WorkProject {
  token: string;
  name: string;
  files: string[];
}
type DirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<DirectoryHandle | FileHandle>;
  getDirectoryHandle: (name: string) => Promise<DirectoryHandle>;
  getFileHandle: (name: string) => Promise<FileHandle>;
};
type FileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (text: string) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};
const handles = new Map<string, DirectoryHandle>();
const native = () =>
  Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
export const allowedPath = (path: string) =>
  !path.startsWith("/") &&
  !path.includes("\\") &&
  path
    .split("/")
    .every(
      (p) =>
        p !== "" &&
        p !== "." &&
        p !== ".." &&
        !p.startsWith(".") &&
        !["node_modules", "dist", "target", "vendor", "build"].includes(p) &&
        !/(?:credential|secret|\.pem$|\.key$)/i.test(p),
    );
export async function openProject(): Promise<WorkProject | null> {
  if (native()) {
    return (await import("@tauri-apps/api/core")).invoke("work_open");
  }
  const picker = (
    window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }
  ).showDirectoryPicker;
  if (!picker)
    throw new Error(
      "L’accès aux dossiers Work nécessite l’application macOS ou un navigateur compatible avec la sélection de dossiers.",
    );
  const root = await picker();
  const files: string[] = [];
  async function scan(dir: DirectoryHandle, prefix: string, depth: number) {
    if (depth > 12 || files.length >= 2000) return;
    for await (const item of dir.values()) {
      const path = prefix + item.name;
      if (!allowedPath(path)) continue;
      if (item.kind === "directory") await scan(item, path + "/", depth + 1);
      else if ((await item.getFile()).size <= 512000) files.push(path);
      if (files.length >= 2000) break;
    }
  }
  await scan(root, "", 0);
  const token = crypto.randomUUID();
  handles.clear();
  handles.set(token, root);
  return { token, name: root.name, files: files.sort() };
}
async function fileHandle(project: WorkProject, path: string) {
  if (!allowedPath(path) || !project.files.includes(path))
    throw new Error("Fichier non autorisé");
  let dir = handles.get(project.token);
  if (!dir) throw new Error("Ouvre le dossier à nouveau.");
  const parts = path.split("/");
  for (const part of parts.slice(0, -1))
    dir = await dir.getDirectoryHandle(part);
  return dir.getFileHandle(parts.at(-1)!);
}
export async function readProjectFile(project: WorkProject, path: string) {
  if (!allowedPath(path) || !project.files.includes(path))
    throw new Error("Fichier non autorisé");
  if (native())
    return (await import("@tauri-apps/api/core")).invoke<string>("work_read", {
      token: project.token,
      path,
    });
  const file = await (await fileHandle(project, path)).getFile();
  if (file.size > 512000) throw new Error("Fichier trop volumineux");
  const data = await file.text();
  if (data.includes("\0")) throw new Error("Fichier binaire");
  return data;
}
export function parseWorkChanges(
  text: string,
  files: Record<string, string>,
): WorkChange[] {
  const match = text.match(/```solar-changes\s*([\s\S]*?)```/);
  if (!match) return [];
  const json = JSON.parse(match[1]);
  if (!Array.isArray(json.changes) || json.changes.length > 20)
    throw new Error("Proposition de modification invalide");
  return json.changes.map((c: any) => {
    if (
      typeof c.path !== "string" ||
      typeof c.content !== "string" ||
      !allowedPath(c.path) ||
      !Object.hasOwn(files, c.path) ||
      c.content.length > 512000
    )
      throw new Error(
        "Modification hors fichiers transmis ou trop volumineuse",
      );
    return { path: c.path, before: files[c.path], after: c.content };
  });
}
export async function applyOperation(
  project: WorkProject,
  operation: WorkOperation,
  undo = false,
) {
  if (native()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>(undo ? "work_undo" : "work_apply", {
      token: project.token,
      operation: operation.id,
      ...(!undo ? { changes: operation.changes } : {}),
    });
  }
  const changes = operation.changes.map((c) =>
    undo ? { path: c.path, before: c.after, after: c.before } : c,
  );
  for (const c of changes) {
    if ((await readProjectFile(project, c.path)) !== c.before)
      throw new Error(c.path + " a changé depuis l’aperçu.");
  }
  if (
    !window.confirm(
      `${undo ? "Restaurer" : "Modifier"} les ${changes.length} fichiers affichés ?`,
    )
  )
    return false;
  const written: WorkChange[] = [];
  try {
    for (const c of changes) {
      if ((await readProjectFile(project, c.path)) !== c.before)
        throw new Error(c.path + " a changé pendant la confirmation.");
      const writer = await (await fileHandle(project, c.path)).createWritable();
      try {
        await writer.write(c.after);
        await writer.close();
        written.push(c);
      } catch (error) {
        await writer.abort();
        throw error;
      }
    }
  } catch (error) {
    for (const c of written) {
      if ((await readProjectFile(project, c.path)) !== c.after)
        throw new Error(
          "Restauration incomplète : un fichier a changé pendant l’opération.",
        );
      const writer = await (await fileHandle(project, c.path)).createWritable();
      await writer.write(c.before);
      await writer.close();
    }
    throw error;
  }
  return true;
}
export async function saveOperation(operation: WorkOperation) {
  return extensionStore.save(operation);
}
