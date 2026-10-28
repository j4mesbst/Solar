export const MODEL = 'ornith-1.5:9b';
export const OLLAMA_BASE = process.env.SOLAR_BENCH_OLLAMA_BASE ?? 'http://127.0.0.1:11434';

export const profiles = Object.freeze({
  STRICT: Object.freeze({
    name: 'STRICT',
    contextWindow: 16384,
    maxOutputTokens: 2200,
    timeoutMs: 8 * 60_000,
    temperature: 0,
    resource: Object.freeze({ maxSwapGrowthBytes: 4 * 1024 ** 3, minAvailableBytes: 384 * 1024 ** 2 }),
  }),
  PRACTICAL: Object.freeze({
    name: 'PRACTICAL',
    contextWindow: 16384,
    maxOutputTokens: 4096,
    timeoutMs: 12 * 60_000,
    temperature: 0,
    resource: Object.freeze({ maxSwapGrowthBytes: 4 * 1024 ** 3, minAvailableBytes: 384 * 1024 ** 2 }),
  }),
});

export function profile(name = 'STRICT') {
  const value = profiles[String(name).toUpperCase()];
  if (!value) throw new Error(`Profil inconnu : ${name}. Valeurs : STRICT, PRACTICAL.`);
  return value;
}
