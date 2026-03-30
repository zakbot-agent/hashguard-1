#!/usr/bin/env node

import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  hashFile, hashFileAll, hashText, hashTextAll,
  ALGORITHMS, type Algorithm,
} from './hasher.js';
import { verifyFile, compareFiles, checkFromFile } from './verifier.js';
import { batchHash, formatChecksums } from './batch.js';
import {
  formatHashResults, formatSingleHash, formatVerifyResult,
  formatCompareResult, formatBatchResults, formatCheckResults,
  formatProgress,
} from './formatter.js';

// ── Argument parser ──

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] ?? 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function isAlgorithm(value: unknown): value is Algorithm {
  return typeof value === 'string' && ALGORITHMS.includes(value as Algorithm);
}

// ── Commands ──

async function cmdHash(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;
  const isText = flags.text === true;
  const algo = flags.algo;

  if (positional.length === 0) {
    console.error('Usage: hashguard hash <file|text> [--algo sha256] [--text] [--json]');
    process.exit(1);
  }

  const input = positional[0];

  if (isText) {
    if (algo && isAlgorithm(algo)) {
      const hash = hashText(input, algo);
      console.log(formatSingleHash(algo, hash, `"${input}"`, json));
    } else {
      const results = hashTextAll(input);
      console.log(formatHashResults(results, `"${input}"`, json));
    }
    return;
  }

  const filePath = resolve(input);

  const progressCb = (p: { percent: number }) => formatProgress(p.percent);

  if (algo && isAlgorithm(algo)) {
    const hash = await hashFile(filePath, algo, progressCb);
    console.log(formatSingleHash(algo, hash, filePath, json));
  } else {
    const results = await hashFileAll(filePath, progressCb);
    console.log(formatHashResults(results, filePath, json));
  }
}

async function cmdVerify(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;

  if (positional.length < 2) {
    console.error('Usage: hashguard verify <file> <expected-hash> [--json]');
    process.exit(1);
  }

  const filePath = resolve(positional[0]);
  const expectedHash = positional[1];

  const result = await verifyFile(filePath, expectedHash, (p) => formatProgress(p.percent));
  console.log(formatVerifyResult(result, json));
  process.exit(result.match ? 0 : 1);
}

async function cmdCompare(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;
  const algo = flags.algo;

  if (positional.length < 2) {
    console.error('Usage: hashguard compare <file1> <file2> [--algo sha256] [--json]');
    process.exit(1);
  }

  const file1 = resolve(positional[0]);
  const file2 = resolve(positional[1]);
  const algoToUse: Algorithm = isAlgorithm(algo) ? algo : 'sha256';

  const result = await compareFiles(file1, file2, algoToUse);
  console.log(formatCompareResult(file1, file2, result.file1Hash, result.file2Hash, result.match, result.algorithm, json));
  process.exit(result.match ? 0 : 1);
}

async function cmdBatch(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;
  const algo = flags.algo;
  const output = flags.output;

  if (positional.length === 0) {
    console.error('Usage: hashguard batch <directory> --algo sha256 [--output checksums.txt] [--json]');
    process.exit(1);
  }

  const dirPath = resolve(positional[0]);
  const algoToUse: Algorithm = isAlgorithm(algo) ? algo : 'sha256';

  const entries = await batchHash(dirPath, algoToUse, (entry, i, total) => {
    if (!json) {
      process.stderr.write(`\r  Processing ${i}/${total}...`);
    }
  });

  if (!json) process.stderr.write('\r' + ' '.repeat(40) + '\r');

  if (typeof output === 'string') {
    const content = formatChecksums(entries);
    await writeFile(resolve(output), content, 'utf-8');
    console.log(`Checksums written to ${resolve(output)} (${entries.length} files)`);
  } else {
    console.log(formatBatchResults(entries, json));
  }
}

async function cmdCheck(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;

  if (positional.length === 0) {
    console.error('Usage: hashguard check <checksums-file> [--json]');
    process.exit(1);
  }

  const checksumsPath = resolve(positional[0]);
  const results = await checkFromFile(checksumsPath, (current, total, result) => {
    if (!json) {
      const icon = result.match ? '✓' : '✗';
      process.stderr.write(`\r  [${current}/${total}] ${icon} ${result.file}`);
    }
  });

  if (!json) process.stderr.write('\r' + ' '.repeat(80) + '\r');

  console.log(formatCheckResults(results, json));

  const failed = results.filter(r => !r.match).length;
  process.exit(failed > 0 ? 1 : 0);
}

function showHelp(): void {
  console.log(`
  hashguard — File hash generator & verifier

  Usage:
    hashguard hash <file>                    Generate all hashes (MD5, SHA1, SHA256, SHA512)
    hashguard hash <file> --algo sha256      Generate specific hash
    hashguard hash "text" --text             Hash a text string
    hashguard verify <file> <hash>           Verify file against hash (auto-detects algo)
    hashguard compare <file1> <file2>        Compare two files by hash
    hashguard batch <dir> --algo sha256      Hash all files in directory
    hashguard batch <dir> --algo sha256 --output checksums.txt
    hashguard check <checksums.txt>          Verify files from checksums file

  Flags:
    --algo <algorithm>   md5, sha1, sha256, sha512
    --text               Treat input as text string
    --json               JSON output
    --output <file>      Save batch results to file

  Examples:
    hashguard hash package.json
    hashguard hash "hello world" --text --algo sha256
    hashguard verify file.txt abc123def456...
    hashguard batch ./src --algo sha256 --output checksums.txt
    hashguard check checksums.txt
`);
}

// ── Main ──

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'hash':    await cmdHash(positional, flags); break;
      case 'verify':  await cmdVerify(positional, flags); break;
      case 'compare': await cmdCompare(positional, flags); break;
      case 'batch':   await cmdBatch(positional, flags); break;
      case 'check':   await cmdCheck(positional, flags); break;
      case 'help':
      case '--help':
      case '-h':      showHelp(); break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
