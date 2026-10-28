import { aiderAdapter } from './aider.mjs';
import { cortexAdapter } from './cortex.mjs';
import { opencodeAdapter } from './opencode.mjs';

export const adapters = Object.freeze({ cortex: cortexAdapter, aider: aiderAdapter, opencode: opencodeAdapter });
export const agentIds = Object.freeze(Object.keys(adapters));
