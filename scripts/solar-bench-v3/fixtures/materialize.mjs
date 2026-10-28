import { cp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hashTree } from '../lib/io.mjs';

const exec = promisify(execFile);

function safe(root, name) {
  const target = resolve(root, name);
  if (!target.startsWith(`${resolve(root)}/`)) throw new Error(`Chemin fixture hors racine : ${name}`);
  return target;
}

export async function writeFiles(root, files) {
  for (const [name, content] of Object.entries(files)) {
    const path = safe(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

export async function materializeFixture(fixture, root, { dependencyRoot, evaluationRoot = `${root}-evaluation` } = {}) {
  await mkdir(root, { recursive: true });
  await mkdir(evaluationRoot, { recursive: true });
  const publicSource = fixture.files['public-test.mjs'];
  if (!publicSource) throw new Error(`Test public absent pour ${fixture.id}.`);
  const files = Object.fromEntries(Object.entries(fixture.files).filter(([name]) => name !== 'public-test.mjs'));
  const runner = join(evaluationRoot, 'public-runner.mjs');
  const runnerSource = `import {spawnSync} from 'node:child_process';\nconst source=${JSON.stringify(publicSource)};\nconst result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',source],{cwd:process.cwd(),stdio:'inherit',env:process.env});\nprocess.exit(result.status??1);\n`;
  await writeFile(runner, runnerSource, { mode: 0o444 });
  const packageFile = JSON.parse(files['package.json']);
  packageFile.scripts.test = `node ${JSON.stringify(relative(root, runner))}`;
  files['package.json'] = JSON.stringify(packageFile, null, 2);
  await writeFiles(root, files);
  if (dependencyRoot) {
    try { await symlink(join(dependencyRoot, 'node_modules'), join(root, 'node_modules'), 'dir'); } catch {}
  }
  await exec('/usr/bin/git', ['init', '--quiet'], { cwd: root });
  await exec('/usr/bin/git', ['config', 'user.email', 'solar-bench@invalid.local'], { cwd: root });
  await exec('/usr/bin/git', ['config', 'user.name', 'Solar Bench'], { cwd: root });
  await exec('/usr/bin/git', ['add', '--all'], { cwd: root });
  await exec('/usr/bin/git', ['commit', '--quiet', '-m', 'fixture baseline'], { cwd: root });
  const tree = await hashTree(root, { ignore: [/^\.git\//, /^node_modules\//] });
  return { ...tree, evaluation: { version: 2, publicRunner: runner, publicSourceSha256: (await hashTree(evaluationRoot)).sha256, expectedTestCommand: packageFile.scripts.test, protectedWorkspaceFiles: ['public-test.mjs', 'test-private.mjs'] } };
}

export async function copyFixture(source, target) {
  await cp(source, target, { recursive: true, dereference: false });
}
