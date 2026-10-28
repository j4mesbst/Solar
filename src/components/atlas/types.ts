export type AtlasMood = "idle" | "thinking" | "working" | "happy";
export type AtlasStatus = "idle" | "thinking" | "working";

export type AtlasMessage = {
  question?:import("../../domain/types").AgentQuestion;
  connectionRequest?:import('../../domain/types').Message['connectionRequest'];
  resultCards?:import("../../domain/types").AgentResultCard[];
  id: string;
  role: "user" | "atlas";
  text: string;
  streaming?: boolean;
  attachments?: import("../../domain/types").PastedContent[];
  localCommand?:"context"|"memory"|"clear";
  contextReport?:import("../../services/contextBudget").ContextReport;
  compacting?:boolean;
  error?: string;
};

export type AtlasModel = {
  id: string;
  name: string;
  /** ex. "Local · Ollama", "En ligne · OpenAI" */
  where: string;
};

export type AtlasEffortId = "low" | "medium" | "high" | "xhigh" | "ultra";

export const ATLAS_EFFORTS: { id: AtlasEffortId; label: string }[] = [
  { id: "low", label: "Faible" },
  { id: "medium", label: "Moyen" },
  { id: "high", label: "Haut" },
  { id: "xhigh", label: "Très élevé" },
  { id: "ultra", label: "Ultra" },
];

export type AtlasFile = {
  id: string;
  name: string;
  size?: number;
  /** chemin absolu si disponible (Tauri) */
  path?: string;
};

export type AtlasPermissionRequest = {
  title: string; // "Autoriser Atlas à mettre des fichiers à la corbeille ?"
  summary: string; // "Supprimer les fichiers de Téléchargements de plus de 6 mois"
};

export type AtlasPermissionDecision = "allow" | "deny";
