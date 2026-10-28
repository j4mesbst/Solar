/** Harness smoke, NOT a Cortex/Ornith model evaluation. This uses known
 * fixture reference patches to check the immutable public runner path. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures } from '../fixtures/definitions.mjs';
import { materializeFixture,writeFiles } from '../fixtures/materialize.mjs';
import { runProcess } from '../lib/process.mjs';
let pass=0;
for(const fixture of fixtures){
  const root=await mkdtemp(join(tmpdir(),`solar-ref-${fixture.id}-`));
  try {
    const workspace=join(root,'workspace'),evaluationRoot=join(root,'evaluation');
    const baseline=await materializeFixture(fixture,workspace,{evaluationRoot});
    await writeFiles(workspace,fixture.solution);
    const result=await runProcess(process.execPath,[baseline.evaluation.publicRunner],{cwd:workspace,timeoutMs:20000});
    assert.equal(result.code,0,`${fixture.id}: known reference must pass public tests: ${result.stderr}\n${result.stdout}`);
    pass++;
  } finally {await rm(root,{recursive:true,force:true});}
}
console.log(`Known reference patches: ${pass}/${fixtures.length} immutable public fixture runners pass (NOT model performance)`);
