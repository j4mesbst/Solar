import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { classifyModel, loadBundledSkills, routeSkills } from '../src/services/skillEngine.ts';
import { chooseSolarCodeStrategy, budgetConversation } from '../src/services/solarCodeStrategy.ts';
import { buildIntentQuestions, intentInstruction, summarizeIntent } from '../src/services/intentClarification.ts';
import { pullModel } from '../src/services/modelInstall.ts';

const dir = new URL('../src/skills/', import.meta.url);
const files = Object.fromEntries(readdirSync(dir).filter(file => file.endsWith('.md')).map(file => [file, readFileSync(join(dir.pathname, file), 'utf8')]));
const loaded = loadBundledSkills(files);
assert.deepEqual(loaded.errors, []);
assert.equal(loaded.skills.length, 7);
assert.equal(new Set(loaded.skills.map(skill => skill.id)).size, 7);
for (const skill of loaded.skills) {
  assert(skill.name.length > 2);
  assert(skill.description.length > 20);
  assert(skill.content.length > 100);
}

assert.equal(classifyModel('Solar 4B / Qwen3-4B', 'ollama'), 'solar-4b');
assert.equal(classifyModel('Solar 9B (Ornith-1.0-9B)', 'ollama'), 'solar-9b');
assert.equal(classifyModel('Solar 12B Gemma 3 12B IT', 'ollama'), 'solar-12b');
assert.equal(classifyModel('Qwen3-4B', 'openai-compatible'), 'cloud');
const route = routeSkills({ prompt: 'Corrige ce bug TypeScript et vérifie les imports', modelName: 'Solar 9B', providerProtocol: 'ollama' }, loaded.skills);
assert(route.selected.some(item => item.skill.id === 'solar.software-engineer'));
assert(route.selected.some(item => item.skill.id === 'solar.debugging'));
assert(route.instruction.length <= route.budget);
assert(route.selected.every(item => item.injectedContent.length > 0));
const manual = routeSkills({ prompt: 'Crée une présentation animée', skillsMode: 'manual', manualSkillIds: ['solar.presentation-design'], modelName: 'Solar 4B', providerProtocol: 'ollama' }, loaded.skills);
assert.deepEqual(manual.selected.map(item => item.skill.id), ['solar.presentation-design']);
assert(routeSkills({ prompt: 'Bonjour', modelName: 'Solar 4B', providerProtocol: 'ollama' }, loaded.skills).selected.length === 0);

assert.equal(chooseSolarCodeStrategy({ prompt: 'Renomme ce bouton', modelName: 'Solar 4B', protocol: 'ollama' }).strategy, 'fast');
assert.equal(chooseSolarCodeStrategy({ prompt: 'Refactor l’architecture multi-fichier, corrige les régressions de sécurité, vérifie les références et ajoute les tests', modelName: 'Solar 9B', protocol: 'ollama', attachments: 1 }).strategy, 'deep');
const messages = Array.from({ length: 40 }, (_, i) => ({ id: String(i), role: i === 39 ? 'user' : i % 2 ? 'assistant' : 'user', content: `Message ${i} `.repeat(400), conversationId: 'c' }));
const bounded = budgetConversation(messages, { modelName: 'Solar 4B', protocol: 'ollama', availableMemory: 3 * 2 ** 30 });
assert(bounded.messages.some(message => message.id === '39'));
assert(bounded.messages.length < messages.length);
assert(bounded.budget < 10500);

assert.equal(buildIntentQuestions('Refais cette page', '', false).length > 0, true);
assert.equal(buildIntentQuestions('Ajoute un bouton de recherche sous le titre sur macOS, style minimaliste', '', false).length, 0);
assert.equal(buildIntentQuestions('Envoie-moi un bonjour', '', false).length, 0);
const questions = [{ id: 'style', label: 'Style', options: ['Minimaliste'] }];
const resolution = { prompt: 'Refais cette page', answers: { style: ['Minimaliste'] } };
assert.equal(summarizeIntent(resolution, questions), 'Minimaliste');
assert(intentInstruction(resolution).includes('contraintes confirmées'));

const server = createServer((request, response) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    const model = JSON.parse(body).model;
    if (model === 'test:missing') {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'manifest introuvable pour ce modèle' }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/x-ndjson' });
    response.write('{"status":"pulling manifest"}\n{"status":"downloading","completed":2,"total":4}\n');
    response.end('{"status":"success"}\n');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;
await assert.rejects(pullModel(baseUrl, 'test:missing', new AbortController().signal, () => {}), /manifest introuvable/);
const progress = [];
await pullModel(baseUrl, 'test:success', new AbortController().signal, update => progress.push(update));
assert.equal(progress.at(-1)?.status, 'success');
assert(progress.some(update => update.completed === 2 && update.total === 4));
await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

console.log('solar-ai-contracts: ok (7 skill packs, metadata, routing, model budgets, clarification and Solar Code strategy)');
