import { hashFile, detectAlgorithm, ALGORITHMS, type Algorithm, type ProgressCallback } from './hasher.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export interface VerifyResult {
  file: string;
  algorithm: Algorithm;
  expected: string;
  actual: string;
  match: boolean;
}

export async function verifyFile(
  filePath: string,
  expectedHash: string,
  onProgress?: ProgressCallback
): Promise<VerifyResult> {
  const algo = detectAlgorithm(expectedHash);
  if (!algo) {
    throw new Error(
      `Cannot detect algorithm from hash length ${expectedHash.length}. ` +
      `Expected: 32 (MD5), 40 (SHA1), 64 (SHA256), 128 (SHA512).`
    );
  }

  const actual = await hashFile(filePath, algo, onProgress);
  return {
    file: filePath,
    algorithm: algo,
    expected: expectedHash.toLowerCase(),
    actual,
    match: actual === expectedHash.toLowerCase(),
  };
}

export async function compareFiles(
  file1: string,
  file2: string,
  algo: Algorithm = 'sha256'
): Promise<{ file1Hash: string; file2Hash: string; match: boolean; algorithm: Algorithm }> {
  const [hash1, hash2] = await Promise.all([
    hashFile(file1, algo),
    hashFile(file2, algo),
  ]);

  return { file1Hash: hash1, file2Hash: hash2, match: hash1 === hash2, algorithm: algo };
}

export interface ChecksumsEntry {
  hash: string;
  file: string;
}

export function parseChecksumsFile(content: string): ChecksumsEntry[] {
  const entries: ChecksumsEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Format: hash  filename  OR  hash filename
    const match = trimmed.match(/^([a-fA-F0-9]+)\s+(.+)$/);
    if (match) {
      entries.push({ hash: match[1], file: match[2].trim() });
    }
  }
  return entries;
}

export async function checkFromFile(
  checksumsPath: string,
  onProgress?: (current: number, total: number, result: VerifyResult) => void
): Promise<VerifyResult[]> {
  const content = await readFile(checksumsPath, 'utf-8');
  const entries = parseChecksumsFile(content);
  const baseDir = dirname(resolve(checksumsPath));
  const results: VerifyResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const filePath = resolve(baseDir, entry.file);
    try {
      const result = await verifyFile(filePath, entry.hash);
      results.push(result);
      onProgress?.(i + 1, entries.length, result);
    } catch (err) {
      const errorResult: VerifyResult = {
        file: filePath,
        algorithm: detectAlgorithm(entry.hash) ?? 'sha256',
        expected: entry.hash,
        actual: `ERROR: ${(err as Error).message}`,
        match: false,
      };
      results.push(errorResult);
      onProgress?.(i + 1, entries.length, errorResult);
    }
  }

  return results;
}
