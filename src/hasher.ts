import { createHash, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export type Algorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export const ALGORITHMS: Algorithm[] = ['md5', 'sha1', 'sha256', 'sha512'];

export const HASH_LENGTHS: Record<number, Algorithm> = {
  32: 'md5',
  40: 'sha1',
  64: 'sha256',
  128: 'sha512',
};

export function detectAlgorithm(hash: string): Algorithm | null {
  return HASH_LENGTHS[hash.length] ?? null;
}

export function hashText(text: string, algo: Algorithm): string {
  return createHash(algo).update(text).digest('hex');
}

export interface HashProgress {
  bytesProcessed: number;
  totalBytes: number;
  percent: number;
}

export type ProgressCallback = (progress: HashProgress) => void;

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

export async function hashFile(
  filePath: string,
  algo: Algorithm,
  onProgress?: ProgressCallback
): Promise<string> {
  const fileStat = await stat(filePath);
  const totalBytes = fileStat.size;
  const showProgress = onProgress && totalBytes > LARGE_FILE_THRESHOLD;

  return new Promise((resolve, reject) => {
    const hash: Hash = createHash(algo);
    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
    let bytesProcessed = 0;

    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
      bytesProcessed += chunk.length;
      if (showProgress) {
        onProgress({ bytesProcessed, totalBytes, percent: Math.round((bytesProcessed / totalBytes) * 100) });
      }
    });

    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export interface HashResult {
  algorithm: Algorithm;
  hash: string;
}

export async function hashFileAll(
  filePath: string,
  onProgress?: ProgressCallback
): Promise<HashResult[]> {
  const results: HashResult[] = [];
  for (const algo of ALGORITHMS) {
    const hash = await hashFile(filePath, algo);
    results.push({ algorithm: algo, hash });
  }
  return results;
}

export function hashTextAll(text: string): HashResult[] {
  return ALGORITHMS.map(algo => ({ algorithm: algo, hash: hashText(text, algo) }));
}
