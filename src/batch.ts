import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { hashFile, type Algorithm, type HashResult } from './hasher.js';

export interface BatchEntry {
  file: string;
  algorithm: Algorithm;
  hash: string;
}

export async function batchHash(
  dirPath: string,
  algo: Algorithm,
  onFile?: (entry: BatchEntry, index: number, total: number) => void
): Promise<BatchEntry[]> {
  const files = await getFiles(dirPath);
  const results: BatchEntry[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const hash = await hashFile(file, algo);
    const entry: BatchEntry = { file, algorithm: algo, hash };
    results.push(entry);
    onFile?.(entry, i + 1, files.length);
  }

  return results;
}

async function getFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      const subFiles = await getFiles(fullPath);
      files.push(...subFiles);
    }
  }

  return files.sort();
}

export function formatChecksums(entries: BatchEntry[]): string {
  return entries.map(e => `${e.hash}  ${e.file}`).join('\n') + '\n';
}
