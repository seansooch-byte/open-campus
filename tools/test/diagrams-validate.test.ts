import { afterEach, beforeEach, expect, it } from 'vitest';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../src/validate.js';

const smi = 'courses/ex-100/topics/example-amino-acid-structure/diagrams/glycine.smi';
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(fileURLToPath(new URL('./', import.meta.url)), '.tmp-oc-'));
  await cp(new URL('./fixtures/content/', import.meta.url), root, { recursive: true });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

it('a malformed .smi fails validation with the file and input named', async () => {
  await writeFile(join(root, smi), 'C1C1\n');
  const errors = (await validate(root)).filter((i) => i.severity === 'error');
  expect(errors).toHaveLength(1);
  expect(errors[0]!.file).toBe(smi);
  expect(errors[0]!.message).toBe(`${smi}: invalid SMILES "C1C1": duplicate bond between atoms 1 and 2 (ring closure 1)`);
});

it('a well-formed .smi still validates', async () => {
  await writeFile(join(root, smi), 'NCC(=O)O\n');
  expect((await validate(root)).filter((i) => i.severity === 'error')).toEqual([]);
});
