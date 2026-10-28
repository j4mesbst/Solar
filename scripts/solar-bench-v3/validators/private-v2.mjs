import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from '@babel/parser';
import { hashTree } from '../lib/io.mjs';
import { runProcess } from '../lib/process.mjs';

export const VALIDATOR_VERSION = 2;

const functional = {
  '01-broken-react': `import assert from 'node:assert/strict';import {seed,removeTask,increment} from './src/state.ts';assert.equal(increment(5),6);assert.deepEqual(seed.map(x=>x.id),['a','b']);assert.deepEqual(removeTask(seed,'b').map(x=>x.id),['a']);`,
  '02-multifile-refactor': `import assert from 'node:assert/strict';import {products,label,formatPrice,affordable,total} from './src/index.ts';assert.deepEqual(products.map(x=>x.id),['p1','p2']);assert(products.every(x=>['EUR','USD'].includes(x.currency)));assert.match(formatPrice(products[0]),/18/);assert.match(label(products[0]),/Solar Mug/);assert.equal(affordable(products).length,1);assert.equal(total(products),50);`,
  '03-feature-integration': `import assert from 'node:assert/strict';import {notes,search,rename,toggleFavorite,favorites,summary} from './src/index.ts';const next=toggleFavorite(notes,'1');assert.equal(notes[0].favorite,false);assert.equal(next[0].favorite,true);assert.deepEqual(favorites(next).map(x=>x.id),['1']);assert.deepEqual(summary(next),{total:2,favorites:1});assert.equal(search(next,'beta')[0].id,'2');assert.equal(rename(next,'2','B')[1].title,'B');`,
  '04-phased-task': `import assert from 'node:assert/strict';import {invoices} from './src/model.ts';import {advance,total} from './src/workflow.ts';import {report} from './src/report.ts';assert.deepEqual(invoices.map(x=>x.id),['i1','i2']);assert.equal(total(invoices),50);assert.equal(advance(invoices[0]).status,'sent');assert.equal(advance(advance(invoices[0])).status,'paid');assert.equal(advance(advance(advance(invoices[0]))).status,'paid');assert.deepEqual(report(invoices),{count:2,total:50,byStatus:{draft:2,sent:0,paid:0}});`,
  '05-non-regression': `import assert from 'node:assert/strict';import {items,sortItems,select,add,remove} from './src/list.ts';const sorted=sortItems(items);assert.equal(select(sorted,'z').label,'Zulu');assert.deepEqual(items.map(x=>x.id),['z','a']);assert.equal(add(items,{id:'b',label:'Beta'}).length,3);assert.deepEqual(remove(items,'z').map(x=>x.id),['a']);`,
  '06-diagnosis-to-fix': `import assert from 'node:assert/strict';import {memo,clear} from './src/cache.ts';clear();let calls=0;assert.equal(await memo('a',async()=>{calls++;return 'A'}),'A');assert.equal(await memo('a',async()=>{calls++;return 'X'}),'A');assert.equal(await memo('b',async()=>{calls++;return 'B'}),'B');assert.equal(calls,2);clear();await assert.rejects(()=>memo('x',async()=>{throw Error('x')}));assert.equal(await memo('x',async()=> 'retry'),'retry');`,
  '07-large-context': `import assert from 'node:assert/strict';import {localHour} from './src/time.ts';assert.equal(localHour(23,120),1);assert.equal(localHour(1,-180),22);assert.equal(localHour(0,0),0);`,
  '08-api-recovery': `import assert from 'node:assert/strict';import {deadline} from './src/deadline.ts';assert.equal(deadline('2024-02-28T00:00:00Z',1),'2024-02-29');assert.equal(deadline('2026-12-31T00:00:00Z',1),'2027-01-01');`,
  '09-responsive-ui': ``,
  '10-long-context': `import assert from 'node:assert/strict';import {canEdit,invite,audit,csv} from './src/index.ts';const owner={id:'alice',name:'Alice',role:'owner'},editor={id:'eve',name:'Eve',role:'editor'},viewer={id:'bob',name:'Bob',role:'viewer'};assert.equal(canEdit(owner),true);assert.equal(canEdit(editor),true);assert.equal(canEdit(viewer),false);const xs=[owner];const added=invite(xs,{...viewer,id:'BOB'});assert.equal(xs.length,1);assert.equal(added[1].id,'bob');assert.strictEqual(invite(xs,owner),xs);assert.match(audit('invite','bob'),/[À-ÿ]|Action|Invit|Ajout/);assert(csv([owner]).startsWith('id;nom;rôle'));assert.doesNotMatch(csv([owner]),/,/);`,
  '11-tool-loop': `import assert from 'node:assert/strict';import {normalize} from './src/normalize.ts';assert.equal(normalize('  SOLAR    CODE  '),'solar code');assert.equal(normalize('İSTANBUL'),'istanbul');assert.equal(normalize('ÉTÉ'),'été'.normalize('NFKD').toLocaleLowerCase('en-US'));`,
  '12-multilingual': `import assert from 'node:assert/strict';import {calcularTotal,resumenMensual} from './src/index.ts';const registros=[{fecha:'2026-01-02',importe:2},{fecha:'2026-01-20',importe:3},{fecha:'2026-02-01',importe:4}];assert.equal(calcularTotal(registros),9);assert.deepEqual(resumenMensual(registros),[{month:'2026-01',total:5,label:'Total 2026-01 : 5'},{month:'2026-02',total:4,label:'Total 2026-02 : 4'}]);assert.equal(registros.length,3);`,
};

const check = (id, status, output, extra = {}) => ({ id, status, success: status === 'passed', output, ...extra });
const exists = path => stat(path).then(() => true).catch(() => false);

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) Array.isArray(value) ? value.forEach(item => walk(item, visit)) : walk(value, visit);
}

async function structural(fixture, workspace) {
  if (fixture.id === '01-broken-react') {
    const source = await readFile(join(workspace, 'src/TaskList.tsx'), 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    let stableKey = false, removeById = false;
    walk(ast, node => {
      if (node.type === 'JSXAttribute' && node.name?.name === 'key' && node.value?.expression?.type === 'MemberExpression' && node.value.expression.property?.name === 'id') stableKey = true;
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'onRemove' && node.arguments?.[0]?.type === 'MemberExpression' && node.arguments[0].property?.name === 'id') removeById = true;
    });
    if (!stableKey || !removeById) throw new Error('La liste doit utiliser un ID stable pour la clé et la suppression.');
  }
  if (fixture.id === '05-non-regression') {
    const html = await readFile(join(workspace, 'src/view.html'), 'utf8');
    const ids = new Set([...html.matchAll(/\bid\s*=\s*(["'])([^"']+)\1/gi)].map(match => match[2]));
    for (const id of ['app', 'add', 'items', 'selection']) if (!ids.has(id)) throw new Error(`Élément DOM #${id} absent.`);
  }
  if (fixture.id === '08-api-recovery') {
    const source = await readFile(join(workspace, 'src/deadline.ts'), 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
    const imported = [];
    walk(ast, node => { if (node.type === 'ImportSpecifier') imported.push(node.imported?.name); });
    if (imported.some(name => !['formatIso', 'addDays'].includes(name))) throw new Error('Import SolarDate non documenté.');
  }
  if (fixture.id === '09-responsive-ui') {
    const app = await readFile(join(workspace, 'src/App.tsx'), 'utf8');
    const css = await readFile(join(workspace, 'src/styles.css'), 'utf8');
    const ast = parse(app, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    const tags = new Set(), calls = new Set(); let labelled = false, reusable = false;
    walk(ast, node => {
      if (node.type === 'JSXOpeningElement' && node.name?.type === 'JSXIdentifier') tags.add(node.name.name.toLowerCase());
      if (node.type === 'JSXAttribute' && ['aria-label', 'aria-labelledby'].includes(node.name?.name)) labelled = true;
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') calls.add(node.callee.name);
      if ((node.type === 'FunctionDeclaration' || node.type === 'VariableDeclarator') && ['Card', 'card'].includes(node.id?.name)) reusable = true;
    });
    for (const tag of ['nav', 'article', 'input', 'select', 'dialog']) if (!tags.has(tag)) throw new Error(`Élément ${tag} absent.`);
    if (!labelled || !calls.has('useState') || !reusable) throw new Error('Accessibilité, état interactif ou carte réutilisable absent.');
    if (!/display\s*:\s*grid/i.test(css) || !/@media\s*\([^)]*max-width/i.test(css) || !/prefers-reduced-motion/i.test(css) || !/color-scheme/i.test(css)) throw new Error('Contrat responsive/thème/mouvement incomplet.');
  }
  if (fixture.id === '10-long-context') {
    const source = await Promise.all(['src/access.ts','src/team.ts','src/audit.ts','src/csv.ts'].map(path => readFile(join(workspace, path), 'utf8')));
    if (source.some(value => /Date\.now\s*\(/.test(value))) throw new Error('Date.now est interdit par le contrat.');
  }
  if (fixture.id === '12-multilingual') {
    const source = await readFile(join(workspace, 'src/reporte.ts'), 'utf8');
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript'], attachComment: true });
    const comments = ast.comments?.map(item => item.value).join(' ') ?? '';
    if (!/\b(Suma|importes|registros)\b/i.test(comments)) throw new Error('Le commentaire espagnol existant doit être préservé.');
  }
}

export async function validateFixture(fixture, workspace, { timeoutMs = 45_000, evaluation } = {}) {
  const checks = [];
  if (!evaluation?.publicRunner) throw new Error('Bundle d’évaluation immuable absent.');
  const currentEvaluationHash = (await hashTree(dirname(evaluation.publicRunner))).sha256;
  const packageFile = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8').catch(() => '{}'));
  const protectedCreated = (await Promise.all(evaluation.protectedWorkspaceFiles.map(async name => [name, await exists(join(workspace, name))]))).filter(([, present]) => present).map(([name]) => name);
  const integrityOk = currentEvaluationHash === evaluation.publicSourceSha256 && packageFile.scripts?.test === evaluation.expectedTestCommand && protectedCreated.length === 0;
  checks.push(check('evaluation-integrity', integrityOk ? 'passed' : 'failed', integrityOk ? 'Évaluation immuable intacte.' : `Tentative de modification détectée (${protectedCreated.join(', ') || 'commande/hash'}).`));
  const publicResult = await runProcess(process.execPath, [evaluation.publicRunner], { cwd: workspace, timeoutMs });
  checks.push(check('public-tests-v2', publicResult.code === 0 ? 'passed' : 'failed', publicResult.code === 0 ? 'Tests publics immuables réussis.' : publicResult.stderr || publicResult.stdout, { durationMs: publicResult.durationMs }));
  const source = functional[fixture.id];
  if (source === undefined) checks.push(check('private-acceptance-v2', 'unavailable', 'Oracle privé V2 absent.'));
  else {
    const result = source ? await runProcess(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', source], { cwd: workspace, timeoutMs }) : { code: 0, durationMs: 0 };
    let error;
    if (result.code === 0) try { await structural(fixture, workspace); } catch (caught) { error = caught; }
    checks.push(check('private-acceptance-v2', result.code === 0 && !error ? 'passed' : 'failed', result.code !== 0 ? result.stderr || result.stdout : error?.message ?? 'Critères fonctionnels et structurels privés V2 réussis.', { durationMs: result.durationMs }));
  }
  checks.push(check('project-integrity', packageFile.private === true && packageFile.scripts?.test ? 'passed' : 'failed', 'Package privé et commande de test présents.'));
  return { validatorVersion: VALIDATOR_VERSION, passed: checks.length > 0 && checks.every(item => item.status === 'passed'), checks };
}
