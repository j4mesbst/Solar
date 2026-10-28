import { currentAccountScope, scopedKey } from "./accountScope.ts";
const formatters = new Map<string, Intl.DateTimeFormat>();
import { solarAgentStore, type AgentAutomation } from "./solarAgentStore.ts";

function localParts(date: Date, timezone: string) {
  const formatter = formatters.get(timezone) ?? new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  formatters.set(timezone, formatter); const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}
export function nextAutomationRun(automation: Pick<AgentAutomation, "frequency" | "localTime" | "timezone" | "weekdays" | "localDate">, after: Date): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(automation.localTime)) throw new Error("Heure locale invalide.");
  new Intl.DateTimeFormat("en-US", { timeZone: automation.timezone });
  if (automation.frequency === "weekly" && !automation.weekdays?.some(day => Number.isInteger(day) && day >= 0 && day <= 6)) throw new Error("Choisis au moins un jour.");
  if (automation.frequency === "once" && !/^\d{4}-\d{2}-\d{2}$/.test(automation.localDate ?? "")) throw new Error("Choisis une date.");
  const current = localParts(after, automation.timezone);
  const skipDate = current.time >= automation.localTime ? current.date : "";
  // Walk minute boundaries in UTC; Intl maps each instant through the IANA zone,
  // so DST skips nonexistent local times and naturally handles 23/25-hour days.
  let instant = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
  if (automation.frequency === "once") instant = Math.max(instant, Date.parse(`${automation.localDate}T00:00:00Z`) - 24 * 60 * 60_000);
  const limit = automation.frequency === "once" ? Date.parse(`${automation.localDate}T00:00:00Z`) + 48 * 60 * 60_000 : instant + 8 * 24 * 60 * 60_000;
  for (; instant < limit; instant += 60_000) {
    const parts = localParts(new Date(instant), automation.timezone);
    if ((automation.frequency !== "once" || parts.date === automation.localDate) && parts.date !== skipDate && parts.time === automation.localTime && (automation.frequency !== "weekly" || automation.weekdays?.includes(parts.weekday))) return new Date(instant).toISOString();
  }
  throw new Error("Aucune occurrence future à cette date et à cette heure locale.");
}
export async function dueAutomations(now: Date): Promise<AgentAutomation[]> {
  const data = await solarAgentStore.snapshot();
  return data.automations.filter(item => item.enabled && !item.missed && Date.parse(item.nextRunAt) <= now.getTime() && item.lastOccurrence !== item.nextRunAt);
}
export async function markAutomationResult(item: AgentAutomation, result: string, now = new Date()) {
  return solarAgentStore.updateAutomationOccurrence(item.id, item.nextRunAt, current => {
    const next = { ...current, lastOccurrence: item.nextRunAt, lastResult: result, updatedAt: now.toISOString(), enabled: current.enabled && current.frequency !== "once", missed: false, interactiveOnce: false };
    if (next.enabled) next.nextRunAt = nextAutomationRun(current, new Date(Math.max(now.getTime(), Date.parse(item.nextRunAt))));
    return next;
  });
}
export async function detectMissedAutomations(now = new Date(), graceMinutes = 10) {
  const data = await solarAgentStore.snapshot();
  for (const item of data.automations) {
    if (item.enabled && !item.missed && now.getTime() - Date.parse(item.nextRunAt) > graceMinutes * 60_000) {
      await solarAgentStore.updateAutomationOccurrence(item.id,item.nextRunAt,current=>current.enabled ? { ...current, missed: true, updatedAt: now.toISOString() } : current);
    }
  }
}

export async function claimAutomation(item: AgentAutomation): Promise<boolean> {
 const account = currentAccountScope(), occurrence = item.nextRunAt;
 if (typeof window !== "undefined" && (window as Window & {__TAURI_INTERNALS__?: unknown}).__TAURI_INTERNALS__) {
  return (await import("@tauri-apps/api/core")).invoke<boolean>("scheduler_claim", {account, automation:item.id, occurrence});
 }
 const key = scopedKey(`solar.automation.receipt.${item.id}.${occurrence}`);
 if (!navigator.locks) throw Error("Le verrouillage des automatisations est indisponible dans cet aperçu.");
 return navigator.locks.request(key, () => { if (localStorage.getItem(key)) return false; localStorage.setItem(key, "claimed"); return true; });
}

/** Explicit delegation is scoped to instruction, model, workspace resources and
 * exact connector accounts. Revocation/changes fall back to normal approvals. */
export function delegatedReadAllowed(item:AgentAutomation,agent:import('./solarAgentStore.ts').SolarAgent,accounts:Record<string,string>,resources:unknown){
 const consent=item.readConsent;if(!consent||!item.kind||consent.providerId!==agent.providerId||consent.modelId!==agent.modelId)return false;
 return consent.instruction===item.instruction&&consent.resources===JSON.stringify(resources)&&consent.services.length>0&&consent.services.every(id=>accounts[id]&&consent.connections[id]===accounts[id]);
}
