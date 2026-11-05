import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { validateSnapshot } from '../lib/abssa/validate';
import type { AbssaSnapshot } from '../lib/abssa/types';
export async function saveVerifiedSnapshot(path: string, snapshot: AbssaSnapshot) {
  const report = validateSnapshot(snapshot);
  if (!report.valid) throw new Error(`Validation blocked update: ${report.errors.join('; ')}`);
  if (Math.abs(Date.now()-Date.parse(snapshot.fetchedAt)) > 15*60*1000) throw new Error('Source snapshot is not fresh');
  const previous = JSON.parse(await readFile(path,'utf8')) as AbssaSnapshot;
  if (Date.parse(previous.fetchedAt) > Date.parse(snapshot.fetchedAt)) throw new Error('Refusing an older snapshot');
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(snapshot,null,2)+'\n');
    await rename(temporary,path);
  } finally { await rm(temporary,{force:true}); }
}
