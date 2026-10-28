import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

export const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

export async function hashTree(root, { ignore = [] } = {}) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const name = relative(root, path).split(sep).join('/');
      if (ignore.some(pattern => pattern.test(name))) continue;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push([name, sha256(await readFile(path))]);
    }
  }
  await walk(root);
  files.sort(([a], [b]) => a.localeCompare(b));
  return { files, sha256: sha256(JSON.stringify(files)) };
}

export function redact(text = '') {
  return String(text)
    .replaceAll(process.env.HOME ?? '/Users/unknown', '<HOME>')
    .replace(/(?:sk|ghp|github_pat|xox[baprs])-[-\w]{12,}/gi, '<SECRET>')
    .replace(/(?:api[_-]?key|token|authorization)["'=:\s]+[^\s",}]+/gi, '$1=<REDACTED>');
}
