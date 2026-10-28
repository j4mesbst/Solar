import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtures } from '../fixtures/definitions.mjs';
import { materializeFixture, writeFiles } from '../fixtures/materialize.mjs';
import { validateFixture } from './private-v2.mjs';

const alternative = {
  '01-broken-react': { 'src/TaskList.tsx': `import type {Task} from './types';export const TaskList=({items,onRemove}:{items:Task[];onRemove:(id:string)=>void})=><ul>{items.map(task=><li key={task.id}>{task.label}<button onClick={function(){onRemove(task.id)}}>Supprimer</button></li>)}</ul>;\n` },
  '05-non-regression': { 'src/list.ts': `export const items=[{id:'z',label:'Zulu'},{id:'a',label:'Alpha'}];export const sortItems=xs=>Array.from(xs).sort((a,b)=>a.label.localeCompare(b.label));export function select(xs,id){return xs.find(item=>item.id===id)}export const add=(xs,item)=>xs.concat(item);export const remove=(xs,id)=>xs.filter(item=>item.id!==id);\n` },
  '08-api-recovery': { 'src/deadline.ts': `import * as SolarDate from '../vendor/solar-date/index.ts';export function deadline(iso:string,days:number){return SolarDate.formatIso(SolarDate.addDays(new Date(iso),days))}\n` },
};

const corrupt = {
  '01-broken-react': ['src/state.ts', /value\+1/, 'value'],
  '02-multifile-refactor': ['src/data.ts', /currency:'EUR'/, "currency:'GBP'"],
  '03-feature-integration': ['src/store.ts', /favorite:!x\.favorite/, 'favorite:x.favorite'],
  '04-phased-task': ['src/workflow.ts', /sent:'paid'/, "sent:'sent'"],
  '05-non-regression': ['src/list.ts', /xs\.find\(x=>x\.id===id\)/, 'xs[Number(id)]'],
  '06-diagnosis-to-fix': ['src/cache.ts', /cache\.has\(key\)/, 'cache.size > 0'],
  '07-large-context': ['src/time.ts', /offsetMinutes\/60/, 'offsetMinutes'],
  '08-api-recovery': ['src/deadline.ts', /formatIso/, 'formatDate'],
  '09-responsive-ui': ['src/styles.css', /@media\(max-width:640px\)[\s\S]*?\}\}/, ''],
  '10-long-context': ['src/access.ts', /\|\|m\.role==='editor'/, ''],
  '11-tool-loop': ['src/normalize.ts', /\.replace\(\/\\u0307\/g,''\)/, ''],
  '12-multilingual': ['src/reporte.ts', /meses\.set\(mes,\(meses\.get\(mes\)\?\?0\)\+registro\.importe\)/, 'meses.set(mes,registro.importe)'],
};

export async function validateAll({ root = process.cwd(), keep = false } = {}) {
  const base = await mkdtemp(join(tmpdir(), 'solar-bench-v3-fixtures-'));
  const results = [];
  try {
    for (const fixture of fixtures) {
      const initial = join(base, `${fixture.id}-initial`);
      const initialTree = await materializeFixture(fixture, initial);
      const initialResult = await validateFixture(fixture, initial, { evaluation: initialTree.evaluation });
      const reference = join(base, `${fixture.id}-reference`);
      const referenceTree = await materializeFixture(fixture, reference);
      await writeFiles(reference, fixture.solution);
      const referenceResult = await validateFixture(fixture, reference, { evaluation: referenceTree.evaluation });
      const variant = join(base, `${fixture.id}-variant`);
      const variantTree = await materializeFixture(fixture, variant);
      await writeFiles(variant, { ...fixture.solution, ...alternative[fixture.id] });
      for (const [name, content] of Object.entries(fixture.solution)) if (!alternative[fixture.id]?.[name]) await writeFiles(variant, { [name]: `${content}\n` });
      const variantResult = await validateFixture(fixture, variant, { evaluation: variantTree.evaluation });
      const defective = join(base, `${fixture.id}-defective`);
      const defectiveTree = await materializeFixture(fixture, defective);
      await writeFiles(defective, fixture.solution);
      const [path, pattern, replacement] = corrupt[fixture.id];
      const damaged = (fixture.solution[path] ?? fixture.files[path]).replace(pattern, replacement);
      await writeFiles(defective, { [path]: damaged });
      const defectiveResult = await validateFixture(fixture, defective, { evaluation: defectiveTree.evaluation });
      results.push({ id: fixture.id, initialRejected: !initialResult.passed, referenceAccepted: referenceResult.passed, correctVariantAccepted: variantResult.passed, defectiveVariantRejected: !defectiveResult.passed, initialChecks: initialResult.checks, referenceChecks: referenceResult.checks, variantChecks: variantResult.checks, defectiveChecks: defectiveResult.checks });
    }
    return { passed: results.every(item => item.initialRejected && item.referenceAccepted && item.correctVariantAccepted && item.defectiveVariantRejected), results, temporaryRoot: keep ? base : undefined };
  } finally { if (!keep) await rm(base, { recursive: true, force: true }); }
}
